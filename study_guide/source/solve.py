from math import *
from scipy.optimize import brentq
g=1.4; R=287.0; cp=1004.5; k=g/(g-1)
d=lambda x: degrees(x); r=lambda x: radians(x)
P=lambda *a: print(*a)
# ---- MGT-70 master
U=pi*1.83*3000/60; Va=218.96; phi=Va/U
etac=(12.1**(1/k)-1)/(12.1**(1/(k*0.86))-1)
P('MGT U',U,'phi',phi,'eta_c',etac,'T0e chk',300*12.1**(1/(k*.86)))
rho=1210e3/(R*687.4); h=55/(rho*pi*1.83*Va); P('h(1210kPa)',h,'h(121kPa)',55/(121e3/(R*687.4)*pi*1.83*Va))
dH=cp*(687.4-300)/1000; P('dH',dH,'stage',dH/16,'psiT',dH*1e3/U**2,'psi',dH*1e3/16/U**2)
dVw=dH/16*1e3/U; Vwi=(U-dVw)/2; Wwi=U-Vwi; Vi=hypot(Vwi,Va); Wi=hypot(Wwi,Va)
P('dVw',dVw,'Vwi',Vwi,'Wwi',Wwi,'Vi',Vi,'Wi',Wi,'ai',d(atan(Vwi/Va)),'bi',d(atan(Wwi/Va)))
Ti=300-Vi**2/2/cp; pi_=100*(Ti/300)**k; M=Wi/sqrt(g*R*Ti); P('Ti',Ti,'pi',pi_,'Mrel',M)
T0e=300+dH/16*1e3/cp; Te=T0e-Vi**2/2/cp; p0e=100*(T0e/300)**(k*.86); pe=p0e*(Te/T0e)**k
Tm=Ti+0.5*(Te-Ti); pm=pi_*(Tm/Ti)**(k*.86); Rp=(pm-pi_)/(pe-pi_)
P('T0e',T0e,'Te',Te,'p0e',p0e,'pe',pe,'Tm',Tm,'pm',pm,'Rp',Rp)
T0R=Ti+Wi**2/2/cp; p0Ri=pi_*(T0R/Ti)**k; p0Rm=pm*(T0R/Tm)**k; P('T0R',T0R,'p0Ri',p0Ri,'p0Rm',p0Rm,'p0m',pm*(T0e/Tm)**k)
T0es=300*(p0e/100)**(1/k); Tes=300*(pe/100)**(1/k); P('T0es',T0es,'ett',(T0es-300)/(T0e-300),'Tes',Tes,'ets',(Tes-300)/(T0e-300))
# ---- ch2
for V in (60,300):
  T0=300+V**2/2/cp; P('2.8',V,T0,140*(T0/300)**k)
P('2.11',sqrt(2*cp*450*(1-0.5**(1/k))))
A=pi*0.04**2/4; f=lambda V: 110e3*V/(R*(288-V**2/2/cp))-0.5/A; P('2.14',brentq(f,1,400))
P('2.16',600/1000, cp*330*(1-(1/7)**(1/k))/1000)
P('2.18',288+6000/cp,(1+0.75*6000/cp/288)**k,(101.3e3+0.75*6000*1000)/101.3e3)
# 2.20
gg=4/3; Rg=8314/28.97; cpg=gg*Rg/(gg-1); kg=gg/(gg-1)
T02s=1100*(140/700)**(1/kg); T2=780-210**2/2/cpg; p2=140*(T2/780)**kg; T2s=1100*(p2/700)**(1/kg)
P('2.20 cpg',cpg,T02s,(320)/(1100-T02s),T2,p2,T2s,320/(1100-T2s))
# 2.21
dK=300**2/2/cp; T2s=288*(420/101.3)**(1/k); T02=288+(T2s+dK-288)/0.82; P('2.21a',T2s,T02-dK)
def f(T2):
  T02=T2+dK; p02=420*(T02/T2)**k; T02s=288*(p02/101.3)**(1/k); return 288+(T02s-288)/0.82-T02
T2=brentq(f,300,600); P('2.21b',T2)
# 2.23
T01=300+50**2/2/cp; p01=100*(T01/300)**k; p02=25*p01; T02s=T01*25**(1/k); T02=T01+(T02s-T01)/0.86; T2=T02-300**2/2/cp; p2=p02*(T2/T02)**k
T2s=T01*(p2/p01)**(1/k); T2ss=300*(p2/100)**(1/k)
P('2.23',T01,p01,T02s,T02,T2,p2,'ts',(T2s-T01)/(T02-T01),'ss',(T2ss-300)/(T2-300))
# 2.19
gs=1.3; ks=gs/(gs-1); x=2.5**(-1/ks); st=1-0.87*(1-x); P('2.19',(1-st**4)/(1-x**4))
# Ex 2.11
T0es=300*30**(1/k); T0e=300+(T0es-300)/.82; p0ei=(T0e/300)**k; P('Ex2.11',T0es,T0e,p0ei,p0ei-30,R*log(p0ei/30))
# ---- ch3
p0=680; T0=560; P('3.1 p*',p0*(2/2.4)**k,'V',sqrt(g*R*T0/1.2))
T1=g*(140e3*6.5e-4*0.6/0.25)**2/R; T0=T1*(1+0.2*.36); AA=(1/0.6)*((2/2.4)*(1+0.2*.36))**3; p0=140*(1+0.2*.36)**k
P('3.2',T1,T0,AA,6.5/AA,1-1/AA,p0,p0*(2/2.4)**k)
P('3.3',240e3*5e-4*0.4*sqrt(g/(R*360)))
ep=0.98; n=g/(ep+g*(1-ep)); Mt=sqrt((n-1)/(g-1)); pt=380*(2/(n+1))**(n/(n-1)); Tt=2*460/(n+1)
P('3.11 n',n,'Mt',Mt,'pt',pt,'Tt',Tt,'V',Mt*sqrt(g*R*Tt))
# 3.14
T2s=530*(180/260)**(1/k); V2=sqrt(2*cp*(530-T2s)/1.02); T2=530-V2**2/2/cp; M2=V2/sqrt(g*R*T2)
nn=1/(1-log(T2/530)/log(180/260)); P('3.14',T2s,V2,T2,M2,'etap',(1-1/nn)*k)
# 3.10 supersonic nozzle eta=0.91
eN=0.91; T0=470; p0=500
mA_t=p0*1e3*(2/2.4)**k*sqrt(g/(R*T0/1.2))
def p2r(M): return (1-(g-1)*M**2/(eN*(2+(g-1)*M**2)))**k
def f(M):
  T2=T0/(1+0.2*M**2); p2=p0*1e3*p2r(M); return mA_t/(p2*M*sqrt(g/(R*T2)))-2.3
M=brentq(f,1.2,3.5); P('3.10',M,p0*p2r(M),T0/(1+0.2*M**2))
# 3.19
def AAs(M): return (1/M)*((2/2.4)*(1+0.2*M*M))**3
def p0r(M):
  M2=sqrt((1+0.2*M*M)/(1.4*M*M-0.2)); return ((2.4*M*M/(2+0.4*M*M))**k)*((2.4/(2.8*M*M-0.4))**(1/0.4))
ratio=AAs(0.3)/(2*AAs(4)); M1=brentq(lambda M: p0r(M)-ratio,1.5,8); P('3.19',AAs(4),AAs(0.3),ratio,M1,1+2*g/(g+1)*(M1**2-1))
# 3.20
c1=sqrt(g*R*300); a=400/c1/(2/2.4); Ms=(a+sqrt(a*a+4))/2; P('3.20',c1,Ms,Ms*c1,101.3*(1+2*g/2.4*(Ms**2-1)))
# 3.23 PM
nu=lambda M: d(sqrt(2.4/.4)*atan(sqrt(.4/2.4*(M*M-1)))-atan(sqrt(M*M-1)))
M2=brentq(lambda M: nu(M)-nu(1.1)-5,1.1,3); T2=310*(1+0.2*1.21)/(1+0.2*M2**2)
P('3.23',nu(1.1),M2,T2,130*(T2/310)**k, d(asin(1/1.1))-d(asin(1/M2))+5)
# 3.28 oblique shock M=2.9 theta=5 lower; PM upper
def tb(b,M): return atan(2/tan(b)*(M*M*sin(b)**2-1)/(M*M*(g+cos(2*b))+2))
M=2.9; b=brentq(lambda b: tb(b,M)-r(5), asin(1/M)+1e-6, r(60)); Mn=M*sin(b)
M2u=brentq(lambda x: nu(x)-nu(2.9)-5,2.9,5)
P('3.28 beta',d(b),'p_below',101.3*(1+2*g/2.4*(Mn**2-1)),'p_above',101.3*((1+0.2*M**2)/(1+0.2*M2u**2))**k)
# ---- ch5
Vu2=320*sin(r(73)); Vx=320*cos(r(73)); b2=atan((Vu2-165)/Vx); Vu3=165-(Vu2-165); P('5.6',Vu2,Vx,d(b2),Vu3,d(atan(Vu3/Vx)))
Vu2=140*tan(r(60)); w=140*Vu2; P('5.10',(140**2-(Vu2-140)**2)/2/w)
U=pi*0.1*50000/60; P('5.12',U,37000/U,(335/(335-37000/(0.8*cp)))**k)
V3=sqrt(500**2*0.2/(1-0.8*0.4)); w=0.8*V3**2/2/0.2; Vx=250; Vu2=500*sin(r(60)); Vu3=-sqrt(V3**2-Vx**2); U=w/(Vu2-Vu3)
P('5.16',V3,w,U,Vx/U,w/U**2,d(atan((Vu3-U)/Vx)))
P('5.22',60*1750/3550*1.5**3,120*(1750/3550)**2*2.25*0.75,1000*60*1750/3550*1.5**3/1000*120*(1750/3550)**2*2.25)
r1=103.1e3/(R*288); r1b=101.3e3/(R*288); r2=20e3/(R*253); P('5.24',r2*0.24,250*r2/r1,250*r2/r1b)
Om=1440*pi/30; P('5.26',0.4*1750/1440,4.25*(1440/1750)*(1750/1440)**3,Om*sqrt(6.277)/(0.153*9810/1.2)**0.75, 1750*pi/30*sqrt(4.25)/(0.153*9810/1.2)**.75)
# ---- ch8
P('8.1',cp*281*(10**(1/k)-1)/0.75/1000)
rho=100e3/(R*300); m=rho*0.48; tq=m*0.15*15; P('8.2',m,tq,tq*3000*pi/30)
Vu2=31600/280; P('8.3',d(atan(Vu2/140)),d(atan((Vu2-280)/140)))
Vu2=40*tan(r(60)); U=Vu2-40*tan(r(-25)); Vu1=40*tan(r(30)); w=U*(Vu2-Vu1); W1s=40**2+(Vu1-U)**2; W2s=40**2+(40*tan(r(25)))**2
r01=101.3e3/(R*300); V1=40/cos(r(30)); T1=300-V1**2/2/cp; p1=101.3e3*(T1/300)**k; rho1=p1/(R*T1)
P('8.4',U,40/U,(Vu2-Vu1)/U,d(atan((Vu1-U)/40)),'dp0',r01*(W1s-W2s)/2,'dp1',rho1*(W1s-W2s)/2,'R',(W1s-W2s)/2/w)
ps=2*(0.6*tan(r(55))-0.6); P('8.5',ps,d(atan(-(0.4+ps/2)/.6)),d(atan((-0.4+ps/2)/.6)),d(atan((0.6-ps/2)/.6)),'dH S',cos(r(55))/cos(atan((0.6-ps/2)/.6)),'dH R',cos(atan(-(0.4+ps/2)/.6))/cos(atan((-0.4+ps/2)/.6)))
rt=0.3*2/1.8; rh=0.8*rt; A=pi*(rt**2-rh**2); V1=125/cos(r(40)); T1=293-V1**2/2/cp; p1=101e3*(T1/293)**k; m=p1/(R*T1)*A*125
U=125*(tan(r(40))-tan(r(-60))); P('8.6',rt,rh,A,T1,p1,m,U,U/0.3*30/pi,m*U*125*(tan(r(60))-tan(r(40)))/1000)
Vx=290/(tan(r(35))+tan(r(60))); w=290*Vx*(tan(r(60))-tan(r(35))); T0es=300*5.5**(1/k); dT=(T0es-300)/0.756
P('8.7',Vx,w,w/cp,T0es,dT,dT/(w/cp))
w=150*(120-55); T02=340+w/cp; T2=T02-(75**2+120**2)/2/cp; p03=185*(1+0.9*w/cp/340)**k; p0i=185*(T02/340)**k
P('8.8',w,T02,T2,p03,p0i,p0i-(p0i-p03)/2)
rm=0.325; U=rm*6000*pi/30; Vu2=U-122; ps=Vu2/U; T1=300-122**2/2/cp; p1=1e5*(T1/300)**k; A=pi*(.35**2-.3**2)
P('8.10',U,122/U,ps,'m_static',p1/(R*T1)*A*122,'m_rho0',1e5/(R*300)*A*122,(1+0.86*U*Vu2/cp/300)**k,1-Vu2/2/U)
tb2=tan(r(-25)); ps=2*(0.5+0.45*tb2); tb1=-(0.5+ps/2)/0.45
def f(Vx): W1=Vx/cos(atan(tb1)); V1=Vx/cos(r(25)); T1=310-V1**2/2/cp; return W1/sqrt(g*R*T1)-0.65
Vx=brentq(f,10,300); U=Vx/0.45; P('8.12',ps,d(atan(tb1)),Vx,ps*U**2/cp)
# 8.19
etas=[0.920-0.004*i for i in range(10)]
def fin(dT):
  T=288; p=1
  for e in etas: p*= (1+e*dT/T)**k; T+=dT
  return p
dT=brentq(lambda x: fin(x)-4.3,1,40); T0es=288*4.3**(1/k); P('8.19',dT,(T0es-288)/(10*dT),(4.3**(1/k)-1)/(4.3**(1/(k*.902))-1))
# 8.22
T1=288-175**2/2/cp; c=sqrt(g*R*T1); Uc=2*280/1.5; P('8.22a',hypot(175,280)/c,hypot(175,Uc)/c)
p1=101.3e3*(T1/288)**k; A=20/(p1/(R*T1)*175)
def f(Vx):
  T=288-(Vx/cos(r(10)))**2/2/cp; p=101.3e3*(T/288)**k; return p/(R*T)*Vx*A-20
Vx=brentq(f,100,250); T=288-(Vx/cos(r(10)))**2/2/cp; c=sqrt(g*R*T); Vu=Vx*tan(r(10))
P('8.22b',A,Vx,hypot(Vx,280-Vu)/c,hypot(Vx,Uc-Vu)/c)
# Ex 8.2
DR=0.72; Rr=0.82; ph=sqrt((DR**2-(2*Rr-1)**2)/(1-DR**2)); P('Ex8.2',ph,d(atan((2-2*Rr)/ph)),d(atan(-1/ph)),d(atan((1-2*Rr)/ph)))
