// 材质 MAT；房间场景 buildRoom；卵鞘形状
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 재질 ─────────
const M={
  std:(color,o={})=>new THREE.MeshStandardMaterial(Object.assign({color,roughness:0.6,metalness:0},o)),
  gloss:(color,o={})=>new THREE.MeshPhysicalMaterial(Object.assign({color,roughness:0.3,metalness:0,clearcoat:0.8,clearcoatRoughness:0.3},o)),
};
const MAT={
  // 새 바퀴 모델: 색은 정점에 들어 있고 재질은 광택만 정한다
  roachShell:new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:0.4,metalness:0,clearcoat:0.65,clearcoatRoughness:0.24}),
  roachLimb:new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:0.46}),
  nymphShell:new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:0.5,clearcoat:0.45,clearcoatRoughness:0.35}),
  nymphLimb:new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:0.6}),
  // 시체: 산 것보다 탁하고 광이 죽는다. 내장은 젖은 광택.
  corpseShell:new THREE.MeshPhysicalMaterial({color:0xb9ad9f,vertexColors:true,roughness:0.52,clearcoat:0.35,clearcoatRoughness:0.3}),
  corpseLimb:new THREE.MeshStandardMaterial({color:0xcfc4b8,vertexColors:true,roughness:0.58}),
  charShell:new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:0.86}),
  charLimb:new THREE.MeshStandardMaterial({color:0x4a3f3a,vertexColors:true,roughness:0.85}),
  goo:new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:0.16,clearcoat:1,clearcoatRoughness:0.08}),

  skin:M.std(0xe9b994,{roughness:0.65}),
  hair:M.std(0x2a1b12,{roughness:0.8}),
  pjTop:M.std(0xa8cbe6,{roughness:0.85}),
  pjPants:M.std(0x5d74a6,{roughness:0.85}),
  black:M.std(0x1e1e22,{roughness:0.6}),
  white:M.std(0xf6f4ee,{roughness:0.6}),
  wood:M.std(0xb07a45,{roughness:0.7}),
  darkwood:M.std(0x6b4326,{roughness:0.7}),
  steel:M.std(0xc9ccd0,{roughness:0.28,metalness:0.85}),
  iron:M.std(0x2b2b30,{roughness:0.45,metalness:0.6}),
  cream:M.std(0xf1e8d2,{roughness:0.9}),
  navy:M.std(0x2f4a8a,{roughness:0.95}),
  green:M.std(0x3b8f4a,{roughness:0.5}),
  red:M.std(0xd9342b,{roughness:0.5}),
  yellow:M.std(0xf2c12e,{roughness:0.5}),
  grey:M.std(0x8e8e96,{roughness:0.5}),
  paper:M.std(0xf7f3ea,{roughness:0.9}),
  fridge:M.std(0xf2f2f0,{roughness:0.35,metalness:0.1}),
  olive:M.std(0x7a8c3e,{roughness:0.95}),
  curtain:M.std(0xEAD6A8,{roughness:0.95}),
  bag:M.std(0xc3ccd2,{roughness:0.62,metalness:0,transparent:true,opacity:0.9}),
};
function box(w,h,d,mat,x=0,y=0,z=0,cast=true,recv=true){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=cast; m.receiveShadow=recv; return m; }
function cyl(rt,rb,h,mat,x=0,y=0,z=0,seg=16){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; return m; }
function sph(r,mat,x=0,y=0,z=0,ws=16,hs=12){ const m=new THREE.Mesh(new THREE.SphereGeometry(r,ws,hs),mat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; return m; }

// ───────── 방 ─────────
function buildRoom(scene){
  const R={};
  const floorMat=new THREE.MeshStandardMaterial({map:texFloor(),roughness:0.5,metalness:0.02});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(4,6),floorMat); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor); R.floor=floor;
  const tile=new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.5),new THREE.MeshStandardMaterial({map:texTile(),roughness:0.5})); tile.rotation.x=-Math.PI/2; tile.position.set(1.5,0.001,2.75); tile.receiveShadow=true; scene.add(tile);
  const wallMat=new THREE.MeshStandardMaterial({map:texWall(),roughness:0.95});
  const mkWall=(w,h,x,y,z,ry)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),wallMat); m.position.set(x,y,z); m.rotation.y=ry; m.receiveShadow=true; scene.add(m); return m; };
  mkWall(4,2.4,0,1.2,-3,0); mkWall(4,2.4,0,1.2,3,Math.PI); mkWall(6,2.4,-2,1.2,0,Math.PI/2); mkWall(6,2.4,2,1.2,0,-Math.PI/2);
  R.ceilGroup=new THREE.Group(); scene.add(R.ceilGroup);
  const ceil=new THREE.Mesh(new THREE.PlaneGeometry(4,6),new THREE.MeshStandardMaterial({color:0xf8f6f0,roughness:1,emissive:0xf8f6f0,emissiveIntensity:0.05})); ceil.rotation.x=Math.PI/2; ceil.position.y=2.4; R.ceilGroup.add(ceil); R.ceil=ceil;
  const bbMat=M.std(0x8a6a48,{roughness:0.7});
  scene.add(box(4,0.08,0.02,bbMat,0,0.04,-2.99)); scene.add(box(4,0.08,0.02,bbMat,0,0.04,2.99)); scene.add(box(0.02,0.08,6,bbMat,-1.99,0.04,0)); scene.add(box(0.02,0.08,6,bbMat,1.99,0.04,0));
  R.fluor=box(0.34,0.06,1.2,new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:1.6,roughness:0.5}),0,2.36,0,false,false); R.ceilGroup.add(R.fluor);
  R.ceilGroup.add(box(0.4,0.03,1.26,M.std(0xdddddd),0,2.39,0,false,false));
  R.door=new THREE.Group(); R.door.position.set(1.98,0,2.96);
  const doorPanel=box(0.88,2.1,0.05,M.std(0xe8e2d4,{roughness:0.6}),-0.45,1.05,0); R.door.add(doorPanel);
  R.door.add(box(0.03,0.16,0.03,MAT.steel,-0.8,1.0,0.05));
  scene.add(R.door);
  scene.add(box(0.06,2.15,0.1,M.std(0xd9d2c2),1.04,1.075,2.96)); scene.add(box(0.06,2.15,0.1,M.std(0xd9d2c2),2.0,1.075,2.96)); scene.add(box(1.0,0.06,0.1,M.std(0xd9d2c2),1.52,2.13,2.96));
  scene.add(box(0.08,0.12,0.015,MAT.white,0.2,1.15,2.985)); R.switchKnob=box(0.04,0.06,0.012,M.std(0xe4e4e0),0.2,1.15,2.995); scene.add(R.switchKnob);
  const cab=M.std(0xf3f1ea,{roughness:0.5});
  scene.add(box(0.55,0.77,1.25,cab,-1.725,0.09+0.385,1.825));
  scene.add(box(0.47,0.09,1.25,M.std(0x3a3a3a),-1.765,0.045,1.825));
  scene.add(box(0.6,0.03,1.3,MAT.steel,-1.7,0.875,1.825));
  const basin=box(0.36,0.2,0.4,M.std(0x9a9ea3,{roughness:0.35,metalness:0.8}),-1.7,0.79,1.6); scene.add(basin);
  scene.add(cyl(0.012,0.012,0.22,MAT.steel,-1.9,0.99,1.6)); const fauc=cyl(0.01,0.01,0.2,MAT.steel,-1.82,1.1,1.6); fauc.rotation.z=Math.PI/2; scene.add(fauc);
  for(const [x,z] of [[-1.78,2.1],[-1.6,2.28]]){ scene.add(cyl(0.08,0.08,0.015,MAT.iron,x,0.9,z)); scene.add(cyl(0.035,0.035,0.02,M.std(0x111111),x,0.91,z)); }
  R.ceilGroup.add(box(0.55,0.7,1.25,cab,-1.725,1.85,1.825));
  const glove=M.std(0xf0c419,{roughness:0.6}); const g1=box(0.1,0.02,0.24,glove,-1.6,0.9,1.3); g1.rotation.y=0.3; scene.add(g1); const g2=box(0.1,0.02,0.24,glove,-1.68,0.92,1.32); g2.rotation.y=0.1; scene.add(g2);
  scene.add(box(0.25,0.18,0.18,M.std(0xc44536,{roughness:0.4}),-1.75,0.98,2.4)); scene.add(cyl(0.02,0.02,0.1,MAT.black,-1.75,1.12,2.4));
  scene.add(box(0.6,1.34,0.7,MAT.fridge,-1.7,0.06+0.67,0.55));
  scene.add(box(0.5,0.05,0.6,M.std(0x2a2a2a),-1.75,0.03,0.55));
  scene.add(box(0.02,0.5,0.03,MAT.steel,-1.39,1.0,0.35)); scene.add(box(0.61,0.01,0.7,M.std(0xdcdcd8),-1.7,0.95,0.55));
  for(const [z,y,col] of [[0.4,1.2,0xe0483a],[0.6,1.25,0x3f8fd6],[0.72,1.1,0xf2c12e]]) scene.add(box(0.008,0.05,0.05,M.std(col),-1.395,y,z));
  scene.add(box(1.1,0.3,2.0,MAT.darkwood,1.45,0.15,-1.9));
  scene.add(box(1.06,0.15,1.96,MAT.cream,1.45,0.375,-1.9));
  scene.add(box(0.7,0.1,0.42,MAT.white,1.45,0.5,-2.6));
  R.blanket=box(0.98,0.16,1.3,MAT.navy,1.45,0.53,-1.6); scene.add(R.blanket);
  scene.add(box(1.4,0.04,0.6,MAT.wood,-0.9,0.72,-2.7));
  for(const [x,z] of [[-1.55,-2.95],[-0.25,-2.95],[-1.55,-2.45],[-0.25,-2.45]]) scene.add(box(0.04,0.7,0.04,MAT.darkwood,x,0.35,z));
  scene.add(box(0.5,0.32,0.02,MAT.black,-1.05,0.98,-2.88)); scene.add(box(0.14,0.12,0.14,MAT.black,-1.05,0.8,-2.85)); scene.add(box(0.44,0.26,0.005,new THREE.MeshStandardMaterial({color:0x8fb3d9,emissive:0x3a5f8a,emissiveIntensity:0.4}),-1.05,0.98,-2.868));
  scene.add(box(0.4,0.02,0.14,M.std(0xe5e2da),-1.05,0.75,-2.55)); scene.add(cyl(0.04,0.035,0.09,MAT.white,-0.4,0.79,-2.5));
  scene.add(cyl(0.08,0.09,0.02,MAT.black,-0.55,0.75,-2.72)); const arm=cyl(0.01,0.01,0.34,MAT.black,-0.55,0.92,-2.72); scene.add(arm);
  R.lampShade=new THREE.Mesh(new THREE.ConeGeometry(0.11,0.14,20,1,true),new THREE.MeshStandardMaterial({color:0x2a2a2a,side:THREE.DoubleSide,roughness:0.5})); R.lampShade.position.set(-0.55,1.1,-2.72); R.lampShade.rotation.set(0.5,0,0); scene.add(R.lampShade);
  R.lampBulb=new THREE.Mesh(new THREE.SphereGeometry(0.03,10,8),new THREE.MeshStandardMaterial({color:0xfff2c0,emissive:0xffd77a,emissiveIntensity:0})); R.lampBulb.position.set(-0.55,1.06,-2.68); scene.add(R.lampBulb);
  scene.add(box(0.4,0.04,0.4,MAT.darkwood,-0.9,0.45,-2.1)); for(const [x,z] of [[-1.08,-2.28],[-0.72,-2.28],[-1.08,-1.92],[-0.72,-1.92]]) scene.add(box(0.03,0.45,0.03,MAT.darkwood,x,0.225,z)); scene.add(box(0.4,0.42,0.03,MAT.darkwood,-0.9,0.68,-1.92));
  scene.add(box(0.7,1.76,0.3,MAT.wood,0.55,0.04+0.88,-2.85)); scene.add(box(0.7,0.04,0.28,MAT.darkwood,0.55,0.03,-2.9));
  const cols=[0xd9342b,0x3f8fd6,0xf2c12e,0x3b8f4a,0x8e5bb5,0xe08a2e,0x2b2b30,0xf6f4ee];
  for(let s=0;s<4;s++){ let x=0.24; while(x<0.84){ const w=rand(0.02,0.045), h=rand(0.18,0.3); scene.add(box(w,h,rand(0.15,0.24),M.std(cols[Math.floor(rand(cols.length))]),x+w/2,0.12+s*0.44+h/2,-2.82)); x+=w+0.004; } }
  const bag=sph(0.19,MAT.bag,0.75,0.2,2.65); bag.scale.set(1.05,1.1,0.88); bag.rotation.z=0.2; scene.add(bag); const knot=sph(0.055,MAT.bag,0.75,0.4,2.65); knot.scale.set(1,1.5,1); scene.add(knot); const b2=sph(0.11,MAT.bag,0.55,0.1,2.48); b2.scale.set(1.1,0.9,1); scene.add(b2);
  scene.add(box(0.01,0.14,0.04,M.std(0x1a1008),1.995,0.07,0.2)); const peel=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.12),wallMat); peel.position.set(1.96,0.13,0.26); peel.rotation.set(0,-Math.PI/2+0.5,0.3); scene.add(peel);
  scene.add(box(0.14,0.006,0.14,M.std(0x55585c,{metalness:0.6,roughness:0.5}),-1.78,0.003,2.8)); for(let i=-2;i<=2;i++) scene.add(box(0.1,0.008,0.012,M.std(0x111111),-1.78,0.004,2.8+i*0.025));
  // 창문 — 밖은 대낮. 커튼이 쳐져 있어 방 안은 어둑하다.
  R.glass=new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.8),new THREE.MeshStandardMaterial({color:0xcfe6f7,emissive:0xbfe0ff,emissiveIntensity:0.6,roughness:0.2})); R.glass.position.set(1.985,1.5,-1.9); R.glass.rotation.y=-Math.PI/2; scene.add(R.glass);
  scene.add(box(0.03,0.85,0.05,MAT.white,1.975,1.5,-2.42)); scene.add(box(0.03,0.85,0.05,MAT.white,1.975,1.5,-1.38)); scene.add(box(0.03,0.05,1.1,MAT.white,1.975,1.92,-1.9)); scene.add(box(0.03,0.05,1.1,MAT.white,1.975,1.08,-1.9)); scene.add(box(0.03,0.85,0.03,MAT.white,1.975,1.5,-1.9));
  R.curtainA=box(0.05,1.02,0.56,MAT.curtain,1.93,1.45,-2.15); scene.add(R.curtainA);
  R.curtainB=box(0.05,1.02,0.56,MAT.curtain,1.93,1.45,-1.63); scene.add(R.curtainB);
  for(let i=0;i<8;i++){ const z=-2.4+i*0.135+0.02; const f=cyl(0.022,0.022,1.0,MAT.curtain,1.905,1.45,z,8); scene.add(f); }
  scene.add(cyl(0.012,0.012,1.3,MAT.steel,1.9,1.98,-1.9).rotateX(Math.PI/2));
  for(const z of [-1.28,-1.06]){ const s=makeItem('slipper'); s.position.set(0.6,0,z); s.rotation.y=Math.PI/2+rand(-0.2,0.2); scene.add(s); }
  R.cushion=cyl(0.225,0.215,0.05,M.std(0x6d7a3c,{roughness:0.98}),0.1,0.025,-0.4,26); scene.add(R.cushion);
  { const seam=new THREE.Mesh(new THREE.TorusGeometry(0.212,0.008,6,30),M.std(0x5d6c2c,{roughness:0.95})); seam.rotation.x=Math.PI/2; seam.position.set(0.1,0.03,-0.4); seam.castShadow=true; scene.add(seam);
    const btn=cyl(0.018,0.018,0.012,M.std(0x4e5a24,{roughness:0.9}),0.1,0.046,-0.4,10); scene.add(btn);
    for(let i=0;i<4;i++){ const a=i/4*TAU+0.4; const d=cyl(0.012,0.012,0.008,M.std(0x66752f,{roughness:0.95}),0.1+Math.cos(a)*0.12,0.049,-0.4+Math.sin(a)*0.12,8); scene.add(d); } }
  return R;
}


// 알집(난협): 옆으로 납작한 강낭콩·동전지갑 모양. 등에는 톱니 진 솔기, 옆면엔 알 칸마다 희미한 골이 진다. 긴 쪽이 x축.
let _ootheca=null;
function oothecaGeo(){
  if(_ootheca) return _ootheca;
  const L=0.032, H=0.031, W=0.0135, U=44, Vn=28;
  const cBody=rgb(0x8a4219), cDark=rgb(0x3e1908), cRib=rgb(0x4a1c09), cKeel=rgb(0x3a1406);
  const P=(u,v)=>{ const t=u*2-1, e=Math.pow(Math.max(0,1-Math.pow(Math.abs(t),2.4)),0.5);
    const th=v*TAU, c=Math.cos(th), s=Math.sin(th);
    let z=W*e*Math.sign(c)*Math.pow(Math.abs(c),2/2.6), y=H*0.5*(1+Math.sign(s)*Math.pow(Math.abs(s),2/2.4));
    const up=clamp(s,0,1); z*=1-0.6*Math.pow(up,1.8);                                  // 위로 갈수록 좁아져 솔기가 된다
    y=y*(0.55+0.45*e);                                                                   // 양 끝은 둥글게 낮아진다
    y+=0.0022*Math.pow(up,8)*Math.pow(Math.abs(Math.sin(t*Math.PI*8.5)),0.6)*e;          // 솔기의 톱니
    z*=1-0.07*Math.pow(Math.abs(Math.cos(t*Math.PI*7.5)),8)*(1-up)*Math.abs(c);          // 알 칸 사이마다 옆면이 옴폭 팬 골
    return [t*L,y,z]; };
  const g=gridGeo(U,Vn,P,true,false);
  const B=new GeoBuilder();
  B.add(g,(p,w,i)=>{ const u=Math.floor(i/Vn)/U, v=(i%Vn)/Vn, t=u*2-1, s=Math.sin(v*TAU), up=clamp(s,0,1);
    let c=rgbMix(cBody,cDark,sstep(0.7,1,Math.abs(t))*0.7); c=rgbMix(c,cKeel,sstep(0.75,0.98,up));
    if(Math.pow(Math.abs(Math.cos(t*Math.PI*7.5)),8)>0.45&&up<0.75) c=rgbMix(c,cRib,0.65);
    return c; });
  _ootheca=B.build(); return _ootheca;
}
