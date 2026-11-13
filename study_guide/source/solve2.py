from math import *
from scipy.optimize import brentq
from iapws import IAPWS97 as W
k=3.5;cp=1004.5;g=1.4;R=287
s=W(P=0.15,T=473.15); A=(0.04*cos(radians(68))-0.002)*0.025; print('2.1 v',s.v,'A',A,'m',A*400/s.v)
a=W(P=7,T=693.15); w=440*745.7/2.5/1000; h2=a.h-w; b=W(h=h2,s=a.s); print('2.3',a.h,a.s,w,b.P*10,b.T-273.15)
f=W(P=0.008,x=0); o=W(P=3,s=f.s); print('2.4 vdp',f.v*(3000-8)*10000/3600,'dh',(o.h-f.h)*10000/3600)
# 2.15
s1=W(P=1.4,x=1); print('2.15 T1',s1.T)
cps=2731;gs=1.135;Rs=cps*(gs-1)/gs; T2=s1.T*(8.2/14)**((gs-1)/gs); V2=sqrt(52**2+2*cps*(s1.T-T2)); rho=8.2e5/(Rs*T2); print(' a',Rs,T2,V2,0.7/(rho*V2)*1e4)
e=W(P=0.82,s=s1.s); V2=sqrt(52**2+2*(s1.h-e.h)*1000); print(' b',e.h,V2,0.7*e.v/V2*1e4)
# 2.22
i=W(P=5,T=833.15); o=W(P=0.007,T=393.15); h01=i.h+190**2/2000; h0e=o.h+220**2/2000; es=W(P=0.007,s=i.s)
print('2.22',i.h,o.h,es.h,'tt',(h01-h0e)/(h01-es.h-220**2/2000),'ts',(h01-h0e)/(h01-es.h),'ss',(i.h-o.h)/(i.h-es.h))
l=W(P=4,x=0); x2=W(P=0.1,h=l.h); print('2.25',l.h,x2.x,1/x2.v,x2.v/l.v)
o=W(P=0.1,T=393.15)
def f(x):
  s=W(P=2,x=x); V2=15*o.v/s.v; return s.h+15**2/2000-o.h-V2**2/2000
x=brentq(f,0.8,1); s=W(P=2,x=x); print('2.26',x,15*o.v/s.v)
print('2.2',38000/(102000/(R*315.15))+1250)
print('2.5',15**2/2/4182,700+0.5*998.2*225/1000)
print('2.6',(780-100)*1e3/998.2+(9-36)/2+9.81*0.8,(780-100)+(9-36)/2+9.81*.8)
T01=300.15;T02=301.15;p02=101.3*(T02/T01)**k;T1=T01-46**2/2/cp;p1=101.3*(T1/T01)**k;T2=T02-123**2/2/cp;p2=p02*(T2/T02)**k
print('2.10',(p02-101.3)*1e3/9.81,(p2-p1)*1e3/9.81)
T=450-321.5**2/2/cp;p=700*(T/450)**k;print('2.13',T,p,p*1e3/(R*T))
w=186.4/1.5; T01=w/cp*1000/(0.8*(1-5**(-1/k)));T03=T01-w*1000/cp;T3=T03-90**2/2/cp;p01=1;p03=0.2;p3=p03*(T3/T03)**k;T3s=T01*(p3/p01)**(1/k)
print('2.17',w,T01,T03,T3,(T01-T03)/(T01-T3s))
# 2.12 variable cp via cantera
import cantera as ct
gas=ct.Solution('air.yaml'); gas.TP=300,2e5; h=gas.h+1000**2/2; s0=gas.s
pass
# find p0 isentropic with h0
pass
T0=300+1e6/2/cp; print('2.12 a',T0,2*(T0/300)**k)
# 2.24
gas=ct.Solution('gri30.yaml'); y={'N2':0.7808,'O2':0.2095,'AR':0.0093,'CO2':0.0004}
gas.TPX=298.15,1e5,y; M=gas.mean_molecular_weight; print('2.24',M,8314.46/M,gas.cp_mass,gas.cv_mass,gas.cp_mass/gas.cv_mass)
# Ex2.10 fan
# 3.16
p0=280e3;T0=1000;A1=1e-4;A3=2.5e-4;p3=170e3
m=A1*p0/sqrt(R*T0)*sqrt(g)*(2/2.4)**3
M3=brentq(lambda M: p3*A3*M*sqrt(g/(R*T0/(1+0.2*M*M)))-m,0.01,1)
T3=T0/(1+0.2*M3**2);V3=M3*sqrt(g*R*T3);T1=T0/1.2;V1=sqrt(g*R*T1);p1=p0*(1/1.2)**k
p2=(p3*A3+m*V3-p1*A1-m*V1)/(A3-A1); print('3.16',m,M3,p1,p2)
# 3.17
p1=530e3;T1=700;A1=pi*.15**2/4;A2=pi*.1**2/4
def f(V1):
  T0=T1+V1**2/2/cp; T2=T0/1.2; p2=p1*(T2/T1)**k; V2=sqrt(g*R*T2); return p1/(R*T1)*V1*A1-p2/(R*T2)*V2*A2
V1=brentq(f,10,400);T0=T1+V1**2/2/cp;T2=T0/1.2;p2=p1*(T2/T1)**k;V2=sqrt(g*R*T2);m=p1/(R*T1)*V1*A1
print('3.17',V1,V2,p2,m)
pa=101.3e3
for c in (0.5,-0.5):
  F=(p1-pa)*A1-(p2-pa)*A2*c-m*(V2*c-V1)
  print('  Fx variant c',c,F)
# 3.25
b=radians(31);M=2
th=atan(2/tan(b)*(M*M*sin(b)**2-1)/(M*M*(g+cos(2*b))+2)); print('3.25',degrees(th))
# 3.26 steam PM
gs=1.135;ks=gs/(gs-1);T0=W(P=0.018,x=1).T;Rs=461.5
M2=sqrt(2/(gs-1)*((18/7)**(1/ks)-1))
nu=lambda M: degrees(sqrt((gs+1)/(gs-1))*atan(sqrt((gs-1)/(gs+1)*(M*M-1)))-atan(sqrt(M*M-1)))
T2=T0/(1+(gs-1)/2*M2**2); print('3.26',T0,M2,nu(M2),M2*sqrt(gs*Rs*T2),65-nu(M2), 'p*',18*(2/(gs+1))**ks)
# 3.13
n=1.396; T01=430; p01=320; M1=.3; p1=p01*(1+.2*M1*M1)**-k
T02_T2=(p01/p1)**(1/k)*(p1/210)**((n-1)/n); print('3.13',sqrt(5*(T02_T2-1)))
