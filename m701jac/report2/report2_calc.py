"""
Report 2 calculations - M701JAC compressor, 448 MW ISO rating.
Hand-checkable perfect-gas method (the class method), with every assumed value listed in ASSUMED.
Run: python3 report2_calc.py   -> prints all numbers, writes report2_results.json and fig_*.png
"""
import json, math, os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))

# ------------------------------------------------------------------ catalogue (D2)
CAT = dict(P=448.0e6, HR=8182.0, eta=0.440, PR=25.0, m_exh=765.0, T_exh=663.0 + 273.15, N=3000.0, Z=15)

# ------------------------------------------------------------------ assumed values (all listed in the report table)
ASSUMED = dict(
    T01=288.15, p01=101.325e3,            # ISO 2314 reference inlet (catalogue rating basis)
    gam=1.4, cp=1004.5, R=287.0,          # air, perfect gas (class values)
    gam_g=1.333, cp_g=1148.0,             # combustion gas, perfect gas (common practice, Saravanamuttoo)
    LHV=50.0e6,                           # natural gas taken as methane [J/kg]
    eta_gen=0.985,                        # generator + mechanical efficiency (common practice)
    dp_comb=0.04,                         # combustor total-pressure loss (common practice 3-5 %)
    p4_ratio=1.02,                        # turbine exit pressure / ambient (exhaust diffuser + duct)
    eta_pe_ref=(0.90, 0.92),              # cooled heavy-duty turbine: "as good as it can be"
    Va=170.0,                             # constant axial velocity (class rule); inlet axial Mach ~0.52
    nu1=0.50,                             # hub-to-tip ratio at first-rotor inlet
    R_reac=0.5,                           # degree of reaction (class choice: symmetric triangles)
    f_first=0.85, f_last=0.80,            # non-uniform work: stage 1 and stage 15 relative to mean
    dH_ok=0.75, dH_min=0.70,              # de Haller criteria (class notes)
    rho_b=7800.0, K_taper=0.6,            # blade steel density, taper factor (light mechanical check)
)
A = ASSUMED
g, cp, R = A['gam'], A['cp'], A['R']
k = (g - 1) / g

def T_static(T0, V): return T0 - V * V / (2 * cp)
def p_static(p0, T0, T): return p0 * (T / T0) ** (1 / k)

# ------------------------------------------------------------------ C1: air flow from the heat rate
Q = CAT['P'] * CAT['HR'] / 3600.0
m_f = Q / A['LHV']
m_a = CAT['m_exh'] - m_f
m_g = CAT['m_exh']

# ------------------------------------------------------------------ C2-C6: cycle in class notation, for a range of eta_pc
def cycle(eta_pc):
    T1 = A['T01']
    T2 = T1 * CAT['PR'] ** (k / eta_pc)
    W_C = m_a * cp * (T2 - T1)
    # combustor energy balance (reference T1): m_g cp_g (T3-T1) = m_a cp (T2-T1) + Q
    T3 = T1 + (m_a * cp * (T2 - T1) + Q) / (m_g * A['cp_g'])
    T4 = CAT['T_exh']
    W_T = m_g * A['cp_g'] * (T3 - T4)
    p3_p4 = CAT['PR'] * (1 - A['dp_comb']) / A['p4_ratio']
    kg = (A['gam_g'] - 1) / A['gam_g']
    eta_pe = math.log(T3 / T4) / (kg * math.log(p3_p4))
    eta_isc = (CAT['PR'] ** k - 1) / (CAT['PR'] ** (k / eta_pc) - 1)
    P_shaft = W_T - W_C
    return dict(eta_pc=eta_pc, T2=T2, W_C=W_C, T3=T3, W_T=W_T, eta_pe=eta_pe, eta_isc=eta_isc,
                P_shaft=P_shaft, P_needed=CAT['P'] / A['eta_gen'], bwr=W_C / W_T)

cyc = [cycle(e) for e in (0.82, 0.84, 0.86, 0.88, 0.90)]
# compressor efficiency implied by a turbine efficiency at its practical best (0.90-0.92)
def eta_pc_for(eta_pe_target):
    lo, hi = 0.70, 0.99
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if cycle(mid)['eta_pe'] > eta_pe_target: lo = mid
        else: hi = mid
    return 0.5 * (lo + hi)
eta_pc_band = [eta_pc_for(A['eta_pe_ref'][1]), eta_pc_for(A['eta_pe_ref'][0])]
ETA_PC = 0.86                                   # baseline adopted in the report (rounded, inside the band)
base = cycle(ETA_PC)

# ------------------------------------------------------------------ C7-C8: first-rotor sizing, constant Va
omega = 2 * math.pi * CAT['N'] / 60
Va = A['Va']
T1s = T_static(A['T01'], Va)                    # IGV inlet: axial flow, no whirl
p1s = p_static(A['p01'], A['T01'], T1s)
rho1 = p1s / (R * T1s)
A1 = m_a / (rho1 * Va)
rt1 = math.sqrt(A1 / (math.pi * (1 - A['nu1'] ** 2))); rh1 = A['nu1'] * rt1
rm = 0.5 * (rt1 + rh1); Dm = 2 * rm
U = omega * rm

# ------------------------------------------------------------------ stage march (all four ways)
def work_shape(Z, f1, fl):
    f = np.ones(Z)
    f[0] = f1; f[1] = 0.5 * (f1 + 1.08); f[-1] = fl; f[-2] = 0.5 * (fl + 1.05)
    mid = np.arange(2, Z - 2); f[mid] = 1.0 + 0.06 * np.sin(np.pi * (mid - 2) / (Z - 5))
    return f * Z / f.sum()

def march(eta_pc, loading='equal', annulus='const_Dm'):
    """Stage-by-stage mean-line march. loading: 'equal' | 'nonuniform'. annulus: 'const_Dm' | 'const_Dt'."""
    Z = CAT['Z']
    dT_tot = A['T01'] * (CAT['PR'] ** (k / eta_pc) - 1)
    f = np.ones(Z) if loading == 'equal' else work_shape(Z, A['f_first'], A['f_last'])
    T0, p0 = A['T01'], A['p01']
    rows = []
    for i in range(Z):
        dT = dT_tot * f[i] / Z
        dh = cp * dT
        # mean radius of this stage (rotor inlet): iterate with density
        r_m = rm
        for _ in range(30):
            Um = omega * r_m
            dVw = dh / Um
            Vw1 = (Um - dVw) / 2 if A['R_reac'] == 0.5 else Um * (1 - A['R_reac']) - dVw / 2
            Vw2 = Vw1 + dVw
            V1 = math.hypot(Va, Vw1)
            T1 = T_static(T0, V1); p1 = p_static(p0, T0, T1); rho = p1 / (R * T1)
            Ann = m_a / (rho * Va)
            if annulus == 'const_Dm':
                h = Ann / (2 * math.pi * rm); r_new = rm
            else:                                   # constant tip radius = first-rotor tip
                r_h = math.sqrt(max(rt1 ** 2 - Ann / math.pi, 0.0)); h = rt1 - r_h; r_new = 0.5 * (rt1 + r_h)
            if abs(r_new - r_m) < 1e-7: break
            r_m = r_new
        Um = omega * r_m
        W1 = math.hypot(Va, Um - Vw1); W2 = math.hypot(Va, Um - Vw2); V2 = math.hypot(Va, Vw2)
        a1 = math.sqrt(g * R * T1)
        r_t = r_m + h / 2
        # tip relative Mach number with free-vortex whirl (Vw * r = const)
        Ut = omega * r_t; Vw1t = Vw1 * r_m / r_t
        M_rel_t = math.hypot(Va, Ut - Vw1t) / a1
        T0n = T0 + dT
        pi_st = (T0n / T0) ** (eta_pc / k)
        rows.append(dict(stage=i + 1, f=f[i], dT0=dT, dh=dh, r_m=r_m, Dm=2 * r_m, U=Um, phi=Va / Um, psi=dh / Um ** 2,
                         dVw=dVw, Vw1=Vw1, Vw2=Vw2, V1=V1, V2=V2, W1=W1, W2=W2,
                         alpha1=math.degrees(math.atan(Vw1 / Va)), alpha2=math.degrees(math.atan(Vw2 / Va)),
                         beta1=math.degrees(math.atan((Um - Vw1) / Va)), beta2=math.degrees(math.atan((Um - Vw2) / Va)),
                         T0in=T0, p0in=p0, T1=T1, p1=p1, rho1=rho, h=h, Dt=2 * r_t, Dh=2 * (r_m - h / 2),
                         M1=V1 / a1, M_rel_m=W1 / a1, M_rel_t=M_rel_t, deHaller_R=W2 / W1, deHaller_S=V1 / V2, pi_st=pi_st))
        T0, p0 = T0n, p0 * pi_st
    return rows

CASES = {('equal', 'const_Dm'): 'A', ('nonuniform', 'const_Dm'): 'B', ('equal', 'const_Dt'): 'C', ('nonuniform', 'const_Dt'): 'D'}
marches = {lab: march(ETA_PC, ld, an) for (ld, an), lab in CASES.items()}

# light mechanical check: stage-1 rotor root stress
sigma1 = A['K_taper'] * A['rho_b'] * omega ** 2 * A1 / (2 * math.pi)

# ------------------------------------------------------------------ output
def r(x, n=3): return round(float(x), n)
out = dict(assumed=A, catalogue=CAT, Q=Q, m_f=m_f, m_a=m_a, cycle=cyc, eta_pc_band=eta_pc_band, eta_pc=ETA_PC, base=base,
           inlet=dict(T1s=T1s, p1s=p1s, rho1=rho1, A1=A1, Dt1=2 * rt1, Dh1=2 * rh1, Dm=Dm, U=U, M_a1=Va / math.sqrt(g * R * T1s)),
           marches=marches, sigma1=sigma1)
json.dump(out, open(os.path.join(HERE, 'report2_results.json'), 'w'), indent=1, default=float)

print(f"C1  Q={Q/1e6:.1f} MW  m_f={m_f:.2f} kg/s  m_a={m_a:.1f} kg/s")
for c in cyc:
    print(f"eta_pc={c['eta_pc']:.2f}  T2={c['T2']:.1f}  W_C={c['W_C']/1e6:.1f}  T3={c['T3']:.0f} ({c['T3']-273.15:.0f} C)  W_T={c['W_T']/1e6:.1f}  "
          f"eta_pe={c['eta_pe']:.3f}  eta_isc={c['eta_isc']:.3f}  P_shaft={c['P_shaft']/1e6:.1f} (needed {c['P_needed']/1e6:.1f})  BWR={c['bwr']:.3f}")
print(f"eta_pc band for eta_pe 0.92..0.90: {eta_pc_band[0]:.3f} .. {eta_pc_band[1]:.3f}")
i = out['inlet']
print(f"inlet: T={i['T1s']:.2f} p={i['p1s']/1e3:.2f} rho={i['rho1']:.4f} A={i['A1']:.3f} Dt={i['Dt1']:.3f} Dh={i['Dh1']:.3f} Dm={i['Dm']:.3f} U={i['U']:.2f} Ma={i['M_a1']:.3f}")
print(f"sigma1 = {sigma1/1e6:.0f} MPa")
for lab, rows in marches.items():
    dH = [min(x['deHaller_R'], x['deHaller_S']) for x in rows]
    print(f"case {lab}: psi1={rows[0]['psi']:.3f} psimax={max(x['psi'] for x in rows):.3f} min deHaller={min(dH):.3f} (stage {int(np.argmin(dH))+1}) "
          f"h1={rows[0]['h']:.3f} h15={rows[-1]['h']:.4f} Dm15={rows[-1]['Dm']:.3f} pi1={rows[0]['pi_st']:.3f} pi15={rows[-1]['pi_st']:.3f} "
          f"Mrel_t1={rows[0]['M_rel_t']:.3f} Mrel_m1={rows[0]['M_rel_m']:.3f}")
s1 = marches['A'][0]
print('stage1 A:', {kk: r(v) for kk, v in s1.items()})
print('stage15 A:', {kk: r(v) for kk, v in marches['A'][-1].items()})

# ------------------------------------------------------------------ figures
NAVY='#1f3864'; TEAL='#127a8a'; ORG='#d9822b'; RED='#c0392b'; GRY='#6b7785'; GRN='#2e8b57'
plt.rcParams.update({'font.size': 9.5, 'axes.spines.top': False, 'axes.spines.right': False, 'savefig.dpi': 220})
# Fig 1: stage-1 velocity triangles (case D, design case)
s = marches['D'][0]
fig, ax = plt.subplots(figsize=(6.4, 3.4))
U_, Va_, w1, w2 = s['U'], Va, s['Vw1'], s['Vw2']
def arrow(x0, y0, x1, y1, c, lab, off=(0, 0)):
    ax.annotate('', xy=(x1, y1), xytext=(x0, y0), arrowprops=dict(arrowstyle='-|>', color=c, lw=2, shrinkA=0, shrinkB=0))
    ax.text((x0 + x1) / 2 + off[0], (y0 + y1) / 2 + off[1], lab, color=c, fontsize=9, ha='center', va='center')
O = (0, 0)
# common apex at top, base = U along x; inlet (1) and exit (2)
arrow(0, 0, w1, -Va_, NAVY, f'$V_1$={s["V1"]:.0f}', (34, 6))
arrow(0, 0, w2, -Va_, NAVY, f'$V_2$={s["V2"]:.0f}', (28, 14))
arrow(0, 0, -(U_ - w1), -Va_, ORG, f'$W_1$={s["W1"]:.0f}', (-30, 8))
arrow(0, 0, -(U_ - w2), -Va_, ORG, f'$W_2$={s["W2"]:.0f}', (-34, 6))
ax.plot([-(U_ - w1), w1], [-Va_, -Va_], color=GRY, lw=1)
ax.text((w1 - (U_ - w1)) / 2, -Va_ - 14, f'U = {U_:.1f} m/s', ha='center', color=GRY)
ax.plot([w1, w2], [-Va_ - 30, -Va_ - 30], color=RED, lw=1.5); ax.plot([w1, w1], [-Va_, -Va_ - 34], ':', color=RED, lw=0.8); ax.plot([w2, w2], [-Va_, -Va_ - 34], ':', color=RED, lw=0.8); ax.text((w1 + w2) / 2, -Va_ - 42, f'ΔV$_w$ = {s["dVw"]:.1f}', ha='center', color=RED, fontsize=8.5)
ax.plot([0, 0], [0, -Va_], ':', color=GRY); ax.text(0, 10, f'$V_a$ = {Va_:.0f} m/s (axial)', color=GRY, fontsize=8.5, ha='center')
ax.set_aspect('equal'); ax.axis('off')
ax.set_title(f'Stage 1, mean radius (design case D): α₁=β₂={s["alpha1"]:.1f}°, α₂=β₁={s["alpha2"]:.1f}°, de Haller {s["deHaller_R"]:.3f}', fontsize=9, color=NAVY)
fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig1_triangles.png')); plt.close(fig)
# Fig 2: four cases - de Haller and stage pressure ratio
fig, axs = plt.subplots(1, 2, figsize=(9.2, 3.3))
sty = {'A': (NAVY, '-', 'o'), 'B': (RED, '--', 's'), 'C': (TEAL, '-', '^'), 'D': (ORG, '-', 'D')}
names = {'A': 'A: equal work, const. $D_m$', 'B': 'B: non-uniform, const. $D_m$', 'C': 'C: equal work, const. $D_t$', 'D': 'D: non-uniform, const. $D_t$'}
st = np.arange(1, 16)
for lab, rows in marches.items():
    c, ls, mk = sty[lab]
    axs[0].plot(st, [min(x['deHaller_R'], x['deHaller_S']) for x in rows], ls, color=c, marker=mk, ms=3.5, lw=1.6, label=names[lab])
    axs[1].plot(st, [x['pi_st'] for x in rows], ls, color=c, marker=mk, ms=3.5, lw=1.6, label=names[lab])
axs[0].axhspan(0.60, A['dH_min'], color=RED, alpha=0.08); axs[0].axhline(A['dH_min'], color=RED, lw=1); axs[0].axhline(A['dH_ok'], color=GRN, lw=1)
axs[0].text(15.3, A['dH_ok'], '0.75', color=GRN, fontsize=8, va='center'); axs[0].text(15.3, A['dH_min'], '0.70', color=RED, fontsize=8, va='center')
axs[0].set_ylim(0.68, 0.82); axs[0].set_xlabel('stage'); axs[0].set_ylabel('de Haller number (min of rotor, stator)'); axs[0].set_xticks(st)
axs[1].set_xlabel('stage'); axs[1].set_ylabel('stage total-pressure ratio'); axs[1].set_xticks(st); axs[1].legend(fontsize=7.5, frameon=False)
fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig2_cases.png')); plt.close(fig)
# Fig 3: meridional annulus for const Dm (A) and const Dt (D)
fig, ax = plt.subplots(figsize=(7.0, 2.8))
for lab, c in (('A', NAVY), ('D', ORG)):
    rows = marches[lab]; x = np.arange(1, 16)
    ax.plot(x, [r_['Dt'] / 2 for r_ in rows], '-', color=c, lw=2, label=names[lab].split(',')[0][:1] + ': ' + ('constant mean diameter' if lab == 'A' else 'constant tip diameter'))
    ax.plot(x, [r_['Dh'] / 2 for r_ in rows], '-', color=c, lw=2)
    ax.plot(x, [r_['r_m'] for r_ in rows], ':', color=c, lw=1)
ax.set_xlabel('stage (rotor inlet)'); ax.set_ylabel('radius [m]'); ax.set_xticks(np.arange(1, 16)); ax.set_ylim(0.5, 1.62)
ax.legend(fontsize=8, frameon=False, loc='upper center', ncol=2); ax.set_title('Hub and tip radii (solid) and mean radius (dotted)', fontsize=9, color=GRY)
fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig3_annulus.png')); plt.close(fig)
print('case D table')
for x in marches['D']:
    print(f"{x['stage']:2d} f={x['f']:.3f} dT0={x['dT0']:.2f} pi={x['pi_st']:.3f} p0out={x['p0in']*x['pi_st']/1e5:.2f} Dm={x['Dm']:.3f} h={x['h']*1000:.0f}mm U={x['U']:.1f} psi={x['psi']:.3f} phi={x['phi']:.3f} a1={x['alpha1']:.1f} a2={x['alpha2']:.1f} Mrt={x['M_rel_t']:.3f} Mrm={x['M_rel_m']:.3f} dH={min(x['deHaller_R'],x['deHaller_S']):.3f} T0out={x['T0in']+x['dT0']:.1f}")
