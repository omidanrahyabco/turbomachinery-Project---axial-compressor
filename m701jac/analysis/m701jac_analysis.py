"""
M701JAC compressor - catalogue-based analysis with traceable inputs and explicit uncertainty.

Every input is tagged with its origin:
  [CAT]  published by the manufacturer (MHI GTCC catalogue 2026, document D2)
  [DOC]  stated in an MHI Technical Review (D3-D8)
  [STD]  physical / ISO standard value (not an assumption)
  [RNG]  not published - treated as a RANGE with a stated literature basis, never a single number

Outputs are reported as the median and 5-95 % band of a Monte Carlo sample over the [RNG] inputs,
so it is visible which results are fixed by data and which are dominated by assumptions.

Thermodynamic properties: Cantera (GRI-Mech 3.0 species thermo, ideal-gas mixtures, variable cp).
Run:  python3 m701jac_analysis.py      (writes results.json, results_tables.md and fig_*.png here)
"""
import json, math, os
import numpy as np
import cantera as ct
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
GAS = ct.Solution('gri30.yaml')
RNG = np.random.default_rng(1405)

# ----------------------------------------------------------------------------- inputs
ISO = dict(T=288.15, p=101325.0, RH=0.60)                     # [STD] ISO 2314 / catalogue note (1)
N_RPM = 3000.0                                                # [CAT] 50 Hz, direct drive
N_STAGES = 15                                                 # [CAT]/[DOC] D2, D5, D6
RATINGS = {                                                   # [CAT] D2 performance table, p. 21-22
    'M701JAC_448': dict(P=448.0e6, HR=8182.0, eta=0.440, PR=25.0, PR_note='25',  m_exh=765.0,  T_exh=663.0),
    'M701JAC_574': dict(P=574.0e6, HR=8295.0, eta=0.434, PR=25.0, PR_note='>25 (25 used as lower bound)', m_exh=1024.0, T_exh=646.0),
}
CONTEXT = {                                                   # [CAT] other catalogue machines, for comparison
    'M701DA':  dict(P=144.09e6, PR=14.0, m_exh=453.0,  T_exh=542.0, N=3000, eta=0.348),
    'M701F':   dict(P=385.0e6,  PR=21.0, m_exh=748.0,  T_exh=630.0, N=3000, eta=0.419),
    'M501GAC': dict(P=283.0e6,  PR=20.0, m_exh=618.0,  T_exh=617.0, N=3600, eta=0.400),
    'M501JAC': dict(P=453.0e6,  PR=25.0, m_exh=815.0,  T_exh=649.0, N=3600, eta=0.440),
    'M701JAC 448': dict(P=448.0e6, PR=25.0, m_exh=765.0, T_exh=663.0, N=3000, eta=0.440),
    'M701JAC 574': dict(P=574.0e6, PR=25.0, m_exh=1024.0, T_exh=646.0, N=3000, eta=0.434),
}
# [RNG] ranges - each with its basis (see ASSUMPTIONS_AUDIT.md)
RANGES = {
    'eta_p':  (0.86, 0.91, 'whole-machine polytropic efficiency (inlet to diffuser exit, incl. transonic front stages, bleeds, clearances); not published by MHI. Lowered after the supervisor review; checked against the cycle in section 5'),
    'LHV':    (46.0e6, 50.0e6, 'natural-gas LHV [J/kg]; fuel composition not stated (pure CH4 = 50.0 MJ/kg)'),
    'Mx_in':  (0.45, 0.60, 'axial Mach number at first-rotor inlet; typical large industrial range'),
    'nu_in':  (0.40, 0.55, 'hub-to-tip radius ratio at first rotor; typical heavy-duty range'),
    'Mx_out': (0.25, 0.35, 'axial Mach number at compressor exit (ahead of diffuser)'),
    'K':      (0.55, 0.70, 'blade taper factor for root centrifugal stress (constant section = 1.0)'),
    # stage work distribution (section 6) - shape factors relative to the mean stage work
    'f_first': (0.75, 0.95, 'work of stage 1 / mean: limited by transonic tip Mach, IGV, start-up surge margin'),
    'f_last':  (0.70, 0.90, 'work of stage 15 / mean: thick end-wall boundary layers, large relative clearance, axial exit flow'),
    'deta_front': (0.01, 0.04, 'stage-1 polytropic efficiency deficit (shock losses) vs mid stages'),
    'deta_rear':  (0.01, 0.03, 'last-stage efficiency deficit (end-wall and clearance losses) vs mid stages'),
}
CYCLE = {   # used only in the cycle cross-check of section 5 (indicative)
    'TIT': (1873.15, 1973.15, 'combustor-exit temperature, "1650 degC class" (D3, D4) +- 50 K'),
    'dp_comb': (0.03, 0.05, 'combustor total-pressure loss fraction'),
    'p_back': (1.00, 1.03, 'turbine exit static pressure / ambient (exhaust diffuser + duct)'),
}
RHO_BLADE = 7800.0   # [RNG-fixed] steel; titanium would give x0.58 stress - reported separately

# ----------------------------------------------------------------------------- property helpers
def psat_water(T):
    """Saturation pressure of water [Pa], Magnus-Tetens (adequate at 15 degC, error < 0.2 %)."""
    tc = T - 273.15
    return 610.94 * math.exp(17.625 * tc / (tc + 243.04))

def humid_air_X():
    xw = ISO['RH'] * psat_water(ISO['T']) / ISO['p']
    dry = {'N2': 0.78084, 'O2': 0.20946, 'AR': 0.00934, 'CO2': 0.00036}
    X = {k: v * (1 - xw) for k, v in dry.items()}
    X['H2O'] = xw
    return X

AIR_X = humid_air_X()

def set_air(T, p):
    GAS.TPX = T, p, AIR_X
    return GAS

def lhv_methane(Tref=288.15):
    """LHV of CH4 at Tref with water as vapour [J/kg fuel]."""
    GAS.TPX = Tref, ct.one_atm, {'CH4': 1, 'O2': 2}
    h_r = GAS.enthalpy_mass * GAS.mean_molecular_weight  # J/kmol mixture
    nr = 3.0
    GAS.TPX = Tref, ct.one_atm, {'CO2': 1, 'H2O': 2}
    h_p = GAS.enthalpy_mass * GAS.mean_molecular_weight
    npd = 3.0
    q = (h_r * nr - h_p * npd)           # J per kmol CH4
    return q / 16.043

def products_X(far):
    """Complete combustion of CH4 in humid air at fuel/air mass ratio far -> mole fractions."""
    set_air(ISO['T'], ISO['p'])
    Ma = GAS.mean_molecular_weight
    n_air = 1.0 / Ma                     # kmol air per kg air
    n_f = far / 16.043                   # kmol CH4 per kg air
    comp = {k: v * n_air for k, v in AIR_X.items()}
    comp['O2'] -= 2 * n_f
    comp['CO2'] += n_f
    comp['H2O'] += 2 * n_f
    tot = sum(comp.values())
    return {k: v / tot for k, v in comp.items()}

def _s_T(T, X, pref=ISO['p']):
    """Temperature part of the ideal-gas entropy at a fixed reference pressure [J/kg K]."""
    GAS.TPX = T, pref, X
    return GAS.entropy_mass

def _R(X):
    GAS.TPX = 300.0, ISO['p'], X
    return ct.gas_constant / GAS.mean_molecular_weight

def polytropic_T(T_in, ln_pr, eta, X, compress=True):
    """Exact ideal-gas polytropic end temperature: s_T(T_out) - s_T(T_in) = (R/eta) ln(PR) for compression,
    = eta R ln(PR) for expansion (ln_pr < 0). Solved by bisection on T."""
    R = _R(X); s_in = _s_T(T_in, X)
    target = s_in + (R / eta if compress else R * eta) * ln_pr
    lo, hi = (T_in, T_in * 4.0) if ln_pr > 0 else (T_in * 0.2, T_in)
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if _s_T(mid, X) < target: lo = mid
        else: hi = mid
    return 0.5 * (lo + hi)

def polytropic_compression(PR, eta_p, n=None):
    """Humid-air compression from the ISO total state. Returns T02, dh, eta_c (total-to-total), T02s."""
    T02 = polytropic_T(ISO['T'], math.log(PR), eta_p, AIR_X)
    T02s = polytropic_T(ISO['T'], math.log(PR), 1.0, AIR_X)
    h1 = set_air(ISO['T'], ISO['p']).enthalpy_mass
    h2 = set_air(T02, ISO['p'] * PR).enthalpy_mass
    h2s = set_air(T02s, ISO['p'] * PR).enthalpy_mass
    return T02, h2 - h1, (h2s - h1) / (h2 - h1), T02s

def static_from_total_mach(T0, p0, M):
    """Static T, p, rho, speed of sound for given Mach (uses local gamma, 3 iterations)."""
    g = set_air(T0, p0)
    gam = g.cp / g.cv
    for _ in range(3):
        T = T0 / (1 + 0.5 * (gam - 1) * M * M)
        p = p0 * (T / T0) ** (gam / (gam - 1))
        g = set_air(T, p); gam = g.cp / g.cv
    a = math.sqrt(gam * ct.gas_constant / g.mean_molecular_weight * T)
    return T, p, g.density, a

# ----------------------------------------------------------------------------- 1. data checks
def energy_balance(r, LHV):
    """Overall GT energy balance from catalogue data alone (fuel = CH4 of given LHV)."""
    Q = r['P'] * r['HR'] / 3600.0          # heat input [W] from heat rate [kJ/kWh]
    mf = Q / LHV
    ma = r['m_exh'] - mf
    far = mf / ma
    # enthalpy flux of exhaust relative to the same products at 15 degC (sensible part)
    X = products_X(far)
    GAS.TPX = r['T_exh'] + 273.15, ISO['p'], X; h_e = GAS.enthalpy_mass
    GAS.TPX = ISO['T'], ISO['p'], X; h_0 = GAS.enthalpy_mass
    sens = r['m_exh'] * (h_e - h_0)
    resid = Q - r['P'] - sens               # heat leaving other than via exhaust + generator
    return dict(Q=Q, mf=mf, ma=ma, far=far, exhaust_sensible=sens, residual=resid,
                residual_pct_of_Q=100 * resid / Q, eta_check=3600.0 / r['HR'])

# ----------------------------------------------------------------------------- 2. Monte Carlo
def sample(nsamp=4000):
    return {k: RNG.uniform(lo, hi, nsamp) for k, (lo, hi, _) in RANGES.items()}

def evaluate(r, s):
    out = {k: [] for k in ('ma', 'T02', 'dh', 'eta_c', 'W_c', 'A_in', 'D_tip', 'D_hub', 'U_tip', 'U_mean',
                           'M_rel_tip', 'A_out', 'area_ratio', 'sigma_root', 'dT0_stage_mean', 'psi_mean')}
    cache = {}
    omega = 2 * math.pi * N_RPM / 60.0
    for i in range(len(s['eta_p'])):
        ep = s['eta_p'][i]
        key = round(ep, 4)
        if key not in cache:
            cache[key] = polytropic_compression(r['PR'], key, n=120)
        T02, dh, eta_c, _ = cache[key]
        Q = r['P'] * r['HR'] / 3600.0
        ma = r['m_exh'] - Q / s['LHV'][i]
        W = ma * dh                                    # full-delivery power (upper bound, no bleed credit)
        # inlet annulus
        T1, p1, rho1, a1 = static_from_total_mach(ISO['T'], ISO['p'], s['Mx_in'][i])
        cx = s['Mx_in'][i] * a1
        A = ma / (rho1 * cx)
        nu = s['nu_in'][i]
        rt = math.sqrt(A / (math.pi * (1 - nu * nu))); rh = nu * rt
        Ut = omega * rt; Um = omega * 0.5 * (rt + rh)
        Mrel = math.hypot(cx, Ut) / a1                 # no IGV pre-swirl at design (IGV open)
        # exit annulus
        g = set_air(ISO['T'], ISO['p']); s1 = g.entropy_mass
        T2s, p2s, rho2, a2 = static_from_total_mach(T02, ISO['p'] * r['PR'], s['Mx_out'][i])
        A2 = ma / (rho2 * s['Mx_out'][i] * a2)
        sig = s['K'][i] * RHO_BLADE * omega ** 2 * A / (2 * math.pi)
        out['ma'].append(ma); out['T02'].append(T02); out['dh'].append(dh); out['eta_c'].append(eta_c)
        out['W_c'].append(W); out['A_in'].append(A); out['D_tip'].append(2 * rt); out['D_hub'].append(2 * rh)
        out['U_tip'].append(Ut); out['U_mean'].append(Um); out['M_rel_tip'].append(Mrel)
        out['A_out'].append(A2); out['area_ratio'].append(A2 / A); out['sigma_root'].append(sig)
        out['dT0_stage_mean'].append((T02 - ISO['T']) / N_STAGES)
        out['psi_mean'].append((dh / N_STAGES) / Um ** 2)
    return {k: np.array(v) for k, v in out.items()}

def band(x):
    return [float(np.percentile(x, 5)), float(np.percentile(x, 50)), float(np.percentile(x, 95))]

# ----------------------------------------------------------------------------- 3. scaling check
def scaling_table():
    rows = []
    ref = CONTEXT['M501JAC']
    for nm, c in CONTEXT.items():
        rows.append(dict(model=nm, N=c['N'], PR=c['PR'], P_MW=c['P'] / 1e6, m_exh=c['m_exh'],
                         spec_work_kJkg=c['P'] / c['m_exh'] / 1e3, eta=c['eta']))
    # documented similarity rule (D5): 60 Hz -> 50 Hz with scale 3600/3000 = 1.2, flow x 1.44
    expected_50Hz_flow = ref['m_exh'] * 1.44
    implied = {nm: math.sqrt(CONTEXT[nm]['m_exh'] / ref['m_exh']) for nm in ('M701JAC 448', 'M701JAC 574')}
    return rows, expected_50Hz_flow, implied

# ----------------------------------------------------------------------------- 5. cycle cross-check of eta_p
def h_methane(T=288.15):
    GAS.TPX = T, ISO['p'], {'CH4': 1.0}
    return GAS.enthalpy_mass

def cycle_check(r, eta_p, TIT, dp_comb, p_back, bleed=0.0):
    """Given a compressor efficiency, what turbine efficiency and cooling fraction does the catalogue imply?
    Model: fuel CH4 (Q from heat rate), all non-combustor air extracted at compressor delivery and mixed
    back before an 'equivalent uncooled' turbine expansion that must end at the catalogue exhaust temperature."""
    lhv = lhv_methane()
    Q = r['P'] * r['HR'] / 3600.0; mf = Q / lhv; ma = r['m_exh'] - mf
    T02, dh, _, _ = polytropic_compression(r['PR'], eta_p, n=200)
    g = set_air(T02, ISO['p'] * r['PR']); h2 = g.enthalpy_mass
    hf = h_methane()
    # combustor air flow so that the combustor exit reaches TIT
    def exit_T(mc):
        far = mf / mc; X = products_X(far)
        GAS.TPX = 1500.0, ISO['p'] * r['PR'], X
        GAS.HP = (mc * h2 + mf * hf) / (mc + mf), ISO['p'] * r['PR']
        return GAS.T
    lo, hi = 0.3 * ma, ma
    if exit_T(hi) > TIT:
        mc = hi
    else:
        for _ in range(50):
            mid = 0.5 * (lo + hi)
            if exit_T(mid) > TIT: lo = mid
            else: hi = mid
        mc = 0.5 * (lo + hi)
    delta = 1 - mc / ma
    # mixed turbine inlet state
    X = products_X(mf / ma); p3 = ISO['p'] * r['PR'] * (1 - dp_comb)
    GAS.TPX = 1500.0, p3, X; GAS.HP = (ma * h2 + mf * hf) / (ma + mf), p3
    # intermediate-stage bleed (vanes 2-4 cooling, D2) leaves at roughly half the compression work
    GAS.TPX = 1500.0, p3, X
    GAS.HP = (ma * h2 - bleed * ma * 0.5 * dh + mf * hf) / (ma + mf), p3
    Tmix, hmix = GAS.T, GAS.enthalpy_mass
    pe = ISO['p'] * p_back
    GAS.TPX = r['T_exh'] + 273.15, pe, X; he = GAS.enthalpy_mass
    # equivalent turbine polytropic efficiency that ends exactly at the catalogue exhaust temperature
    R = _R(X); ln_pr = math.log(pe / p3)
    eta_t = (_s_T(r['T_exh'] + 273.15, X) - _s_T(Tmix, X)) / (R * ln_pr)
    return dict(eta_t=eta_t, delta=delta, T02=T02, Tmix=Tmix)

# ----------------------------------------------------------------------------- 6. stage work distribution
def work_shape(f1, fl, n=N_STAGES):
    """Relative stage work: reduced first stage, plateau in the middle, reduced last stages; mean = 1."""
    f = np.ones(n)
    f[0] = f1; f[1] = 0.5 * (f1 + 1.08)
    f[-1] = fl; f[-2] = 0.5 * (fl + 1.05)
    mid = np.arange(2, n - 2)
    f[mid] = 1.0 + 0.06 * np.sin(np.pi * (mid - 2) / (n - 5))      # gentle hump (work-done-factor compensation)
    return f * n / f.sum()

def stage_march(dh_tot, f, eta_stage):
    """March through the stages: stage work dh_i = f_i * dh_tot / N, stage polytropic efficiency eta_i.
    Exact ideal-gas relation per stage: ln(pi_i) = eta_i [s_T(T_out) - s_T(T_in)] / R."""
    R = _R(AIR_X)
    g = set_air(ISO['T'], ISO['p']); h = g.enthalpy_mass; p = ISO['p']; T = ISO['T']
    T0, P0, PR = [T], [p], []
    for i in range(len(f)):
        h_out = h + dh_tot * f[i] / len(f)
        g.HP = h_out, p; T_out = g.T                    # enthalpy is pressure-independent (ideal gas)
        pi = math.exp(eta_stage[i] * (_s_T(T_out, AIR_X) - _s_T(T, AIR_X)) / R)
        p *= pi; h = h_out; T = T_out
        T0.append(T); P0.append(p); PR.append(pi)
    return np.array(T0), np.array(P0), np.array(PR)

def stage_distribution(r, eta_p, f1, fl, de_f, de_r):
    T02, dh, _, _ = polytropic_compression(r['PR'], eta_p, n=200)
    f = work_shape(f1, fl)
    # choose the mid-stage efficiency so that the overall PR is reproduced
    lo, hi = eta_p - 0.02, eta_p + 0.08
    for _ in range(30):
        em = 0.5 * (lo + hi)
        e = np.full(N_STAGES, em); e[0] -= de_f; e[1] -= 0.5 * de_f; e[-1] -= de_r
        _, P0, _ = stage_march(dh, f, e)
        if P0[-1] / ISO['p'] < r['PR']: lo = em
        else: hi = em
    T0, P0, PR = stage_march(dh, f, e)
    return dict(f=f, eta=e, T0=T0, p0=P0, PR=PR, dT0=np.diff(T0))

# ----------------------------------------------------------------------------- main
def main():
    res = dict(inputs=dict(ISO=ISO, N_rpm=N_RPM, stages=N_STAGES, ratings=RATINGS,
                           ranges={k: dict(lo=v[0], hi=v[1], basis=v[2]) for k, v in RANGES.items()},
                           rho_blade=RHO_BLADE, air_mole_fractions=AIR_X))
    lhv = lhv_methane()
    res['LHV_CH4_15C_MJkg'] = lhv / 1e6
    res['energy_balance'] = {}
    for nm, r in RATINGS.items():
        res['energy_balance'][nm] = {f'LHV_{int(L / 1e6)}': energy_balance(r, L) for L in (lhv, 46.0e6)}
    # efficiency sweep (deterministic, for the figure)
    sweep = {}
    for ep in np.round(np.arange(0.85, 0.9401, 0.005), 3):
        T02, dh, eta_c, T02s = polytropic_compression(25.0, float(ep))
        sweep[float(ep)] = dict(T02=T02, dh=dh, eta_c=eta_c, T02s=T02s)
    res['eta_p_sweep_PR25'] = sweep
    # Monte Carlo
    s = sample()
    res['monte_carlo'] = {}
    for nm, r in RATINGS.items():
        o = evaluate(r, s)
        res['monte_carlo'][nm] = {k: band(v) for k, v in o.items()}
        res['monte_carlo'][nm]['fraction_transonic_tip'] = float(np.mean(o['M_rel_tip'] > 1.0))
        # rank-correlation of each output with each input (which assumption drives which result)
        sens = {}
        for ok in ('T02', 'W_c', 'D_tip', 'M_rel_tip', 'area_ratio', 'sigma_root', 'ma'):
            sens[ok] = {ik: float(np.corrcoef(np.argsort(np.argsort(s[ik])), np.argsort(np.argsort(o[ok])))[0, 1])
                        for ik in RANGES}
        res['monte_carlo'][nm]['rank_correlation'] = sens
        if nm == 'M701JAC_448':
            mc448 = (s, o)
    # cycle cross-check: implied turbine efficiency and cooling fraction for each compressor efficiency
    cyc = {}
    for nm, r in RATINGS.items():
        cyc[nm] = {}
        for ep in (0.86, 0.88, 0.90, 0.92):
            vals = [cycle_check(r, ep, TIT, dpc, pb, bl) for TIT in (1873.15, 1973.15) for dpc in (0.03, 0.05) for pb in (1.00, 1.03) for bl in (0.0, 0.05, 0.10)]
            et = np.array([v['eta_t'] for v in vals]); de = np.array([v['delta'] for v in vals])
            cyc[nm][ep] = dict(eta_t=[float(et.min()), float(np.median(et)), float(et.max())],
                               delta=[float(de.min()), float(np.median(de)), float(de.max())], T02=vals[0]['T02'])
    res['cycle_check'] = cyc
    # stage distribution: three cases + Monte Carlo band (448 MW rating)
    r = RATINGS['M701JAC_448']
    T02, dh, _, _ = polytropic_compression(25.0, 0.885, n=200)
    eq_pr = stage_march(dh, np.ones(N_STAGES), np.full(N_STAGES, 0.885))   # equal work, equal eta
    pr_eq = np.full(N_STAGES, 25.0 ** (1 / N_STAGES))
    mc_st = [stage_distribution(r, s['eta_p'][i], s['f_first'][i], s['f_last'][i], s['deta_front'][i], s['deta_rear'][i]) for i in range(300)]
    PRs = np.array([m['PR'] for m in mc_st]); dTs = np.array([m['dT0'] for m in mc_st])
    res['stages'] = dict(equal_PR=pr_eq.tolist(), equal_work_PR=eq_pr[2].tolist(), equal_work_dT0=np.diff(eq_pr[0]).tolist(),
                         realistic_PR=[band(PRs[:, i]) for i in range(N_STAGES)],
                         realistic_dT0=[band(dTs[:, i]) for i in range(N_STAGES)],
                         realistic_T0_exit=[band(np.array([m['T0'][i + 1] for m in mc_st])) for i in range(N_STAGES)],
                         realistic_p0_exit_bar=[band(np.array([m['p0'][i + 1] for m in mc_st]) / 1e5) for i in range(N_STAGES)])
    rows, exp_flow, implied = scaling_table()
    res['scaling'] = dict(table=rows, M501JAC_x1p44_flow=exp_flow, implied_linear_scale_vs_M501JAC=implied,
                          documented_scale=1.2)
    json.dump(res, open(os.path.join(HERE, 'results.json'), 'w'), indent=1, default=float)
    write_tables(res)
    figures(res, mc448)
    figures_extra(res)
    print(open(os.path.join(HERE, 'results_tables.md')).read())

def fmt(b, scale=1.0, nd=1):
    lo, md, hi = (v * scale for v in b)
    return f"{md:.{nd}f} ({lo:.{nd}f}–{hi:.{nd}f})"

def write_tables(res):
    L = []
    L.append('# M701JAC compressor — generated results\n')
    L.append('Generated by `m701jac_analysis.py`. Values are median (5–95 % band) over the ranges in `ASSUMPTIONS_AUDIT.md`.\n')
    L.append(f"LHV of methane at 15 °C (Cantera): **{res['LHV_CH4_15C_MJkg']:.2f} MJ/kg**\n")
    L.append('## 1. Catalogue consistency check (overall energy balance)\n')
    L.append('| Rating | Heat input Q | Fuel flow | Inlet air flow | Exhaust sensible heat | Residual (Q − P − exhaust) |')
    L.append('|---|---|---|---|---|---|')
    for nm, d in res['energy_balance'].items():
        for lk, e in d.items():
            L.append(f"| {nm} ({lk.replace('_', ' ')} MJ/kg) | {e['Q'] / 1e6:.0f} MW | {e['mf']:.1f} kg/s | {e['ma']:.1f} kg/s | "
                     f"{e['exhaust_sensible'] / 1e6:.0f} MW | {e['residual'] / 1e6:+.1f} MW ({e['residual_pct_of_Q']:+.1f} % of Q) |")
    L.append('\nA small positive residual is expected: generator and mechanical losses, casing heat loss and the heat rejected '
             'by the external cooler of the enhanced air-cooling system (D2, D4) leave the gas turbine other than through the exhaust.\n')
    L.append('## 2. Compressor results (Monte Carlo)\n')
    lab = [('ma', 'Inlet air flow [kg/s]', 1, 1), ('T02', 'Delivery total temperature [K]', 1, 0),
           ('eta_c', 'Isentropic efficiency (t-t) [–]', 1, 3), ('W_c', 'Shaft power, full delivery flow [MW]', 1e-6, 0),
           ('dT0_stage_mean', 'Mean stage ΔT₀ [K]', 1, 1), ('A_in', 'Inlet annulus area [m²]', 1, 2),
           ('D_tip', 'First-rotor tip diameter [m]', 1, 2), ('D_hub', 'First-rotor hub diameter [m]', 1, 2),
           ('U_tip', 'First-rotor tip speed [m/s]', 1, 0), ('M_rel_tip', 'Relative tip Mach number [–]', 1, 2),
           ('psi_mean', 'Mean loading ψ at inlet mean radius [–]', 1, 2),
           ('A_out', 'Exit annulus area [m²]', 1, 2), ('area_ratio', 'A_out / A_in [–]', 1, 3),
           ('sigma_root', 'First-rotor root stress, steel [MPa]', 1e-6, 0)]
    L.append('| Quantity | M701JAC 448 MW | M701JAC 574 MW |')
    L.append('|---|---|---|')
    for k, name, sc, nd in lab:
        a = res['monte_carlo']['M701JAC_448'][k]; b = res['monte_carlo']['M701JAC_574'][k]
        L.append(f'| {name} | {fmt(a, sc, nd)} | {fmt(b, sc, nd)} |')
    for nm in ('M701JAC_448', 'M701JAC_574'):
        L.append(f"\nShare of samples with a transonic first-rotor tip (M_rel > 1), {nm}: "
                 f"**{100 * res['monte_carlo'][nm]['fraction_transonic_tip']:.0f} %** (D6 states the front stages are transonic).")
    L.append('\n## 3. Which assumption drives which result (Spearman rank correlation, 448 MW rating)\n')
    sens = res['monte_carlo']['M701JAC_448']['rank_correlation']
    ins = list(RANGES)
    L.append('| Output | ' + ' | '.join(ins) + ' |')
    L.append('|---|' + '---|' * len(ins))
    for ok, d in sens.items():
        L.append(f'| {ok} | ' + ' | '.join(f"{d[i]:+.2f}" for i in ins) + ' |')
    L.append('\n## 4. Scaling check against the documented 60 Hz → 50 Hz rule (D5)\n')
    sc = res['scaling']
    L.append('| Model | Speed [rpm] | PR | Output [MW] | Exhaust flow [kg/s] | Specific output [kJ/kg] | η |')
    L.append('|---|---|---|---|---|---|---|')
    for r in sc['table']:
        L.append(f"| {r['model']} | {r['N']:.0f} | {r['PR']:.0f} | {r['P_MW']:.0f} | {r['m_exh']:.0f} | {r['spec_work_kJkg']:.0f} | {r['eta']:.3f} |")
    L.append(f"\nA 1.2× geometric scale of the current M501JAC (815 kg/s) would pass **{sc['M501JAC_x1p44_flow']:.0f} kg/s** at 3000 rpm. "
             f"The implied linear scale of the two M701JAC ratings relative to the M501JAC (equal flow per unit area) is "
             f"**{sc['implied_linear_scale_vs_M501JAC']['M701JAC 448']:.3f}** (448 MW) and "
             f"**{sc['implied_linear_scale_vs_M501JAC']['M701JAC 574']:.3f}** (574 MW), not 1.2.\n")
    L.append('\n## 5. Cycle cross-check of the compressor efficiency (indicative)\n')
    L.append('For each assumed compressor polytropic efficiency, the catalogue (PR, heat rate, exhaust flow and temperature) and a combustor-exit '
             'temperature of 1600–1700 °C imply an equivalent (cooling-mixed) turbine polytropic efficiency and a fraction of compressor air '
             'that bypasses the combustor (turbine cooling, leakages). Ranges cover TIT ±50 K, combustor loss 3–5 %, exhaust back-pressure 0–3 % and 0–10 % intermediate-stage bleed (vane 2–4 cooling, D2).\n')
    L.append('| Rating | Compressor η_p | T02 [K] | Implied turbine η_p (min / median / max) | Implied bypass/cooling air fraction |')
    L.append('|---|---|---|---|---|')
    for nm, d in res['cycle_check'].items():
        for ep, v in d.items():
            L.append(f"| {nm} | {ep:.2f} | {v['T02']:.0f} | {v['eta_t'][0]:.3f} / {v['eta_t'][1]:.3f} / {v['eta_t'][2]:.3f} | "
                     f"{100 * v['delta'][0]:.0f}–{100 * v['delta'][2]:.0f} % |")
    L.append('\n## 6. Stage-by-stage distribution (448 MW rating)\n')
    st = res['stages']
    L.append('| Stage | Equal PR (Phase 1 / dossier) | Equal work: π_st | Realistic distribution: π_st | Realistic ΔT₀ [K] | Exit T₀ [K] | Exit p₀ [bar] |')
    L.append('|---|---|---|---|---|---|---|')
    for i in range(N_STAGES):
        L.append(f"| {i + 1} | {st['equal_PR'][i]:.3f} | {st['equal_work_PR'][i]:.3f} | {fmt(st['realistic_PR'][i], 1, 3)} | "
                 f"{fmt(st['realistic_dT0'][i], 1, 1)} | {fmt(st['realistic_T0_exit'][i], 1, 0)} | {fmt(st['realistic_p0_exit_bar'][i], 1, 2)} |")
    open(os.path.join(HERE, 'results_tables.md'), 'w').write('\n'.join(L) + '\n')

def figures(res, mc):
    NAVY = '#1f3864'; TEAL = '#127a8a'; ORG = '#d9822b'; RED = '#c0392b'; GRY = '#6b7785'
    plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False, 'savefig.dpi': 200})
    # Fig A: delivery temperature and specific work vs eta_p
    sw = res['eta_p_sweep_PR25']; ep = np.array(sorted(sw)); T = np.array([sw[e]['T02'] for e in ep]); dh = np.array([sw[e]['dh'] for e in ep])
    ma = res['energy_balance']['M701JAC_448']['LHV_50']['ma']
    fig, ax = plt.subplots(figsize=(6.6, 3.8))
    ax.axvspan(*RANGES['eta_p'][:2], color=TEAL, alpha=0.10, label=f"range used ({RANGES['eta_p'][0]:.2f}–{RANGES['eta_p'][1]:.2f})")
    ax.plot(ep, T - 273.15, color=NAVY, lw=2.2, label='delivery temperature (real gas)')
    ax.axvline(0.90, color=GRY, ls=':', lw=1); ax.text(0.9008, T.max() - 273.15 - 8, 'Phase 1 / dossier\nfixed value 0.90', fontsize=8, color=GRY)
    ax.set_xlabel('compressor polytropic efficiency η$_p$ (not published)'); ax.set_ylabel('T$_{02}$ [°C]', color=NAVY)
    ax2 = ax.twinx(); ax2.spines['right'].set_visible(True)
    ax2.plot(ep, ma * dh / 1e6, color=ORG, lw=2.2, ls='--', label='shaft power, 448 MW rating')
    ax2.set_ylabel('compressor power [MW]', color=ORG)
    h1, l1 = ax.get_legend_handles_labels(); h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(h1 + h2, l1 + l2, fontsize=8, loc='lower left', frameon=False)
    ax.set_title('PR = 25, ISO humid air, variable c$_p$', fontsize=9, color=GRY)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig_A_eta_sweep.png')); plt.close(fig)
    # Fig B: feasibility map Mx vs nu (448 MW rating)
    Mx = np.linspace(0.40, 0.65, 60); nu = np.linspace(0.35, 0.60, 60)
    omega = 2 * math.pi * N_RPM / 60
    Dt = np.zeros((len(nu), len(Mx))); Mr = np.zeros_like(Dt)
    for j, m in enumerate(Mx):
        T1, p1, rho1, a1 = static_from_total_mach(ISO['T'], ISO['p'], m)
        cx = m * a1; A = ma / (rho1 * cx)
        for i, n in enumerate(nu):
            rt = math.sqrt(A / (math.pi * (1 - n * n))); Dt[i, j] = 2 * rt; Mr[i, j] = math.hypot(cx, omega * rt) / a1
    fig, ax = plt.subplots(figsize=(6.6, 4.4))
    cs = ax.contour(Mx, nu, Dt, levels=np.arange(2.2, 3.6, 0.1), colors=NAVY, linewidths=0.8)
    ax.clabel(cs, fmt='D$_{tip}$=%.1f m', fontsize=7)
    cm = ax.contour(Mx, nu, Mr, levels=[1.0, 1.2, 1.4, 1.6], colors=RED, linewidths=1.4, linestyles='--')
    ax.clabel(cm, fmt='M$_{rel}$=%.1f', fontsize=7)
    ax.contourf(Mx, nu, Mr, levels=[0, 1.0], colors=[GRY], alpha=0.25)
    ax.add_patch(plt.Rectangle((RANGES['Mx_in'][0], RANGES['nu_in'][0]), RANGES['Mx_in'][1] - RANGES['Mx_in'][0],
                               RANGES['nu_in'][1] - RANGES['nu_in'][0], fill=False, ec=TEAL, lw=2))
    ax.text(RANGES['Mx_in'][0] + 0.003, RANGES['nu_in'][1] + 0.006, 'range sampled', color=TEAL, fontsize=8)
    ax.set_xlabel('inlet axial Mach number M$_x$ (not published)'); ax.set_ylabel('hub-to-tip ratio ν (not published)')
    ax.set_title('First rotor, 448 MW rating (743–745 kg/s, 3000 rpm). Grey: subsonic tip, excluded by D6', fontsize=8.5, color=GRY)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig_B_inlet_feasibility.png')); plt.close(fig)
    # Fig C: MHI line-up
    fig, ax = plt.subplots(figsize=(6.6, 3.8))
    for r in res['scaling']['table']:
        c = ORG if 'JAC' in r['model'] else NAVY
        ax.scatter(r['PR'], r['spec_work_kJkg'], s=r['m_exh'] / 3, color=c, alpha=0.75, edgecolor='k', lw=0.5)
        off = {'M501JAC': (-62, -18), 'M701JAC 574': (10, -14), 'M701JAC 448': (10, 2)}.get(r['model'], (8, -4))
        ax.annotate(f"{r['model']}\n{r['m_exh']:.0f} kg/s", (r['PR'], r['spec_work_kJkg']), xytext=off, textcoords='offset points', fontsize=7.5)
    ax.set_xlabel('compressor pressure ratio [–]'); ax.set_ylabel('specific output P / ṁ$_{exh}$ [kJ/kg]')
    ax.set_title('MHI catalogue (D2); bubble area ∝ exhaust flow', fontsize=9, color=GRY); ax.set_xlim(12, 28)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig_C_lineup.png')); plt.close(fig)
    # Fig D: Monte Carlo histograms of four outputs
    s, o = mc
    fig, axs = plt.subplots(1, 4, figsize=(10, 2.6))
    for ax, (k, lab, sc) in zip(axs, [('T02', 'T$_{02}$ [K]', 1), ('W_c', 'power [MW]', 1e-6), ('D_tip', 'D$_{tip}$ [m]', 1), ('M_rel_tip', 'M$_{rel,tip}$', 1)]):
        ax.hist(o[k] * sc, bins=40, color=TEAL, alpha=0.8); ax.set_xlabel(lab); ax.set_yticks([])
        for q in (5, 50, 95): ax.axvline(np.percentile(o[k] * sc, q), color=NAVY if q == 50 else GRY, lw=1.2 if q == 50 else 0.8, ls='-' if q == 50 else ':')
    fig.suptitle('M701JAC 448 MW rating — spread caused by the unpublished inputs (median and 5/95 %)', fontsize=9, color=GRY)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig_D_montecarlo.png')); plt.close(fig)

def figures_extra(res):
    NAVY = '#1f3864'; TEAL = '#127a8a'; ORG = '#d9822b'; GRY = '#6b7785'; RED = '#c0392b'
    st = res['stages']; i = np.arange(1, N_STAGES + 1)
    fig, axs = plt.subplots(1, 2, figsize=(10, 3.8))
    ax = axs[0]
    rp = np.array(st['realistic_PR'])
    ax.fill_between(i, rp[:, 0], rp[:, 2], color=TEAL, alpha=0.25, label='non-uniform work, 5–95 %')
    ax.plot(i, rp[:, 1], 'o-', color=TEAL, lw=2, ms=4, label='non-uniform work, median')
    ax.plot(i, st['equal_work_PR'], 's--', color=NAVY, ms=3.5, lw=1.2, label='equal work per stage')
    ax.plot(i, st['equal_PR'], ':', color=RED, lw=1.8, label='equal pressure ratio (Phase 1 / dossier)')
    ax.set_xlabel('stage'); ax.set_ylabel('stage total-pressure ratio π$_{st}$'); ax.legend(fontsize=7.5, frameon=False); ax.set_xticks(i)
    ax = axs[1]
    rd = np.array(st['realistic_dT0'])
    ax.fill_between(i, rd[:, 0], rd[:, 2], color=ORG, alpha=0.25)
    ax.plot(i, rd[:, 1], 'o-', color=ORG, lw=2, ms=4, label='non-uniform work, median')
    ax.plot(i, st['equal_work_dT0'], 's--', color=NAVY, ms=3.5, lw=1.2, label='equal work per stage')
    ax.set_xlabel('stage'); ax.set_ylabel('stage total-temperature rise ΔT$_0$ [K]'); ax.legend(fontsize=7.5, frameon=False); ax.set_xticks(i)
    fig.suptitle('M701JAC (448 MW, PR 25, 15 stages): why "equal stage pressure ratio" is not physical', fontsize=9, color=GRY)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig_E_stage_distribution.png')); plt.close(fig)
    fig, ax = plt.subplots(figsize=(6.6, 3.8))
    for nm, c in (('M701JAC_448', NAVY), ('M701JAC_574', ORG)):
        d = res['cycle_check'][nm]; ep = np.array(sorted(d)); et = np.array([d[e]['eta_t'] for e in ep])
        ax.fill_between(ep, et[:, 0], et[:, 2], color=c, alpha=0.18); ax.plot(ep, et[:, 1], 'o-', color=c, lw=2, label=nm.replace('_', ' ') + ' MW')
    ax.axhspan(0.86, 0.91, color=GRY, alpha=0.12); ax.text(0.861, 0.905, 'plausible equivalent cooled-turbine η$_p$', fontsize=8, color=GRY)
    ax.set_xlabel('assumed compressor polytropic efficiency'); ax.set_ylabel('turbine η$_p$ implied by the catalogue')
    ax.legend(fontsize=8, frameon=False); ax.set_title('Cycle cross-check (indicative): a higher compressor η forces a lower turbine η', fontsize=8.5, color=GRY)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, 'fig_F_cycle_check.png')); plt.close(fig)

if __name__ == '__main__':
    main()
