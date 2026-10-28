import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
NAVY='#1f3864'; TEAL='#127a8a'; ORG='#d9822b'; GRY='#6b7785'; GRN='#2e8b57'
fig,ax=plt.subplots(figsize=(9,5.2)); ax.axis('off'); ax.set_xlim(0,12); ax.set_ylim(0,7)
def box(x,y,w,h,t,kind):
    fc={'cat':'#eaf2f8','rng':'#fdf2e6','res':'#eef7ee','phy':'#f2f2f2'}[kind]; ec={'cat':NAVY,'rng':ORG,'res':GRN,'phy':GRY}[kind]
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=0.03,rounding_size=0.1',fc=fc,ec=ec,lw=1.3))
    ax.text(x+w/2,y+h/2,t,ha='center',va='center',fontsize=8.3,color='#1d2b3a')
def arr(x1,y1,x2,y2): ax.annotate('',xy=(x2,y2),xytext=(x1,y1),arrowprops=dict(arrowstyle='-|>',color=GRY,lw=1.1))
# catalogue inputs
box(0.2,5.6,2.4,0.9,'Output P, heat rate HR\n(catalogue D2)','cat')
box(0.2,4.4,2.4,0.9,'Exhaust flow, exhaust T\n(catalogue D2)','cat')
box(0.2,3.2,2.4,0.9,'Pressure ratio 25,\n15 stages, 3000 rpm (D2, D5)','cat')
box(0.2,2.0,2.4,0.9,'ISO air: 15 °C, 1 atm,\n60 % RH (standard)','phy')
# step 1
box(3.3,5.6,2.6,0.9,'Heat input Q = P·HR\nfuel = Q / LHV','res')
box(3.3,4.4,2.6,0.9,'Air flow = exhaust − fuel\n≈ 744 kg/s','res')
box(3.3,6.6-0.05,2.6,0.0,'','phy') if False else None
box(3.3,3.2,2.6,0.9,'Energy balance check\nQ − P − exhaust heat ≈ +1 %','res')
# ranges
box(3.3,0.6,2.6,1.0,'Not published → ranges:\nη_p, inlet Mach, hub/tip,\nexit Mach, stage-work shape','rng')
# step 2
box(6.6,5.6,2.6,0.9,'Real-gas polytropic compression\n(uses PR 25 + ISO air) → T₀₂, Δh','res')
box(6.6,4.4,2.6,0.9,'Compressor power\n= air flow · Δh ≈ 390 MW','res')
box(6.6,3.2,2.6,0.9,'Inlet annulus (3000 rpm, ISO air):\narea, D_tip, U_tip, M_rel,tip','res')
box(6.6,2.0,2.6,0.9,'Stage-by-stage\nπ_st, ΔT₀ distribution','res')
# step 3
box(9.7,5.0,2.1,1.4,'Cycle cross-check:\nimplied turbine η\n→ is η_p plausible?','res')
box(9.7,2.6,2.1,1.4,'Monte Carlo:\nmedian + 5–95 %\n+ what drives what','res')
for y in (6.05,): arr(2.6,y,3.3,y)
arr(2.6,4.85,3.3,4.85); arr(5.9,6.05,6.6,6.05); arr(4.6,5.6,4.6,5.3); arr(2.6,4.75,3.3,3.75); arr(1.4,5.6,1.4,5.3) if False else None
arr(5.9,4.85,6.6,4.85); arr(5.9,4.85,6.6,3.65);
arr(5.9,1.1,6.6,2.3); arr(5.9,1.1,6.6,3.4); arr(5.9,1.1,6.6,5.7)
arr(9.2,6.05,9.7,5.8); arr(9.2,3.65,9.7,3.4); arr(9.2,2.45,9.7,3.0); arr(9.2,4.85,9.7,5.3)
for x,t,c in ((0.2,'published data',NAVY),(2.6,'standard values',GRY),(4.9,'derived results',GRN),(7.5,'unpublished → treated as ranges',ORG)):
    ax.add_patch(FancyBboxPatch((x,0.05),0.25,0.22,boxstyle='round,pad=0.01',fc='white',ec=c,lw=1.5)); ax.text(x+0.35,0.16,t,fontsize=8,va='center',color=c)
fig.tight_layout(); fig.savefig('fig_chain.png',dpi=200)
