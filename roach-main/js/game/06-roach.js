// 蟑螂模型（身体、腿、触角）与步态
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 蟑螂 (이질바퀴) ─────────
// 몸 좌표: +z 头部, +y 위, x 좌우. 몸길이 약 1.2단위 = 실제 ROACH_L×1.2.
// 실험실 표본과 같은 종으로 맞춘다: 적갈색 광택, 前胸背板은 옅은 테두리 안에 짙은 나비 무늬, 가시 돋친 납작한 다리.
const ROACH_TOP=0.15;   // 등(날개 위) 높이 — 뒤집힌 바퀴를 바닥에 눕힐 때 쓴다
// yaw: 넓적다리가 뻗는 방향(0=앞, π=뒤), ky: 무릎에서 종아리가 더 꺾이는 각도(+면 뒤로).
// 前足는 앞으로, 가운데·后足는 뒤로 꺾여야 바퀴 윤곽이 나온다.
const LEG_DEF=[
  {z:0.30, yaw:0.75, ky:-0.35, fl:0.28, tl:0.30, w:0.85, tar:0.15},
  {z:0.06, yaw:1.90, ky:0.60,  fl:0.34, tl:0.40, w:1.0,  tar:0.19},
  {z:-0.20,yaw:2.25, ky:0.55,  fl:0.44, tl:0.56, w:1.15, tar:0.27},
];
const HIP_Y=0.05, LEG_ELEV=0.3;
for(const d of LEG_DEF){ const hK=HIP_Y+d.fl*Math.sin(LEG_ELEV); d.knee=-(LEG_ELEV+Math.asin(Math.min(0.98,hK/d.tl))); }

const _col=new THREE.Color();
const rgb=h=>{ _col.setHex(h); return [_col.r,_col.g,_col.b]; };
const rgbMix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const rgbMul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const sstep=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const hash3=(x,y,z)=>{ const s=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453; return s-Math.floor(s); };
function vnoise(x,y,z){ const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi; const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),w=zf*zf*(3-2*zf);
  const c=(a,b,d)=>hash3(xi+a,yi+b,zi+d);
  return lerp(lerp(lerp(c(0,0,0),c(1,0,0),u),lerp(c(0,1,0),c(1,1,0),u),v),lerp(lerp(c(0,0,1),c(1,0,1),u),lerp(c(0,1,1),c(1,1,1),u),v),w); }
function mulberry(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const Y_AXIS=V3(0,1,0);
function mtx(px=0,py=0,pz=0,rx=0,ry=0,rz=0,sx=1,sy=sx,sz=sx,order='XYZ'){ return new THREE.Matrix4().compose(V3(px,py,pz),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz,order)),V3(sx,sy,sz)); }
// 피벗(px,py,pz)을 중심으로 돌린 뒤 (ox,oy,oz)만큼 옮긴다
function pivotM(px,py,pz,rx,ry,rz,ox=0,oy=0,oz=0){ return new THREE.Matrix4().makeTranslation(px+ox,py+oy,pz+oz).multiply(mtx(0,0,0,rx,ry,rz,1,1,1,'YXZ')).multiply(new THREE.Matrix4().makeTranslation(-px,-py,-pz)); }

// 여러 조각을 정점색이 든 한 덩어리로 합친다. 조각마다: 배치 → 변형(warp) → 전체 변환(M), 법선은 합친 뒤 조각별로 다시 구한다.
class GeoBuilder{
  constructor(){ this.pos=[]; this.nrm=[]; this.col=[]; this.idx=[]; }
  add(geo,cs,place,warp,M,post){
    const P=geo.attributes.position, C=geo.attributes.color, n=P.count;
    const v=new THREE.Vector3(), w=new THREE.Vector3(); const pa=new Float32Array(n*3), ca=[];
    for(let i=0;i<n;i++){
      v.fromBufferAttribute(P,i); w.copy(v); if(place) w.applyMatrix4(place);
      let c=typeof cs==='function'?cs(v,w,i):cs?cs:[C.getX(i),C.getY(i),C.getZ(i)];
      if(post) c=post(c,w,i);
      if(warp) warp(w,i);
      if(M) w.applyMatrix4(M);
      pa[i*3]=w.x; pa[i*3+1]=w.y; pa[i*3+2]=w.z; ca.push(c[0],c[1],c[2]);
    }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pa,3));
    if(geo.index) g.setIndex(Array.from(geo.index.array)); g.computeVertexNormals();
    const base=this.pos.length/3, N=g.attributes.normal;
    for(let i=0;i<n;i++){ this.pos.push(pa[i*3],pa[i*3+1],pa[i*3+2]); this.nrm.push(N.getX(i),N.getY(i),N.getZ(i)); this.col.push(ca[i*3],ca[i*3+1],ca[i*3+2]); }
    if(geo.index){ const I=geo.index.array; for(let k=0;k<I.length;k++) this.idx.push(base+I[k]); } else for(let k=0;k<n;k++) this.idx.push(base+k);
    g.dispose(); return this;
  }
  build(){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(this.pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(this.nrm,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(this.col,3)); g.setIndex(this.idx); g.computeBoundingSphere(); return g; }
}
// 격자 곡면 (u 0..1 × v 0..1). wrapV면 v 방향으로 닫는다.
function gridGeo(U,Vn,fn,wrapV=false,flip=false){
  const pos=[],idx=[]; const VV=wrapV?Vn:Vn+1;
  for(let i=0;i<=U;i++) for(let j=0;j<VV;j++){ const p=fn(i/U,j/Vn); pos.push(p[0],p[1],p[2]); }
  for(let i=0;i<U;i++) for(let j=0;j<Vn;j++){ const a=i*VV+j, b=(i+1)*VV+j, c=(i+1)*VV+(wrapV?(j+1)%VV:j+1), d=i*VV+(wrapV?(j+1)%VV:j+1); flip?idx.push(a,c,b,a,d,c):idx.push(a,b,c,a,c,d); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); return g;
}
const UNIT_SPH=new THREE.SphereGeometry(1,12,9);
const UNIT_SPH_LO=new THREE.SphereGeometry(1,8,6);   // 尸体上的内脏团
const UNIT_SPH_S=new THREE.SphereGeometry(1,9,7);
const UNIT_CONE=new THREE.ConeGeometry(1,1,4);
const UNIT_SPH_XS=new THREE.SphereGeometry(1,6,4);
// 手机档尸体（GEO_LOD<0.5）的球改用低一档的网格
const lowLod=()=>GEO_LOD<0.5;
const sphM=()=>lowLod()?UNIT_SPH_LO:UNIT_SPH, sphS=()=>lowLod()?UNIT_SPH_XS:UNIT_SPH_S;
// +x 방향으로 뻗은 가늘어지는 원통 (다리·수염·꼬리털)
function limbGeo(len,r0,r1,flat=1,radial=6,segs=3){ const g=new THREE.CylinderGeometry(r1,r0,len,radial,segs,true); g.rotateZ(-Math.PI/2); g.translate(len/2,0,0); if(flat!==1) g.scale(1,flat,1); return g; }

const ROACH_PAL={
  adult:{ pro:{center:0x5a2710,mid:0x7a3814,blot:0x2a0f05,rim:0xc89250,under:0x6a4024},
    head:0x3e1d0c, face:0x8a5530, eye:0x0b0604, mouth:0x2a1208,
    thD:0x2e1408, thV:0x6a3c1e, coxa:0x86522a, coxaRim:0x4a2812,
    abD:0x3a1809, abEdge:0x9a6636, abV:0x7a4824, abBand:0x3e200e, abMem:0xbc9868,
    wing:0x6e3413, wingBase:0x3a1807, wingEdge:0xa8662e, veinK:0.6,
    fem:0x5e2d11, femBase:0xa06c3a, tib:0x6c3718, tar:0x86502a, spine:0x2a1308, joint:0xa87244,
    ant:0x5c2d12, ant2:0x3c1b0a, cerc:0x603118 },
  nymph:{ pro:{center:0xe4d8bc,mid:0xeee4ce,blot:0xc9b48e,rim:0xf7f1e2,under:0xe6dcc4},
    head:0xe8dcc2, face:0xf2eadb, eye:0x1a120c, mouth:0xcbb894,
    thD:0xe6dac0, thV:0xf1e8d6, coxa:0xefe6d4, coxaRim:0xd4c4a4,
    abD:0xe4d8bc, abEdge:0xf4ecdc, abV:0xefe6d2, abBand:0xbfa782, abMem:0xf7f1e4,
    wing:0xe4d8bc, wingBase:0xd4c4a4, wingEdge:0xf4ecdc, veinK:0.9,
    fem:0xe0d2b4, femBase:0xeee4d0, tib:0xdaC8a6, tar:0xe4d6ba, spine:0xb09472, joint:0xefe4cc,
    ant:0xd8c6a4, ant2:0xbfa782, cerc:0xdccaa8 },
};
const _palRGB=new Map();
function palRGB(pal){ if(_palRGB.has(pal)) return _palRGB.get(pal); const o={}; for(const k in pal){ const v=pal[k]; o[k]=typeof v==='object'?Object.fromEntries(Object.entries(v).map(([a,b])=>[a,rgb(b)])):(k==='veinK'?v:rgb(v)); } _palRGB.set(pal,o); return o; }

// 前胸背板 — 실험실 표본과 같은 방패 모양. 头部 쪽은 반원, 배 쪽은 완만한 D자, 가장자리는 얇게 들린다.
const _proGeo=new Map();
function pronotumGeo(pal,low=false){
  const key=low?pal.pro:pal; if(_proGeo.has(key)) return _proGeo.get(key);
  const C=palRGB(pal).pro, N=low?20:32,K=low?4:7,W=.78,LF=.66,LR=.43,PW=3.3; const pos=[],col=[],idx=[];
  const edge=a=>{ const sx=Math.sin(a),cz=Math.cos(a); const r=cz>=0?1/Math.sqrt((sx/W)**2+(cz/LF)**2):1/Math.pow(Math.pow(Math.abs(sx)/W,PW)+Math.pow(Math.abs(cz)/LR,PW),1/PW); return [sx*r,cz*r]; };
  const topY=(u,a)=>{ const f=Math.max(0,Math.cos(a)),H=lerp(.13,lerp(.1,.16,(Math.cos(a)+1)/2),sstep(0,.55,u)); return .012+H*Math.pow(Math.max(0,1-u*u),.78)+.016*sstep(.74,.93,u)*(1-sstep(.93,1,u))-.08*f*u*u; };
  const botY=(u,a)=>{ const f=Math.max(0,Math.cos(a)); return -.008+.05*Math.max(0,1-u*u)-.08*f*u*u; };
  const tint=(u,x,z,under)=>{ if(under) return C.under; let c=rgbMix(C.mid,C.center,sstep(.75,.2,u)); const bl=Math.exp(-(((Math.abs(x)-.17)/.12)**2+((z-.02)/.24)**2)); c=rgbMix(c,C.blot,bl*.85); const mid=Math.exp(-((x/.05)**2+((z+.05)/.35)**2)); c=rgbMix(c,C.blot,mid*.35); return rgbMix(c,C.rim,sstep(.7,.84,u)); };
  const B=1+K*N;
  for(const under of [false,true]){ pos.push(0,under?botY(0,0):topY(0,0),0); const t=tint(0,0,0,under); col.push(...t);
    for(let k=1;k<=K;k++){ const u=k/K; for(let j=0;j<N;j++){ const a=j/N*TAU,[ex,ez]=edge(a),x=ex*u,z=ez*u; pos.push(x,under?botY(u,a):topY(u,a),z); col.push(...tint(u,x,z,under)); } } }
  const ring=(base,k,j)=>base+1+(k-1)*N+((j%N)+N)%N;
  for(const [base,flip] of [[0,false],[B,true]]){ for(let j=0;j<N;j++){ const a=base,b=ring(base,1,j),d=ring(base,1,j+1); flip?idx.push(a,d,b):idx.push(a,b,d); }
    for(let k=1;k<K;k++) for(let j=0;j<N;j++){ const a=ring(base,k,j),b=ring(base,k+1,j),cc=ring(base,k+1,j+1),d=ring(base,k,j+1); flip?idx.push(a,cc,b,a,d,cc):idx.push(a,b,cc,a,cc,d); } }
  for(let j=0;j<N;j++){ const t0=ring(0,K,j),t1=ring(0,K,j+1),b0=ring(B,K,j),b1=ring(B,K,j+1); idx.push(t0,b0,b1,t0,b1,t1); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx);
  _proGeo.set(key,g); return g;
}
// 몸 조각들. o: {M, warp, post, ...}
// 网格细分系数：活蟑螂用 1；尸体在俯视下只有几十像素，生成尸体时临时调低
let GEO_LOD=1;
function addPronotum(B,pal,o={}){
  // 옆과 앞 가장자리는 가슴을 덮으며 아래로 휜다
  const droop=(w,i)=>{ const lx=w.x/0.195, lz=(w.z-0.30)/0.165; w.y-=0.03*lx*lx+0.022*Math.max(0,lz)*Math.max(0,lz); if(o.warp) o.warp(w,i); };
  B.add(pronotumGeo(pal,lowLod()),null,mtx(0,0.104,0.30,0.1,0,0,0.25,0.2,0.25),droop,o.M,o.post); }
function addHead(B,pal,o={}){
  const C=palRGB(pal);
  B.add(sphM(),(v)=>rgbMix(C.head,C.face,sstep(0.1,0.9,v.z*0.7-v.y*0.5)),mtx(0,0.04,0.405,0.6,0,0,0.078,0.052,0.058),o.warp,o.M,o.post);
  for(const s of [1,-1]) B.add(sphS(),C.eye,mtx(s*0.054,0.052,0.418,0.2,0,s*0.35,0.018,0.034,0.026),o.warp,o.M,o.post);
  B.add(sphS(),C.mouth,mtx(0,0.008,0.452,0,0,0,0.03,0.018,0.02),o.warp,o.M,o.post);
  for(const s of [1,-1]){ const g=limbGeo(0.075,0.009,0.005,1,5,2); B.add(g,C.face,mtx(s*0.028,0.012,0.445,0,-Math.PI/2+s*0.25,-0.75),o.warp,o.M,o.post); }
}
function addThorax(B,pal,o={}){
  const C=palRGB(pal);
  B.add(sphM(),(v)=>rgbMix(C.thV,C.thD,sstep(-0.2,0.4,v.y)),mtx(0,0.064,0.13,0,0,0,0.15,0.042,0.18),o.warp,o.M,o.post);
  LEG_DEF.forEach((d,i)=>{ for(const s of [1,-1]){
    const ix=s*0.035, iz=d.z+[0.03,0.0,0.05][i], hx=s*0.13, hz=d.z; const cx=(ix+hx)/2, cz=(iz+hz)/2, len=Math.hypot(hx-ix,hz-iz);
    B.add(sphS(),(v)=>rgbMix(C.coxa,C.coxaRim,sstep(0.55,0.95,Math.hypot(v.x,v.z))),mtx(cx,0.028,cz,0,Math.atan2(-(hz-iz),hx-ix),0,len*0.62,0.013,0.05*(i===2?1.3:1)),o.warp,o.M,o.post); } });
}
// 배: 여섯 마디 판이 겹친 납작한 몸통. v0~v1로 잘라서 만들 수 있다(짓이겨져 끊긴 배).
function addAbdomen(B,pal,o={}){
  const C=palRGB(pal), v0=o.v0??0, v1=o.v1??1, zf=0.1, zr=-0.56, SEG=6.2;
  const prof=v=>{ const w=Math.max(0.035,0.205*Math.pow(Math.max(0,Math.sin(Math.PI*Math.min(1,0.2+v*0.82))),0.55)); return {w,hd:0.052*(1-0.55*v*v),hv:0.05*(1-0.5*v*v)}; };
  const U=Math.max(3,Math.round(22*(v1-v0)*GEO_LOD)), Vn=GEO_LOD<1?14:18;
  const g=gridGeo(U,Vn,(uu,j)=>{ const v=lerp(v0,v1,uu), z=lerp(zf,zr,v), f=(v*SEG)%1; const {w,hd,hv}=prof(v); const lip=1+0.05*sstep(0.72,0.94,f)-0.06*sstep(0.96,1,f);
    const th=j*TAU, co=Math.cos(th), si=Math.sin(th);
    const x=w*lip*Math.sign(co)*Math.pow(Math.abs(co),2/2.4), y=si>=0?hd*lip*Math.pow(si,2/2.0):-hv*Math.pow(-si,2/3.2);
    // 끊긴 끝은 안쪽으로 오므린다
    const cap=Math.min(1,(v0>0?sstep(0.18,0,uu):sstep(0.08,0,uu)*0.6)+(v1<1?sstep(0.82,1,uu):sstep(0.9,1,v)*0.95));
    return [x*(1-cap*0.9),0.068+y*(1-cap*0.75),z]; },true);
  B.add(g,(p,w,i)=>{ const row=Math.floor(i/Vn), uu=row/U, v=lerp(v0,v1,uu), f=(v*SEG)%1, th=(i%Vn)/Vn*TAU, si=Math.sin(th), co=Math.abs(Math.cos(th));
    let c; if(si>=0){ c=rgbMix(C.abEdge,C.abD,sstep(0.05,0.5,si)); c=rgbMix(c,C.abBand,sstep(0.8,0.96,f)*0.8); }
    else { c=rgbMix(C.abV,C.abEdge,sstep(0.75,1,co)*0.5); c=rgbMix(c,C.abBand,sstep(0.82,0.96,f)*0.9); c=rgbMix(c,C.abMem,sstep(0.12,0,f)*0.7); }
    return c; },null,o.warp,o.M,o.post);
}
// 앞날개(前翅) 한 장. side +1 / -1. 右侧 날개(-1)가 위로 겹친다.
function addWing(B,pal,side,o={}){
  const C=palRGB(pal), uMax=o.uMax??1, z0=0.22, z1=-0.64, lift=side<0?0.007:0, T=0.007;
  const shape=(u,v)=>{ const te=clamp((u-0.76)/0.24,0,1); const hs=(0.035+0.095*Math.pow(Math.max(0,Math.sin(Math.PI*clamp(u*0.95+0.08,0,0.86))),0.45))*Math.sqrt(Math.max(0.0004,1-te*te));
    const cx=0.088+0.004*Math.sin(Math.PI*u)-0.05*sstep(0.55,1,u); const xin=cx-hs, xout=cx+hs; const x=lerp(xin,xout,v);
    const z=lerp(z0,z1,u);
    const yb=0.096+0.034*sstep(0,0.22,u)-0.03*sstep(0.3,1,u);
    // 안쪽 절반은 평평한 등, 바깥쪽은 옆구리로 휘어 내려간다
    const y=yb+0.01*Math.cos(Math.PI*0.5*clamp((v-0.3)/0.7,0,1))-0.052*Math.pow(sstep(0.5,1,v),1.25)-0.004*sstep(0.12,0,v)+lift*(1-v);
    return [side*x,y,z]; };
  const U=Math.max(4,Math.round(22*uMax*GEO_LOD)), Vn=GEO_LOD<1?7:10;
  const tear=o.tear||0;
  const top=gridGeo(U,Vn,(uu,v)=>{ const u=uu*uMax; const p=shape(u,v); return p; },false,side>0);
  const bot=gridGeo(U,Vn,(uu,v)=>{ const u=uu*uMax; const p=shape(u,v); p[1]-=T*(1-0.6*v); return p; },false,side<0);
  const colAt=(i)=>{ const row=Math.floor(i/(Vn+1)), u=row/U*uMax, v=(i%(Vn+1))/Vn;
    let c=rgbMix(C.wingBase,C.wing,sstep(0.02,0.2,u)); c=rgbMix(c,C.wingEdge,sstep(0.6,1,v)*0.55+sstep(0.75,1,u)*0.25);
    const fv=(v*7.5-u*2.0*(1-v)+10)%1; if(fv<0.13) c=rgbMul(c,C.veinK);
    if(v>0.3&&((u*30)%1)<0.07) c=rgbMul(c,0.86);
    if(v<0.38&&u<0.42&&((Math.hypot(u*1.4,v)*10)%1)<0.13) c=rgbMul(c,0.7);
    if(tear&&u>uMax-0.08) c=rgbMul(c,0.6);
    return c; };
  B.add(top,(p,w,i)=>colAt(i),null,o.warp,o.M,o.post);
  B.add(bot,(p,w,i)=>rgbMul(colAt(i),0.75),null,o.warp,o.M,o.post);
}
function addCerci(B,pal,o={}){ const C=palRGB(pal); for(const s of [1,-1]){ const g=limbGeo(0.12,0.013,0.004,0.8,5,6);
  B.add(g,(v)=>((v.x*70)%2<1)?C.cerc:rgbMul(C.cerc,0.7),mtx(s*0.04,0.058,-0.53,0,Math.PI/2-s*0.35,0.08),o.warp,o.M,o.post); } }
// 몸통 (다리·더듬이 제외) 한 덩어리
function buildRoachBody(pal,o={}){
  const B=new GeoBuilder(), w=o.wings!==false;
  addAbdomen(B,pal,o); addThorax(B,pal,o); addPronotum(B,pal,o); addHead(B,pal,o); addCerci(B,pal,o);
  if(w){ addWing(B,pal,1,o); addWing(B,pal,-1,o); }
  return B.build();
}
// 가시: base에서 dir 방향으로
function addSpine(B,col,bx,by,bz,dir,len,r,M){ const q=new THREE.Quaternion().setFromUnitVectors(Y_AXIS,dir); const m=new THREE.Matrix4().compose(V3(bx+dir.x*len*0.5,by+dir.y*len*0.5,bz+dir.z*len*0.5),q,V3(r,len,r)); if(M) m.premultiply(M); B.add(UNIT_CONE,col,m); }
// 넓적다리: 납작하고 도톰하다. 배 쪽 모서리에 짧은 가시 한 줄.
function addFemur(B,i,pal,M){
  const C=palRGB(pal), d=LEG_DEF[i], w=d.w, L=d.fl;
  const lo=lowLod(), g=limbGeo(L,0.03*w,0.02*w,0.55,lo?5:7,lo?3:5);
  B.add(g,(v)=>rgbMix(C.femBase,C.fem,sstep(0.02,0.3*L,v.x)),M,(p)=>{ const t=clamp(p.x/L,0,1), k=1+0.22*Math.sin(Math.PI*Math.pow(t,0.8)); p.y*=k; p.z*=k; });
  B.add(sphS(),C.joint,mtx(0.01,0,0,0,0,0,0.022*w,0.013*w,0.022*w).premultiply(M||new THREE.Matrix4()));
  const n=lo?[2,2,3][i]:[3,4,5][i];
  for(let k=0;k<n;k++){ const t=0.42+0.5*k/Math.max(1,n-1), sd=k%2?1:-1, r=0.022*w*(1-0.35*t)*1.2; const a=sd*2.3;
    const dir=V3(Math.cos(0.75),Math.sin(0.75)*Math.cos(a)*0.55,Math.sin(0.75)*Math.sin(a)).normalize();
    addSpine(B,C.spine,t*L,Math.cos(a)*r*0.5,Math.sin(a)*r,dir,0.028*w,0.0055*w,M); }
}
// 종아리 + 발목마디 5개 + 爪. 종아리엔 굵은 가시가 사방으로 돋는다.
function addTibia(B,i,pal,M){
  const C=palRGB(pal), d=LEG_DEF[i], w=d.w, L=d.tl;
  const lo=lowLod(), g=limbGeo(L,0.019*w,0.0125*w,0.72,lo?4:6,lo?2:4);
  B.add(g,(v)=>rgbMix(C.joint,C.tib,sstep(0,0.15*L,v.x)),M);
  const n=lo?[4,5,6][i]:[7,9,12][i], A=[0.75,-0.75,2.35,-2.35];
  for(let k=0;k<n;k++){ const t=0.12+0.83*k/(n-1), a=A[k%4]+(hash3(i,k,1)-0.5)*0.4, r=lerp(0.019,0.0125,t)*w;
    const tilt=0.5+hash3(i,k,2)*0.2, dir=V3(Math.cos(tilt),Math.sin(tilt)*Math.cos(a),Math.sin(tilt)*Math.sin(a)).normalize();
    addSpine(B,C.spine,t*L,Math.cos(a)*r*0.72,Math.sin(a)*r,dir,(0.042+0.024*hash3(i,k,3))*w*(i===2?1.12:1),0.0062*w,M); }
  for(const a of [2.7,-2.7,Math.PI]){ const dir=V3(Math.cos(0.32),Math.sin(0.32)*Math.cos(a),Math.sin(0.32)*Math.sin(a)).normalize(); addSpine(B,C.spine,L*0.99,Math.cos(a)*0.01*w,Math.sin(a)*0.012*w,dir,0.05*w,0.0065*w,M); }
  // 발목마디: 종아리가 바닥을 향해 꺾인 만큼 되돌려 바닥에 눕힌다
  const tA=-(LEG_ELEV+d.knee)*0.92, seg=[0.4,0.18,0.14,0.1,0.18]; let m=new THREE.Matrix4().makeTranslation(L,0,0).multiply(mtx(0,0,0,0,0.12,tA));
  for(let k=0;k<5;k++){ const sl=d.tar*seg[k], r0=(0.011-k*0.0008)*w, r1=r0*0.8; const sg=limbGeo(sl,r0,r1,0.8,lo?4:5,1);
    const mm=m.clone(); if(M) mm.premultiply(M); B.add(sg,(v)=>rgbMix(C.tar,C.joint,sstep(sl*0.75,sl,v.x)*0.7),mm);
    m=m.multiply(new THREE.Matrix4().makeTranslation(sl,0,0)).multiply(mtx(0,0,0,0,0,-0.06)); }
  for(const s of [1,-1]){ const dir=V3(0.8,-0.45,s*0.35).normalize(); const mm=m.clone(); if(M) mm.premultiply(M); addSpine(B,C.spine,0,0,0,dir,0.022*w,0.004*w,mm); }
}
function antGeo(pal){ const C=palRGB(pal); const g=new THREE.CylinderGeometry(0.0048,0.0074,0.38,4,8,true); const B=new GeoBuilder(); B.add(g,(v)=>(Math.floor((v.y+0.19)/0.38*8)%2)?C.ant:C.ant2); return B.build(); }
const ROACH_GEO={};
function roachGeos(kind='adult'){
  if(ROACH_GEO[kind]) return ROACH_GEO[kind];
  const pal=ROACH_PAL[kind], nymph=kind==='nymph';
  const body=buildRoachBody(pal,{wings:!nymph});
  // 활동 중인 바퀴의 다리는 무릎을 서 있는 각도로 굳힌 한 덩어리(좌우 따로), 더듬이는 세 마디를 굳힌 한 가닥 — 한 마리 19개 → 9개 메시
  const leg={}; for(const side of [1,-1]) for(let i=0;i<3;i++) leg[side*(i+1)]=legWholeGeo(i,side*LEG_DEF[i].ky,LEG_DEF[i].knee,pal);
  return ROACH_GEO[kind]={pal,body,leg,ant:antennaGeo(pal)};
}
// 한 다리 전체(넓적다리+종아리)를 무릎 각도 하나로 굳힌 모양 — 시체용, 활동 중인 바퀴용
function legWholeGeo(i,ky,kz,pal=ROACH_PAL.adult){ const B=new GeoBuilder(); addFemur(B,i,pal); addTibia(B,i,pal,new THREE.Matrix4().makeTranslation(LEG_DEF[i].fl,0,0).multiply(mtx(0,0,0,0,ky,kz))); return B.build(); }
// 더듬이 세 마디(마디마다 0.38 길이, -0.1 rad 휨, 끝으로 갈수록 가늘게)를 한 가닥으로
function antennaGeo(pal){ const seg=antGeo(pal), B=new GeoBuilder(), acc=new THREE.Matrix4();
  for(let i=0;i<3;i++){ acc.multiply(new THREE.Matrix4().makeTranslation(0,i?0.38:0,0)).multiply(new THREE.Matrix4().makeRotationX(-0.1));
    B.add(seg,null,acc.clone().multiply(mtx(0,0.19,0,0,0,0,1-i*0.25,1,1-i*0.25))); }
  seg.dispose(); return B.build(); }

function makeRoach(kind='adult'){
  const GS=roachGeos(kind), nymph=kind==='nymph';
  const shell=nymph?MAT.nymphShell:MAT.roachShell, limb=nymph?MAT.nymphLimb:MAT.roachLimb;
  const g=new THREE.Group(); const L=ROACH_L; const parts={legs:[],ants:[]};
  parts.body=new THREE.Mesh(GS.body,shell); parts.body.castShadow=true; parts.body.receiveShadow=true; g.add(parts.body);
  for(const s of [1,-1]){ const base=new THREE.Group(); base.position.set(s*0.032,0.052,0.462); base.rotation.order='YXZ'; base.rotation.set(1.25,s*0.42,0); g.add(base); base.add(new THREE.Mesh(GS.ant,limb)); parts.ants.push({base,s}); }
  for(const s of [1,-1]) LEG_DEF.forEach((d,i)=>{ const hip=new THREE.Group(); hip.position.set(s*0.13,HIP_Y,d.z); g.add(hip); const fem=new THREE.Group(); hip.add(fem);
    fem.add(new THREE.Mesh(GS.leg[s*(i+1)],limb)); parts.legs.push({hip,fem,s,i,d}); });
  g.scale.setScalar(L);
  const st={phase:rand(TAU),antT:rand(TAU),dead:0};
  function pose(speedNorm,dt,dead=0){
    st.phase+=dt*(6+speedNorm*26); st.antT+=dt*4;
    for(const lg of parts.legs){ const d=lg.d; const tri=((lg.i+(lg.s>0?0:1))%2===0)?1:-1; const sw=Math.sin(st.phase)*tri; const amp=0.10+0.32*speedNorm;
      const yw=d.yaw-sw*amp*(1-dead)+dead*0.25*(lg.i-1);
      lg.hip.rotation.y=lg.s>0?(yw-Math.PI/2):(1.5*Math.PI-yw);
      const lift=Math.max(0,sw)*0.45*speedNorm*(1-dead);
      lg.fem.rotation.z=(LEG_ELEV+lift)*(1-dead)+dead*0.12; }
    for(const a of parts.ants){ const w=Math.sin(st.antT*1.7+a.s)*0.22; a.base.rotation.set(1.25+Math.sin(st.antT+a.s*2)*0.12+Math.sin(st.antT*2.3+a.s)*0.06,a.s*(0.42+w),0); }
    g.scale.set(L*(1+dead*0.3),L*(1-dead*0.7),L);
  }
  pose(0,0);
  return {g,parts,pose,st};
}
const NYMPH_SCALE=0.46;
function makeNymph(){
  const m=makeRoach('nymph');
  const adultPose=m.pose;
  m.pose=(speedNorm,dt,dead=0)=>{ adultPose(speedNorm,dt,dead); m.g.scale.multiplyScalar(NYMPH_SCALE); };
  m.pose(0,0,0);
  return m;
}
// 걷는 자세 두 가지(세 다리씩 번갈아)를 굳힌 다리+더듬이 — 엔딩 떼거리용
function legPoseGeo(kind,phase){
  const m=makeRoach(kind); m.st.phase=phase; m.pose(1,0,0); m.g.scale.setScalar(1); m.g.position.set(0,0,0); m.g.rotation.set(0,0,0); m.g.updateMatrixWorld(true);
  const B=new GeoBuilder(); m.g.traverse(o=>{ if(o.isMesh&&o!==m.parts.body) B.add(o.geometry,null,null,null,o.matrixWorld); });
  return B.build();
}

const SWARM_LEGS=[];
