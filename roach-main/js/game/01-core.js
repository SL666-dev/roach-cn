// 公共工具函数；房间尺寸、家具障碍、藏身处与蟑螂移动碰撞
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";


// ───────── 공통 ─────────
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a);
const TAU=Math.PI*2;
const wrapAng=a=>((a+Math.PI)%TAU+TAU)%TAU-Math.PI;
const angleLerp=(a,b,t)=>a+wrapAng(b-a)*t;
const damp=(a,b,rate,dt)=>lerp(a,b,1-Math.exp(-rate*dt));
const angleDamp=(a,b,rate,dt)=>angleLerp(a,b,1-Math.exp(-rate*dt));
const dist2=(ax,az,bx,bz)=>{const dx=ax-bx,dz=az-bz;return dx*dx+dz*dz;};
const now=()=>performance.now()/1000;

// ───────── 画质档位 ─────────
// 手机档：主要指点设备是手指，且屏幕短边 ≤ 600（平板和触屏笔记本仍用电脑档）。?q=low / ?q=high 可强制。
const QS=new URLSearchParams(window.__ROACH_SEARCH ?? location.search);
const QUALITY=(()=>{
  const q=QS.get('q'), coarse=!!(window.matchMedia&&matchMedia('(pointer: coarse)').matches);
  const mobile=q==='low'?true:q==='high'?false:coarse&&Math.min(screen.width,screen.height)<=600;
  const dpr=parseFloat(QS.get('dpr'));
  return {
    mobile,
    // 以下三项只在手机档生效，默认不变，真机对比后再定：?dpr=1.25 像素比上限，?aa=0 关抗锯齿，?cc=0 甲壳去掉 clearcoat
    dpr:mobile&&dpr>0?Math.min(dpr,1.5):1.5,
    aa:!(mobile&&QS.get('aa')==='0'),
    clearcoat:!(mobile&&QS.get('cc')==='0'),
    softShadow:!mobile,            // 手机用 PCF，不用 PCFSoft
    shadowEvery:mobile?2:1,        // 阴影贴图每几帧更新一次
    paintScale:mobile?2/3:1,       // 地面污渍贴图分辨率
    paintHz:mobile?5:10,           // 地面污渍贴图每秒最多上传几次
    corpseLod:mobile?0.4:0.65,     // 尸体网格细分系数（尸体俯视下只有几十像素宽）
    corpseCap:mobile?200:600,      // 尸体上限：超出后最早的尸体消失（活蟑螂数量不受影响）
  };
})();

// ───────── 방 ─────────
const ROOM={x1:-2,x2:2,z1:-3,z2:3,h:2.4};
const OBST=[
  {n:'counter',x1:-2,z1:1.2,x2:-1.45,z2:2.45,h:0.86,roach:false,human:false},
  {n:'fridge',x1:-2,z1:0.2,x2:-1.4,z2:0.9,h:1.4,roach:false,human:false},
  {n:'bed',x1:0.9,z1:-2.9,x2:2,z2:-0.9,h:0.45,roach:false,human:false},
  {n:'desk',x1:-1.6,z1:-3,x2:-0.2,z2:-2.4,h:0.72,roach:true,human:false},
  {n:'chair',x1:-1.1,z1:-2.3,x2:-0.7,z2:-1.9,h:0.45,roach:true,human:false},
  {n:'shelf',x1:0.2,z1:-3,x2:0.9,z2:-2.7,h:1.8,roach:false,human:false},
  {n:'trash',x1:0.43,z1:2.36,x2:1.0,z2:2.85,h:0.5,roach:false,human:false},   // 봉지 두 개가 삐져나온 만큼까지
  {n:'slippers',x1:0.46,z1:-1.42,x2:0.74,z2:-0.92,h:0.04,roach:false,human:true},   // 침대 앞 拖鞋 — 바퀴가 뚫고 지나가지 않게
  {n:'door',x1:1.02,z1:2.9,x2:2,z2:3,h:2.1,roach:false,human:true},   // 문짝·문틀 두께 — 바퀴가 문 속으로 파고들지 않게
];
// 숨는 자리: 구멍 5곳 + 坐垫底下 + 书桌底下. 사람은 이 자리들을 차례로 뒤진다.
const HOLES=[
  {n:'fridge',label:'冰箱底下',x:-1.52,z:0.55,dx:1,dz:0,hole:true},
  {n:'sink',label:'水槽底下',x:-1.52,z:1.7,dx:1,dz:0,hole:true},
  {n:'drain',label:'下水道',x:-1.78,z:2.8,dx:0.93,dz:-0.37,hole:true},
  {n:'crack',label:'墙纸缝隙',x:1.94,z:0.2,dx:-1,dz:0,hole:true},
  {n:'shelf',label:'书架后面',x:0.55,z:-2.66,dx:0,dz:1,hole:true},
  {n:'cushion',label:'坐垫底下',x:0.1,z:-0.4,dx:0,dz:1,r:0.2,cushion:true},
  {n:'desk',label:'书桌底下',x:-0.9,z:-2.7,dx:0,dz:1,rect:true,rx:0.66,rz:0.27},
];
const HOLE_LIST=HOLES.filter(h=>h.hole);
const CUSHION=HOLES.find(h=>h.n==='cushion');
const HOLE_R=0.17;
const inSpot=(h,x,z)=>h.rect?(Math.abs(x-h.x)<h.rx&&Math.abs(z-h.z)<h.rz):dist2(x,z,h.x,h.z)<(h.r||HOLE_R)*(h.r||HOLE_R);
function spotAt(x,z){ for(const h of HOLES){ if(inSpot(h,x,z)) return h; } return null; }
const ROACH_L=0.13;           // 바퀴 몸길이 (연출상 실물의 3배쯤 — 폰에서 손가락으로 잡히는 크기)
const LAMP_POS=new THREE.Vector3(-0.55,1.08,-2.72);
const SWITCH_STAND={x:0.2,z:2.55};
const BEDSIDE={x:0.55,z:-1.55};

function inObst(o,x,z,m=0){return x>o.x1-m&&x<o.x2+m&&z>o.z1-m&&z<o.z2+m;}
function nearHole(x,z,r){ if(r===undefined) return spotAt(x,z); let best=null,bd=1e9; for(const h of HOLES){ if(h.rect) continue; const d=dist2(x,z,h.x,h.z); if(d<r*r&&d<bd){bd=d;best=h;} } return best; }
function roachMove(x,z,nx,nz){
  const m=0.025;
  const ok=(px,pz)=>{
    if(px<ROOM.x1+m||px>ROOM.x2-m||pz<ROOM.z1+m||pz>ROOM.z2-m) return false;
    if(nearHole(px,pz,HOLE_R)) return true;
    for(const o of OBST){ if(!o.roach&&inObst(o,px,pz,0.01)) return false; }
    return true;
  };
  if(ok(nx,nz)) return [nx,nz];
  if(ok(nx,z)) return [nx,z];
  if(ok(x,nz)) return [x,nz];
  return [x,z];
}
