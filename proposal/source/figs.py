import json, math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, FancyBboxPatch, FancyArrowPatch, Rectangle, Arc
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'mathtext.fontset':'dejavusans','savefig.dpi':220})
NAVY='#1f3864'; TEAL='#127a8a'; ORG='#d9822b'; GRY='#6b7785'; RED='#c0392b'; GRN='#2e8b57'; ROT='#4a78b0'; STA='#c8954e'
calc=json.load(open('calc.json')); stages=json.load(open('stages.json'))

# ---------- Fig 1: meridional schematic
fig,ax=plt.subplots(figsize=(8.2,3.6))
N=16; x0=0.0
chord=lambda i:0.175*0.36**(i/(N-1))
rows=[('IGV',0,0.15)]; x=0.15+0.05
xs=[]
for i in range(N):
    c=chord(i); a=c*0.8; rows.append((f'R{i+1}',x,a)); x+=a+c*0.28; rows.append((f'S{i+1}',x,a*0.95)); x+=a*0.95+c*0.30
rows.append(('OGV',x,chord(N-1)*0.9)); xe=x+chord(N-1)*0.9
rm=0.83; hin=0.56; hout=0.115; xa=rows[1][1]
def h(x):
    f=min(1,max(0,(x-xa)/(xe-xa))); return hin*(hout/hin)**(f**0.85)
X=np.linspace(-0.4,xe+0.5,400); H=np.array([h(v) for v in X])
ax.fill_between(X,rm+H/2,rm+H/2+0.08,color='#c9d2dc'); ax.fill_between(X,0.25,rm-H/2,color='#dfe5ec')
ax.plot(X,rm+H/2,color=NAVY,lw=1.6); ax.plot(X,rm-H/2,color=NAVY,lw=1.6)
for name,x1,a in rows:
    xm=x1+a/2; hh=h(xm)
    col=ROT if name.startswith('R') else STA if name.startswith('S') else '#8fa3b8'
    if name.startswith('R'): y0,y1=rm-hh/2,rm+hh/2-0.01
    else: y0,y1=rm-hh/2+0.01,rm+hh/2
    ax.add_patch(Rectangle((x1,y0),a,y1-y0,color=col,alpha=0.9,lw=0))
    if name in('IGV','R1','S1','R2','S2','R8','S8','R16','S16','OGV'):
        ax.text(xm,rm+hh/2+0.12,name,ha='center',fontsize=7.5,color=NAVY,rotation=90 if len(name)>2 else 0)
ax.plot([-0.4,xe+0.5],[0.25,0.25],'-.',color=GRY,lw=0.8); ax.text(xe+0.3,0.27,'axis',fontsize=8,color=GRY)
ax.annotate('',xy=(0.0,1.45),xytext=(-0.45,1.45),arrowprops=dict(arrowstyle='-|>',color=TEAL,lw=2))
ax.text(-0.45,1.5,'air in (1 bar, 288 K)',fontsize=8.5,color=TEAL)
ax.annotate('',xy=(xe+0.55,1.05),xytext=(xe+0.1,1.05),arrowprops=dict(arrowstyle='-|>',color=ORG,lw=2))
ax.text(xe+0.06,1.12,'≈12 bar, ≈634 K',fontsize=8,color=ORG,va='bottom',ha='left')
# station numbers stage 1
r1=rows[1]; s1=rows[2]
for xx,lab in((r1[1]-0.02,'1'),(r1[1]+r1[2]+0.02,'2'),(s1[1]+s1[2]+0.02,'3')):
    ax.plot([xx,xx],[rm-h(xx)/2,rm+h(xx)/2],':',color='k',lw=0.8); ax.text(xx,rm-h(xx)/2-0.09,lab,ha='center',fontsize=8)
ax.text(1.9,0.33,'rotor drum (hub)',fontsize=8.5,color=GRY,ha='center'); ax.text(1.9,1.3,'casing',fontsize=8.5,color=GRY,ha='center')
ax.add_patch(Rectangle((2.9,1.55),0.12,0.06,color=ROT)); ax.text(3.05,1.55,'rotor row',fontsize=8)
ax.add_patch(Rectangle((3.55,1.55),0.12,0.06,color=STA)); ax.text(3.7,1.55,'stator row',fontsize=8)
ax.set_xlim(-0.5,xe+0.95); ax.set_ylim(0.15,1.7); ax.set_aspect('equal'); ax.axis('off')
fig.tight_layout(); fig.savefig('fig/fig1_meridional.png'); plt.close(fig)

# ---------- Fig 2: velocity triangles on a cascade
def airfoil(ain,aout,chord,t=0.10,n=40):
    steps=200; x=s=0; pts=[(0,0)]
    for k in range(1,steps+1):
        u=(k-0.5)/steps; a=ain+(aout-ain)*u; x+=math.cos(a)/steps; s+=math.sin(a)/steps; pts.append((x,s))
    pts=np.array(pts); L=math.hypot(x,s); pts=pts/L*chord
    up=[];lo=[]
    for k in range(n+1):
        u=0.5*(1-math.cos(math.pi*k/n)); i=min(steps-1,int(u*steps)); p=pts[i]; q=pts[i+1]
        tx,ts=q-p; tl=math.hypot(tx,ts); tx/=tl; ts/=tl; nx,ns=-ts,tx
        yt=5*t*(0.2969*math.sqrt(u)-0.126*u-0.3516*u*u+0.2843*u**3-0.1036*u**4)*chord
        up.append((p[0]+nx*yt,p[1]+ns*yt)); lo.append((p[0]-nx*yt,p[1]-ns*yt))
    return np.array(up+lo[::-1])
phi=0.55; psi=0.35; Rr=0.5
b1=math.atan((Rr+psi/2)/phi); b2=math.atan((Rr-psi/2)/phi); a1=b2; a2=b1; dev=math.radians(7)
fig,ax=plt.subplots(figsize=(8.2,4.4))
pitch=0.9; ch=1.0
rot=airfoil(-b1,-b2+dev,ch); sta=airfoil(a2,a1-dev,ch*0.95)
XR=1.6; XS=3.9
for k in range(-2,2):
    P=rot.copy(); P[:,0]+=XR; P[:,1]=-(P[:,1])+k*pitch; P[:,1]-=0; ax.add_patch(Polygon(P,color=ROT,alpha=0.85))
    Q=sta.copy(); Q[:,0]+=XS; Q[:,1]=-(Q[:,1])+k*pitch+0.3; ax.add_patch(Polygon(Q,color=STA,alpha=0.85))
def arrow(x0,y0,dx,dy,col,lab,off=(0,0)):
    ax.annotate('',xy=(x0+dx,y0+dy),xytext=(x0,y0),arrowprops=dict(arrowstyle='-|>',color=col,lw=2,shrinkA=0,shrinkB=0))
    ax.text(x0+dx/2+off[0],y0+dy/2+off[1],lab,color=col,fontsize=11,ha='center',va='center')
S=0.75; U=S/phi
# inlet triangle (station 1), theta positive = DOWN on the figure
def tri(x0,y0,al,lab):
    ct=S*math.tan(al); wt=ct-U
    arrow(x0,y0,S,-wt,'#c2185b',r'$w_%s$'%lab,(-0.22,0.05))
    arrow(x0+S,y0-wt,0,-U,'#b8860b',r'$U$',(0.15,0))
    arrow(x0,y0,S,-ct,TEAL,r'$c_%s$'%lab,(-0.05,-0.18))
    ax.add_patch(Arc((x0,y0),0.6,0.6,theta1=-math.degrees(math.atan2(ct,S)),theta2=0,color=TEAL,lw=1))
    ax.add_patch(Arc((x0,y0),0.9,0.9,theta1=0,theta2=math.degrees(math.atan2(-wt,S)),color='#c2185b',lw=1))
    ax.text(x0+0.36,y0-0.12,r'$\alpha_%s$'%lab,color=TEAL,fontsize=9); ax.text(x0+0.48,y0+0.22,r'$\beta_%s$'%lab,color='#c2185b',fontsize=9)
    ax.plot([x0,x0+S+0.15],[y0,y0],':',color=GRY,lw=0.8)
tri(0.15,0.25,a1,'1'); tri(2.75,0.25,a2,'2')
arrow(XS+0.95,0.6,S,-S*math.tan(a1),TEAL,r'$c_3$',(0.1,0.15))
ax.annotate('',xy=(XR+0.5,-2.05),xytext=(XR+0.5,-1.45),arrowprops=dict(arrowstyle='-|>',color='#b8860b',lw=2.2))
ax.text(XR+0.62,-1.8,r'$U=\omega r$ (rotor motion)',color='#b8860b',fontsize=9)
ax.text(XR+0.4,2.0,'ROTOR',color=ROT,fontsize=10,fontweight='bold',ha='center'); ax.text(XS+0.4,2.0,'STATOR',color=STA,fontsize=10,fontweight='bold',ha='center')
for xx,l in((1.45,'1'),(2.7,'2'),(4.85,'3')): ax.text(xx,-2.25,l,fontsize=9,ha='center'); ax.plot([xx,xx],[-2.15,1.7],':',color='k',lw=0.6)
ax.annotate('',xy=(0.8,-2.2),xytext=(0.0,-2.2),arrowprops=dict(arrowstyle='-|>',color=GRY)); ax.text(0.85,-2.25,'axial  x',fontsize=8,color=GRY,va='center')
ax.set_xlim(-0.1,5.6); ax.set_ylim(-2.4,2.25); ax.set_aspect('equal'); ax.axis('off')
fig.tight_layout(); fig.savefig('fig/fig2_triangles.png'); plt.close(fig)

# ---------- Fig 3: h-s (T-s) diagram of the first stage, thermodynamically consistent
fig,ax=plt.subplots(figsize=(6.4,4.6))
cp=1005; Rg=287; T01=288.15
pist=1.168; dT0=T01*(2.2009**(1/16)-1)       # first-stage total temperature rise (~14.6 K)
T03=T01+dT0; T02=T03
s03=cp*np.log(T03/T01)-Rg*np.log(pist); s02=0.55*s03
kin1=8.0; kin2=15.0                            # c^2/(2cp) [K] at stations 1(=3) and 2
T1=T01-kin1; T2=T02-kin2; T3=T03-kin1
T03s=T01*pist**(0.4/1.4)
pof=lambda s_,T_: np.exp((cp*np.log(T_/T01)-s_)/Rg)
iso=lambda p,s_: T01*np.exp((s_+Rg*np.log(p))/cp)
st={'01':(0,T01),'1':(0,T1),'2':(s02,T2),'02':(s02,T02),'3':(s03,T3),'03':(s03,T03),'03s':(0,T03s)}
pp={'01':1.0,'1':pof(0,T1),'2':pof(s02,T2),'02':pof(s02,T02),'3':pof(s03,T3),'03':pist}
sg=np.linspace(-3.5,9,100)
for k,p in pp.items():
    tot=k.startswith('0'); col=NAVY if tot else GRY
    ax.plot(sg,iso(p,sg),'-' if tot else '--',color=col,lw=1.1)
    ax.text(sg[-1]+0.15,iso(p,sg[-1])+{'02':0.45,'03':-0.45,'01':0.3,'2':-0.3}.get(k,0),f'$p_{{{k}}}$',fontsize=9,va='center',color=col)
for k,(x_,y_) in st.items():
    tot=k.startswith('0'); ax.plot(x_,y_,'o',color=ORG if tot else TEAL,ms=5,zorder=5)
    dx,dy={'01':(0.2,-0.9),'1':(0.2,-0.9),'2':(0.2,-0.9),'02':(-0.75,0.5),'3':(0.2,-0.9),'03':(0.2,0.4),'03s':(-1.1,0.2)}[k]
    ax.text(x_+dx,y_+dy,k,fontsize=10)
ax.plot([0,0],[T01,T03s],':',color=GRN,lw=1.6); ax.text(0.15,(T01+T03s)/2,'isentropic',color=GRN,fontsize=8,rotation=90,va='center')
ax.plot([0,s03],[T03,T03],'-',color=ORG,lw=1)
ax.plot([0,s02,s03],[T1,T2,T3],'-',color=TEAL,lw=1.6)
ax.text(s02/2-0.3,(T1+T2)/2+0.9,'rotor',color=TEAL,fontsize=8.5,rotation=55); ax.text((s02+s03)/2,(T2+T3)/2+1.0,'stator',color=TEAL,fontsize=8.5,rotation=60)
ax.annotate('',xy=(-2.5,T03),xytext=(-2.5,T01),arrowprops=dict(arrowstyle='<->',color=RED)); ax.text(-3.2,(T01+T03)/2,r'$\Delta h_0=c_p\Delta T_0=w_{st}$',rotation=90,va='center',color=RED,fontsize=9)
ax.text(s02+0.9,T03+1.6,r'$h_{02}=h_{03}$  (no work in stator)',fontsize=8.5,color=ORG,ha='center')
ax.text(s03+0.2,T03s-0.2,r'$\eta_{st}=\frac{T_{03s}-T_{01}}{T_{03}-T_{01}}\approx%.2f$'%((T03s-T01)/dT0),fontsize=9,color=NAVY)
ax.set_xlabel('specific entropy  s − s$_{01}$  [J/kg·K]'); ax.set_ylabel('temperature T (∝ h = c$_p$T)  [K]')
ax.set_xlim(-3.8,10.2); ax.set_ylim(277,306)
fig.tight_layout(); fig.savefig('fig/fig3_hs.png'); plt.close(fig)

# ---------- Fig 4: compressor map
fig,ax=plt.subplots(figsize=(6.4,4.6))
ms=lambda N:0.16+0.74*N**1.3; mc=lambda N:0.26+0.79*N**1.15; pt=lambda N:1+11.6*N**2.5
for N in (0.7,0.8,0.9,1.0,1.05):
    u=np.linspace(0,1,80); m=ms(N)+(mc(N)-ms(N))*u; p=1+(pt(N)-1)*(1-0.05*u-0.5*u**6)
    ax.plot(m,p,color=TEAL,lw=1.6); ax.text(m[-1]+0.005,p[-1]-0.3,f'{int(N*100)} %',fontsize=8,color=TEAL)
Ns=np.linspace(0.62,1.1,50); ax.plot(ms(Ns),pt(Ns),color=RED,lw=2.4); ax.text(0.61,9.3,'surge line',color=RED,fontsize=10,rotation=52)
md=ms(1)+(mc(1)-ms(1))*0.62; pd=1+(pt(1)-1)*(1-0.05*0.62-0.5*0.62**6)
mm=np.linspace(0.45,1.05,50); ax.plot(mm,1+(pd-1)*(mm/md)**2.4,'--',color='k',lw=1.2); ax.text(0.72,4.4,'operating line',fontsize=9,rotation=40)
from numpy import interp
NsS=np.linspace(0.5,1.2,200); msS=ms(NsS); psS=pt(NsS)
for k,e in enumerate((0.88,0.86,0.83,0.79)):
    t=np.linspace(0,2*np.pi,400); ang=math.atan2(0.9*14.5/0.75,1)
    A=0.035+0.045*k; B=0.012+0.012*k
    u=A*np.cos(t); v=B*np.sin(t)
    xx=(md-0.02)+(u*np.cos(1.0)-v*np.sin(1.0))*0.75; yy=(pd-0.4)+(u*np.sin(1.0)+v*np.cos(1.0))*14.5
    yy=np.where(yy>interp(xx,msS,psS)-0.15,np.nan,yy)
    ax.plot(xx,yy,color=GRN,lw=0.9,alpha=0.85)
    j=np.nanargmax(np.where(np.isnan(yy),-1,xx))
    if k in (0,3): ax.text(xx[j]+0.004,yy[j],f'{e:.2f}',fontsize=7,color=GRN)
ax.text(0.95,1.6,r'green: isentropic-efficiency contours',fontsize=8,color=GRN)
ax.plot(md,pd,'o',color='k'); ax.annotate(r'design point ($\pi_c\approx12$)',xy=(md,pd),xytext=(md-0.33,pd+1.6),arrowprops=dict(arrowstyle='->'),fontsize=9)
ax.text(1.07,3,'choke',fontsize=10,color=GRY,rotation=90)
ax.set_xlabel(r'corrected mass flow  $\dot m\sqrt{T_{01}}/p_{01}$  (fraction of design)'); ax.set_ylabel(r'total pressure ratio  $\pi_c$')
ax.set_xlim(0.4,1.15); ax.set_ylim(1,14.5)
fig.tight_layout(); fig.savefig('fig/fig4_map.png'); plt.close(fig)

# ---------- Fig 5: stage-wise distribution (MGT-70 estimate)
fig,ax=plt.subplots(figsize=(6.6,3.4))
i=[r[0] for r in stages]; p=[r[1] for r in stages]; T=[r[2] for r in stages]
ax.bar(i,p,color=TEAL,alpha=0.75,width=0.7,label='total pressure p$_0$ [bar]')
ax.set_xlabel('stage exit index (0 = compressor inlet)'); ax.set_ylabel('p$_0$ [bar]',color=TEAL)
ax2=ax.twinx(); ax2.plot(i,T,'o-',color=ORG,lw=2,ms=4,label='total temperature T$_0$ [K]'); ax2.set_ylabel('T$_0$ [K]',color=ORG); ax2.spines['right'].set_visible(True)
ax.set_xticks(range(0,17,2))
fig.legend(loc='upper left',bbox_to_anchor=(0.1,0.93),fontsize=8.5,frameon=False)
fig.tight_layout(); fig.savefig('fig/fig5_stages.png'); plt.close(fig)

# ---------- Fig 6: AI-assisted workflow
fig,ax=plt.subplots(figsize=(8.2,4.3)); ax.axis('off'); ax.set_xlim(0,10); ax.set_ylim(0,5.4)
steps=[('1','Catalogue & literature\nmining (AI-assisted)'),('2','Cycle matching\n(π, ṁ, P, η, T)'),('3','Mean-line design\nstage by stage'),('4','Blade design &\n3-D stacking'),
       ('5','Performance & CFD\n(design / off-design)'),('6','Mechanical & vibration\n(stress, Campbell)'),('7','Virtual test\n(ASME PTC 10 / ISO 5389)'),('8','Generated catalogue\nvs. OEM catalogue')]
pos=[(0.2,3.7),(2.7,3.7),(5.2,3.7),(7.7,3.7),(7.7,1.4),(5.2,1.4),(2.7,1.4),(0.2,1.4)]
for (n,t),(x,y) in zip(steps,pos):
    ax.add_patch(FancyBboxPatch((x,y),2.1,1.15,boxstyle='round,pad=0.04,rounding_size=0.12',fc='#eaf2f8' if int(n)%2 else '#fdf2e6',ec=NAVY,lw=1.2))
    ax.text(x+0.18,y+0.92,n,fontsize=11,fontweight='bold',color=ORG); ax.text(x+1.1,y+0.5,t,ha='center',va='center',fontsize=8.6,color=NAVY)
for a,b in zip(pos[:-1],pos[1:]):
    if a[1]==b[1]:
        sgn=1 if b[0]>a[0] else -1
        ax.annotate('',xy=(b[0]+(0 if sgn>0 else 2.1),b[1]+0.57),xytext=(a[0]+(2.1 if sgn>0 else 0),a[1]+0.57),arrowprops=dict(arrowstyle='-|>',color=NAVY,lw=1.4))
    else: ax.annotate('',xy=(b[0]+1.05,b[1]+1.15),xytext=(a[0]+1.05,a[1]),arrowprops=dict(arrowstyle='-|>',color=NAVY,lw=1.4))
ax.add_patch(FancyBboxPatch((2.4,0.1),5.2,0.8,boxstyle='round,pad=0.04,rounding_size=0.12',fc='#eef7ee',ec=GRN,lw=1.2))
ax.text(5.0,0.5,'Verification loop: hand checks with textbook equations · cross-source data checks ·\nNASA Rotor 37 benchmark · team review of every AI output',ha='center',va='center',fontsize=8.2,color=GRN)
ax.text(5.0,5.15,'AI assists every step; the team verifies, decides and signs off',ha='center',fontsize=9.5,color=GRY,style='italic')
fig.tight_layout(); fig.savefig('fig/fig6_workflow.png'); plt.close(fig)
print('ok')
