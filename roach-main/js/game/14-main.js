// 渲染器、灯光、流程切换、主循环（最后加载）
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 게임 전체 ─────────
const G={time:0,state:'boot',shakeAmt:0,savedWeapons:null,savedBaits:null};
G.canvas=document.getElementById('gl');
G.renderer=new THREE.WebGLRenderer({canvas:G.canvas,antialias:true,powerPreference:'high-performance'});
G.renderer.shadowMap.enabled=true; G.renderer.shadowMap.type=THREE.PCFSoftShadowMap; G.renderer.toneMapping=THREE.ACESFilmicToneMapping; G.renderer.toneMappingExposure=1.0; G.renderer.outputColorSpace=THREE.SRGBColorSpace;
G.scene=new THREE.Scene(); G.scene.background=new THREE.Color(0xEBDFC0);
G.camera=new THREE.PerspectiveCamera(40,1,0.01,40); G.camBase=new THREE.Vector3(); G.camRight=new THREE.Vector3(1,0,0); G.camUp=new THREE.Vector3(0,0,-1); G.camFwd=new THREE.Vector3(0,0,-1);
// 提示文字跟着玩家最近一次实际使用的输入方式走
Object.defineProperty(G,'isTouch',{get:()=>G.input?G.input.lastType==='touch':COARSE_POINTER});
G.paint=new FloorPaint();
G.room=buildRoom(G.scene);
G.corpses=new Corpses(G.scene);
{ const ov=new THREE.Mesh(new THREE.PlaneGeometry(4,6),new THREE.MeshStandardMaterial({map:G.paint.tex,transparent:true,roughness:0.65,metalness:0,depthWrite:false})); ov.rotation.x=-Math.PI/2; ov.position.y=0.002; ov.receiveShadow=true; ov.renderOrder=1; G.scene.add(ov); }
// 조명 — 1라운드도 2라운드도 같은 낮이다. 다른 건 보는 높이뿐.
const SM=COARSE_POINTER?1024:1536;
G.hemi=new THREE.HemisphereLight(0xfff6e8,0xd9a441,0.9); G.scene.add(G.hemi);
G.sun=new THREE.DirectionalLight(0xffffff,2.4); G.sun.position.set(1.0,7,0.7); G.sun.target.position.set(0,0,0); G.scene.add(G.sun,G.sun.target);
G.sun.castShadow=true; G.sun.shadow.mapSize.set(SM,SM); Object.assign(G.sun.shadow.camera,{left:-2.4,right:2.4,top:3.4,bottom:-3.4,near:1,far:12}); G.sun.shadow.camera.updateProjectionMatrix(); G.sun.shadow.bias=-0.0004; G.sun.shadow.normalBias=0.012;
// 커튼 사이로 들어오는 낮빛 — 2라운드의 주광원
G.win=new THREE.DirectionalLight(0xe8eeff,0); G.win.position.set(7,2.4,-1.9); G.win.target.position.set(-1.2,0,-0.2); G.scene.add(G.win,G.win.target);
G.win.castShadow=true; G.win.shadow.mapSize.set(SM,SM); Object.assign(G.win.shadow.camera,{left:-3.4,right:3.4,top:3.2,bottom:-2.2,near:1,far:14}); G.win.shadow.camera.updateProjectionMatrix(); G.win.shadow.bias=-0.0006; G.win.shadow.normalBias=0.012;
// 천장 형광등 — 방 전체에 고르게 떨어지는 빛
G.ceilLamp=new THREE.DirectionalLight(0xfff8ee,0); G.ceilLamp.position.set(0.2,6,0.3); G.ceilLamp.target.position.set(0,0,0); G.scene.add(G.ceilLamp,G.ceilLamp.target);
G.ceilLamp.castShadow=true; G.ceilLamp.shadow.mapSize.set(SM,SM); Object.assign(G.ceilLamp.shadow.camera,{left:-2.4,right:2.4,top:3.4,bottom:-3.4,near:1,far:11}); G.ceilLamp.shadow.camera.updateProjectionMatrix(); G.ceilLamp.shadow.bias=-0.0004; G.ceilLamp.shadow.normalBias=0.012;
G.setLighting=function(mode){
  const R=G.room;
  R.ceilGroup.visible=(mode!=='day');
  R.ceil.material.emissiveIntensity=mode==='on'?0.5:0.03;
  const glass=(col,i)=>{ R.glass.material.emissive.set(col); R.glass.material.emissiveIntensity=i; R.glass.material.color.set(col); };
  const cur=(mode==='dim'||mode==='empty')?0.72:1;
  MAT.curtain.color.setRGB(0.92*cur,0.84*cur,0.66*cur);
  if(mode==='day'){ // 1라운드 — 위에서 내려다본다
    G.hemi.intensity=0.62; G.hemi.color.set(0xfff6e8); G.hemi.groundColor.set(0xd9a441);
    G.sun.intensity=1.75; G.sun.color.set(0xfff4e2); G.sun.visible=true; G.sun.castShadow=true;
    G.win.intensity=0; G.win.visible=false; G.win.castShadow=false;
    G.ceilLamp.intensity=0; G.ceilLamp.visible=false; G.ceilLamp.castShadow=false;
    R.fluor.material.emissiveIntensity=1.4; R.lampBulb.material.emissiveIntensity=0;
    glass(0xcfe6f7,0.7); G.scene.background.set(0xEBDFC0); G.renderer.toneMappingExposure=1.02;
  } else if(mode==='dim'||mode==='empty'){ // 2라운드 — 같은 낮, 커튼이 쳐진 방
    G.hemi.intensity=0.36; G.hemi.color.set(0xE8D6BC); G.hemi.groundColor.set(0x5e3c1a);
    G.sun.intensity=0; G.sun.visible=false; G.sun.castShadow=false;
    G.win.intensity=mode==='empty'?2.9:3.3; G.win.color.set(0xFFF0DA); G.win.visible=true; G.win.castShadow=true;
    G.ceilLamp.intensity=0; G.ceilLamp.visible=false; G.ceilLamp.castShadow=false;
    R.fluor.material.emissiveIntensity=0.02; R.lampBulb.material.emissiveIntensity=0;
    glass(0xF4F9FF,2.6); G.scene.background.set(0x2E2C29); G.renderer.toneMappingExposure=1.14;
  } else if(mode==='on'){ // 형광등이 켜졌다
    G.hemi.intensity=0.6; G.hemi.color.set(0xeef3ff); G.hemi.groundColor.set(0xc9a05a);
    G.sun.intensity=0; G.sun.visible=false; G.sun.castShadow=false;
    G.win.intensity=0.75; G.win.color.set(0xE8EEFF); G.win.visible=true; G.win.castShadow=false;
    G.ceilLamp.intensity=2.1; G.ceilLamp.visible=true; G.ceilLamp.castShadow=true;
    R.fluor.material.emissiveIntensity=1.9; R.lampBulb.material.emissiveIntensity=0;
    glass(0xEAF3FF,1.4); G.scene.background.set(0x3A3833); G.renderer.toneMappingExposure=1.06;
  }
};
G.shake=function(a){ G.shakeAmt=Math.max(G.shakeAmt,a); };
G.blackout=function(on,instant=true){ const f=document.getElementById('fade'); f.style.transition=instant?'none':'opacity .6s'; f.style.background='#000'; f.style.opacity=on?'1':'0'; };
G.view={w:1.5,h:3.3}; G.ppm=260;
G.resize=function(){ const w=innerWidth,h=innerHeight; G.renderer.setSize(w,h,false); G.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5)); G.camera.aspect=w/h; G.ppm=clamp(Math.min(w,h)/1.5,200,340); G.portrait=h>=w; G.camera.updateProjectionMatrix(); const V=h/G.ppm; G.topH=V/(2*Math.tan(G.camera.fov*Math.PI/360)); if(G.portrait){ G.view.h=V; G.view.w=V*w/h; } else { G.view.w=V; G.view.h=V*w/h; } };
G.setTopCam=function(cx,cz,scale=1){ const cam=G.camera; if(cam.fov!==40){ cam.fov=40; cam.updateProjectionMatrix(); G.resize(); } cam.up.set(G.portrait?0:1,0,G.portrait?-1:0); cam.position.set(cx,G.topH*scale,cz); cam.lookAt(cx,0,cz); if(G.portrait){ G.camRight.set(1,0,0); G.camUp.set(0,0,-1); } else { G.camRight.set(0,0,1); G.camUp.set(1,0,0); } };
window.addEventListener('resize',()=>G.resize());
G.input=new Input(G.canvas); G.ui=new UI(G); G.r1=new Round1(G); G.r2=new Round2(G);
const inR1=()=>G.state==='r1';
G.input.onPress=(x,y,t,id)=>{ if(inR1()) G.r1.press(x,y,t,id); };
G.input.onDrag=(x,y,id)=>{ if(inR1()) G.r1.drag(x,y,id); };
G.input.onRelease=(id)=>{ if(inR1()) G.r1.release(id); };
G.input.onCancel=()=>{ if(inR1()) G.r1.cancel(); };
G.input.onPan=(dx,dy)=>{ if(inR1()) G.r1.pan(dx,dy); };
G.input.onAny=()=>{ if(inR1()) G.r1.touch(); };
// 快捷键按屏幕上按钮的顺序分配（镊子按钮由 index.html 插在第二位），角标显示在按钮上
const KEY_OF_CODE={Digit1:'1',Digit2:'2',Digit3:'3',Digit4:'4',Digit5:'5',Digit6:'6',Digit7:'7',Digit8:'8',Digit9:'9',Digit0:'0',Minus:'-',Equal:'='};
const stepSlot=d=>{ const s=G.ui.slotList(); const i=s.findIndex(e=>e.classList.contains('sel')); s[((i<0?0:i)+d+s.length)%s.length].select(); };
G.input.onKey=(code,down)=>{
  if(inR1()){ if(down){ const k=KEY_OF_CODE[code]; if(k){ const el=G.ui.slotList().find(e=>e.dataset.key===k); if(el) el.select(); } if(code==='Tab') stepSlot(1); } }
  else if(G.state==='r2'){ if(code==='Space'&&down) G.input.dashReq=true; if(code==='KeyE') G.input.eggHold=down; }
};
window.addEventListener('keydown',e=>{ if(e.code==='Tab'&&inR1()) e.preventDefault(); });
// 滚轮切工具：触控板一次轻滑会连发很多小增量，累积够一格才切，切完短暂锁住，免得一下跳过好几个
let wheelAcc=0, wheelLast=0, wheelLock=0;
window.addEventListener('wheel',e=>{ if(!inR1()) return; const t=performance.now(); if(t-wheelLast>300) wheelAcc=0; wheelLast=t; if(t<wheelLock) return;
  wheelAcc+=e.deltaMode===1?e.deltaY*33:e.deltaY; if(Math.abs(wheelAcc)<50) return; stepSlot(wheelAcc>0?1:-1); wheelAcc=0; wheelLock=t+180; },{passive:true});
// 흐름
G.startRound1=function(){ G.state='r1'; G.r2.stop(); G.camera.fov=40; G.camera.near=0.05; G.camera.updateProjectionMatrix(); G.resize(); G.r1.start(); G.blackout(false,false); };


G.toRound2=function(){
  G.state='to_r2';

  G.ui.showQuit(false);
  G.r1.stop();
  G.ui.hintClear();
  G.input.reset();
  G.blackout(true,false);

  const used=[...G.r1.used].filter(k=>LETHAL_ORDER.includes(k));

  G.savedWeapons=(used.length?used:['hand']).sort(
    (a,b)=>LETHAL_ORDER.indexOf(a)-LETHAL_ORDER.indexOf(b)
  );

  G.savedBaits=[...G.r1.baitsUsed].sort(
    (a,b)=>BAIT_SLOTS.indexOf(a)-BAIT_SLOTS.indexOf(b)
  );

  // 사용한 도구는 2라운드 구성에만 반영하고 따로 설명하지 않는다.
  setTimeout(()=>{
    if(G.state==='to_r2') G.startRound2();
  },650);
};

G.startRound2=function(){
  G.state='r2';

  G.r1.stop();
  G.ui.showQuit(false);
  G.ui.confirm.classList.remove('show');

  G.camera.fov=68;
  G.camera.near=0.01;
  G.camera.updateProjectionMatrix();

  G.resize();
  G.paint.clear();
  G.corpses.clear();

  G.r2.start(
    G.savedWeapons||['hand'],
    G.savedBaits||[]
  );
};

G.lineEnded=function(gen){
  G.state='ended';

  G.r2.stop();
  G.input.reset();
  G.blackout(true);

  const e=document.getElementById('endtext');
  e.textContent='没有留下卵鞘。';
  e.style.display='grid';

  setTimeout(()=>{
    e.style.display='none';
    G.showRank(gen,false);
  },1700);
};


G.ending=function(gen){
  G.state='ended';

  G.r2.stop();
  G.input.reset();
  G.showRank(gen,true);
};


G.showRank=function(gen,ended){
  G.state='rank';
  G.rankT=0;

  const now=Date.now();
  let list=[];

  try{
    list=JSON.parse(localStorage.getItem('roach_gens')||'[]');
  }catch(e){}

  list=list
    .filter(o=>o&&Number.isFinite(Number(o.g)))
    .map(o=>({g:Number(o.g),t:Number(o.t)||0,e:!!o.e,n:Number(o.n)||0}));

  // 这一局最多能走几代（由第一阶段用过的工具决定），排名规则不变，只在记录里标出来
  const total=G.r2.weapons?G.r2.weapons.length+1:0;
  list.push({g:gen,t:now,e:!!ended,n:total});

  // 세대 수가 많은 순. 같으면 먼저 세운 기록이 위.
  list.sort((a,b)=>(b.g-a.g)||(a.t-b.t));
  list=list.slice(0,50);

  try{
    localStorage.setItem('roach_gens',JSON.stringify(list));
  }catch(e){}

  const me=list.findIndex(o=>o.t===now);
  const generations=gen+1;
  const rk=document.getElementById('rank');

  rk.querySelector('.now').innerHTML=
    `${generations}<small>代${total?` / 共 ${total} 代`:''}</small>`;

  rk.querySelector('.sub').textContent=
    (ended?'人类离开了房间。':`生命延续了 ${generations} 代。`)+
    (me>=0?` 本次排名第 ${me+1}。`:'');

  const row=(o,i)=>`<div class="${o.t===now?'me':''}">第 ${i+1} 名 · ${o.g+1} 代${o.n?` / 共 ${o.n} 代`:''}${o.e?' · 已通关':''}</div>`;
  let html=list.slice(0,5).map(row).join('');
  if(me>=5) html+=`<div class="gap">⋯</div>`+row(list[me],me);
  rk.querySelector('.list').innerHTML=html;

  rk.style.display='block';
  G.blackout(false);
};

G.restart=function(){ document.getElementById('rank').style.display='none'; G.startRound2(); };
G.restartAll=function(){ document.getElementById('rank').style.display='none'; G.startRound1(); };
// 디버그 진입
const Q=new URLSearchParams(window.__ROACH_SEARCH ?? location.search); G.paused=Q.get('pause')==='1';
G.resize();
if(Q.get('r')==='2'){ G.savedWeapons=Q.get('w')?Q.get('w').split(','):LETHAL_ORDER.slice(); G.savedBaits=Q.get('b')?Q.get('b').split(','):['bone']; G.startRound2(); if(Q.get('gen')){ G.r2.gen=parseInt(Q.get('gen'),10); G.r2.startGen(); } }
else if(Q.get('r')==='rank'){ G.savedWeapons=['hand','slipper']; G.showRank(2,false); }
else G.startRound1();
G.corpses.prewarm();
window.__g=G; window.__THREE=THREE; window.__SFX=SFX; G.HOLES=HOLES;


G.advance=function(T,step=1/60){
  for(
    let i=0;
    i<Math.round(T/step);
    i++
  ){
    G.time+=step;

    if(G.state==='r1'){
      G.r1.update(step);
    }else if(G.state==='r2'){
      G.r2.update(step);
    }
    G.corpses.update(step);
  }

  G.paint.flush(G.time+999);
};


// 루프
let last=now(); const _off=new THREE.Vector3();
function frame(){ requestAnimationFrame(frame); if(G.sleep){ last=now(); return; } const t=now(); let dt=Math.min(0.05,t-last); last=t; G.time+=dt;
  if(G.state==='rank') G.rankT+=dt;
  
  
if(!G.paused){
  if(G.state==='r1'){
    G.r1.update(dt);
  }else if(G.state==='r2'){
    G.r2.update(dt);
  }
  G.corpses.update(dt);
}


  if(G.state==='r2'){ G.ui.miniT-=dt; if(G.ui.miniT<=0){ G.ui.miniT=0.1; G.ui.drawMini(G.r2.miniData()); } }
  if(G.shakeAmt>0.001){ const a=G.shakeAmt*0.02; _off.set(rand(-a,a),rand(-a,a),rand(-a,a)); G.camera.position.add(_off); G.shakeAmt*=Math.exp(-9*dt); }
  G.paint.flush(G.time); G.renderer.render(G.scene,G.camera);
}
frame();
