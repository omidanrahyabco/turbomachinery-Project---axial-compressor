# First-pass (catalogue-based) meanline estimates for the MGT-70(3) compressor
import math, json
g=1.4; R=287.0; cp=1005.0
PR=12.0; N=3000.0; Nst=16; mdot_exh=554.0; P_net=185e6; eta_th=0.364
LHV=48e6
T01=288.15; p01=101325.0
eta_p=0.90
Q=P_net/eta_th; mf=Q/LHV; m=mdot_exh-mf
T02=T01*PR**((g-1)/(g*eta_p)); T02s=T01*PR**((g-1)/g)
eta_c=(T02s-T01)/(T02-T01)
dT=T02-T01; W=m*cp*dT
pist=PR**(1/Nst); dTst=dT/Nst
omega=2*math.pi*N/60
# inlet geometry
cx1=160.0; ht=0.50
T1=T01-cx1**2/(2*cp); p1=p01*(T1/T01)**(g/(g-1)); rho1=p1/(R*T1)
A1=m/(rho1*cx1); rt=math.sqrt(A1/(math.pi*(1-ht**2))); rh=ht*rt; rm=(rt+rh)/2
Ut=omega*rt; Um=omega*rm
a1=math.sqrt(g*R*T1); Mrel_tip=math.sqrt(cx1**2+Ut**2)/a1
psi=cp*dTst/Um**2; phi=cx1/Um
# exit
cx2=130.0; p02=p01*PR
T2=T02-cx2**2/(2*cp); p2=p02*(T2/T02)**(g/(g-1)); rho2=p2/(R*T2)
A2=m/(rho2*cx2); h2=A2/(2*math.pi*rm)
# stress
rho_b=7800; K=2/3
sig=rho_b*omega**2*A1/(2*math.pi)*K
# back-work
Wt=W+P_net
# Mean-stage velocity triangles (50% reaction) at Um
R_=0.5
tb1=(R_+psi/2)/phi; tb2=(R_-psi/2)/phi
b1=math.degrees(math.atan(tb1)); b2=math.degrees(math.atan(tb2))
dh=math.cos(math.radians(b1))/math.cos(math.radians(b2))
res=dict(mf=mf,m=m,T02=T02,T02s=T02s,eta_c=eta_c,dT=dT,W=W/1e6,pist=pist,dTst=dTst,omega=omega,T1=T1,p1=p1,rho1=rho1,A1=A1,rt=rt,rh=rh,rm=rm,Dt=2*rt,Ut=Ut,Um=Um,a1=a1,Mrel_tip=Mrel_tip,psi=psi,phi=phi,T2=T2,p2=p2,rho2=rho2,A2=A2,h2=h2,h1=rt-rh,sig=sig/1e6,BWR=W/Wt,b1=b1,b2=b2,deHaller=dh,Q=Q/1e6)
for k,v in res.items(): print(f"{k:10s} {v:.4f}")
json.dump(res,open('calc.json','w'),indent=1)
# stage table
rows=[]
for i in range(Nst+1):
    p=PR**(i/Nst); T=T01*p**((g-1)/(g*eta_p)); rows.append((i,p*p01/1e5,T))
json.dump(rows,open('stages.json','w'))
