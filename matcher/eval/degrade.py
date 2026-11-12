import json, random, cv2, numpy as np, os, sys
ds = json.load(open('eval/dataset.json'))
os.makedirs('eval/photos', exist_ok=True)
def make_bg(w,h,rng):
    base = np.array([rng.randint(30,120), rng.randint(30,110), rng.randint(30,100)],np.float32)
    bg = np.ones((h,w,3),np.float32)*base
    # wood/desk-like streaks + gradient + noise
    streak = cv2.GaussianBlur(np.random.RandomState(rng.randint(0,9999)).randn(h,w).astype(np.float32),(0,0),sigmaX=60,sigmaY=3)
    bg += streak[...,None]*rng.uniform(40,120)
    gx = np.linspace(-1,1,w)[None,:,None]*rng.uniform(-25,25)
    bg += gx
    return np.clip(bg,0,255)
def degrade(img, level, seed):
    rng = random.Random(seed); np.random.seed(seed)
    H,W = 1600,1200
    bg = make_bg(W,H,rng)
    ih,iw = img.shape[:2]
    if level=='mild':
        scale=rng.uniform(0.72,0.88); rot=rng.uniform(-5,5); pj=0.03; blur=rng.uniform(0.6,1.2); glare=rng.uniform(0.0,0.25); lowres=rng.uniform(0.7,1.0); q=rng.randint(70,85)
    else:
        scale=rng.uniform(0.50,0.68); rot=rng.uniform(-12,12); pj=0.08; blur=rng.uniform(1.5,2.6); glare=rng.uniform(0.35,0.7); lowres=rng.uniform(0.35,0.55); q=rng.randint(45,65)
    tw = W*scale; th = tw*ih/iw
    if th > H*0.85: th = H*0.85; tw = th*iw/ih
    cx = W/2 + rng.uniform(-0.06,0.06)*W; cy = H/2 + rng.uniform(-0.06,0.06)*H
    src = np.float32([[0,0],[iw,0],[iw,ih],[0,ih]])
    dst = np.float32([[-tw/2,-th/2],[tw/2,-th/2],[tw/2,th/2],[-tw/2,th/2]])
    a = np.deg2rad(rot); R = np.array([[np.cos(a),-np.sin(a)],[np.sin(a),np.cos(a)]])
    dst = dst @ R.T
    dst += np.array([[rng.uniform(-pj,pj)*tw, rng.uniform(-pj,pj)*th] for _ in range(4)])
    dst += np.array([cx,cy])
    M = cv2.getPerspectiveTransform(src, dst.astype(np.float32))
    warped = cv2.warpPerspective(img, M, (W,H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0))
    mask = cv2.warpPerspective(np.ones((ih,iw),np.float32), M, (W,H))
    mask = cv2.GaussianBlur(mask,(0,0),1.2)[...,None]
    # drop shadow
    shadow = cv2.GaussianBlur(np.roll(mask[...,0],(14,10),(0,1)),(0,0),14)[...,None]*0.5
    out = bg*(1-shadow)
    out = out*(1-mask)+warped.astype(np.float32)*mask
    # lighting gradient
    gy,gx = np.mgrid[0:H,0:W].astype(np.float32)
    ang=rng.uniform(0,6.28); grad = 1+0.18*((gx/W-0.5)*np.cos(ang)+(gy/H-0.5)*np.sin(ang))*2
    out *= grad[...,None]
    # glare
    if glare>0:
        gcx,gcy = cx+rng.uniform(-0.2,0.2)*tw, cy+rng.uniform(-0.25,0.25)*th
        g = np.exp(-(((gx-gcx)/(tw*rng.uniform(0.15,0.35)))**2+((gy-gcy)/(th*rng.uniform(0.1,0.3)))**2))
        out = out + 255*glare*g[...,None]
    # white balance shift
    out *= np.array([rng.uniform(0.9,1.1),1,rng.uniform(0.9,1.1)])[None,None,:]
    out = np.clip(out,0,255).astype(np.uint8)
    out = cv2.GaussianBlur(out,(0,0),blur)
    # lower res
    sm = cv2.resize(out,(int(W*lowres),int(H*lowres)),interpolation=cv2.INTER_AREA)
    sm = np.clip(sm.astype(np.float32)+np.random.randn(*sm.shape)*rng.uniform(2,7),0,255).astype(np.uint8)
    _,enc = cv2.imencode('.jpg',sm,[cv2.IMWRITE_JPEG_QUALITY,q])
    return enc.tobytes()
for i,d in enumerate(ds):
    img = cv2.imread(d['file'])
    for lv in ['mild','harsh']:
        open(f"eval/photos/{d['rgid']}_{lv}.jpg",'wb').write(degrade(img, lv, 1000+i*7+(0 if lv=='mild' else 3)))
print('ok', len(ds)*2)
