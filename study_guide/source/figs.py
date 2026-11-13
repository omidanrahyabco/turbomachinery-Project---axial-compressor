import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from math import *
import numpy as np
cp=1004.5;R=287
plt.rcParams.update({'font.size':9,'font.family':'DejaVu Sans','axes.edgecolor':'#9aa0a6','axes.linewidth':0.6})
INK='#1f2328'; MUT='#5f6368'; A='#2a6fdb'; Wc='#d9622b'; G='#80868b'
# ---- Fig 1 velocity triangles, common base (MGT-70 stage 1, R=0.5)
U=287.46; Va=218.96; Vwi=101.42; Vwm=186.03
fig,ax=plt.subplots(figsize=(6.2,3.4),dpi=200)
O=(0,0)
def arr(x0,y0,x1,y1,c,lab,off=(0,0),ha='center'):
    ax.annotate('',xy=(x1,y1),xytext=(x0,y0),arrowprops=dict(arrowstyle='-|>',lw=1.6,color=c,shrinkA=0,shrinkB=0,mutation_scale=11))
    ax.text((x0+x1)/2+off[0],(y0+y1)/2+off[1],lab,color=INK,ha=ha,va='center',fontsize=9)
# axial direction = +x (down page in video); tangential = y (U direction negative y => draw U to the left?)
# Use: x axial (right), y tangential (up = direction of U)
arr(0,0,Va,Vwi,A,r'$V_i$ = 241.3',(-8,14))
arr(0,0,Va,-(U-Vwi),Wc,r'$W_i$ = 287.3',(-30,-18))
arr(0,0,Va,Vwm,A,r'$V_m$ = 287.3',(-48,30))
arr(0,0,Va,-(U-Vwm),Wc,r'$W_m$ = 241.3',(-40,-6))
ax.plot([Va,Va],[-(U-Vwi),Vwm],color=G,lw=0.8,ls='--')
ax.annotate('',xy=(Va+12,Vwm),xytext=(Va+12,Vwi),arrowprops=dict(arrowstyle='<->',lw=0.9,color=INK))
ax.text(Va+18,(Vwm+Vwi)/2,r'$\Delta V_w$ = 84.6',va='center',fontsize=9,color=INK)
ax.annotate('',xy=(Va+48,Vwi),xytext=(Va+48,-(U-Vwi)),arrowprops=dict(arrowstyle='<->',lw=0.9,color=INK))
ax.text(Va+54,-90,r'$U$ = 287.5',va='center',fontsize=9,color=INK)
ax.annotate('',xy=(Va,-200),xytext=(0,-200),arrowprops=dict(arrowstyle='<->',lw=0.9,color=INK))
ax.text(Va/2,-222,r'$V_a$ = 218.96  (axial)',ha='center',fontsize=9,color=INK)
ax.text(4,232,'blue = absolute,  orange = relative (rotor frame);  all in m/s',color=MUT,fontsize=8)
ax.text(Va+70,40,r'$\alpha_i=-\beta_m$ = 24.9°'+'\n'+r'$\alpha_m=-\beta_i$ = 40.4°',fontsize=8.5,color=INK,va='center')
ax.set_xlim(-10,400); ax.set_ylim(-235,245); ax.set_aspect('equal'); ax.axis('off')
fig.tight_layout(); fig.savefig('fig_triangles.png'); plt.close()
# ---- Fig 2 T-s of stage 1
def s(T,p): return cp*log(T/300)-R*log(p/100)
pts={'0i':(300,100),'i':(271.02,70.07),'0R':(312.11,114.85),'m':(283.12,79.92),'0R,m':(312.11,112.42),
 '0m':(324.21,128.43),'e':(295.23,91.01),'0e':(324.21,126.32),'0es':(320.71,126.32),'es':(292.04,91.01)}
fig,ax=plt.subplots(figsize=(6.4,4.6),dpi=200)
ss=np.linspace(-4,16,50)
for p,lab in [(70.07,'$p_i$ 70.1'),(79.92,'$p_m$ 79.9'),(91.01,'$p_e$ 91.0'),(100,'$p_{0i}$ 100'),(126.32,'$p_{0e}$ 126.3')]:
    T=300*np.exp((ss+R*log(p/100))/cp); ax.plot(ss,T,color='#c4c7c5',lw=0.8,zorder=1)
    ax.text(16.2,T[-1],lab+' kPa',fontsize=7.5,color=MUT,va='center')
stag={'0i','0R','0R,m','0m','0e','0es'}
for n,(T,p) in pts.items():
    x=s(T,p); ideal=n in('0es','es')
    mk='o' if n not in stag else 's'
    ax.scatter([x],[T],s=26,marker=mk,facecolor='white' if ideal else (Wc if 'R' in n else A),edgecolor=INK if ideal else 'white',lw=0.8 if ideal else 1.2,zorder=3)
off={'0i':(-3.2,1),'i':(0.6,-2.5),'0R':(-4.2,1.2),'m':(0.6,-2.5),'0R,m':(0.7,1.4),'0m':(0.6,1.2),'e':(0.6,-2.5),'0e':(0.6,-2.6),'0es':(-4.9,0.6),'es':(-3.6,-2.6)}
for n,(T,p) in pts.items():
    dx,dy=off[n]; ax.text(s(T,p)+dx,T+dy,n+f' ({T:.1f} K)',fontsize=7.5,color=INK)
def seg(a,b,**kw):
    ax.plot([s(*pts[a]),s(*pts[b])],[pts[a][0],pts[b][0]],**kw)
seg('i','m',color=INK,lw=1.4); seg('m','e',color=INK,lw=1.4)
seg('0i','0e',color=INK,lw=1,ls=(0,(4,3)))
for a,b in [('i','0i'),('i','0R'),('m','0R,m'),('m','0m'),('e','0e'),('0i','0es'),('es','0es')]:
    seg(a,b,color=G,lw=0.7,ls=':')
ax.text(s(*pts['i'])+1.0,276.5,'rotor',fontsize=8,color=INK); ax.text(s(*pts['m'])+1.6,288.5,'stator',fontsize=8,color=INK)
ax.set_xlabel('s − s$_{0i}$  [J/(kg·K)]',color=INK); ax.set_ylabel('T  [K]',color=INK)
ax.set_xlim(-6,22); ax.set_ylim(266,330)
ax.grid(color='#eceff1',lw=0.5); ax.tick_params(colors=MUT)
for sp in ('top','right'): ax.spines[sp].set_visible(False)
from matplotlib.lines import Line2D
h=[Line2D([],[],marker='o',ls='',mfc=A,mec='white',ms=6,label='static state'),
   Line2D([],[],marker='s',ls='',mfc=A,mec='white',ms=6,label='absolute stagnation'),
   Line2D([],[],marker='s',ls='',mfc=Wc,mec='white',ms=6,label='relative stagnation (rotor frame)'),
   Line2D([],[],marker='o',ls='',mfc='white',mec=INK,ms=6,label='ideal (isentropic) end state')]
ax.legend(handles=h,loc='lower center',bbox_to_anchor=(0.5,1.0),ncol=2,fontsize=7.5,frameon=False)
fig.tight_layout(); fig.savefig('fig_ts.png'); plt.close()
