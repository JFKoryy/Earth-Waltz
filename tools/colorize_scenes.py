import json, numpy as np
from pathlib import Path
from PIL import Image
from scipy.ndimage import label
R=Path(__file__).resolve().parent.parent; D=R/'salida/datos'
OUT=R/'assets/scenes'; (OUT/'color').mkdir(parents=True,exist_ok=True); (OUT/'change').mkdir(parents=True,exist_ok=True)
U=-20.78; MINP=25; HA=0.04; W=760
def cmap(stops,t):
    t=np.clip(t,0,1); xs=[s[0] for s in stops]; out=np.zeros(t.shape+(3,))
    for c in range(3): out[...,c]=np.interp(t,xs,[s[1][c] for s in stops])
    return out
hexs=lambda h:tuple(int(h[i:i+2],16) for i in (1,3,5))
# water deep navy -> blue at threshold -> teal -> green -> light lime
HV_ST=[(0,hexs('#020a1f')),(0.30,hexs('#0b2a6b')),(0.39,hexs('#1d63c9')),(0.46,hexs('#14a7b8')),(0.6,hexs('#1fae6a')),(0.8,hexs('#7fd65a')),(1,hexs('#f4f2a0'))]
HH_ST=[(0,hexs('#05051c')),(0.3,hexs('#2a1468')),(0.5,hexs('#6b3fd6')),(0.68,hexs('#2fb6e0')),(0.85,hexs('#9ff0e6')),(1,hexs('#ffffff'))]
def save(arr,p):
    im=Image.fromarray(np.nan_to_num(arr).astype('uint8')); h=round(im.height*W/im.width)
    im.resize((W,h),Image.LANCZOS).save(p,quality=82,optimize=True,progressive=True)
def small(a,res=Image.NEAREST):
    im=Image.fromarray(a); return im.resize((W,round(im.height*W/im.width)),res)
scenes=json.load(open(R/'data/scenes.json'))
res=json.load(open(R/'data/results.json'))
for s in scenes:
    f=s['date'].replace('-','')
    hv=np.load(D/f'{f}_HV.npy'); hh=np.load(D/f'{f}_HH.npy')
    nan=np.isnan(hv)
    c=cmap(HV_ST,(hv+30)/25); c[nan]=(4,16,24); save(c,OUT/f'color/hv_{f}.jpg')
    c=cmap(HH_ST,(hh+30)/30); c[nan]=(4,16,24); save(c,OUT/f'color/hh_{f}.jpg')
    n=lambda a,lo,hi:np.clip((a-lo)/(hi-lo),0,1)
    rgb=np.dstack([n(hh,-25,-2),n(hv,-28,-8),n(hh-hv,2,14)])*255; rgb[nan]=(4,16,24)
    save(rgb,OUT/f'color/rgb_{f}.jpg')
    s['files']['hv_color']=f'assets/scenes/color/hv_{f}.jpg'
    s['files']['hh_color']=f'assets/scenes/color/hh_{f}.jpg'
    s['files']['rgb']=f'assets/scenes/color/rgb_{f}.jpg'
    res['scenes'][s['id']]['date']=s['date']
def quitar(m):
    e,_=label(m); t=np.bincount(e.ravel()); g=t>=MINP; g[0]=False; return g[e]
pairs={}
for v in ['X05009','P05023']:
    vs=[s for s in scenes if s['version']==v]
    for i in range(len(vs)):
        for j in range(i+1,len(vs)):
            a,b=vs[i],vs[j]; fa,fb=a['date'].replace('-',''),b['date'].replace('-','')
            A=np.load(D/f'{fa}_HV.npy'); B=np.load(D/f'{fb}_HV.npy')
            ok=~np.isnan(A)&~np.isnan(B); wa=(A<U)&ok; wb=(B<U)&ok
            g=quitar(wb&~wa); p=quitar(wa&~wb)
            veg=ok&~wa&~wb
            rgba=np.zeros(A.shape+(4,),np.uint8); rgba[g]=(255,79,216,235); rgba[p]=(245,181,68,235)
            name=f'change_{fa}_{fb}.png'; small(rgba).save(OUT/'change'/name,optimize=True)
            gh,ph=round(g.sum()*HA,1),round(p.sum()*HA,1); wah=wa.sum()*HA
            from datetime import date
            days=(date.fromisoformat(b['date'])-date.fromisoformat(a['date'])).days
            pairs[f"{a['id']}__{b['id']}"]={"gained_ha":gh,"lost_ha":ph,"gross_ha":round(gh+ph,1),"net_ha":round(gh-ph,1),
              "gross_pct":round(100*(gh+ph)/wah,2),"days":days,"version":v,"stable_veg_ha":round(veg.sum()*HA,1),
              "water_a_ha":round(wah,1),"water_b_ha":round(wb.sum()*HA,1),"change_map":f'assets/scenes/change/{name}'}
print(pairs['scene_01__scene_06'], pairs['scene_07__scene_15'])
res['pairs']=pairs
json.dump(scenes,open(R/'data/scenes.json','w'),indent=2)
json.dump(res,open(R/'data/results.json','w'),indent=1)
