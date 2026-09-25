// 地面污渍贴图 FloorPaint；地板、墙、瓷砖贴图
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 바닥 페인트 (장판 위 얼룩·시체·그을음·미끼) ─────────
class FloorPaint{
  constructor(){
    const s=QUALITY.paintScale; this.W=Math.round(768*s); this.H=Math.round(1152*s); this.ppm=192*s;
    this.c=document.createElement('canvas'); this.c.width=this.W; this.c.height=this.H;
    this.g=this.c.getContext('2d');
    this.tex=new THREE.CanvasTexture(this.c); this.tex.colorSpace=THREE.SRGBColorSpace; this.tex.anisotropy=4;
    // 手机上不生成 mipmap：俯视时贴图基本是放大显示，用不上，每次上传还要重算一遍
    if(QUALITY.mobile){ this.tex.generateMipmaps=false; this.tex.minFilter=THREE.LinearFilter; }
    this.dirty=false; this.lastFlush=0; this.gap=1/QUALITY.paintHz;
  }
  px(x,z){ return [(x+2)*this.ppm,(z+3)*this.ppm]; }
  clear(){ this.g.clearRect(0,0,this.W,this.H); this.dirty=true; }
  // 텍스처 업로드는 비싸다. 얼룩이 생긴 프레임에만, 그것도 초당 10회（手机 5 次）까지만 올린다.（768×1152 一次约 3.5MB，手机 512×768 约 1.6MB）
  flush(t){ if(!this.dirty) return; if(t-this.lastFlush<this.gap) return; this.lastFlush=t; this.tex.needsUpdate=true; this.dirty=false; }
  gooColors(L){
    const h=lerp(47,42,L), s=lerp(42,48,L), l=lerp(86,80,L);
    return { core:`hsl(${h},${s}%,${l}%)`, coreA:(a)=>`hsla(${h},${s}%,${l}%,${a})`, rim:`hsl(${h},${s-10}%,${l+6}%)`, goo:(a)=>`hsla(49,46%,93%,${a})`, white:(a)=>`hsla(45,30%,97%,${a})`, gut:(a)=>`hsla(24,52%,15%,${a})`, red:(a)=>`hsla(20,55%,18%,${a})` };
  }
  splat(x,z,dx,dz,size,L,kind='slipper'){
    const g=this.g, [cx,cy]=this.px(x,z), C=this.gooColors(L), S=size*this.ppm;
    const len=Math.hypot(dx,dz)||1; dx/=len; dz/=len;
    g.save();
    let gr=g.createRadialGradient(cx,cy,S*0.1,cx,cy,S);
    gr.addColorStop(0,C.coreA(0.95)); gr.addColorStop(0.55,C.coreA(0.8)); gr.addColorStop(1,C.coreA(0));
    g.fillStyle=gr; g.beginPath(); g.ellipse(cx+dx*S*0.25,cy+dz*S*0.25,S*1.15,S*0.85,Math.atan2(dz,dx),0,TAU); g.fill();
    { const k=1+Math.floor(rand(2)+L*2); for(let i=0;i<k;i++){ const a=Math.atan2(dz,dx)+rand(-0.7,0.7), off=rand(-0.15,0.3)*S, w=S*rand(0.05,0.11), ln=S*rand(0.35,0.9); const px=cx+Math.cos(a)*off, py=cy+Math.sin(a)*off; g.strokeStyle=C.gut(rand(0.55,0.85)); g.lineWidth=w; g.lineCap='round'; g.beginPath(); g.moveTo(px-Math.cos(a)*ln*0.3,py-Math.sin(a)*ln*0.3); g.quadraticCurveTo(px+Math.sin(a)*w,py-Math.cos(a)*w,px+Math.cos(a)*ln*0.7,py+Math.sin(a)*ln*0.7); g.stroke(); } }
    g.fillStyle=C.goo(0.55+0.35*L); for(let i=0;i<3+L*5;i++){ const a=rand(TAU), r=rand(S*0.5); g.beginPath(); g.ellipse(cx+Math.cos(a)*r,cy+Math.sin(a)*r,S*rand(0.12,0.3),S*rand(0.08,0.2),rand(TAU),0,TAU); g.fill(); }
    const n=8+Math.floor(L*14)+(kind==='pan'?10:kind==='book'?6:0);
    const base=Math.atan2(dz,dx);
    for(let i=0;i<n;i++){
      const a=base+rand(-0.9,0.9), d=S*rand(0.8,3.2+L*2)*(kind==='pan'?1.4:1), r=Math.max(S*0.02,S*rand(0.05,0.22)*(1-d/(S*9)));
      const px=cx+Math.cos(a)*d, py=cy+Math.sin(a)*d;
      const gut=Math.random()<0.18; g.fillStyle=gut?C.gut(0.8):Math.random()<0.35?C.goo(0.9):C.coreA(0.9);
      g.beginPath(); g.ellipse(px,py,r*rand(1,2.6),r,a,0,TAU); g.fill();
      if(Math.random()<0.5){ g.strokeStyle=C.coreA(0.5); g.lineWidth=r*0.6; g.beginPath(); g.moveTo(px-Math.cos(a)*d*0.35,py-Math.sin(a)*d*0.35); g.lineTo(px,py); g.stroke(); }
    }
    if(L>0.35){ g.fillStyle=C.white(0.35*(L-0.3)); for(let i=0;i<4;i++){ const a=rand(TAU), r=rand(S*0.45); g.beginPath(); g.ellipse(cx+Math.cos(a)*r,cy+Math.sin(a)*r,S*0.07,S*0.05,a,0,TAU); g.fill(); } }
    if(L>0.6){ gr=g.createRadialGradient(cx,cy,0,cx,cy,S*0.6); gr.addColorStop(0,C.red(0.35*(L-0.5))); gr.addColorStop(1,C.red(0)); g.fillStyle=gr; g.beginPath(); g.arc(cx,cy,S*0.6,0,TAU); g.fill(); }
    g.fillStyle='rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(cx-S*0.2,cy-S*0.25,S*0.25,S*0.12,-0.6,0,TAU); g.fill();
    g.restore(); this.dirty=true;
  }



  corpse(x,z,heading,L,mode='crushed'){
    // 시체 몸통은 3D로 따로 남으므로(吸尘器로 빨아 갈 수 있게) 바닥에는 밴 얼룩과 진물만 그린다
    const g=this.g, [cx,cy]=this.px(x,z), S=ROACH_L*this.ppm;
    g.save(); g.translate(cx,cy); g.rotate(Math.PI-heading);
    const burnt=mode==='burnt';
    g.fillStyle=burnt?'rgba(18,12,8,0.34)':'rgba(52,34,18,0.2)'; g.beginPath(); g.ellipse(0,0.02*S,0.2*S,0.5*S,0,0,TAU); g.fill();
    if(mode==='crushed'){ const C=this.gooColors(L); g.fillStyle=C.goo(0.9); g.beginPath(); g.ellipse(rand(-0.08,0.08)*S,rand(-0.1,0.2)*S,0.17*S,0.11*S,rand(TAU),0,TAU); g.fill(); g.strokeStyle=C.gut(0.8); g.lineWidth=S*0.045; g.lineCap='round'; g.beginPath(); g.moveTo(-0.06*S,-0.15*S); g.quadraticCurveTo(0.06*S,0.05*S,0.03*S,0.3*S); g.stroke(); }
    g.restore(); this.dirty=true;
  }



  drop(x,z,r,L,yellow=false,gut=false){ const g=this.g,[cx,cy]=this.px(x,z),C=this.gooColors(L); g.fillStyle=gut?C.gut(0.8):yellow?C.goo(0.85):C.coreA(0.85); g.beginPath(); g.ellipse(cx,cy,r*this.ppm*rand(1,1.8),r*this.ppm,rand(TAU),0,TAU); g.fill(); this.dirty=true; }
  scorch(x,z,r){ const g=this.g,[cx,cy]=this.px(x,z),S=r*this.ppm; const gr=g.createRadialGradient(cx,cy,0,cx,cy,S); gr.addColorStop(0,'rgba(20,12,6,0.55)'); gr.addColorStop(0.6,'rgba(30,18,8,0.25)'); gr.addColorStop(1,'rgba(30,18,8,0)'); g.fillStyle=gr; g.beginPath(); g.arc(cx,cy,S,0,TAU); g.fill(); this.dirty=true; }
  bait(kind,x,z){
    const g=this.g,[cx,cy]=this.px(x,z),S=this.ppm; g.save(); g.translate(cx,cy);
    if(kind==='cola'){ const gr=g.createRadialGradient(0,0,S*0.05,0,0,S*0.36); gr.addColorStop(0,'rgba(70,32,12,0.75)'); gr.addColorStop(0.8,'rgba(70,32,12,0.55)'); gr.addColorStop(1,'rgba(70,32,12,0)'); g.fillStyle=gr; g.beginPath(); for(let i=0;i<=24;i++){ const a=i/24*TAU, r=S*0.34*(0.85+0.15*Math.sin(a*3+1)); i?g.lineTo(Math.cos(a)*r,Math.sin(a)*r):g.moveTo(Math.cos(a)*r,Math.sin(a)*r); } g.fill(); g.fillStyle='rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(-S*0.08,-S*0.1,S*0.1,S*0.04,-0.5,0,TAU); g.fill(); }
    else if(kind==='rice'){ g.fillStyle='#FBF7EC'; g.strokeStyle='#D9CDB1'; g.lineWidth=1; for(let i=0;i<26;i++){ const a=rand(TAU), r=rand(S*0.09); g.beginPath(); g.ellipse(Math.cos(a)*r,Math.sin(a)*r,S*0.012,S*0.007,rand(TAU),0,TAU); g.fill(); g.stroke(); } }
    else if(kind==='bone'){ g.rotate(rand(TAU)); g.fillStyle='#F1E9D8'; g.strokeStyle='#CFC3A9'; g.lineWidth=1.5; g.beginPath(); g.roundRect(-S*0.12,-S*0.018,S*0.24,S*0.036,S*0.018); g.fill(); g.stroke(); for(const s of [-1,1]){ g.beginPath(); g.arc(s*S*0.12,-S*0.015,S*0.025,0,TAU); g.arc(s*S*0.12,S*0.015,S*0.025,0,TAU); g.fill(); g.stroke(); } g.fillStyle='#C9773A'; g.beginPath(); g.ellipse(S*0.03,0,S*0.07,S*0.03,0.3,0,TAU); g.fill(); g.fillStyle='rgba(170,90,30,0.35)'; g.beginPath(); g.ellipse(0,S*0.02,S*0.17,S*0.07,0.1,0,TAU); g.fill(); }
    g.restore(); this.dirty=true;
  }
}
// ───────── 텍스처 ─────────
function texFloor(){
  const c=document.createElement('canvas'); c.width=c.height=1024; const g=c.getContext('2d');
  g.fillStyle='#E2AC46'; g.fillRect(0,0,1024,1024);
  const plank=1024/4;
  for(let p=0;p<4;p++){
    const x0=p*plank; g.fillStyle=`hsl(${36+rand(-2,2)},${64+rand(-4,4)}%,${55+rand(-1.5,1.5)}%)`; g.fillRect(x0,0,plank,1024);
    for(let i=0;i<70;i++){ g.strokeStyle=`hsla(30,55%,${30+rand(20)}%,${rand(0.05,0.14)})`; g.lineWidth=rand(0.6,2.2); g.beginPath(); const y=rand(1024); g.moveTo(x0+rand(-20,20),y); for(let k=1;k<=6;k++) g.lineTo(x0+k*plank/6+rand(-14,14),y+rand(-40,40)); g.stroke(); }
    g.fillStyle='rgba(120,70,20,0.35)'; g.fillRect(x0,0,2,1024); g.fillStyle='rgba(255,240,200,0.25)'; g.fillRect(x0+2,0,2,1024);
  }
  const id=g.getImageData(0,0,1024,1024), d=id.data; for(let i=0;i<d.length;i+=4){ const n=rand(-10,10); d[i]+=n; d[i+1]+=n; d[i+2]+=n; } g.putImageData(id,0,0);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(4/1.2,6/1.2); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}
function texWall(){
  const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d');
  g.fillStyle='#F4EBD6'; g.fillRect(0,0,256,256);
  g.fillStyle='rgba(200,170,120,0.35)'; for(let y=0;y<256;y+=32) for(let x=0;x<256;x+=32){ g.beginPath(); g.arc(x+16+((y/32)%2)*8,y+16,2,0,TAU); g.fill(); }
  const id=g.getImageData(0,0,256,256), d=id.data; for(let i=0;i<d.length;i+=4){ const n=rand(-6,6); d[i]+=n; d[i+1]+=n; d[i+2]+=n; } g.putImageData(id,0,0);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(8,4); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function texTile(){
  const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d');
  g.fillStyle='#B9B4A8'; g.fillRect(0,0,256,256); g.fillStyle='#CFCABD'; for(let y=0;y<2;y++) for(let x=0;x<2;x++){ g.fillRect(x*128+4,y*128+4,120,120); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(4,2); t.colorSpace=THREE.SRGBColorSpace; return t;
}
