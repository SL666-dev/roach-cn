// 第一阶段：工具定义与 Round1
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 아이템 정의 ─────────
const ITEMS={
  hand:   {r:0.10,windup:0.05,rest:0.10,hover:0.30},
  slipper:{r:0.13,windup:0.09,rest:0.14,hover:0.24},
  tissue: {r:0.09,windup:0.08,rest:0.24,hover:0.20},
  book:   {r:0.21,windup:0.15,rest:0.26,hover:0.30},
  pan:    {r:0.18,windup:0.12,rest:0.22,hover:0.28},
  spray:  {cone:{len:1.0,ang:0.5},hold:true,hover:0.12},
  flame:  {cone:{len:0.65,ang:0.32},hold:true,hover:0.08},
  vacuum: {cone:{len:0.5,ang:0.75},hold:true,hover:0.0},
  bone:{bait:{radius:2.8,amount:40,spread:0.15,boost:12},hover:0.16},
  cola:{bait:{radius:2.2,amount:30,spread:0.34,boost:7},hover:0.16},
  rice:{bait:{radius:1.8,amount:18,spread:0.10,boost:5},hover:0.16},
};
const SLOT_ORDER=['hand','slipper','tissue','book','pan','spray','flame','vacuum'];
const LABEL={hand:'徒手',slipper:'拖鞋',tissue:'纸巾',book:'书本',pan:'平底锅',spray:'杀虫剂',flame:'火焰',vacuum:'吸尘器',bone:'鸡骨头',cola:'可乐',rice:'米饭'};
const BAIT_SLOTS=['bone','cola','rice'];
const LETHAL_ORDER=['hand','tissue','slipper','book','pan','vacuum','spray','flame'];
const ROACH_R=0.05;
const QUIT_KILLS=40;

// ───────── 1라운드 ─────────
class Round1{
  constructor(G){
    this.G=G; const {scene}=G;
    this.grp=new THREE.Group(); scene.add(this.grp);
    this.roaches=[]; this.nymphs=[]; this.oothecae=[]; this.baits=[]; this.baitMeshes=[]; this.kills=0; this.combo=0; this.lastKill=-9; this.lastAction=0; this.time=0; this.spawnT=0; this.boost=0;
    this.item='hand'; this.used=new Set(); this.killedWith=new Set(); this.baitsUsed=new Set(); this.strikes=[]; this.hold=null; this.cam={x:0,z:0.15};
    this.splat=new Splatter(this.grp,G.paint); this.puffs=new Puffs(this.grp);
    this.itemMeshes={}; for(const k of [...SLOT_ORDER,...BAIT_SLOTS]){ const m=makeItem(k); m.visible=false; this.grp.add(m); this.itemMeshes[k]=m; } this.itemPool={};
    this.quitShown=false; this.active=false; this.ray=new THREE.Raycaster(); this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    this.scorchT=0; this.crackleT=0; this.hoverT=0; this.intro=null; this.introK=1; this.eggSpawnT=0;
  }
  floorPoint(sx,sy){ const v=new THREE.Vector2((sx/innerWidth)*2-1,-(sy/innerHeight)*2+1); this.ray.setFromCamera(v,this.G.camera); const p=new THREE.Vector3(); return this.ray.ray.intersectPlane(this.plane,p)?p:null; }
  start(){
    this.active=true; this.G.input.mode='r1'; document.getElementById('r1ui').style.display='block';
    this.kills=0; this.combo=0; this.lastKill=-9; this.time=0; this.spawnT=0; this.boost=0; this.used=new Set(); this.killedWith=new Set(); this.baitsUsed=new Set(); this.clearStrikes(); this.hold=null; this.cam={x:0,z:0.15}; this.quitShown=false; this.G.ui.showQuit(false); this.G.ui.setKills(0);

  this.clearNymphs(); this.clearOothecae(); this.eggSpawnT=3.5;

    this.G.setLighting('day'); this.G.paint.clear(); this.G.corpses.clear(); this.splat.setLevel(0);
    // 인트로: 방 전체가 보이는 높이에서 손에 잡히는 크기까지 내려온다
    this.intro={t:0,k0:Math.max(1,6/this.G.view.h)}; this.introK=this.intro.k0; this.G.setTopCam(this.cam.x,this.cam.z,this.introK);
    this.resetCushion(); for(let i=0;i<12;i++) this.spawn(true); for(let i=0;i<3;i++){ const r=this.spawn(true); r.x=CUSHION.x+rand(-0.12,0.12); r.z=CUSHION.z+rand(-0.12,0.12); r.spd=0; r.t=rand(3,9); r.m.g.position.set(r.x,0,r.z); }
   
   
     this.selectItem('hand');
    this.lastAction=0;

    this.G.ui.hint(
      '选好工具，再点击蟑螂所在的位置。',
      3.2,
      1.8,
      true
    );

    this.G.ui.hint(
      this.G.isTouch
        ? '双指拖动：移动画面'
        : '空格 + 左键拖动 / 中键拖动：移动画面 · 数字键：切换工具',
      3.4,
      0.25,
      true
    );


  }
  resetCushion(){ this.cushionF={flipped:false,t:0,k:0,dx:0,dz:1}; const c=this.G.room.cushion; c.position.set(CUSHION.x,0.022,CUSHION.z); c.quaternion.identity(); }
  underCushion(x,z){ return !this.cushionF.flipped&&this.cushionF.k<0.5&&dist2(x,z,CUSHION.x,CUSHION.z)<CUSHION.r*CUSHION.r; }
  flipCushion(x,z){ const f=this.cushionF; if(f.flipped) return; let dx=CUSHION.x-x, dz=CUSHION.z-z; const d=Math.hypot(dx,dz); if(d<0.05){ dx=this.G.camUp.x; dz=this.G.camUp.z; } else { dx/=d; dz/=d; } f.flipped=true; f.t=0; f.dx=dx; f.dz=dz; SFX.cushionFlip(); this.G.shake(0.2);
    for(const r of this.roaches){ if(r.state==='dead'||r.gone) continue; if(dist2(r.x,r.z,CUSHION.x,CUSHION.z)<CUSHION.r*CUSHION.r){ r.startle={t:rand(0.15,0.55),ax:CUSHION.x,az:CUSHION.z}; } } }
  updateCushion(dt){ const f=this.cushionF, c=this.G.room.cushion; if(!f.flipped&&f.k<=0) return; f.t+=dt; let k; if(f.flipped){ k=Math.min(1,f.t/0.35); if(f.t>4.2){ f.flipped=false; f.t=0; } } else { k=Math.max(0,1-f.t/0.35); } f.k=k; const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2; c.position.set(CUSHION.x+f.dx*0.5*e,0.022+Math.sin(e*Math.PI)*0.22,CUSHION.z+f.dz*0.5*e); c.quaternion.setFromAxisAngle(new THREE.Vector3(f.dz,0,-f.dx).normalize(),e*Math.PI); }
  stop(){ this.active=false; document.getElementById('r1ui').style.display='none'; this.stopHold(); this.clearStrikes(); this.resetCushion(); for(const r of this.roaches) this.grp.remove(r.m.g); this.roaches.length=0; this.clearNymphs(); this.clearOothecae(); for(const b of this.baitMeshes) ITEM_POOL.put(b); this.baitMeshes.length=0; this.baits.length=0; for(const k in this.itemMeshes) this.itemMeshes[k].visible=false; this.puffs.clear(); this.splat.hideAll(); this.G.ui.setKills(null); }
  selectItem(k){ if(this.hold) this.stopHold(); this.item=k; this.G.ui.selectSlot(k); this.touch(); }
  level(){ return clamp(this.kills/80,0,1); }
  touch(){ this.lastAction=this.time; }
  inView(x,z,m=0){ const V=this.G.view; return Math.abs(x-this.cam.x)<V.w/2+m&&Math.abs(z-this.cam.z)<V.h/2+m; }
  clampCam(){ const V=this.G.view; const lx=V.w>=4.2?0:2-V.w/2, lz=V.h>=6.2?0:3-V.h/2; this.cam.x=clamp(this.cam.x,-lx,lx); this.cam.z=clamp(this.cam.z,-lz,lz); }
  pan(dx,dy){ if(this.intro) return; const R=this.G.camRight, U=this.G.camUp, p=this.G.ppm; this.cam.x-=(R.x*dx-U.x*dy)/p; this.cam.z-=(R.z*dx-U.z*dy)/p; this.clampCam(); this.touch(); }
  okPos(px,pz){ if(px<ROOM.x1+0.06||px>ROOM.x2-0.06||pz<ROOM.z1+0.06||pz>ROOM.z2-0.06) return false; for(const o of OBST){ if(!o.roach&&inObst(o,px,pz,0.02)) return false; } return true; }
  spawn(anywhere=false){
    const V=this.G.view, cam=this.cam; let x=0,z=0,h=0,done=false;
    if(anywhere){ for(let i=0;i<24&&!done;i++){ x=rand(cam.x-V.w/2+0.12,cam.x+V.w/2-0.12); z=rand(cam.z-V.h/2+0.12,cam.z+V.h/2-0.12); done=this.okPos(x,z); } h=rand(TAU); }
    else {
      const pool=HOLE_LIST.filter(o=>this.inView(o.x,o.z,0.35));
      if(pool.length&&Math.random()<0.6){ const o=pool[Math.floor(rand(pool.length))]; x=o.x+o.dx*0.03; z=o.z+o.dz*0.03; h=Math.atan2(o.dx,o.dz)+rand(-0.5,0.5); done=true; }
      for(let i=0;i<12&&!done;i++){ const side=Math.floor(rand(4)); const mx=V.w/2+rand(0.1,0.25), mz=V.h/2+rand(0.1,0.25);
        if(side===0){ x=cam.x-mx; z=rand(cam.z-V.h/2,cam.z+V.h/2); } else if(side===1){ x=cam.x+mx; z=rand(cam.z-V.h/2,cam.z+V.h/2); } else if(side===2){ x=rand(cam.x-V.w/2,cam.x+V.w/2); z=cam.z-mz; } else { x=rand(cam.x-V.w/2,cam.x+V.w/2); z=cam.z+mz; }
        if(this.okPos(x,z)){ done=true; h=Math.atan2(cam.x-x,cam.z-z)+rand(-0.7,0.7); } }
    }
    if(!done){ const o=HOLE_LIST[Math.floor(rand(HOLE_LIST.length))]; x=o.x+o.dx*0.03; z=o.z+o.dz*0.03; h=Math.atan2(o.dx,o.dz)+rand(-0.5,0.5); }
    const m=makeRoach(); this.grp.add(m.g);
    const r={x,z,h,spd:rand(0.15,0.3),state:'wander',t:rand(0.8,2.2),m,poison:0,dead:0,turn:rand(-0.6,0.6),hole:null,bait:null,twitch:0,bakeMode:'crushed',startle:null,offT:0,fleeT:0,fleeSpd:0.7};
    m.g.position.set(r.x,0,r.z); m.g.rotation.y=r.h; this.roaches.push(r); return r;
  }


 tryLayOotheca(){
    const liveNymphs=this.nymphs.filter(n=>n.state!=='dead').length;
    if(this.oothecae.length>=2||liveNymphs>=18) return false;
    const pool=this.roaches.filter(r=>
      r.state==='wander'&&!r.startle&&!r.gone&&!r.layEgg&&
      this.inView(r.x,r.z,0.1)&&!this.underCushion(r.x,r.z)
    );
    if(!pool.length) return false;
    const r=pool[Math.floor(rand(pool.length))];
    r.layEgg={t:0,laid:false};
    r.spd=0;
    return true;
  }
  spawnOotheca(x,z,h){
    const mesh=makeItem('egg');
    mesh.scale.setScalar(0.9);
    mesh.position.set(x,0,z);
    mesh.rotation.y=h+Math.PI/2;
    this.grp.add(mesh);
    this.oothecae.push({x,z,h,mesh,t:0,hatchAt:rand(4.8,7),spray:0});
  }
  removeOotheca(o){
    const i=this.oothecae.indexOf(o);
    if(i>=0) this.oothecae.splice(i,1);
    // 卵鞘的形状和材质是所有卵鞘、活蟑螂共用的，这里只从场景里拿掉，不能释放
    this.grp.remove(o.mesh);
  }
  clearOothecae(){
    for(const o of [...this.oothecae]) this.removeOotheca(o);
  }
  spawnNymph(x,z,h,delay=0){
    const m=makeNymph();
    const a=h+rand(-1.2,1.2), d=rand(0.015,0.045);
    const n={
      x:x+Math.sin(a)*d,z:z+Math.cos(a)*d,h:a,m,
      spd:rand(0.35,0.7),turn:rand(-2.2,2.2),turnT:rand(0.15,0.45),
      delay,state:'live',dead:0,poisonT:0,spray:0,offT:0
    };
    m.g.visible=delay<=0;
    m.g.position.set(n.x,0,n.z); m.g.rotation.y=n.h;
    this.grp.add(m.g); this.nymphs.push(n);
    return n;
  }
  removeNymph(n){
    const i=this.nymphs.indexOf(n);
    if(i>=0) this.nymphs.splice(i,1);
    this.grp.remove(n.m.g);
  }
  clearNymphs(){
    for(const n of [...this.nymphs]) this.removeNymph(n);
  }
  killNymph(n,weapon,idx=0){
    if(!this.nymphs.includes(n)||n.state==='dead') return;
    const pan=clamp((n.x-this.cam.x)/2,-0.8,0.8);
    if(weapon==='vacuum'){
      SFX.kill('vacuum',0,0.32,0,pan,1);
      this.removeNymph(n);
      return;
    }
    n.state='dead'; n.dead=0;
    SFX.kill(weapon,0,weapon==='flame'?0.24:0.32,idx*0.015,pan,1);
    this.G.paint.drop(n.x,n.z,0.008,this.level(),true,false);
    this.touch();
  }
  hatchOotheca(o){
    const room=Math.max(0,18-this.nymphs.filter(n=>n.state!=='dead').length);
    const count=Math.min(8+Math.floor(rand(3)),room);
    SFX.eggHatch();
    
    for(let i=0;i<count;i++) this.spawnNymph(o.x,o.z,o.h,i*0.08+rand(0,0.05));
    this.removeOotheca(o);
  }
  destroyOotheca(o){
    if(!this.oothecae.includes(o)) return;
    SFX.eggCrush();
    this.G.paint.drop(o.x,o.z,0.018,this.level(),true,false);
    this.removeOotheca(o);
    this.touch();
  }
  updateOothecae(dt){
    for(const o of [...this.oothecae]){
      o.t+=dt;
      o.spray=Math.max(0,o.spray-dt*0.35);
      const near=Math.max(0,o.t-(o.hatchAt-1.2));
      const pulse=near>0?Math.sin(near*18)*0.06:0;
      o.mesh.scale.set(0.9*(1+pulse),0.9*(1-pulse*0.45),0.9*(1+pulse*0.3));
      if(o.t>=o.hatchAt) this.hatchOotheca(o);
    }
  }
  updateNymphs(dt){
    for(let i=this.nymphs.length-1;i>=0;i--){
      const n=this.nymphs[i], m=n.m;
      if(n.delay>0){ n.delay-=dt; m.g.visible=false; if(n.delay>0) continue; m.g.visible=true; }
      if(n.state==='dead'){
        n.dead=Math.min(1,n.dead+dt/0.24);
        m.pose(0,dt,n.dead);
        if(n.dead>=1){ this.removeNymph(n); continue; }
        m.g.position.set(n.x,0,n.z); m.g.rotation.y=n.h;
        continue;
      }
      if(n.state==='poison'){
        n.poisonT-=dt;
        m.pose(0.7+0.3*Math.sin(this.time*35+i),dt*1.8,0.12);
        m.g.rotation.z=Math.PI;
        m.g.position.set(n.x,ROACH_L*NYMPH_SCALE*ROACH_TOP,n.z);
        if(n.poisonT<=0) this.killNymph(n,'spray');
        continue;
      }
      n.spray=Math.max(0,n.spray-dt*0.45);
      n.turnT-=dt;
      if(n.turnT<=0){
        n.turnT=rand(0.12,0.42);
        n.turn=rand(-2.8,2.8);
        n.spd=Math.random()<0.28?0:rand(0.35,0.82);
      }
      n.h+=n.turn*dt+Math.sin(this.time*21+i*1.7)*dt*0.65;
      if(n.spd>0){
        const nx=n.x+Math.sin(n.h)*n.spd*dt, nz=n.z+Math.cos(n.h)*n.spd*dt;
        const [px,pz]=roachMove(n.x,n.z,nx,nz);
        if(px===n.x&&pz===n.z) n.h+=rand(1.8,2.8)*(Math.random()<0.5?1:-1);
        n.x=px; n.z=pz;
      }
      if(this.inView(n.x,n.z,0.2)) n.offT=0;
      else if(!this.inView(n.x,n.z,0.6)){ n.offT+=dt; if(n.offT>3){ this.removeNymph(n); continue; } }
      m.g.position.set(n.x,0,n.z); m.g.rotation.set(0,n.h,0);
      m.pose(clamp(n.spd/0.8,0,1),dt,0);
    }
  }




  scare(x,z,rad){ for(const r of this.roaches){ if(r.state==='dead'||r.state==='poison'||r.gone||r.startle||r.state==='flee') continue; const d=Math.hypot(r.x-x,r.z-z); if(d>rad) continue; if(r.state==='feed'&&(d>rad*0.55||Math.random()<0.5)) continue; r.startle={t:rand(0.14,0.3),ax:x,az:z}; } }
  flee(r,ax,az){ r.state='flee'; r.t=0; r.bait=null; r.fleeT=rand(0.7,1.5); r.fleeSpd=lerp(0.7,1.2,this.level())*rand(0.9,1.1); const d=Math.hypot(r.x-ax,r.z-az); r.h=(d<0.01?rand(TAU):Math.atan2(r.x-ax,r.z-az))+rand(-0.6,0.6); const hole=nearHole(r.x,r.z,0.6); r.hole=(hole&&(hole.cushion?!this.cushionF.flipped&&Math.random()<0.6:Math.random()<0.35))?hole:null; }
  killRoach(r,weapon,cx,cz,idx=0){
    if(r.state==='dead') return; r.state='dead'; r.startle=null; r.dead=0; r.t=0; r.bakeMode=weapon==='flame'?'burnt':weapon==='spray'?'belly':'crushed';
    this.kills++; this.killedWith.add(weapon); this.G.ui.setKills(this.kills);
    const L=this.level(); this.splat.setLevel(L);
    const t=now(); if(t-this.lastKill>1.3) this.combo=0; this.combo++; this.lastKill=t; this.touch();
    const pan=clamp((r.x-this.cam.x)/2,-0.8,0.8);
    if(weapon!=='vacuum'&&weapon!=='spray'){ SFX.kill(weapon,this.combo,weapon==='flame'?0.6:1,idx*0.03,pan,1); }
    if(weapon!=='vacuum'&&weapon!=='flame'&&weapon!=='spray'){
      let dx=r.x-cx, dz=r.z-cz; if(Math.hypot(dx,dz)<0.01){ dx=Math.cos(r.h); dz=-Math.sin(r.h); }
      const size=0.08+L*0.045+(weapon==='pan'?0.03:weapon==='book'?0.02:weapon==='tissue'?-0.02:0);
      this.G.paint.splat(r.x,r.z,dx,dz,size,L,weapon);
      this.splat.burst(r.x,r.z,dx,dz,(weapon==='tissue'?3:8)+Math.floor(L*9)+(weapon==='pan'?7:weapon==='book'?4:0),weapon==='pan'?1.3:weapon==='tissue'?0.5:1);
    }
    if(weapon==='vacuum'){ this.grp.remove(r.m.g); r.gone=true; SFX.kill('vacuum',this.combo,1,0,pan,1); }
  }
    impact(x,z,item){
    const it=ITEMS[item]; const R=it.r+ROACH_R; const hit=[];
    if(!this.cushionF.flipped&&this.cushionF.k<=0&&dist2(x,z,CUSHION.x,CUSHION.z)<(CUSHION.r+0.03)*(CUSHION.r+0.03)){ this.flipCushion(x,z); this.touch(); return 0; }
    for(const q of this.roaches){ if(q.state==='dead'||q.gone) continue; if(this.underCushion(q.x,q.z)) continue; if(dist2(q.x,q.z,x,z)<R*R) hit.push(q); }
    hit.sort((a,b)=>dist2(a.x,a.z,x,z)-dist2(b.x,b.z,x,z));
    let n=0; for(const q of hit){ this.killRoach(q,item,x,z,n); n++; }
  
      const nr=it.r+ROACH_R*NYMPH_SCALE;

    for(const q of [...this.nymphs]){
      if(
        q.delay>0 ||
        q.state==='dead' ||
        this.underCushion(q.x,q.z)
      ) continue;

      if(dist2(q.x,q.z,x,z)<nr*nr){
        this.killNymph(q,item,n);
        n++;
      }
    }

    const er=it.r+0.04;

    for(const o of [...this.oothecae]){
      if(this.underCushion(o.x,o.z)) continue;

      if(dist2(o.x,o.z,x,z)<er*er){
        this.destroyOotheca(o);
        n++;
      }
    }



    if(!n){
      SFX.miss(
        item,
        clamp((x-this.cam.x)/2,-0.8,0.8)
      );
    }

    this.G.shake(
      item==='pan'||item==='book'
        ? 0.55
        : item==='hand'
          ? 0.18
          : 0.3
    );

    this.scare(x,z,R+0.18);
    this.touch();

    return n;
  }





  itemYaw(k){ const U=this.G.camUp; const up=Math.atan2(U.x,U.z);
    if(k==='pan') return up+Math.PI; if(k==='hand') return up; if(k==='slipper') return up+rand(-0.35,0.35); if(k==='book') return rand(-0.6,0.6); if(k==='tissue') return rand(TAU); return up; }
  press(sx,sy,type,pid){ if(!this.active||this.intro) return; const p=this.floorPoint(sx,sy); if(!p) return; this.touch(); const it=ITEMS[this.item];
    if(it.bait){ this.placeBait(this.item,p.x,p.z); return; }
    if(it.hold){ this.startHold(p.x,p.z,pid); return; }
    this.beginStrike(p.x,p.z,type); }
  // 끌기·손 떼기는 뿌리는 도구를 쥔 손가락만 따른다 — 다른 손가락으로 두드리는 동안에도 계속 뿌려진다
  drag(sx,sy,pid){ const h=this.hold; if(!h) return; if(pid!=null&&h.pid!=null&&pid!==h.pid) return; const p=this.floorPoint(sx,sy); if(!p) return; this.touch(); const mx=p.x-h.x, mz=p.z-h.z, d=Math.hypot(mx,mz);
    if(d>0.012){ let nx=h.dx*0.45+mx/d*0.55, nz=h.dz*0.45+mz/d*0.55; const n=Math.hypot(nx,nz)||1; h.dx=nx/n; h.dz=nz/n; }
    h.x=p.x; h.z=p.z; }
  release(pid){ const h=this.hold; if(h&&(pid==null||h.pid==null||pid===h.pid)) this.stopHold(); }
  // 화면 이동으로 바뀌면 아직 내려오는 중인 타격과 뿌리기를 거둔다
  cancel(){ for(let i=this.strikes.length-1;i>=0;i--){ const s=this.strikes[i]; if(s.phase==='windup'){ this.freeStrike(s); this.strikes.splice(i,1); } } if(this.hold) this.stopHold(); }
  clearStrikes(){ for(const s of this.strikes) this.freeStrike(s); this.strikes.length=0; for(const k in this.itemPool) for(const m of this.itemPool[k]){ m.visible=false; m.userData.busy=false; } }
  freeStrike(s){ s.m.visible=false; s.m.userData.busy=false; }
  // 같은 도구로 여러 번 동시에 내려칠 수 있게 도구 모형을 몇 벌 둔다
  strikeMesh(k){
    const pool=this.itemPool[k]||(this.itemPool[k]=[this.itemMeshes[k]]);
    for(const m of pool) if(!m.userData.busy) return m;
    if(pool.length<6){ const m=makeItem(k); m.visible=false; this.grp.add(m); pool.push(m); return m; }
    const old=this.strikes.find(s=>s.item===k); if(old.phase==='windup') this.impact(old.x,old.z,old.item); this.freeStrike(old); this.strikes.splice(this.strikes.indexOf(old),1); return old.m;
  }
  beginStrike(x,z,type){
    const k=this.item, it=ITEMS[k], hov=this.itemMeshes[k], U=this.G.camUp;
    let from; if(type==='mouse'&&hov.visible&&!hov.userData.busy&&!this.strikes.length) from={x:hov.position.x,y:hov.position.y,z:hov.position.z}; else from={x:x-U.x*0.3,y:it.hover+0.28,z:z-U.z*0.3};
    const m=this.strikeMesh(k); m.userData.busy=true;
    const s={item:k,x,z,t:0,phase:'windup',from,yaw:this.itemYaw(k),m}; this.strikes.push(s); m.visible=true; m.position.set(from.x,from.y,from.z); m.rotation.set(0,s.yaw,0);
    this.used.add(k); this.touch();
  }
  startHold(x,z,pid){ if(this.hold) this.stopHold(); const U=this.G.camUp; this.hold={item:this.item,x,z,dx:U.x,dz:U.z,t:0,pid}; this.used.add(this.item); this.touch();
    if(this.item==='spray') SFX.startSpray(); if(this.item==='flame'){ SFX.lighterClick(); SFX.startFlame(); } if(this.item==='vacuum') SFX.startVacuum(); }
  stopHold(){ if(!this.hold) return; this.itemMeshes[this.hold.item].visible=false; this.hold=null; SFX.stopLoop('spray'); SFX.stopLoop('flame'); SFX.stopLoop('vacuum'); }
  placeBait(kind,x,z){
    const it=ITEMS[kind].bait; this.used.add(kind); this.baitsUsed.add(kind); this.touch(); SFX.spawnBait();
    { const dx=x-CUSHION.x, dz=z-CUSHION.z, d=Math.hypot(dx,dz); if(d<CUSHION.r+0.06){ const k=(CUSHION.r+0.06)/Math.max(d,0.01); x=CUSHION.x+(d<0.01?0:dx*k); z=CUSHION.z+(d<0.01?CUSHION.r+0.06:dz*k); } }
    const b={kind,x,z,amount:it.amount,radius:it.radius,spread:it.spread,t:0}; this.baits.push(b); this.boost+=it.boost;
    this.G.paint.bait(kind,x,z);
    if(kind!=='cola'){ const m=ITEM_POOL.get(kind); m.position.set(x,0,z); m.rotation.y=rand(TAU); this.grp.add(m); this.baitMeshes.push(m); b.mesh=m; }
  }
  inCone(q,x,z,h,len,ang){ const dx=q.x-x, dz=q.z-z; const d=Math.hypot(dx,dz); if(d>len||d<0.001) return d<0.001; const a=Math.atan2(dx,dz); return Math.abs(wrapAng(a-h))<ang*(1-0.35*d/len); }
  update(dt){
    if(!this.active) return; this.time+=dt; const G=this.G, inp=G.input, V=G.view;
    if(this.intro){ this.intro.t+=dt; const k=Math.min(1,this.intro.t/2.2); const e=1-Math.pow(1-k,3); this.introK=lerp(this.intro.k0,1,e); if(k>=1){ this.intro=null; this.introK=1; } G.setTopCam(this.cam.x,this.cam.z,this.introK); }
    else {
      const [kx,ky]=inp.keyVec(); if(kx||ky){ const R=G.camRight, U=G.camUp, mv=2.6*dt; this.cam.x+=(R.x*kx-U.x*ky)*mv; this.cam.z+=(R.z*kx-U.z*ky)*mv; this.clampCam(); this.touch(); }
    
    
        G.setTopCam(this.cam.x,this.cam.z,1);
    }
    if(!this.intro){
      this.eggSpawnT-=dt;
      if(this.eggSpawnT<=0) this.eggSpawnT=this.tryLayOotheca()?rand(8,13):1;
    }
    this.updateOothecae(dt);
    const it=ITEMS[this.item];


    const hoverOn=inp.lastType==='mouse'&&inp.mouse.live&&!this.strikes.length&&!this.hold&&!this.intro;
    for(const k in this.itemMeshes){ const m=this.itemMeshes[k]; if(m.userData.busy) continue; if(this.hold&&this.hold.item===k) continue; m.visible=(hoverOn&&k===this.item); }
    if(hoverOn){ if(inp.mouse.x!==this.lastMx||inp.mouse.y!==this.lastMy){ this.lastMx=inp.mouse.x; this.lastMy=inp.mouse.y; this.touch(); } const p=this.floorPoint(inp.mouse.x,inp.mouse.y); if(p){ const m=this.itemMeshes[this.item]; this.hoverT+=dt; if(m.userData.yawFor!==this.item){ m.userData.yawFor=this.item; m.userData.yaw=this.itemYaw(this.item); } m.position.set(p.x,(it.hover||0.15)+Math.sin(this.hoverT*3)*0.01,p.z); m.rotation.set(0,it.cone?Math.atan2(G.camUp.x,G.camUp.z):m.userData.yaw,0); } }
    for(let i=this.strikes.length-1;i>=0;i--){ const s=this.strikes[i], sit=ITEMS[s.item], m=s.m; s.t+=dt; m.visible=true;
      if(s.phase==='windup'){ const k=Math.min(1,s.t/sit.windup), e=k*k; m.position.set(lerp(s.from.x,s.x,e),lerp(s.from.y,0.006,e),lerp(s.from.z,s.z,e)); m.rotation.set(-0.3*(1-e),s.yaw,0);
        if(k>=1){ s.phase='rest'; s.t=0; m.position.set(s.x,0.006,s.z); m.rotation.set(0,s.yaw,0); this.impact(s.x,s.z,s.item); } }
      else if(s.phase==='rest'){ if(s.t>=sit.rest){ s.phase='up'; s.t=0; } }
      else { const k=Math.min(1,s.t/0.16); m.position.y=lerp(0.006,(sit.hover||0.2)+0.22,k*k); if(k>=1){ this.freeStrike(s); this.strikes.splice(i,1); } }
    }



   if(this.hold){ const h=this.hold, hit=ITEMS[h.item], m=this.itemMeshes[h.item], c=hit.cone; h.t+=dt; this.touch(); m.visible=true;
      const yaw=Math.atan2(h.dx,h.dz); m.position.set(h.x,hit.hover,h.z); m.rotation.set(0,yaw,0);
      const nx=h.x+h.dx*0.06, nz=h.z+h.dz*0.06;
      if(h.item==='spray'){
        this.puffs.emit('spray',nx,0.1,nz,h.dx,h.dz,3,2.2);
        for(const q of this.roaches){
          if(q.state==='dead'||q.state==='poison'||q.gone||this.underCushion(q.x,q.z)) continue;
          if(this.inCone(q,h.x,h.z,yaw,c.len,c.ang)){
            q.poison+=dt*1.3;
            if(q.poison>=1){ q.state='poison'; q.startle=null; q.t=rand(2.5,5); q.m.g.rotation.z=Math.PI; q.m.g.position.y=ROACH_L*ROACH_TOP; }
            else if(q.state!=='flee'&&!q.startle){ q.startle={t:0.1,ax:h.x,az:h.z}; }
          }
        }
        for(const q of this.nymphs){
          if(q.delay>0||q.state!=='live') continue;
          if(this.inCone(q,h.x,h.z,yaw,c.len,c.ang)){
            q.spray+=dt;
            if(q.spray>=0.55){ q.state='poison'; q.poisonT=rand(1.1,1.8); }
          }
        }
             for(const o of [...this.oothecae]){
          if(this.underCushion(o.x,o.z)) continue;

          if(this.inCone(o,h.x,h.z,yaw,c.len,c.ang)){
            o.spray+=dt;
            if(o.spray>=0.55) this.destroyOotheca(o);
          }
        }
      }
      if(h.item==='flame'){
        this.puffs.emit('flame',nx,0.06,nz,h.dx,h.dz,4,2.6);
        this.crackleT-=dt; if(this.crackleT<0){ this.crackleT=rand(0.05,0.15); SFX.flameCrackle(); }
        this.scorchT-=dt; if(this.scorchT<0){ this.scorchT=0.12; const d=rand(0.1,c.len), a=yaw+rand(-c.ang*0.7,c.ang*0.7); G.paint.scorch(h.x+Math.sin(a)*d,h.z+Math.cos(a)*d,rand(0.03,0.07)); }
        let n=0;
        for(const q of this.roaches){ if(q.state==='dead'||q.gone||this.underCushion(q.x,q.z)) continue; if(this.inCone(q,h.x,h.z,yaw,c.len,c.ang)) this.killRoach(q,'flame',h.x,h.z,n++); }
       
       
            for(const q of [...this.nymphs]){
          if(
            q.delay>0 ||
            q.state==='dead' ||
            this.underCushion(q.x,q.z)
          ) continue;

          if(this.inCone(q,h.x,h.z,yaw,c.len,c.ang)){
            this.killNymph(q,'flame',n++);
          }
        }

        for(const o of [...this.oothecae]){
          if(this.underCushion(o.x,o.z)) continue;

          if(this.inCone(o,h.x,h.z,yaw,c.len,c.ang)){
            this.destroyOotheca(o);
          }
        }



      }
      if(h.item==='vacuum'){
        this.puffs.emit('spray',h.x+h.dx*c.len*rand(0.4,1),0.03,h.z+h.dz*c.len*rand(0.4,1),-h.dx,-h.dz,1,1.4);
        let n=0;
        for(const q of this.roaches){
          if(q.state==='dead'||q.gone||this.underCushion(q.x,q.z)) continue;
          if(this.inCone(q,h.x,h.z,yaw,c.len,c.ang)){
            const ddx=h.x-q.x, ddz=h.z-q.z, d=Math.hypot(ddx,ddz);
            if(d<0.08){ this.killRoach(q,'vacuum',h.x,h.z,n++); SFX.vacuumSuck(); }
            else { q.x+=ddx/d*dt*1.9; q.z+=ddz/d*dt*1.9; q.h=Math.atan2(-ddx,-ddz); q.startle=null; }
          }
        }
        for(const q of [...this.nymphs]){
          if(q.delay>0||q.state==='dead') continue;
          if(this.inCone(q,h.x,h.z,yaw,c.len,c.ang)){
            const ddx=h.x-q.x, ddz=h.z-q.z, d=Math.hypot(ddx,ddz);
            if(d<0.07){ this.killNymph(q,'vacuum'); SFX.vacuumSuck(); }
            else { q.x+=ddx/d*dt*2.2; q.z+=ddz/d*dt*2.2; q.h=Math.atan2(-ddx,-ddz); }
          }
        }
        // 바닥에 널린 시체도 빨아들인다 (진물 자국은 못 치운다)
        const eaten=G.corpses.suck(h.x,h.z,(x,z)=>!this.underCushion(x,z)&&this.inCone({x,z},h.x,h.z,yaw,c.len*1.1,c.ang),dt);
        if(eaten){ SFX.vacuumSuck(); for(let i=0;i<2+eaten;i++) SFX.noise({t:0.03+i*0.035+Math.random()*0.02,dur:0.018,gain:0.3,freq:2000+Math.random()*3000,q:2.5}); }
               for(const o of [...this.oothecae]){
          if(this.underCushion(o.x,o.z)) continue;

          if(
            this.inCone(o,h.x,h.z,yaw,c.len,c.ang) &&
            Math.hypot(h.x-o.x,h.z-o.z)<0.11
          ){
            this.destroyOotheca(o);
          }
        }




      }
    }


    for(let i=this.baits.length-1;i>=0;i--){ const b=this.baits[i]; b.t+=dt; if(b.amount<=0){ if(b.mesh){ ITEM_POOL.put(b.mesh); this.baitMeshes.splice(this.baitMeshes.indexOf(b.mesh),1);} this.baits.splice(i,1); for(const q of this.roaches) if(q.bait===b){ q.bait=null; if(q.state==='feed'){ q.state='wander'; q.t=0.1; } } } }
    this.boost=Math.max(0,this.boost-dt*1.2);
    let vis=0, alive=0; for(const r of this.roaches){ if(r.state==='dead'||r.gone) continue; alive++; if(this.inView(r.x,r.z,0.15)){ vis++; r.offT=0; } else if(!this.inView(r.x,r.z,0.6)&&r.state!=='feed'){ r.offT+=dt; if(r.offT>3) r.remove=true; } }
    const target=Math.min(24,12+this.time/60*4+this.boost*0.5);
    this.spawnT-=dt; if(vis<target&&alive<40&&this.spawnT<=0){ this.spawn(); const deficit=target-vis; this.spawnT=(this.boost>0?rand(0.2,0.45):rand(0.35,0.9))*(deficit>6?0.35:deficit>3?0.6:1); }
    for(let i=this.roaches.length-1;i>=0;i--){ const r=this.roaches[i]; if(r.gone){ this.roaches.splice(i,1); continue; } this.updateRoach(r,dt); if(r.remove){ this.grp.remove(r.m.g); this.roaches.splice(i,1); } }


      this.updateNymphs(dt);
    this.splat.update(dt); this.puffs.update(dt); this.updateCushion(dt);


    // 최소 1마리를 잡은 뒤 7초 쉬었거나,
    // 40마리를 잡았을 때 종료 선택지를 보여준다.
    const canAsk=!this.hold&&!this.strikes.length;

    if(
      !this.quitShown &&
      !this.intro &&
      canAsk &&
      (
        this.kills>=QUIT_KILLS ||
        (this.kills>0&&this.time-this.lastAction>7)
      )
    ){
      this.quitShown=true;
      G.ui.showQuit(true);
    }


  }
  updateRoach(r,dt){
    const m=r.m;
    // 죽는 즉시 시체로 바꾼다. 막 죽은 시체는 다리가 한동안 경련한다.
    if(r.state==='dead'){ if(!r.baked){ r.baked=true; this.G.paint.corpse(r.x,r.z,r.h,this.level(),r.bakeMode); this.G.corpses.add(r.x,r.z,r.h,r.bakeMode); } r.remove=true; return; }
    if(r.state==='poison'){ r.t-=dt; r.twitch+=dt*rand(10,30); m.pose(0.6+0.4*Math.sin(r.twitch),dt*rand(0.5,3),0.15); if(Math.random()<dt*3) SFX.poisonTwitch(); if(r.t<=0){ this.killRoach(r,'spray',r.x,r.z); } return; }
  
    if(r.startle){ r.layEgg=null; r.startle.t-=dt; m.pose(0,dt,0); m.g.position.set(r.x,0,r.z); m.g.rotation.y=r.h; if(r.startle.t<=0){ const s=r.startle; r.startle=null; this.flee(r,s.ax,s.az); } return; }
    if(r.layEgg){
      const L=r.layEgg; L.t+=dt; r.spd=0;
      if(!L.laid&&L.t>=0.55){
        L.laid=true;
        const ex=r.x-Math.sin(r.h)*0.055, ez=r.z-Math.cos(r.h)*0.055;
        const [px,pz]=roachMove(r.x,r.z,ex,ez);
        this.spawnOotheca(px,pz,r.h);
      }
      m.pose(0,dt,0); m.g.position.set(r.x,0,r.z); m.g.rotation.y=r.h;
      if(L.t>=0.9){ r.layEgg=null; r.t=rand(0.4,1); }
      return;
    }
    let spd=0;



    if(r.state==='wander'){ if(r.underGoal&&dist2(r.x,r.z,CUSHION.x,CUSHION.z)>0.8*0.8) r.underGoal=false; r.t-=dt; if(r.t<0){ if(r.spd>0){ r.spd=0; r.t=rand(0.4,1.8); } else if(Math.random()<0.15){ r.spd=rand(0.6,0.9); r.t=rand(0.25,0.5); r.turn=rand(-0.5,0.5); } else { r.spd=rand(0.12,0.32); r.t=rand(0.6,2.2); r.turn=rand(-1.2,1.2); } }
      if(r.spd>0){ r.h+=r.turn*dt; spd=r.spd; }
      if(!r.bait){ for(const b of this.baits){ if(b.amount>0&&dist2(r.x,r.z,b.x,b.z)<b.radius*b.radius&&Math.random()<dt*1.5){ r.bait=b; r.state='feed'; r.tx=b.x+rand(-b.spread,b.spread); r.tz=b.z+rand(-b.spread,b.spread); break; } } }
      { const hh=nearHole(r.x,r.z,0.09); if(hh&&!hh.cushion&&r.spd===0&&Math.random()<dt*0.12){ r.remove=true; return; } }
      if(!this.cushionF.flipped&&r.spd>0&&!r.underGoal&&dist2(r.x,r.z,CUSHION.x,CUSHION.z)<0.7*0.7&&Math.random()<dt*0.25){ r.state='toCushion'; r.tx=CUSHION.x+rand(-0.12,0.12); r.tz=CUSHION.z+rand(-0.12,0.12); r.underGoal=true; }
    } else if(r.state==='feed'){ const b=r.bait; if(!b||b.amount<=0){ r.bait=null; r.state='wander'; r.t=0; return; }
      const dx=r.tx-r.x, dz=r.tz-r.z, d=Math.hypot(dx,dz);
      if(d>0.03){ r.h=angleDamp(r.h,Math.atan2(dx,dz),6,dt); spd=0.5; } else { b.amount-=dt*1.0; r.t-=dt; if(r.t<0){ r.t=rand(0.5,1.5); r.tx=b.x+rand(-b.spread,b.spread); r.tz=b.z+rand(-b.spread,b.spread); } r.h+=Math.sin(this.time*9+r.x*30)*dt*1.5; spd=0.02; }
    } else if(r.state==='toCushion'){ const dx=r.tx-r.x, dz=r.tz-r.z, d=Math.hypot(dx,dz); if(d>0.03){ r.h=angleDamp(r.h,Math.atan2(dx,dz),6,dt); spd=0.3; } else { r.state='wander'; r.spd=0; r.t=rand(3,10); }
      if(this.cushionF.flipped){ r.state='wander'; r.spd=0.2; r.t=0.5; }
    } else if(r.state==='flee'){ r.t+=dt; spd=r.fleeSpd;
      if(r.t>0.15&&r.hole){ const dx=r.hole.x-r.x, dz=r.hole.z-r.z; r.h=angleDamp(r.h,Math.atan2(dx,dz),8,dt); if(Math.hypot(dx,dz)<0.1){ if(r.hole.cushion){ r.state='wander'; r.spd=0; r.t=rand(2,8); r.hole=null; } else { r.remove=true; return; } } }
      if(r.t>r.fleeT){ r.state='wander'; r.t=rand(0.3,0.9); r.spd=0; r.hole=null; }
    }
    if(spd>0){ const nx=r.x+Math.sin(r.h)*spd*dt, nz=r.z+Math.cos(r.h)*spd*dt; const [px,pz]=roachMove(r.x,r.z,nx,nz); if(px===r.x&&pz===r.z&&r.state!=='feed'){ r.h+=rand(1.8,2.8)*(Math.random()<0.5?1:-1); r.hole=null; if(r.state==='toCushion'){ r.state='wander'; r.t=0.5; } } r.x=px; r.z=pz; }
    m.g.position.set(r.x,0,r.z); m.g.rotation.y=r.h; m.pose(clamp(spd/1.2,0,1),dt,0);
  }
}
