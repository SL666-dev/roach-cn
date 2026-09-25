// 输入：鼠标、键盘、触屏、摇杆 Input
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 입력 ─────────
// 第一阶段：左键使用工具，空格 + 左键或中键拖动画面；触屏仍用双指拖动。
// 2라운드: 左侧 절반에 손가락을 대면 그 자리에 스틱이 생긴다. 손을 떼면 스틱은 기본 자리로 돌아가 흐리게 떠 있다.
// 主要指点设备是不是手指。带触控板/触屏的笔记本 maxTouchPoints 也大于 0，不能拿它判断玩家在用什么。
const COARSE_POINTER=window.matchMedia?matchMedia('(pointer: coarse)').matches:('ontouchstart' in window);
// 第一阶段触屏：手指按下后等这么久（毫秒）才使用工具。期间第二根手指落下就当作双指拖动画面，不打出工具。
const TOUCH_ACT_DELAY=60;
class Input{
  constructor(canvas){
    this.canvas=canvas; this.keys=new Set(); this.pointers=new Map();
    this.stick={active:false,id:null,ox:0,oy:0,x:0,y:0,vx:0,vy:0};
    this.mouse={x:innerWidth/2,y:innerHeight/2,live:false}; this.lastType=COARSE_POINTER?'touch':'mouse'; this.look={dx:0,dy:0}; this.lookId=null; this.lookOn=false;
    this._mode='boot'; this.onPress=null; this.onDrag=null; this.onRelease=null; this.onCancel=null; this.onPan=null; this.onAny=null; this.onKey=null;
    this.dashReq=false; this.eggHold=false;
    this.touchCap=('ontouchstart' in window)||navigator.maxTouchPoints>0;
    this.el=document.getElementById('stick'); this.knob=document.getElementById('knob');
    canvas.addEventListener('pointerdown',e=>this.down(e));
    window.addEventListener('pointermove',e=>this.move(e));
    window.addEventListener('pointerup',e=>this.up(e)); window.addEventListener('pointercancel',e=>this.up(e));
    window.addEventListener('keydown',e=>{ if(!this.keys.has(e.code)){ this.keys.add(e.code); this.onKey&&this.onKey(e.code,true);} this.onAny&&this.onAny(); if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
    window.addEventListener('keyup',e=>{ this.keys.delete(e.code); this.onKey&&this.onKey(e.code,false); });
    document.addEventListener('contextmenu',e=>e.preventDefault());
    // iOS Safari 不理会 user-scalable=no：拦下双指缩放手势和双击缩放
    for(const ev of ['gesturestart','gesturechange','dblclick']) document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
    canvas.addEventListener('auxclick',e=>e.preventDefault());
    window.addEventListener('blur',()=>{ this.keys.clear(); this.reset(); });
    // 手机切到后台时不一定会发 pointercancel，回来后摇杆会卡在按下状态
    document.addEventListener('visibilitychange',()=>{ if(document.hidden){ this.keys.clear(); this.reset(); } });
    window.addEventListener('resize',()=>{ if(!this.stick.active) this.idleStick(); });
  }
  set mode(v){ this._mode=v; if(v==='r2') this.idleStick(); else { this.el.style.display='none'; this.el.classList.remove('live'); } }
  get mode(){ return this._mode; }
  idlePos(){ return [Math.min(innerWidth*0.22,120), innerHeight-Math.min(innerHeight*0.24,140)]; }
  // 스틱은 터치로 조작할 때만 보인다 (마우스·키보드로 할 때는 쓸 수 없으니 숨긴다)
  idleStick(){ if(this._mode!=='r2') return; if(!this.touchCap||this.lastType==='mouse'){ this.el.style.display='none'; return; } const [x,y]=this.idlePos(); this.el.style.display='block'; this.el.classList.remove('live'); this.el.style.left=x+'px'; this.el.style.top=y+'px'; this.knob.style.transform='translate(0,0)'; }
  down(e){
    SFX.ensure(); this.lastType=e.pointerType==='mouse'?'mouse':'touch'; this.onAny&&this.onAny();
    const p={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,type:this.lastType,role:'none',stick:false,t0:performance.now()};
    if(this._mode==='r1'){
      if(p.type==='mouse'){
        if(e.button===1||(e.button===0&&this.keys.has('Space'))){ p.role='pan'; e.preventDefault(); }
        else if(e.button===0) p.role='act';
        else return;
      }
      else { let pan=0, pend=null; for(const q of this.pointers.values()){ if(q.role==='pan') pan++; else if(q.pending) pend=q; }
        // 두 번째 손가락이 첫 손가락의 대기 시간 안에 닿으면 둘 다 화면 이동으로 본다. 둘 다 거의 안 움직이고 떼면 그때 각각 한 번 누른 것으로 친다.
        if(pend){ pend.pending=false; pend.role='pan'; pend.tapBack=true; p.role='pan'; p.tapBack=true; }
        else p.role=pan?'pan':'act'; }
      this.pointers.set(p.id,p); try{ this.canvas.setPointerCapture(p.id); }catch(err){}
      if(p.role==='act'){ if(p.type==='mouse') this.onPress&&this.onPress(p.x,p.y,p.type,p.id); else { p.pending=true; setTimeout(()=>this.firePending(p),TOUCH_ACT_DELAY); } }
      return;
    }
    if(p.type==='mouse'){ if(e.button!==0) return; p.role='look'; if(!this.stick.active) this.el.style.display='none'; }
    else if(p.x<innerWidth*0.5&&!this.stick.active) p.role='move'; else if(this.lookId===null) p.role='look'; else if(!this.stick.active) p.role='move'; else return;
    this.pointers.set(p.id,p); try{ this.canvas.setPointerCapture(p.id); }catch(err){}
    if(p.role==='move') this.beginStick(p); else { this.lookId=p.id; this.lookOn=true; }
  }
  firePending(p){ if(!p.pending||this.pointers.get(p.id)!==p) return; p.pending=false; this.onPress&&this.onPress(p.sx,p.sy,p.type,p.id); }
  consumeLook(){ const l={dx:this.look.dx,dy:this.look.dy}; this.look.dx=this.look.dy=0; return l; }
  lookKeys(){ let x=0,y=0; const k=this.keys; if(k.has('ArrowLeft')) x-=1; if(k.has('ArrowRight')) x+=1; if(k.has('ArrowUp')) y+=1; if(k.has('ArrowDown')) y-=1; return [x,y]; }
  beginStick(p){ p.stick=true; const s=this.stick; s.active=true; s.id=p.id; s.ox=p.x; s.oy=p.y; s.x=p.x; s.y=p.y; s.vx=s.vy=0; this.el.style.display='block'; this.el.classList.add('live'); this.el.style.left=s.ox+'px'; this.el.style.top=s.oy+'px'; this.knob.style.transform='translate(0,0)'; }
  move(e){
    if(e.pointerType==='mouse'){ this.mouse.x=e.clientX; this.mouse.y=e.clientY; this.mouse.live=true; }
    const p=this.pointers.get(e.pointerId); if(!p) return;
    const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY;
    if(this._mode==='r1'){
      if(p.type==='mouse'){
        const panHeld=!!(e.buttons&4)||!!((e.buttons&1)&&this.keys.has('Space'));
        if(panHeld){
          if(p.role==='act') this.onCancel&&this.onCancel();
          p.role='pan'; e.preventDefault();
        }else if(p.role==='pan'){
          // 松开空格后停止拖动，本次按键不再触发工具，避免误击。
          p.role='none';
        }
      }
      if(p.role==='act'){
        if(p.pending) return;
        // 다른 손가락과 함께 끌리면 화면 이동으로 바꾼다. 번갈아 두드리는 손가락은 거의 안 움직이므로 타격으로 남는다.
        if(p.type!=='mouse'&&Math.hypot(p.x-p.sx,p.y-p.sy)>12){ let moved=false; for(const q of this.pointers.values()){ if(q!==p&&q.type!=='mouse'&&Math.hypot(q.x-q.sx,q.y-q.sy)>10){ moved=true; break; } }
          if(moved){ for(const q of this.pointers.values()) if(q.type!=='mouse') q.role='pan'; this.onCancel&&this.onCancel(); return; } }
        this.onDrag&&this.onDrag(p.x,p.y,p.id); }
      else if(p.role==='pan'){ if(p.tapBack&&Math.hypot(p.x-p.sx,p.y-p.sy)>12){ for(const q of this.pointers.values()) q.tapBack=false; } let n=0; for(const q of this.pointers.values()) if(q.role==='pan') n++; this.onPan&&this.onPan(dx/Math.max(1,n),dy/Math.max(1,n)); }
      return;
    }
    if(p.role==='look'){ this.look.dx+=dx; this.look.dy+=dy; return; }
    if(p.stick&&this.stick.id===p.id){ const s=this.stick; let sx=p.x-s.ox, sy=p.y-s.oy; const d=Math.hypot(sx,sy), R=62; if(d>R){ sx*=R/d; sy*=R/d; } s.x=s.ox+sx; s.y=s.oy+sy; const m=Math.min(1,d/R), dz=0.12, k=m<dz?0:Math.pow((m-dz)/(1-dz),1.5); const n=d>0.001?k/d:0; s.vx=(p.x-s.ox)*n; s.vy=(p.y-s.oy)*n; this.knob.style.transform=`translate(${sx}px,${sy}px)`; }
  }
  up(e){
    const p=this.pointers.get(e.pointerId); if(!p) return; this.pointers.delete(e.pointerId);
    if(this._mode==='r1'){ const cancel=e.type==='pointercancel';
      if(p.pending){ p.pending=false; if(cancel) return; this.onPress&&this.onPress(p.sx,p.sy,p.type,p.id); }
      else if(p.tapBack&&!cancel&&Math.hypot(p.x-p.sx,p.y-p.sy)<12){ this.onPress&&this.onPress(p.sx,p.sy,p.type,p.id); this.onRelease&&this.onRelease(p.id); return; }
      if(p.role==='act') this.onRelease&&this.onRelease(p.id); return; }
    if(p.role==='look'&&this.lookId===p.id){ this.lookId=null; this.lookOn=false; if(performance.now()-p.t0<220&&Math.hypot(p.x-p.sx,p.y-p.sy)<10){ this.dashReq=true; this.onDashTap&&this.onDashTap(p.x,p.y); } }
    if(p.stick&&this.stick.id===p.id){ this.stick.active=false; this.stick.id=null; this.stick.vx=this.stick.vy=0; this.idleStick(); }
  }
  keyVec(arrows=true){ let x=0,y=0; const k=this.keys; if(k.has('KeyW')||(arrows&&k.has('ArrowUp'))) y-=1; if(k.has('KeyS')||(arrows&&k.has('ArrowDown'))) y+=1; if(k.has('KeyA')||(arrows&&k.has('ArrowLeft'))) x-=1; if(k.has('KeyD')||(arrows&&k.has('ArrowRight'))) x+=1; const d=Math.hypot(x,y); return d?[x/d,y/d]:[0,0]; }
  vec(){ if(this.stick.active) return [this.stick.vx,this.stick.vy]; return this.keyVec(this._mode==='r1'); }
  reset(){ this.stick.active=false; this.stick.id=null; this.stick.vx=this.stick.vy=0; this.pointers.clear(); this.eggHold=false; this.dashReq=false; this.look.dx=this.look.dy=0; this.lookId=null; this.lookOn=false; if(this._mode==='r2') this.idleStick(); else { this.el.style.display='none'; this.onCancel&&this.onCancel(); } }
}
