// 尸体形状与实例化绘制 Corpses
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 시체 ─────────
// 한 구 = 몸통 변형(껍데기 + 짜낸 내장, 변형마다 인스턴스 한 묶음) + 다리 6개(따로 인스턴스).
// 막 죽은 시체는 다리가 한동안 경련한다. 吸尘器는 시체를 빨아들이지만 바닥에 밴 진물은 남는다.
const CORPSE_VARIANTS={crushed:8,belly:4,burnt:4};
const GOO_RGB=[0xEFE6CF,0xE6D9B6,0xDCC89A,0xF5EFDF,0xD2BC88].map(rgb);
const GUT_RGB=[rgb(0x6e3c1a),rgb(0x3a1d0b),rgb(0xa06a3a)];
// seg: 每个控制点分几段，rad: 截面边数。内脏在俯视下只有几个像素宽，用粗一些的网格即可
function tubeOn(B,pts,r,colFn,M,seg=6,rad=6){ const curve=new THREE.CatmullRomCurve3(pts.map(p=>V3(p[0],p[1],p[2]))); const TS=Math.max(8,pts.length*seg); const g=new THREE.TubeGeometry(curve,TS,r,rad,false); B.add(g,(v,w,i)=>colFn(Math.floor(i/(rad+1))/TS),null,null,M); }
// 더듬이: 바닥에 늘어진 채 굳은 곡선
function corpseAntennae(B,R,M,y0,broken){
  const C=palRGB(ROACH_PAL.adult);
  for(const s of [1,-1]){ const pts=[[s*0.03,y0,0.46]]; let x=s*0.03,z=0.46,a=s*R(0.1,0.7),y=y0; const n=broken&&s===1?3:7;
    for(let k=0;k<n;k++){ a+=R(-0.5,0.5); x+=Math.sin(a)*0.16; z+=Math.cos(a)*0.16; y=Math.max(0.006,y-0.03); pts.push([x,y,z]); }
    tubeOn(B,pts,0.0055,(t)=>((t*n*3)%1<0.5)?C.ant:C.ant2,M,GEO_LOD<1?4:6,GEO_LOD<1?4:6); }
}
function lumpWarp(seed,amp){ return (w)=>{ const k=1+(vnoise(w.x*38+seed,w.y*38,w.z*38)-0.5)*amp; w.x*=k; w.z*=k; }; }
function addGooBlob(B,R,x,z,rx,ry,rz,colIdx,y0=0){ const c0=GOO_RGB[colIdx%GOO_RGB.length], c1=GOO_RGB[(colIdx+2)%GOO_RGB.length], sd=R(0,99);
  B.add(lowLod()?UNIT_SPH_XS:UNIT_SPH_LO,(v)=>rgbMix(c0,c1,vnoise(v.x*3+sd,v.y*3,v.z*3)),mtx(x,y0+Math.max(0.003,ry*0.55),z,0,R(0,TAU),0,rx,ry,rz),(w)=>{ const k=1+(vnoise(w.x*30+sd,w.y*30,w.z*30)-0.5)*0.34; w.x=x+(w.x-x)*k; w.z=z+(w.z-z)*k; w.y=Math.max(0.002,w.y); }); }
function buildCorpseGeo(mode,v){
  GEO_LOD=QUALITY.corpseLod; try{ return buildCorpseGeoLod(mode,v); } finally{ GEO_LOD=1; }
}
function buildCorpseGeoLod(mode,v){
  const R0=mulberry(v*7919+(mode==='crushed'?11:mode==='belly'?23:37)), R=(a,b)=>a+(b-a)*R0(), pick=a=>a[Math.floor(R0()*a.length)];
  const pal=ROACH_PAL.adult, shell=new GeoBuilder(), goo=new GeoBuilder(); let gooN=0; const legs=[];
  const legYaw=(i,s,dev)=>{ const yw=LEG_DEF[i].yaw+dev; return s>0?(yw-Math.PI/2):(1.5*Math.PI-yw); };
  if(mode==='crushed'){
    // 짜부: 납작하게 퍼지고, 배가 터져 두세 조각으로 갈라지고, 그 틈으로 내장이 짜여 나온다
    const fy=R(0.2,0.3), fx=R(1.28,1.5), sd=R(0,50);
    const crush=(amp,f=fy)=>(w)=>{ w.x*=fx; w.y=0.004+w.y*f+(vnoise(w.x*26+sd,w.z*26,sd)-0.5)*amp; };
    const burstA=R(0,TAU), bdx=Math.cos(burstA), bdz=Math.sin(burstA);   // 곤죽이 튀어 나간 쪽
    const vs=R(0.22,0.42), zs=lerp(0.1,-0.56,vs), vs2=R(0.58,0.78), zs2=lerp(0.1,-0.56,vs2);
    const midM=pivotM(0,0,zs,R(-0.08,0.08),R(-0.5,0.5),R(-0.12,0.12),R(-0.08,0.08),0,-R(0.08,0.14));
    const rearM=pivotM(0,0,zs2,R(-0.1,0.1),R(-0.9,0.9),R(-0.15,0.15),R(-0.14,0.14),0,-R(0.2,0.32));
    addThorax(shell,pal,{warp:crush(0.01)});
    addAbdomen(shell,pal,{v0:0,v1:vs,warp:crush(0.012)});
    addAbdomen(shell,pal,{v0:vs+0.04,v1:vs2,warp:crush(0.014),M:midM});
    addAbdomen(shell,pal,{v0:vs2+0.04,v1:1,warp:crush(0.012),M:rearM});
    addCerci(shell,pal,{warp:crush(0.004,0.8),M:rearM});
    // 前胸背板: 금이 가서 한쪽이 들린다
    const ca=R(0,Math.PI), cn=[Math.cos(ca),Math.sin(ca)], co=R(-0.04,0.04);
    const crackD=(w)=>w.x*cn[0]+(w.z-0.3)*cn[1]-co;
    const proM=pivotM(0,0.05,0.3,R(-0.12,0.08),R(-0.4,0.4),(R0()<0.5?-1:1)*R(0.12,0.4),R(-0.04,0.04),0,R(0.02,0.07));
    addPronotum(shell,pal,{M:proM,warp:(w)=>{ const d=crackD(w); crush(0.006,0.5)(w); if(d>0){ w.y+=0.016; w.x+=cn[0]*0.018; w.z+=cn[1]*0.018; } },post:(c,w)=>Math.abs(crackD(w))<0.014?rgbMul(c,0.3):c});
    // 头部: 앞으로 짜여 나가거나 떨어져 나간다
    const detach=R0()<0.5, hd=detach?R(0.14,0.26):R(0.05,0.1), ha=R(-0.8,0.8);
    const headM=pivotM(0,0.03,0.42,R(-0.4,0.4),ha,R(-0.5,0.5),Math.sin(ha)*hd,-0.01,Math.cos(ha)*hd);
    addHead(shell,pal,{M:headM,warp:crush(0.004,0.7)});
    corpseAntennae(shell,R,headM,0.02,R0()<0.6);
    // 날개: 한 장은 뜯겨 옆으로 날아가고, 한 장은 구겨져 비틀린다
    const torn=R0()<0.5?1:-1;
    for(const s of [1,-1]){ const off=s===torn; const uMax=R0()<0.5?R(0.5,0.85):1;
      const wM=off?pivotM(s*0.07,0.1,0.2,R(-0.15,0.15),s*R(0.6,1.7),s*R(0.1,0.6),s*R(0.14,0.3),0.012,R(-0.25,0.05))
                 :pivotM(s*0.07,0.1,0.2,0,s*R(0.3,0.75),s*R(-0.05,0.15),s*R(0.04,0.1),0,R(-0.08,0.02));
      addWing(shell,pal,s,{uMax,tear:uMax<1,M:wM,warp:(w)=>{ crush(0.024,0.4)(w); w.y+=Math.abs(Math.sin(w.z*22+sd))*0.007; }}); }
    // 내장: 갈라진 틈마다 크림색 곤죽이 부풀어 나오고, 한쪽으로 쭉 짜여 번진다
    const splits=[[0,zs-0.05],[R(-0.06,0.06),zs2-0.17]];
    for(const [sx,sz] of splits){
      addGooBlob(goo,R,sx+bdx*0.04,sz+bdz*0.04,R(0.14,0.22),0.008,R(0.1,0.16),4); gooN++;          // 바닥에 얇게 퍼진 막
      addGooBlob(goo,R,sx+bdx*0.02,sz,R(0.1,0.15),0.012,R(0.07,0.1),0,0.045);                     // 껍데기 위로 넘친 막
      for(let k=0;k<Math.floor(R(5,8));k++){ const t=R(0,1), rr=R(0,0.08); addGooBlob(goo,R,sx+bdx*t*0.24+R(-rr,rr),sz+bdz*t*0.16+R(-rr,rr)*0.5,R(0.06,0.13),R(0.014,0.026),R(0.05,0.1),k,t<0.5?0.03:0.008); gooN++; }
    }
    for(let k=0;k<Math.floor(R(3,6));k++){ const s=R0()<0.5?1:-1; addGooBlob(goo,R,s*R(0.2,0.3),R(-0.3,0.2),R(0.04,0.08),R(0.012,0.022),R(0.04,0.09),k+2); }
    addGooBlob(goo,R,Math.sin(ha)*hd*0.5,0.36+Math.cos(ha)*hd*0.5,R(0.04,0.07),R(0.014,0.024),R(0.04,0.06),1);
    // 소화관: 틈에서 삐져나와 늘어진다
    for(let gI=0;gI<2;gI++){ const [sx,sz]=splits[gI]; const pts=[[sx,0.03,sz+0.04]]; let x=sx, z=sz, a=burstA+R(-0.9,0.9); for(let k=0;k<6;k++){ a+=R(-1,1); x+=Math.cos(a)*R(0.04,0.08); z+=Math.sin(a)*R(0.03,0.07); pts.push([x,R(0.03,0.05),z]); }
      tubeOn(goo,pts,R(0.013,0.019),(t)=>{ const q=vnoise(t*9,gI*5,3); return q<0.4?GUT_RGB[1]:q>0.72?GUT_RGB[2]:GUT_RGB[0]; },null,3,4); }
    for(let k=0;k<Math.floor(R(4,7));k++){ const [sx,sz]=splits[k%2]; const pts=[]; let x=sx+R(-0.08,0.08), z=sz+R(-0.05,0.05), a=R(0,TAU); for(let j=0;j<5;j++){ a+=R(-1.6,1.6); x+=Math.cos(a)*0.03; z+=Math.sin(a)*0.03; pts.push([x,R(0.03,0.045),z]); } tubeOn(goo,pts,0.0035,()=>rgb(0xd8b04a),null,3,3); }
    for(let k=0;k<Math.floor(R(10,16));k++){ const [sx,sz]=splits[k%2]; const a=R(0,TAU), rr=R(0.02,0.18); const r=R(0.008,0.016); goo.add(sphS(),GOO_RGB[3],mtx(sx+Math.cos(a)*rr+bdx*0.05,R(0.03,0.045),sz+Math.sin(a)*rr*0.7+bdz*0.05,0,0,0,r,r*0.8,r)); }
    // 다리: 몸에 붙은 채 사방으로 뻗고, 몇 개는 꺾여 들리고, 한두 개는 떨어져 나간다
    const lost=new Set(); if(R0()<0.7) lost.add(Math.floor(R(0,6))); if(R0()<0.3) lost.add(Math.floor(R(0,6)));
    for(let k=0;k<6;k++){ const i=k%3, s=k<3?1:-1, d=LEG_DEF[i];
      if(lost.has(k)){ const a=R(0,TAU), rr=R(0.3,0.55); legs.push({i,style:R0()<0.5?'splayP':'splayN',x:Math.cos(a)*rr,y:0.012,z:Math.sin(a)*rr,ry:R(0,TAU),rz:R(-0.03,0.05),rx:R(-0.3,0.3),tw:0}); continue; }
      const up=R0()<0.3, hz=i===2?(d.z-0.04):d.z;
      legs.push({i,style:s>0?'splayP':'splayN',x:s*0.13*fx,y:0.014,z:hz,ry:legYaw(i,s,R(-0.7,0.7)),rz:up?R(0.45,1.0):R(-0.03,0.16),rx:R(-0.35,0.35),tw:R(0.5,1)}); }
  } else if(mode==='belly'){
    // 살충제: 등을 대고 뒤집혀 다리를 오므린 채 굳는다
    const roll=R(-0.15,0.15), flipM=mtx(0,ROACH_TOP,0,R(-0.06,0.06),0,Math.PI+roll,1,1,1);
    const curl=(w)=>{ if(w.z<-0.15){ const t=(-0.15-w.z)/0.45; w.y-=0.05*t*t; } };
    addAbdomen(shell,pal,{M:flipM,warp:curl}); addThorax(shell,pal,{M:flipM}); addPronotum(shell,pal,{M:flipM}); addHead(shell,pal,{M:flipM}); addCerci(shell,pal,{M:flipM,warp:curl});
    addWing(shell,pal,1,{M:flipM}); addWing(shell,pal,-1,{M:flipM});
    corpseAntennae(shell,R,null,0.09,false);
    addGooBlob(goo,R,R(-0.03,0.03),0.52,0.035,0.006,0.03,1); gooN++;
    const hy=ROACH_TOP-HIP_Y+0.01;
    for(let k=0;k<6;k++){ const i=k%3, s=k<3?1:-1, d=LEG_DEF[i];
      legs.push({i,style:'curl',x:-s*0.13*Math.cos(roll),y:hy,z:d.z,ry:legYaw(i,-s,R(-0.3,0.3)),rz:R(0.75,1.25),rx:R(-0.35,0.35),tw:R(0.7,1.2)}); }
  } else {
    // 불: 까맣게 그을고 쪼그라든다. 날개는 타서 오그라들고, 배 끝이 말려 올라간다
    const sd=R(0,50);
    const charPost=(c,w)=>{ const n=vnoise(w.x*34+sd,w.y*34,w.z*34), lum=(c[0]+c[1]+c[2])/3; let o=rgbMix(rgb(0x120c08),rgb(0x3a1a0a),clamp(lum*3,0,1)*0.6); if(n>0.74) o=rgbMix(o,rgb(0x6f6a66),(n-0.74)*3); else if(n<0.22) o=rgbMix(o,rgb(0x6a2a0e),(0.22-n)*2.5); return o; };
    const shrink=(w)=>{ w.x*=0.9; w.y*=0.92; w.z*=0.93; if(w.z<-0.12){ const t=(-0.12-w.z)/0.45; w.y+=0.1*t*t; } };
    addAbdomen(shell,pal,{warp:shrink,post:charPost}); addThorax(shell,pal,{warp:shrink,post:charPost}); addPronotum(shell,pal,{warp:shrink,post:charPost}); addHead(shell,pal,{warp:shrink,post:charPost}); addCerci(shell,pal,{warp:shrink,post:charPost});
    for(const s of [1,-1]) addWing(shell,pal,s,{uMax:R(0.4,0.7),tear:true,post:charPost,warp:(w)=>{ shrink(w); const e=Math.abs(w.x)/0.2; w.y+=0.04*e*e+(vnoise(w.x*30+sd,w.z*30,1)-0.5)*0.012; }});
    corpseAntennae(shell,R,null,0.03,true);
    for(let k=0;k<Math.floor(R(2,4));k++){ const a=R(0,TAU); const r=R(0.012,0.022); goo.add(sphS(),rgb(0xb8894a),mtx(Math.cos(a)*0.12,0.07,R(-0.3,0.1),0,0,0,r,r*0.7,r)); gooN++; }
    for(let k=0;k<6;k++){ const i=k%3, s=k<3?1:-1, d=LEG_DEF[i];
      legs.push({i,style:'fold',x:s*0.12,y:0.03,z:d.z*0.93,ry:legYaw(i,s,R(-0.5,0.3)),rz:R(0.85,1.1),rx:R(-0.25,0.25),tw:R(0.3,0.6)}); }
  }
  return {shell:shell.build(),goo:gooN?goo.build():null,legs};
}
const CORPSE_LEG_KNEE={splayP:[0.55,-0.04],splayN:[-0.55,-0.04],curl:[0,1.35],fold:[0,-1.75]};
class Corpses{
  constructor(scene,cap=600){
    this.scene=scene; this.cap=cap; this.list=[]; this.head=0; this.kinds={}; this.legMesh={}; this.twitching=new Set();
    this.d=new THREE.Object3D(); this.m4=new THREE.Matrix4(); this.m5=new THREE.Matrix4(); this.zero=new THREE.Matrix4().makeScale(0,0,0);
  }
  // 尸体贴在地上，投影几乎看不见，不画阴影能省一半三角形
  mkMesh(geo,mat,cap){ const m=new THREE.InstancedMesh(geo,mat,cap); m.count=0; m.visible=false; m.frustumCulled=false; m.castShadow=false; m.receiveShadow=true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.userData.owner=[]; this.scene.add(m); return m; }
  // 实例始终紧凑排在 0..count-1：回收时把最后一个挪进空位，只画还在的尸体
  alloc(m,obj,key){ const i=Math.min(m.count,m.instanceMatrix.count-1); m.count=i+1; m.userData.owner[i]=[obj,key]; m.visible=true; return i; }
  release(m,i){ const last=m.count-1, O=m.userData.owner;
    if(i!==last){ m.getMatrixAt(last,this.m5); m.setMatrixAt(i,this.m5); O[i]=O[last]; O[i][0][O[i][1]]=i; }
    O[last]=null; m.count=last; if(!m.count) m.visible=false; m.instanceMatrix.needsUpdate=true; }
  variant(mode,v){ const K=this.kinds[mode]||(this.kinds[mode]=[]); if(K[v]) return K[v];
    const geo=buildCorpseGeo(mode,v);
    return K[v]={shell:this.mkMesh(geo.shell,mode==='burnt'?MAT.charShell:MAT.corpseShell,this.cap),goo:geo.goo?this.mkMesh(geo.goo,MAT.goo,this.cap):null,legs:geo.legs}; }
  legs(style,i){ const k=style+i; if(this.legMesh[k]) return this.legMesh[k];
    let geo; GEO_LOD=QUALITY.corpseLod; try{ geo=legWholeGeo(i,...CORPSE_LEG_KNEE[style]); } finally{ GEO_LOD=1; }
    return this.legMesh[k]=this.mkMesh(geo,style==='fold'?MAT.charLimb:MAT.corpseLimb,this.cap*2); }
  // 첫 시체가 나올 때마다 모양을 만들면 순간 끊긴다. 게임을 시작하면 틈틈이 하나씩 미리 만들어 둔다.
  prewarm(){ const jobs=[]; for(const mode in CORPSE_VARIANTS) for(let v=0;v<CORPSE_VARIANTS[mode];v++) jobs.push(()=>this.variant(mode,v));
    for(const st of ['splayP','splayN','curl','fold']) for(let i=0;i<3;i++) jobs.push(()=>this.legs(st,i));
    const step=()=>{ const j=jobs.shift(); if(!j) return; j(); setTimeout(step,40); }; setTimeout(step,300); }
  clear(){ for(const c of this.list) if(c) this.drop(c); this.list.length=0; this.head=0; this.twitching.clear(); }
  add(x,z,h,mode='crushed'){
    if(!CORPSE_VARIANTS[mode]) mode='crushed';
    const slot=this.head%this.cap; this.head++; if(this.list[slot]) this.drop(this.list[slot]);
    const V=this.variant(mode,Math.floor(Math.random()*CORPSE_VARIANTS[mode]));
    const c={x,z,h,sc:ROACH_L*rand(0.92,1.08),V,mode,alive:true,t:0,tw:mode==='belly'?rand(4,6.5):mode==='burnt'?1.2:rand(2.2,3.4),ph:rand(TAU),si:-1,gi:-1,legs:[]};
    c.si=this.alloc(V.shell,c,'si'); if(V.goo) c.gi=this.alloc(V.goo,c,'gi');
    c.legs=V.legs.map(L=>{ const m=this.legs(L.style,L.i); const g={L,m,i:-1,ph:rand(TAU),f:rand(9,17)}; g.i=this.alloc(m,g,'i'); return g; });
    this.list[slot]=c; this.place(c); if(c.tw>0) this.twitching.add(c);
    return c;
  }
  base(c,out){ const d=this.d; d.position.set(c.x,0,c.z); d.rotation.set(0,c.h,0); d.scale.setScalar(c.sc); d.updateMatrix(); return out.copy(d.matrix); }
  place(c){
    const B=this.base(c,this.m4);
    c.V.shell.setMatrixAt(c.si,B); c.V.shell.instanceMatrix.needsUpdate=true;
    if(c.V.goo){ c.V.goo.setMatrixAt(c.gi,B); c.V.goo.instanceMatrix.needsUpdate=true; }
    this.placeLegs(c,B);
  }
  placeLegs(c,B){
    const k=c.tw>0?clamp(c.tw/2,0,1):0, d=this.d;
    for(const g of c.legs){ const L=g.L, a=k*L.tw;
      // 경련: 불규칙하게 튀었다가 잦아든다
      const j=a?Math.sin(c.t*g.f+g.ph)*Math.max(0,Math.sin(c.t*2.3+g.ph*1.7))*a:0;
      const bellyRun=c.mode==='belly'?Math.sin(c.t*g.f*0.8+g.ph)*0.35*a:0;
      d.position.set(L.x,L.y,L.z); d.rotation.set(L.rx,L.ry+j*0.35+bellyRun,L.rz+j*0.45+Math.abs(bellyRun)*0.6,'YXZ'); d.scale.setScalar(1); d.updateMatrix();
      this.m5.multiplyMatrices(B,d.matrix); g.m.setMatrixAt(g.i,this.m5); g.m.instanceMatrix.needsUpdate=true; }
  }
  update(dt){
    if(!this.twitching.size) return;
    for(const c of this.twitching){ c.t+=dt; c.tw-=dt; if(!c.alive){ this.twitching.delete(c); continue; } if(c.tw<=0){ c.tw=0; this.twitching.delete(c); } this.placeLegs(c,this.base(c,this.m4)); }
  }
  drop(c){ if(!c.alive) return; c.alive=false; this.release(c.V.shell,c.si); if(c.V.goo) this.release(c.V.goo,c.gi); for(const g of c.legs) this.release(g.m,g.i); this.twitching.delete(c); }
  // 吸尘器: 흡입 범위 안의 시체를 노즐 쪽으로 끌어오다가 가까우면 빨아들인다. 바닥에 밴 진물 자국은 남는다.
  suck(hx,hz,inside,dt){
    let eaten=0;
    for(const c of this.list){ if(!c||!c.alive||!inside(c.x,c.z)) continue;
      const dx=hx-c.x, dz=hz-c.z, d=Math.hypot(dx,dz);
      if(d<0.07){ this.drop(c); eaten++; continue; }
      const step=Math.min(d,dt*(1.2+0.5/(d+0.08))); c.x+=dx/d*step; c.z+=dz/d*step; c.h+=dt*rand(-3,3); this.place(c); }
    return eaten;
  }
}
