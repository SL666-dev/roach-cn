// 第二阶段：人类武器、寻路 NavGrid 与 Round2
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 2라운드: 사람 무기 ─────────
// 1라운드에서 내가 휘두르던 것보다 느리고 좁다. 끝까지 가보는 게 목적이라 후하게 잡았다.
const HW={
  hand:{reach:0.72,r:0.075,windup:0.62,rec:1.05,speed:0.78,crouch:1},
  tissue:{reach:0.72,r:0.07,windup:0.66,rec:1.2,speed:0.78,crouch:1},
  slipper:{reach:0.88,r:0.095,windup:0.5,rec:0.95,speed:0.86,crouch:0.7},
  book:{reach:0.95,r:0.13,windup:0.6,rec:1.15,speed:0.82,crouch:0.7},
  pan:{reach:0.98,r:0.12,windup:0.52,rec:1.05,speed:0.88,crouch:0.6},
  vacuum:{cone:{len:0.4,ang:0.6},speed:0.72,nozzle:0.6,sweep:true},
  spray:{cone:{len:1.15,ang:0.36},speed:0.82,expo:1.7,burst:1.0,gap:1.1},
  flame:{cone:{len:0.8,ang:0.24},speed:0.78,expo:0.55,burst:0.7,gap:1.2},
};



const LAY_T=2.0;

// 1·2대 30초 / 3·4대 24초 / 5대 이후 20초
const EGG_TIMES=[30,30,24,24,20];

const eggTimeForGen=gen=>
  EGG_TIMES[Math.min(gen,EGG_TIMES.length-1)];

const SPD_MUL=[0.55,0.63,0.7,0.76,0.82,0.87,0.92,0.96];

const HINTS={
  goal:'即使蟑螂死了，只要卵鞘还在，下一代就能延续下去。',

  moveTouch:
    '左侧拖动：移动 · 右侧拖动：转动视角 · 轻点右侧：冲刺',

  moveKey:
    'WASD：移动 · 鼠标拖动：转动视角 · 空格：冲刺 · E：产卵',

  hideIn:(p)=>`已躲进${p}。画面边缘变暗时，人类就看不到你。`,
  hideOut:(p)=>`已离开${p}。只有待在藏身处，才能避开人类的视线。`,

  watch:
    '你死了，但卵鞘还在。守住它，等它孵化。',

  ripe:
    '卵鞘已成熟。就算你死了，下一代也会从这里出生。',

  trap:(b)=>`这是人类放下的${b}诱饵。停留太久会中毒身亡。`,

  gen:(n)=>`第 ${n} 代`,

  weapon:(w)=>w==='hand'?'人类会徒手拍打':`人类手持：${LABEL[w]}`,
};



const BAIT_LABEL={bone:'鸡骨头',cola:'可乐',rice:'米饭'};

// A* 격자 (사람용)
class NavGrid{
  constructor(){ this.cs=0.1; this.nx=40; this.nz=60; this.blk=new Uint8Array(this.nx*this.nz);
    for(let j=0;j<this.nz;j++) for(let i=0;i<this.nx;i++){ const x=ROOM.x1+(i+0.5)*this.cs, z=ROOM.z1+(j+0.5)*this.cs; let b=(x<ROOM.x1+0.24||x>ROOM.x2-0.24||z<ROOM.z1+0.24||z>ROOM.z2-0.24)?1:0; if(!b) for(const o of OBST){ if(!o.human&&inObst(o,x,z,0.24)){ b=1; break; } } this.blk[j*this.nx+i]=b; } }
  cell(x,z){ return [clamp(Math.floor((x-ROOM.x1)/this.cs),0,this.nx-1),clamp(Math.floor((z-ROOM.z1)/this.cs),0,this.nz-1)]; }
  free(i,j){ return i>=0&&j>=0&&i<this.nx&&j<this.nz&&!this.blk[j*this.nx+i]; }
  nearestFree(i,j){ if(this.free(i,j)) return [i,j]; for(let r=1;r<8;r++) for(let dj=-r;dj<=r;dj++) for(let di=-r;di<=r;di++){ if(this.free(i+di,j+dj)) return [i+di,j+dj]; } return [i,j]; }
  path(x0,z0,x1,z1){
    let [si,sj]=this.nearestFree(...this.cell(x0,z0)); let [gi,gj]=this.nearestFree(...this.cell(x1,z1));
    const N=this.nx*this.nz, g=new Float32Array(N).fill(1e9), f=new Float32Array(N).fill(1e9), from=new Int32Array(N).fill(-1), closed=new Uint8Array(N);
    const h=(i,j)=>Math.hypot(i-gi,j-gj); const s=sj*this.nx+si, goal=gj*this.nx+gi; g[s]=0; f[s]=h(si,sj);
    const open=[s];
    while(open.length){ let bi=0; for(let k=1;k<open.length;k++) if(f[open[k]]<f[open[bi]]) bi=k; const c=open.splice(bi,1)[0]; if(c===goal) break; closed[c]=1; const ci=c%this.nx, cj=(c/this.nx)|0;
      for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){ if(!di&&!dj) continue; const ni=ci+di, nj=cj+dj; if(!this.free(ni,nj)) continue; if(di&&dj&&(!this.free(ci+di,cj)||!this.free(ci,cj+dj))) continue; const n=nj*this.nx+ni; if(closed[n]) continue; const ng=g[c]+Math.hypot(di,dj); if(ng<g[n]){ g[n]=ng; f[n]=ng+h(ni,nj); from[n]=c; if(!open.includes(n)) open.push(n); } } }
    if(from[goal]<0&&goal!==s) return [[x1,z1]];
    const out=[]; let c=goal; while(c>=0&&c!==s){ out.push([ROOM.x1+(c%this.nx+0.5)*this.cs,ROOM.z1+((c/this.nx|0)+0.5)*this.cs]); c=from[c]; } out.reverse();
    const sm=[]; let cur=[x0,z0]; let k=0; while(k<out.length){ let far=k; for(let m=out.length-1;m>k;m--){ if(this.clear(cur[0],cur[1],out[m][0],out[m][1])){ far=m; break; } } sm.push(out[far]); cur=out[far]; k=far+1; }
    if(sm.length) sm[sm.length-1]=[x1,z1]; else sm.push([x1,z1]); return sm;
  }
  clear(x0,z0,x1,z1){ const n=Math.ceil(Math.hypot(x1-x0,z1-z0)/0.05); for(let k=1;k<n;k++){ const t=k/n; const [i,j]=this.cell(lerp(x0,x1,t),lerp(z0,z1,t)); if(!this.free(i,j)) return false; } return true; }
}

class Round2{
  constructor(G){
    this.G=G; this.grp=new THREE.Group(); this.grp.visible=false; G.scene.add(this.grp); this.nav=new NavGrid();
    this.roach=makeRoach(); this.grp.add(this.roach.g);
    this.human=makeHuman(); this.grp.add(this.human.root);
   
   this.weaponMesh=null;
this.strikeMesh=null;
this.puffs=new Puffs(this.grp);

this.deathFX=new DeathFX(G);


    this.eggMesh=makeItem('egg'); this.eggMesh.scale.setScalar(1.25); this.eggMesh.visible=false; this.grp.add(this.eggMesh);
    this.hatchMesh=makeItem('egg'); this.hatchMesh.visible=false; this.grp.add(this.hatchMesh);
    // 내려오는 것의 그림자 — 바퀴에게 유일한 경고
    this.warn=new THREE.Mesh(new THREE.CircleGeometry(1,24),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthWrite:false}));
    this.warn.rotation.x=-Math.PI/2; this.warn.position.y=0.004; this.warn.renderOrder=3; this.warn.visible=false; this.grp.add(this.warn);
    this.ringC=document.createElement('canvas'); this.ringC.width=this.ringC.height=96; this.ringTex=new THREE.CanvasTexture(this.ringC);
    this.ring=new THREE.Mesh(new THREE.CircleGeometry(0.085,28),new THREE.MeshBasicMaterial({map:this.ringTex,transparent:true,depthWrite:false})); this.ring.rotation.x=-Math.PI/2; this.ring.visible=false; this.ring.renderOrder=4; this.grp.add(this.ring);
    this.suitcase=makeItem('suitcase'); this.suitcase.visible=false; this.grp.add(this.suitcase);
    
    
  this.npcs=[]; this.hatchNymphs=[]; this.traps=[]; this.swarm=null; this.active=false; this.camYaw=0; this.tmp=new THREE.Vector3(); this.tmp2=new THREE.Vector3(); this.tmp3=new THREE.Vector3();



    this.cushion=this.G.room.cushion; this.cushionBase={x:this.cushion.position.x,y:this.cushion.position.y,z:this.cushion.position.z};
  }
  start(weapons,baits){
    // 1라운드에서 사용한 무기는
    // 세대 수가 아니라 2라운드 공격 패턴 풀이다.
    const pool=(
      weapons&&weapons.length
        ? weapons
        : ['hand']
    ).slice();

    // 최소 세 번은 실제 세대를 플레이한다.
    const playableStages=Math.max(
      4,
      pool.length
    );

    this.weaponPool=pool;

    this.weapons=Array.from(
      {length:playableStages},
      (_,i)=>pool[i%pool.length]
    );

    this.baitKinds=baits||[];
    this.gen=0;
    this.active=true;
    this.grp.visible=true;
    this.lastEgg=null;
    this.finished=false;
    this.hinted={};

    this.G.input.mode='r2';

    document.getElementById(
      'r2ui'
    ).style.display='block';

    this.G.ui.eggState('none');
    this.G.ui.miniOn(true);

    this.camPitch=0.05;
    this.startGen();
  }
  
      stop(){
    this.active=false;
    this.deathFX.stop();
    this.grp.visible=false;

    document.getElementById('r2ui').style.display='none';

    this.roach.g.visible=false;
    this.human.root.visible=false;
    this.eggMesh.visible=false;
    this.hatchMesh.visible=false;
    this.ring.visible=false;
    this.warn.visible=false;
    this.suitcase.visible=false;

    if(this.swarm){
      for(const m of [
        this.swarm.mesh,
        this.swarm.heads,
        this.swarm.legs
      ]){
        this.grp.remove(m);   // 몸통 형상은 산 바퀴와 같이 쓰므로 버리지 않는다
      }

      this.swarm=null;
    }

    this.clearNpcs();
 this.clearHatchNymphs();

    this.clearTraps();
    this.puffs.clear();
    this.resetCushion();

this.G.room.blanket.visible=true;

 

    this.G.ui.vignette(false);
    this.G.ui.tox(0);
    this.G.ui.eggState('none');
    this.G.ui.hintClear();
    this.G.ui.genLabel(null);
    this.G.ui.miniOn(false);

    SFX.stopLoop('spray');
    SFX.stopLoop('flame');
    SFX.stopLoop('vacuum');
  }



  resetCushion(){ const c=this.cushion; c.position.set(this.cushionBase.x,this.cushionBase.y,this.cushionBase.z); c.quaternion.identity(); c.material.opacity=1; c.material.transparent=false; c.material.needsUpdate=true; this.cushionLift=0; }
 
 
   startGen(){
    const G=this.G;

    this.deathFX.stop();
    G.camera.up.set(0,1,0);
    G.input.idleStick();

    G.setLighting('dim');
    this.G.room.door.rotation.y=0;
    this.resetCushion();

 this.clearHatchNymphs();

    G.ui.hintClear();

    this.phase='play';
    this.death=null;
    this.egg=null;
    this.ready=false;
    this.laying=0;

    // 현재 세대에 맞는 알집 시간을 저장한다.
    this.eggT=eggTimeForGen(this.gen);

    this.eggDanger=false;
    this.hatch=null;
    this.genT=0;
    this.doneStep=false;
    this.warn.visible=false;

    let sx,sz,sh;

    if(this.gen>0&&this.lastEgg){
      sx=this.lastEgg.x;
      sz=this.lastEgg.z;
      sh=this.lastEgg.h;
    }else{
      const o=HOLE_LIST[
        Math.floor(rand(HOLE_LIST.length))
      ];

      sx=o.x+o.dx*0.05;
      sz=o.z+o.dz*0.05;
      sh=Math.atan2(o.dx,o.dz);
    }

    const P=this.p={
      x:sx,
      z:sz,
      h:sh,
      spd:0,
      dash:0,
      dashCd:0,
      vx:0,
      vz:0,
      hidden:!!spotAt(sx,sz),
      poison:0,
      expo:0,
      noise:0,
      tox:0
    };

    this.roach.g.visible=true;
    this.roach.g.rotation.set(0,P.h,0);
    this.roach.g.position.set(P.x,0,P.z);
    this.roach.pose(0,0,0);

    this.camYaw=
      this.gen>0
        ? sh
        : Math.atan2(-P.x,-P.z);

    this.camPitch=0.05;

    this.eggMesh.visible=false;
    this.ring.visible=false;
    this.suitcase.visible=false;

    const w=this.weapons[this.gen];

    if(this.gen>0){
      this.hatch={t:0};
      this.hatchMesh.visible=true;
      this.hatchMesh.scale.setScalar(1);
      this.hatchMesh.position.set(sx,0,sz);
      this.hatchMesh.rotation.y=sh+Math.PI/2;
      SFX.eggHatch();
      this.spawnHatchNymphs(sx,sz,sh);
    }

    // '사람이 든 것 — 拖鞋' 대신
    // 제목 아래에 도구 이름만 보여준다.
    G.ui.genLabel(
      HINTS.gen(this.gen+1),
      HINTS.weapon(w)
    );

    this.setupHuman();
    this.spawnNpcs();
    // 시작 시선은 사람이 누운(서 있는) 쪽 중 트인 방향으로
    this.curSpot=spotAt(P.x,P.z); this.camYaw=this.startYaw(); P.h=this.camYaw; this.roach.g.rotation.set(0,P.h,0);

    G.ui.eggState('none');

     G.ui.eggBar(
      G.isTouch
        ? `按住「产卵」2 秒 · 孵化需 ${this.eggT} 秒`
        : `按住 E 键 2 秒 · 孵化需 ${this.eggT} 秒`,
      false
    );

    G.ui.vignette(P.hidden);
    G.ui.tox(0);

    setTimeout(()=>{
      if(this.active&&this.phase==='play'){
        G.blackout(false,false);
      }
    },350);

    if(this.gen===0&&!this.hinted.move){
      this.hinted.move=true;

      // 일반 조작보다 게임의 고유 규칙을 먼저 말한다.
      G.ui.hint(
        HINTS.goal,
        3.8,
        0.7
      );

      G.ui.hint(
        G.isTouch
          ? HINTS.moveTouch
          : HINTS.moveKey,
        4.8,
        0.2
      );
    }

    // 미끼 설명은 핵심 안내 뒤에 붙인다.
    this.spawnTraps();
  }




  // 시작 시선: 가구 옆면에 코를 박지 않게, 트인 방향 가운데 사람 쪽에 가까운 곳을 본다
  startYaw(){
    const P=this.p, A=this.ai, tx=A?A.x:1.45, tz=A?A.z:-1.9, want=Math.atan2(tx-P.x,tz-P.z);
    let best=want, bs=-1e9;
    for(let k=0;k<48;k++){ const a=k/48*TAU, sx=Math.sin(a), sz=Math.cos(a); let free=0;
      for(let d=0.08;d<=3;d+=0.06){ const x=P.x+sx*d, z=P.z+sz*d; if(x<ROOM.x1||x>ROOM.x2||z<ROOM.z1||z>ROOM.z2) break; let hit=false; for(const o of OBST){ if(!o.roach&&inObst(o,x,z)){ hit=true; break; } } if(hit) break; free=d; }
      const sc=Math.min(free,2.2)+0.9*Math.cos(wrapAng(a-want)); if(sc>bs){ bs=sc; best=a; } }
    return best;
  }
  // 숨는 자리 안내: 처음 숨는 자리를 드나드는 순간에 한 번
  hintHide(from,to){ if(this.hinted.hide||this.genT<0.8||!(from||to)) return; this.hinted.hide=true; this.G.ui.hint(to?HINTS.hideIn(to.label):HINTS.hideOut(from.label),4.8,0); }
  // 먹이 안내: 사람이 둔 먹이가 처음 가까이 눈앞에 들어올 때 한 번
  hintTrap(){ if(this.hinted.trap||!this.traps.length) return; const P=this.p; for(const t of this.traps){ const dx=t.x-P.x, dz=t.z-P.z; if(Math.hypot(dx,dz)<0.9&&Math.abs(wrapAng(Math.atan2(dx,dz)-this.camYaw))<0.75){ this.hinted.trap=true; this.G.ui.hint(HINTS.trap(BAIT_LABEL[t.kind]),4.4,0); return; } } }
  setupHuman(){
    const H=this.human, w=this.weapons[this.gen];
    const A=this.ai={state:'sleep',wake:0,stirred:false,autoWake:rand(7,10),genT:0,t:0,x:BEDSIDE.x,z:BEDSIDE.z,h:Math.PI,spd:0,path:null,wp:0,target:null,prey:null,lastSeen:null,searched:{},searchHole:null,weapon:w,W:HW[w],lightsOn:false,look:0,strike:null,rec:0,noiseT:0,footPhase:0,burstT:0,burstOn:false,sitT:0,spdMul:SPD_MUL[Math.min(this.gen,SPD_MUL.length-1)],windupAdd:this.gen<2?0.2:this.gen<4?0.12:0.05,aimErr:0.16*Math.max(0.35,1-this.gen*0.12),repathT:0,eggKnown:false,awake:false,nozzle:null};
    H.root.visible=true; H.root.position.set(1.45,0.47,-1.0); H.root.rotation.set(-Math.PI/2,0,0); H.hips.rotation.x=0; H.crouch=0; H.headPitch=0; H.headYaw=0; H.bob=0; H.strikeAnim=false; H.pose(0,0);
    this.G.room.blanket.visible=true;
    this.dropWeapon();
    // 2세대부터는 사람이 이미 깨어 있다 — 불 켜진 방에서 도구를 든 채, 알이 깬 자리에서 먼 곳에 서 있다
    if(this.gen>0){
      const P=this.p, spots=[[0.35,1.35],[-0.75,-1.05],[0.95,0.35],[0.15,-1.65],[-0.55,1.05],[0.6,-0.4]];
      let best=spots[0],bd=-1; for(const q of spots){ const d=Math.hypot(q[0]-P.x,q[1]-P.z); if(d>bd){ bd=d; best=q; } }
      A.x=best[0]; A.z=best[1]; A.h=Math.atan2(P.x-A.x,P.z-A.z)+Math.PI*(Math.random()<0.5?0.6:-0.6);
      A.state='hunt'; A.awake=true; A.wake=1.2; A.lightsOn=true; A.look=1.4;
      H.root.rotation.set(0,A.h,0); H.hips.rotation.x=0; this.G.room.blanket.visible=false;
      this.G.setLighting('on'); this.giveWeapon(); this.humanPos(); H.pose(0,0);
    }
  }
  giveWeapon(){
    const w=this.ai.weapon; if(w==='hand') return; const m=ITEM_POOL.get(w); this.weaponMesh=m; this.human.hold.add(m);
    if(w==='slipper'){ m.rotation.set(Math.PI/2,0,0); m.position.set(0,-0.02,0.06); } else if(w==='book'){ m.rotation.set(Math.PI/2,0,0.2); m.position.set(0,-0.1,0.05); } else if(w==='pan'){ m.rotation.set(0.3,Math.PI,0); m.position.set(0,-0.06,0.2); } else if(w==='tissue'){ m.rotation.set(Math.PI/2,0,0); m.position.set(0,-0.06,0.04); } else if(w==='spray'||w==='flame'){ m.rotation.set(Math.PI/2,0,0); m.position.set(0,-0.02,0.02); } else if(w==='vacuum'){ this.human.hold.remove(m); this.grp.add(m); this.vac=m; m.children[2].visible=false; const tube=this.vacTubeMesh||(this.vacTubeMesh=cyl(0.02,0.02,1,M.std(0xa5a5ad))); this.grp.add(tube); this.vacTube=tube; }
  }
  dropWeapon(){
    ITEM_POOL.put(this.weaponMesh); this.weaponMesh=null; ITEM_POOL.put(this.strikeMesh); this.strikeMesh=null;
    if(this.vac){ this.grp.remove(this.vacTube); this.vac=null; this.vacTube=null; }
  }
clearTraps(){
  for(const t of this.traps) ITEM_POOL.put(t.mesh);
  this.traps.length=0;
}
  spawnTraps(){
    this.clearTraps(); if(!this.baitKinds.length) return;
    const spots=[[-0.6,1.4],[0.5,0.9],[-0.35,-1.2],[1.1,1.9],[-1.0,0.2],[0.75,-0.55]];
    const n=Math.min(this.baitKinds.length,1+Math.floor(this.gen/3));
    const pool=spots.slice(); 
    for(let i=0;i<n;i++){
      const kind=this.baitKinds[i%this.baitKinds.length];
      const s=pool.splice(Math.floor(rand(pool.length)),1)[0]; if(!s) break;
      const mesh=ITEM_POOL.get(kind); mesh.position.set(s[0],0,s[1]); mesh.rotation.y=rand(TAU); this.grp.add(mesh);
    
      this.traps.push({kind,x:s[0],z:s[1],mesh});
    }




  }

 // ── 孵化 직후 주변에 보이는 흰 약충. 사람 AI의 공격 대상에는 넣지 않는다. ──
  clearHatchNymphs(){
    for(const n of this.hatchNymphs) this.grp.remove(n.m.g);
    this.hatchNymphs.length=0;
  }
  spawnHatchNymphs(x,z,h){
    this.clearHatchNymphs();
    for(let i=0;i<5;i++){
      const a=h+rand(-1.4,1.4), d=rand(0.015,0.04);
      const m=makeNymph();
      m.g.visible=false;
      this.grp.add(m.g);
      this.hatchNymphs.push({
        x:x+Math.sin(a)*d,z:z+Math.cos(a)*d,h:a,
        ox:x,oz:z,sp:rand(0.38,0.62),turn:rand(-2.2,2.2),
        delay:i*0.12+rand(0,0.06),t:0,life:rand(7,10),m
      });
    }
  }
  updateHatchNymphs(dt){
    for(let i=this.hatchNymphs.length-1;i>=0;i--){
      const n=this.hatchNymphs[i];
      if(n.delay>0){ n.delay-=dt; if(n.delay>0) continue; n.m.g.visible=true; }
      n.t+=dt;
      if(n.t>=n.life){ this.grp.remove(n.m.g); this.hatchNymphs.splice(i,1); continue; }
      if(Math.random()<dt*2.2) n.turn=rand(-2.5,2.5);
      const homeD=Math.hypot(n.x-n.ox,n.z-n.oz);
      if(homeD>0.34) n.h=angleDamp(n.h,Math.atan2(n.ox-n.x,n.oz-n.z),5,dt);
      else n.h+=n.turn*dt;
      const sp=n.sp*(0.72+0.28*Math.sin(n.t*13+i));
      const nx=n.x+Math.sin(n.h)*sp*dt, nz=n.z+Math.cos(n.h)*sp*dt;
      const [px,pz]=roachMove(n.x,n.z,nx,nz);
      if(px===n.x&&pz===n.z) n.h+=rand(1.8,2.8)*(Math.random()<0.5?1:-1);
      n.x=px; n.z=pz;
      n.m.g.position.set(n.x,0,n.z); n.m.g.rotation.y=n.h;
      n.m.pose(clamp(sp/0.7,0,1),dt,0);
    }
  }


  // ── 다른 바퀴들 ──
  npcTarget(){ return Math.min(30,16+this.gen*2); }
  spawnNpcs(){ this.clearNpcs(); const n=this.npcTarget(); for(let i=0;i<n;i++) this.addNpc(rand(0.3,6)); this.npcT=2; }
  addNpc(delay){ const r=Math.random(); const pool=r<0.7?HOLE_LIST:HOLES.filter(h=>!h.hole); const h=pool[Math.floor(rand(pool.length))]; const m=makeRoach(); m.g.visible=false; this.grp.add(m.g); const n={x:h.x,z:h.z,h:Math.atan2(h.dx,h.dz),spd:0,state:'hide',t:delay,hole:h,m,hidden:true,vx:0,vz:0,turn:0,startle:0,fleeSoon:-1,poison:0,dead:0,slug:Math.random()<0.7,bold:Math.random()<0.35,trap:null,eat:0}; this.npcs.push(n); return n; }
  spotExit(h){ const dn=Math.hypot(h.dx,h.dz)||1; const R=h.rect?h.rz:(h.r||HOLE_R); return [h.x+h.dx/dn*(R*0.35),h.z+h.dz/dn*(R*0.35)]; }
  clearNpcs(){ for(const n of this.npcs) this.grp.remove(n.m.g); this.npcs.length=0; }
  npcFlee(n){ if(n.state==='dead'||n.state==='poison') return; n.state='flee'; n.trap=null; let best=null,bd=1e9; for(const h of HOLES){ const d=dist2(n.x,n.z,h.x,h.z)*(0.7+Math.random()*0.6); if(d<bd){bd=d;best=h;} } n.hole=best; }
  killNpc(n,weapon){ if(n.state==='dead') return; n.state='dead'; n.t=0; n.dead=0; n.startle=0; n.hidden=false; n.m.g.visible=true; n.bake=weapon==='flame'?'burnt':weapon==='spray'?'belly':'crushed';
    const d=Math.hypot(n.x-this.p.x,n.z-this.p.z), pan=clamp(Math.sin(wrapAng(Math.atan2(n.x-this.p.x,n.z-this.p.z)-this.camYaw)),-1,1);
   
       if(weapon==='vacuum'){
      n.t=1;

      // 아주 가까울 때만 들린다.
      if(d<0.55){
        SFX.vacuumSuck();
      }

      return;
    }

    // 먹이나 살충제로 독사한 배경 바퀴에게
    // 압사 파열음을 붙이지 않는다.
    if(weapon==='spray'){
      return;
    }

    // 불도 압사음이 아니라 작은 연소음만 낸다.
    if(weapon==='flame'){
      const g=clamp(
        0.32/(0.45+d),
        0.04,
        0.26
      );

      SFX.kill(
        'flame',
        0,
        g,
        0,
        pan,
        clamp(0.34+d*0.28,0.34,1)
      );

      this.G.shake(
        clamp(0.16/(0.4+d),0.01,0.18)
      );

      return;
    }

    // 손·拖鞋·책·平底锅으로 실제 압사했을 때만.
    SFX.npcCrush(d,pan,weapon);

    this.G.shake(
      clamp(0.5/(0.4+d),0.05,0.6)
    );

    const a=rand(TAU);

    this.G.paint.splat(
      n.x,
      n.z,
      Math.cos(a),
      Math.sin(a),
      0.09,
      0.45,
      weapon
    );
 }


  updateNpcs(dt){
    const A=this.ai; let alive=0;
    for(let i=this.npcs.length-1;i>=0;i--){ const n=this.npcs[i], m=n.m;
      // 죽는 즉시 시체로 바꾼다 (吸尘器에 빨려 간 것(t=1)은 시체를 남기지 않는다)
      if(n.state==='dead'){ if(!n.baked){ n.baked=true; if(n.t<1){ this.G.paint.corpse(n.x,n.z,n.h,0.45,n.bake||'crushed'); this.G.corpses.add(n.x,n.z,n.h,n.bake||'crushed'); } } this.grp.remove(m.g); this.npcs.splice(i,1); continue; }
      alive++;
      if(n.state==='poison'){ n.t-=dt; n.twitch=(n.twitch||0)+dt*rand(10,30); m.pose(0.6+0.4*Math.sin(n.twitch),dt*rand(0.5,3),0.15); if(n.t<=0) this.killNpc(n,'spray'); continue; }
      if(n.state==='hide'){ n.t-=dt; if(n.t<=0&&!(A.searchHole===n.hole&&A.state==='search')){ n.hidden=false; m.g.visible=true; n.state='wander'; n.spd=rand(0.15,0.3); n.t=rand(0.6,2); const [ex,ez]=this.spotExit(n.hole); n.x=ex+(n.hole.rect?rand(-0.3,0.3):0); n.z=ez; n.h=Math.atan2(n.hole.dx,n.hole.dz)+rand(-0.6,0.6); n.fleeSoon=-1; m.g.position.set(n.x,0,n.z); } continue; }
      if(A.lightsOn&&n.fleeSoon<0&&n.state==='wander'&&!n.bold&&!n.trap) n.fleeSoon=rand(3,11);
      if(n.fleeSoon>0){ n.fleeSoon-=dt; if(n.fleeSoon<=0&&n.state==='wander') this.npcFlee(n); }
      if(n.state!=='eat'&&(A.awake||A.state==='sit')&&n.startle<=0&&Math.hypot(n.x-A.x,n.z-A.z)<(n.bold?0.32:0.55)){ n.startle=n.bold?rand(1.0,1.6):n.slug?rand(0.6,1.0):rand(0.2,0.4); }
      if(n.startle>0){ n.startle-=dt; if(n.startle<=0){ n.startle=0; this.npcFlee(n); } m.pose(0,dt,0); m.g.position.set(n.x,0,n.z); m.g.rotation.y=n.h; continue; }
      let spd=0;
      if(n.state==='wander'){ n.t-=dt; if(n.t<0){ if(n.spd>0){ n.spd=0; n.t=rand(0.5,2.2); } else { n.spd=rand(0.12,0.3); n.t=rand(0.6,2.2); n.turn=rand(-1,1); } } if(n.spd>0){ n.h+=n.turn*dt; spd=n.spd; } if(Math.random()<dt*0.025) this.npcFlee(n);
        if(!n.trap&&this.traps.length&&Math.random()<dt*0.9){ for(const t of this.traps){ if(dist2(n.x,n.z,t.x,t.z)<2.2*2.2){ n.trap=t; n.state='toTrap'; n.tx=t.x+rand(-0.1,0.1); n.tz=t.z+rand(-0.1,0.1); break; } } } }
      else if(n.state==='toTrap'){ const dx=n.tx-n.x, dz=n.tz-n.z, d=Math.hypot(dx,dz); n.h=angleDamp(n.h,Math.atan2(dx,dz),6,dt); if(d>0.05) spd=0.35; else { n.state='eat'; n.eat=rand(3,7); } }
      else if(n.state==='eat'){ n.eat-=dt; n.h+=Math.sin(this.G.time*7+n.x*20)*dt*1.4; spd=0.015; 
      

        if(n.eat<=0){ n.state='poison'; n.t=rand(2,4); m.g.rotation.z=Math.PI; m.g.position.y=ROACH_L*ROACH_TOP; continue; } }
      else if(n.state==='flee'){ spd=n.slug?0.6:0.8; const dx=n.hole.x-n.x, dz=n.hole.z-n.z; n.h=angleDamp(n.h,Math.atan2(dx,dz),8,dt); if(inSpot(n.hole,n.x,n.z)&&Math.hypot(dx,dz)<(n.hole.rect?0.35:(n.hole.r||0.1)*0.6)){ n.state='hide'; n.hidden=true; m.g.visible=false; n.t=A.lightsOn?rand(6,14):rand(4,10); n.fleeSoon=-1; n.vx=n.vz=0; continue; } }
      if(spd>0){ const nx=n.x+Math.sin(n.h)*spd*dt, nz=n.z+Math.cos(n.h)*spd*dt; const [px,pz]=roachMove(n.x,n.z,nx,nz); if(px===n.x&&pz===n.z){ n.h+=rand(1.8,2.8)*(Math.random()<0.5?1:-1); if(n.state==='flee') n.hole=HOLES[Math.floor(rand(HOLES.length))]; } n.vx=(px-n.x)/Math.max(dt,1e-4); n.vz=(pz-n.z)/Math.max(dt,1e-4); n.x=px; n.z=pz; } else { n.vx=n.vz=0; }
      m.g.position.set(n.x,0,n.z); m.g.rotation.y=n.h; m.pose(clamp(spd/1.2,0,1),dt,0);
    }
    this.npcT-=dt; if(alive<this.npcTarget()&&this.npcT<=0){ this.addNpc(rand(0.8,3)); this.npcT=rand(0.8,2); }
  }
  // ── 보임/빛 ──
  litAt(x,z){ return this.ai.lightsOn||x>0.6; }   // 불이 꺼져 있으면 커튼 틈으로 들어오는 창가 쪽만 밝다
  canSeeAt(x,z,hidden){ const A=this.ai; if(hidden||!(A.state==='sit'||A.awake)) return false; const dx=x-A.x, dz=z-A.z, d=Math.hypot(dx,dz); if(d>3.2||!this.litAt(x,z)) return false; const a=Math.atan2(dx,dz); return Math.abs(wrapAng(a-A.h-this.human.headYaw))<(A.state==='sit'?1.3:0.95)+(d<0.55?1.2:0); }
  // 트인 바닥에 가만히 서 있으면 사람이 곁눈으로도 알아챈다 (1.4m 안, 0.6초 이상 멈춤)
  canSee(){ const P=this.p, A=this.ai; if(this.phase!=='play') return false; if(this.canSeeAt(P.x,P.z,P.hidden)) return true; return A.awake&&!P.hidden&&(P.stillT||0)>0.6&&this.litAt(P.x,P.z)&&Math.hypot(P.x-A.x,P.z-A.z)<1.4; }
  visibleTargets(){ const out=[]; const P=this.p; if(this.canSee()) out.push({ref:'player',x:P.x,z:P.z,vx:P.vx,vz:P.vz}); for(const n of this.npcs){ if(n.state==='dead'||n.state==='poison'||n.hidden) continue; if(this.canSeeAt(n.x,n.z,false)) out.push({ref:n,x:n.x,z:n.z,vx:n.vx,vz:n.vz}); } return out; }
  distH(){ return Math.hypot(this.p.x-this.ai.x,this.p.z-this.ai.z); }
  goTo(x,z){ const A=this.ai; A.path=this.nav.path(A.x,A.z,x,z); A.wp=0; A.target=[x,z]; }
  arrive(){ const A=this.ai; return !A.path||A.wp>=A.path.length; }
  walk(dt){ const A=this.ai; if(this.arrive()){ A.spd=0; return true; } const [tx,tz]=A.path[A.wp]; const dx=tx-A.x, dz=tz-A.z, d=Math.hypot(dx,dz); const sp=A.W.speed*A.spdMul;
    if(d<0.08){ A.wp++; if(this.arrive()){ A.spd=0; return true; } return false; }
    A.h=angleDamp(A.h,Math.atan2(dx,dz),7,dt); A.spd=sp; A.x+=Math.sin(A.h)*sp*dt; A.z+=Math.cos(A.h)*sp*dt; return false; }
  humanPos(){ const H=this.human, A=this.ai; H.root.position.set(A.x,0,A.z); H.root.rotation.set(0,A.h,0); }
  // ── 사람 AI ──
  updateHuman(dt){
    const A=this.ai, H=this.human, P=this.p, W=A.W;
    const alive=this.phase==='play';
    if(A.state==='sleep'||A.state==='sit'){
      A.genT+=dt; if(A.genT>A.autoWake) A.wake=Math.max(A.wake,1.2);
      const df=clamp(2.0/Math.max(0.3,Math.hypot(P.x-1.45,P.z+1.9)),0.35,1.2);   // 침대 한가운데(1.45, -1.9)에서 잰 거리
      let gain=(alive&&P.noise>0.25)?0.05:0; if(alive&&P.dash>0) gain+=0.26; gain*=df;
      if(A.state==='sit'&&this.canSee()) gain+=0.7;
      A.wake+=gain*dt; if(gain===0) A.wake-=dt*(A.state==='sit'?0.06:0.04); A.wake=clamp(A.wake,0,1.2);
      if(A.state==='sleep'){
        H.root.rotation.z=Math.sin(this.G.time*0.9)*0.01;
        if(A.wake>0.35&&!A.stirred){ A.stirred=true; SFX.creak(); A.t=0.8; } if(A.stirred&&A.t>0){ A.t-=dt; H.root.rotation.z=Math.sin(A.t*12)*0.05; }
        if(A.wake<0.2) A.stirred=false;
        if(A.wake>=0.7){ A.state='sit'; A.sitT=0; SFX.creak(); A.h=Math.PI*1.5; H.headYaw=0; }
      } else {
        A.sitT+=dt; H.hips.rotation.x=lerp(0,1.15,Math.min(1,A.sitT/0.8)); H.headYaw=Math.sin(this.G.time*0.7)*0.9; H.head.rotation.y=H.headYaw;
        if(A.wake>=1.0){ A.state='rise'; A.t=0; A.awake=true; SFX.creak(); }
        else if(A.wake<0.45&&A.sitT>2){ A.state='sleep'; A.stirred=false; H.hips.rotation.x=0; H.headYaw=0; }
      }
      return;
    }
    if(A.state==='rise'){ A.t+=dt; const k=Math.min(1,A.t/0.8); const e=k*k*(3-2*k); H.root.position.set(lerp(1.45,BEDSIDE.x,e),lerp(0.47,0,e),lerp(-1.0,BEDSIDE.z,e)); H.root.rotation.set(lerp(-Math.PI/2,0,e),lerp(0,Math.PI*1.5,e),0); H.hips.rotation.x=lerp(1.15,0,e); this.G.room.blanket.visible=k<0.4;
      if(k>=1){ A.x=BEDSIDE.x; A.z=BEDSIDE.z; A.h=Math.PI*1.5; A.state='toSwitch'; this.goTo(SWITCH_STAND.x,SWITCH_STAND.z); } return; }
    if(A.state==='toSwitch'){ if(this.walk(dt)){ A.h=angleDamp(A.h,0,8,dt); A.t+=dt; H.armL.sh.rotation.x=-1.6; if(A.t>0.7&&!A.lightsOn){ A.lightsOn=true; SFX.lightSwitch(); this.G.setLighting('on'); this.giveWeapon(); } if(A.t>1.3){ A.state='hunt'; A.t=0; A.look=1.4; A.h=Math.PI; H.armL.sh.rotation.x=0; } } this.humanPos(); H.pose(dt,A.spd); return; }
    if(A.state==='leave'){ this.updateLeave(dt); return; }
    if(A.rec>0){ A.rec-=dt; }
    if(alive&&P.dash>0&&A.state!=='strike'&&A.state!=='use'){ A.noiseT=0.9; A.noiseDir=Math.atan2(P.x-A.x,P.z-A.z); }
    const targets=this.visibleTargets(); const see=targets.length>0;
    if(see){ let best=null,bd=1e9; for(const t of targets){ let d=Math.hypot(t.x-A.x,t.z-A.z); if(A.prey&&A.prey.ref===t.ref) d*=0.7; if(t.ref==='player'&&Math.hypot(t.vx,t.vz)<0.08) d*=0.35; if(d<bd){bd=d;best=t;} } A.prey=best; A.lastSeen={x:best.x,z:best.z,t:0,vx:best.vx,vz:best.vz,ref:best.ref}; } else A.prey=null;
    if(A.lastSeen) A.lastSeen.t+=dt;
    if(this.egg&&!this.ready&&!A.eggKnown&&!this.egg.spot&&A.awake){ const E=this.egg; const dx=E.x-A.x, dz=E.z-A.z, dE=Math.hypot(dx,dz); if(dE<1.0&&this.litAt(E.x,E.z)&&Math.abs(wrapAng(Math.atan2(dx,dz)-A.h))<0.8){ A.eggKnown=true; A.lastSeen=null; } }
    if(A.state==='strike'){ this.updateStrike(dt); this.humanPos(); H.pose(dt,0); return; }
    if(A.state==='use'){ this.updateUse(dt); this.humanPos(); H.pose(dt,A.spd); return; }
    if(A.state==='search'){
      const hole=A.searchHole; A.t+=dt; A.spd=0; const hx=hole.x-A.x, hz=hole.z-A.z; A.h=angleDamp(A.h,Math.atan2(hx,hz),6,dt); H.crouch=damp(H.crouch,1,6,dt); H.headPitch=0.6;
      if(hole.cushion) this.cushionLift=Math.min(1,A.t/0.5);
      const inThis=alive&&P.hidden&&spotAt(P.x,P.z)===hole;
      if(see&&!inThis){ A.state='hunt'; A.searched[hole.n]=this.G.time; A.searchHole=null; A.reached=false; H.crouch=0; return; }
      if(!W.cone&&A.t>1.6&&!A.reached){ A.reached=true;
        for(const n of this.npcs){ if(n.hidden&&n.hole===hole){ const [ex,ez]=this.spotExit(hole); n.x=ex+rand(-0.06,0.06)+(hole.rect?rand(-0.3,0.3):0); n.z=ez+rand(-0.06,0.06); n.hidden=false; n.m.g.visible=true; n.m.g.position.set(n.x,0,n.z); this.killNpc(n,A.weapon); } }
        if(inThis){ const dn=Math.hypot(hole.dx,hole.dz)||1; const away=Math.atan2(P.x-A.x,P.z-A.z); if(hole.cushion){ const rr=hole.r+0.09; P.x=hole.x+Math.sin(away)*rr; P.z=hole.z+Math.cos(away)*rr; } else if(hole.rect){ P.x=clamp(P.x,hole.x-hole.rx+0.05,hole.x+hole.rx-0.05); P.z=hole.z+hole.dz/dn*(hole.rz+0.09); } else { const rr=HOLE_R+0.09; P.x=hole.x+hole.dx/dn*rr; P.z=hole.z+hole.dz/dn*rr; } P.hidden=false; P.h=away; P.dashCd=0; SFX.creak(); this.G.shake(0.4); A.searched[hole.n]=this.G.time; A.searchHole=null; A.reached=false; A.state='hunt'; A.rec=0.5; H.crouch=0; return; } }
      if(W.cone&&A.t>0.7&&inThis){ A.state='use'; A.useT=0; A.burstOn=false; A.burstT=W.gap-0.45; A.aimHole=hole; return; }
      if(A.t>3.0){ if(this.egg&&this.egg.spot===hole&&!this.ready){ this.destroyEgg(); } A.searched[hole.n]=this.G.time; A.searchHole=null; A.reached=false; A.state='hunt'; H.crouch=0; }
      this.humanPos(); H.pose(dt,0); return;
    }
    if(A.state==='look'){ A.t+=dt; A.spd=0; H.headYaw=Math.sin(A.t*3)*0.9; if(A.t>1.3){ A.state='hunt'; H.headYaw=0; A.lastSeen=null; } this.humanPos(); H.pose(dt,0); return; }
    H.crouch=damp(H.crouch,0,6,dt); H.headPitch=damp(H.headPitch,see?0.45:0.1,6,dt);
    if(A.noiseT>0){ A.noiseT-=dt; A.spd=0; A.h=angleDamp(A.h,A.noiseDir,8,dt); H.headYaw=0; this.humanPos(); H.pose(dt,0); return; }
    if(A.look>0){ A.look-=dt; H.headYaw=Math.sin(this.G.time*3)*0.8; this.humanPos(); H.pose(dt,0); return; } H.headYaw=damp(H.headYaw,0,8,dt);
    if(see){
      const T=A.prey; const dT=Math.hypot(T.x-A.x,T.z-A.z);
      if(W.cone){ const trig=W.sweep?W.nozzle+0.25:W.cone.len*0.75; if(dT<trig&&A.rec<=0){ A.state='use'; A.useT=0; A.burstOn=false; A.burstT=W.sweep?0:W.gap-0.45; A.aimHole=null; return; } }
      else if(dT<W.reach&&A.rec<=0){ const wu=W.windup+A.windupAdd; const err=Math.hypot(T.vx||0,T.vz||0)<0.08?A.aimErr*0.15:A.aimErr; this.beginStrike(T.x+T.vx*wu*0.5+rand(-err,err),T.z+T.vz*wu*0.5+rand(-err,err),false); return; }
      if(!A.target||dist2(A.target[0],A.target[1],T.x,T.z)>0.09||A.repathT<=0){ this.goTo(T.x,T.z); A.repathT=0.4; } A.repathT-=dt; this.walk(dt);
    } else if(A.lastSeen&&A.lastSeen.t<7){
      if(!A.target||dist2(A.target[0],A.target[1],A.lastSeen.x,A.lastSeen.z)>0.04){ this.goTo(A.lastSeen.x,A.lastSeen.z); }
      if(this.walk(dt)){ A.state='look'; A.t=0; }
    } else if(A.eggKnown&&this.egg&&!this.ready){
      const E=this.egg; const dE=Math.hypot(E.x-A.x,E.z-A.z);
      if(dE<Math.min(W.reach||0.8,0.8)&&A.rec<=0){ this.beginStrike(E.x,E.z,false); A.strike.egg=true; return; }
      if(!A.target||dist2(A.target[0],A.target[1],E.x,E.z)>0.04){ this.goTo(E.x,E.z); } this.walk(dt);
    } else {
      if(!A.searchHole){
        let best=null,bs=1e9; const cool=22;
        for(const h of HOLES){ const last=A.searched[h.n]; if(last!==undefined&&this.G.time-last<cool) continue; let s=Math.hypot(h.x-A.x,h.z-A.z); if(this.lastHideHole===h) s*=0.35; if(this.egg&&this.egg.spot===h) s*=0.8; if(s<bs){bs=s;best=h;} }
        if(!best){ A.searched={}; best=HOLES[Math.floor(rand(HOLES.length))]; }
        A.searchHole=best; A.reached=false; const dn=Math.hypot(best.dx,best.dz)||1; const SR=best.rect?best.rz+0.5:0.62; this.goTo(best.x+best.dx/dn*SR,best.z+best.dz/dn*SR);
      }
      if(this.walk(dt)){ A.state='search'; A.t=0; }
    }
    this.humanPos(); H.pose(dt,A.spd);
  }
  showWarn(x,z,r,k){ const w=this.warn; w.visible=true; w.position.set(x,0.004,z); const s=r*(2.1-1.1*k); w.scale.set(s,s,1); w.material.opacity=0.1+0.45*k; }
  hideWarn(){ this.warn.visible=false; this.warn.material.opacity=0; }
  beginStrike(sx,sz,intoHole){
    const A=this.ai, H=this.human, W=A.W; const dx=sx-A.x, dz=sz-A.z, d=Math.hypot(dx,dz); const rd=Math.min(d,W.reach); const nx=d>0.001?dx/d:0, nz=d>0.001?dz/d:1;
    
    const rx=nz;
    const rz=-nx;

    A.state='strike';

    A.strike={
      t:0,
      x:A.x+nx*rd,
      z:A.z+nz*rd,
      intoHole,
      hit:false,

      // 공격 방향
      nx,
      nz,

      // 공격 방향에 수직인 방향
      rx,
      rz,

      // 平底锅을 어느 쪽으로 살짝 휘두를지
      swingSide:Math.random()<0.5?-1:1
    };

    A.h=Math.atan2(nx,nz);
    A.spd=0;
    H.strikeAnim=true;

    if(this.weaponMesh){
      this.weaponMesh.visible=false;
    }

    ITEM_POOL.put(this.strikeMesh);
    const sm=this.strikeMesh=ITEM_POOL.get(A.weapon);

    this.grp.add(sm);

    H.root.updateWorldMatrix(true,true);

    const hp=new THREE.Vector3();

    H.armR.hand.getWorldPosition(hp);

    if(A.weapon==='pan'){
      /*
       * 平底锅 모델의 원점은 팬 바닥 중심이다.
       * 손잡이가 +Z 방향으로 뻗어 있으므로,
       * 팬 바닥을 손보다 앞쪽에 둬야 손잡이 끝이 손에 붙는다.
       */
      sm.position.set(
        hp.x+nx*0.25,
        Math.max(0.08,hp.y-0.02),
        hp.z+nz*0.25
      );

      sm.rotation.set(
        -0.25,
        A.h+Math.PI,
        0
      );

    }else{
      sm.position.copy(hp);
      sm.position.y=Math.max(
        sm.position.y,
        0.9
      );

      sm.rotation.set(
        0,
        A.h,
        0
      );
    }

    A.strike.from=sm.position.clone();




    if(A.weapon==='hand') sm.scale.setScalar(1.35);
    this.showWarn(A.strike.x,A.strike.z,W.r+0.03,0);
  }
  updateStrike(dt){
    const A=this.ai, H=this.human, W=A.W, S=A.strike, P=this.p; S.t+=dt; const sm=this.strikeMesh; const WU=W.windup+A.windupAdd;
    const k=Math.min(1,S.t/WU);
    H.crouch=damp(H.crouch,W.crouch,10,dt); H.headPitch=0.7;
    if(!S.hit){
      this.showWarn(S.x,S.z,W.r+0.03,k);
     
     
           const up=
        k<0.45
          ? k/0.45
          : 1;

      const down=
        k<0.45
          ? 0
          : (k-0.45)/0.55;

      H.armR.sh.rotation.x=
        lerp(-0.3,-2.4,up)*(1-down)+
        lerp(-2.4,0.6,down)*down;

      H.armR.el.rotation.x=
        -0.4*(1-down);

      // 현재 프레임의 실제 손 위치를 계속 가져온다.
      H.root.updateWorldMatrix(true,true);

      H.armR.hand.getWorldPosition(
        this.tmp3
      );

      if(A.weapon==='pan'){
        /*
         * 팬 바닥 중심은 손보다 공격 방향 앞쪽에 둔다.
         * 따라서 平底锅 손잡이 끝이 계속 실제 손 쪽에 남는다.
         */
        const handX=
          this.tmp3.x+
          S.nx*(0.24+0.04*up);

        const handY=Math.max(
          0.05,
          this.tmp3.y-
          0.02+
          0.08*up*(1-0.7*down)
        );

        const handZ=
          this.tmp3.z+
          S.nz*(0.24+0.04*up);

        if(k<0.45){
          // 들어 올리는 동안은 실제 손을 그대로 따라간다.
          sm.position.set(
            handX+
              S.rx*
              S.swingSide*
              0.035*
              up,

            handY,

            handZ+
              S.rz*
              S.swingSide*
              0.035*
              up
          );

          S.from.copy(
            sm.position
          );

        }else{
          const q=Math.pow(
            (k-0.45)/0.55,
            1.35
          );

          /*
           * 내려치는 초반에는 손을 따라가고,
           * 마지막 부분에서만 타격 지점으로 수렴한다.
           */
          let blend=clamp(
            (q-0.48)/0.52,
            0,
            1
          );

          blend=
            blend*
            blend*
            (3-2*blend);

          const arc=Math.sin(
            Math.PI*blend
          );

          sm.position.set(
            lerp(
              handX,
              S.x,
              blend
            )+
              S.rx*
              S.swingSide*
              0.10*
              arc,

            lerp(
              handY,
              0.015,
              blend
            )+
              0.09*
              arc,

            lerp(
              handZ,
              S.z,
              blend
            )+
              S.rz*
              S.swingSide*
              0.10*
              arc
          );
        }

        /*
         * 들어 올릴 때는 세워지고,
         * 내려치면서 팬 바닥이 다시 평평해진다.
         */
        const panTilt=
          k<0.45
            ? lerp(
                -0.25,
                -1.0,
                up
              )
            : lerp(
                -1.0,
                0.04,
                down
              );

        sm.rotation.set(
          panTilt,
          A.h+Math.PI,
          S.swingSide*
            0.24*
            (1-down)
        );

      }else if(k<0.45){
        // 다른 도구의 기존 동작은 그대로 유지
        sm.position.copy(
          this.tmp3
        );

        S.from.copy(
          sm.position
        );

        sm.rotation.set(
          -0.6,
          A.h,
          0
        );

      }else{
        const q=Math.pow(
          (k-0.45)/0.55,
          1.5
        );

        sm.position.set(
          lerp(S.from.x,S.x,q),
          lerp(S.from.y,0.015,q),
          lerp(S.from.z,S.z,q)
        );

        sm.rotation.set(
          lerp(-0.6,0,q),
          A.h,
          0
        );
      }



      if(k>=1){ S.hit=true; this.hideWarn(); sm.position.y=0.005; const nearMe=this.phase==='play'&&Math.hypot(P.x-S.x,P.z-S.z)<W.r+0.03; const hidOk=!P.hidden||S.intoHole; this.G.shake(0.9);
        let hitNpc=false; for(const n of this.npcs){ if(n.hidden||n.state==='dead') continue; if(Math.hypot(n.x-S.x,n.z-S.z)<W.r+0.03){ this.killNpc(n,A.weapon); hitNpc=true; } }
        if(S.egg&&this.egg&&!this.ready&&Math.hypot(this.egg.x-S.x,this.egg.z-S.z)<W.r+0.06){ this.destroyEgg(); }
        if(nearMe&&hidOk){ this.killPlayer('crush'); } else if(!hitNpc){ SFX.thud(Math.hypot(P.x-S.x,P.z-S.z),0,A.weapon==='book'||A.weapon==='pan'?1.2:0.8); } }
    } else { if(S.t>WU+W.rec*0.45){ A.state='hunt'; A.rec=W.rec*0.5; H.strikeAnim=false; H.armR.sh.rotation.x=0; H.armR.el.rotation.x=-0.25; ITEM_POOL.put(sm); this.strikeMesh=null; if(this.weaponMesh) this.weaponMesh.visible=true; A.strike=null; } }
  }
  updateUse(dt){
    const A=this.ai, H=this.human, W=A.W, P=this.p; A.useT+=dt; const c=W.cone; const alive=this.phase==='play';
    const T=A.prey; const tx=A.aimHole?A.aimHole.x:(T?T.x:(A.lastSeen?A.lastSeen.x:P.x)), tz=A.aimHole?A.aimHole.z:(T?T.z:(A.lastSeen?A.lastSeen.z:P.z));
    const dx=tx-A.x, dz=tz-A.z, d=Math.hypot(dx,dz); A.h=angleDamp(A.h,Math.atan2(dx,dz),6,dt); H.crouch=damp(H.crouch,0.45,6,dt); H.headPitch=0.6;
    if(A.aimHole&&A.aimHole.cushion) this.cushionLift=Math.min(1,A.useT/0.5+0.6);
    if(A.weapon==='vacuum'){
      A.spd=0; const swp=Math.sin(A.useT*2.4)*0.5; const reachN=Math.min(W.nozzle,Math.max(0.3,d-0.1)); const nx=A.x+Math.sin(A.h+swp)*reachN, nz=A.z+Math.cos(A.h+swp)*reachN; A.nozzle=[nx,nz,A.h+swp]; H.crouch=damp(H.crouch,0.25,6,dt);
      if(!SFX.loops.vacuum) SFX.startVacuum(); this.puffs.emit('spray',nx+Math.sin(A.h+swp)*c.len*rand(0.3,1),0.03,nz+Math.cos(A.h+swp)*c.len*rand(0.3,1),-Math.sin(A.h+swp),-Math.cos(A.h+swp),1,1.3);
      if(alive){ const pdx=nx-P.x, pdz=nz-P.z, pd=Math.hypot(pdx,pdz); const inC=this.inCone(P.x,P.z,nx,nz,A.h+swp,c.len,c.ang)||pd<0.14||(P.hidden&&pd<0.28);
        if(inC){ if(pd<0.075){ this.killPlayer('vacuum'); return; } P.x+=pdx/pd*dt*1.35; P.z+=pdz/pd*dt*1.35; } }
      for(const n of this.npcs){ if(n.state==='dead') continue; const ndx=nx-n.x, ndz=nz-n.z, nd=Math.hypot(ndx,ndz); const inN=(!n.hidden&&this.inCone(n.x,n.z,nx,nz,A.h+swp,c.len,c.ang))||nd<0.16||(n.hidden&&A.aimHole===n.hole&&nd<0.5); if(inN){ if(nd<0.09||n.hidden){ if(n.hidden){ n.hidden=false; n.m.g.visible=true; } this.killNpc(n,'vacuum'); } else { n.x+=ndx/nd*dt*1.6; n.z+=ndz/nd*dt*1.6; } } }
      if(A.useT>2.2){ A.state='hunt'; H.strikeAnim=false; A.rec=0.6; SFX.stopLoop('vacuum'); A.nozzle=null; if(A.aimHole){ A.searched[A.aimHole.n]=this.G.time; A.searchHole=null; A.aimHole=null; } }
      return;
    }
    A.spd=0; if(d>c.len*0.9&&!A.aimHole){ A.state='hunt'; H.strikeAnim=false; SFX.stopLoop('spray'); SFX.stopLoop('flame'); A.burstOn=false; return; }
    H.strikeAnim=true; H.armR.sh.rotation.x=-1.25+(A.aimHole?0.35:0); H.armR.el.rotation.x=-0.15;
    A.burstT+=dt; if(A.burstOn&&A.burstT>W.burst){ A.burstOn=false; A.burstT=0; SFX.stopLoop('spray'); SFX.stopLoop('flame'); } else if(!A.burstOn&&A.burstT>W.gap){ A.burstOn=true; A.burstT=0; }
    if(A.burstOn){ if(A.weapon==='spray'&&!SFX.loops.spray) SFX.startSpray(); if(A.weapon==='flame'&&!SFX.loops.flame){ SFX.lighterClick(); SFX.startFlame(); }
      H.root.updateWorldMatrix(true,true); if(this.weaponMesh) this.weaponMesh.getWorldPosition(this.tmp); else H.armR.hand.getWorldPosition(this.tmp); const ox=this.tmp.x+Math.sin(A.h)*0.12, oy=Math.max(0.12,this.tmp.y-0.05), oz=this.tmp.z+Math.cos(A.h)*0.12; const kind=A.weapon==='flame'?'flame':'spray'; this.puffs.emit(kind,ox,oy,oz,Math.sin(A.h),Math.cos(A.h),kind==='flame'?5:4,kind==='flame'?3.0:2.4);
      if(alive){ const inC=this.inCone(P.x,P.z,A.x,A.z,A.h,c.len,c.ang)||(P.hidden&&A.aimHole&&spotAt(P.x,P.z)===A.aimHole);
        if(inC){ P.expo+=dt; this.G.ui.tox(clamp(P.expo/W.expo,0,1)); if(P.expo>=W.expo){ this.killPlayer(A.weapon==='flame'?'flame':'poison'); return; } } }
      for(const n of this.npcs){ if(n.state==='dead'||n.state==='poison') continue; const inN=(!n.hidden&&this.inCone(n.x,n.z,A.x,A.z,A.h,c.len,c.ang))||(n.hidden&&A.aimHole===n.hole); if(!inN) continue; if(n.hidden){ n.hidden=false; n.m.g.visible=true; const [ex,ez]=this.spotExit(n.hole); n.x=ex+rand(-0.05,0.05); n.z=ez+rand(-0.05,0.05); n.m.g.position.set(n.x,0,n.z); } if(A.weapon==='flame'){ this.killNpc(n,'flame'); } else { n.poison+=dt; if(n.poison>=W.expo){ n.state='poison'; n.t=rand(2,4); n.m.g.rotation.z=Math.PI; n.m.g.position.y=ROACH_L*ROACH_TOP; } } }
      if(A.weapon==='flame'&&Math.random()<dt*6){ const dd=rand(0.3,c.len), aa=A.h+rand(-c.ang*0.6,c.ang*0.6); this.G.paint.scorch(A.x+Math.sin(aa)*dd,A.z+Math.cos(aa)*dd,rand(0.04,0.09)); }
    }
    if(A.useT>3.6){ A.state='hunt'; H.strikeAnim=false; A.rec=0.7; SFX.stopLoop('spray'); SFX.stopLoop('flame'); A.burstOn=false; if(A.aimHole){ A.searched[A.aimHole.n]=this.G.time; A.searchHole=null; A.aimHole=null; } }
  }
  updateVac(){ const A=this.ai, H=this.human; if(!this.vac) return; let nx,nz,nh; if(A.nozzle){ [nx,nz,nh]=A.nozzle; } else { nx=A.x+Math.sin(A.h)*0.55; nz=A.z+Math.cos(A.h)*0.55; nh=A.h; }
    this.vac.position.set(nx,0,nz); this.vac.rotation.set(0,nh,0); H.root.updateWorldMatrix(true,true); H.armR.hand.getWorldPosition(this.tmp); this.tmp2.set(nx,0.05,nz); const mid=this.tmp.clone().add(this.tmp2).multiplyScalar(0.5); const len=this.tmp.distanceTo(this.tmp2); this.vacTube.position.copy(mid); this.vacTube.scale.set(1,len,1); this.vacTube.lookAt(this.tmp); this.vacTube.rotateX(Math.PI/2); }
  inCone(px,pz,x,z,h,len,ang){ const dx=px-x, dz=pz-z, d=Math.hypot(dx,dz); if(d>len) return false; if(d<0.05) return true; return Math.abs(wrapAng(Math.atan2(dx,dz)-h))<ang*(1-0.3*d/len); }
  // ── 알집 ──
  layTick(dt,holding){ const P=this.p; if(this.egg) return;
    if(holding&&P.spd<0.05){ this.laying+=dt/LAY_T; if(this.laying>=1){ this.placeEgg(); return; } } else this.laying=Math.max(0,this.laying-dt*0.5);
    this.G.ui.eggProgress(this.laying); }
 
 
  placeEgg(){
    const P=this.p;
    const spot=spotAt(P.x,P.z);

    // 알은 꽁무니 쪽에 놓되, 벽이나 가구 안으로 파고들지 않게 바퀴가 갈 수 있는 자리까지만 (다음 세대가 거기서 태어나므로)
    const [ex,ez]=roachMove(P.x,P.z,P.x-Math.sin(P.h)*0.06,P.z-Math.cos(P.h)*0.06);

    this.egg={
      spot,
      x:ex,
      z:ez,
      t:0,
      lastK:-1
    };

    this.laying=0;

    this.lastEgg={
      x:ex,
      z:ez,
      h:P.h,
      spot
    };

    this.G.ui.eggProgress(0);
    this.G.ui.eggState('laid');
      this.G.ui.eggBar(
      `距离孵化还有 ${this.eggT} 秒`,
      false
    );

    this.eggMesh.position.set(ex,0,ez);
    this.eggMesh.rotation.y=P.h+Math.PI/2;
    this.eggMesh.visible=true;

    this.ring.visible=true;
    this.ring.position.set(ex,0.006,ez);
    this.drawRing(0);

    SFX.click(0.25);
  }




  drawRing(k){ const g=this.ringC.getContext('2d'); g.clearRect(0,0,96,96); g.lineWidth=7; g.strokeStyle='rgba(251,244,228,0.55)'; g.beginPath(); g.arc(48,48,36,0,TAU); g.stroke(); g.strokeStyle=k>=1?'#3A2412':'#FBF4E4'; g.lineCap='round'; g.beginPath(); g.arc(48,48,36,-Math.PI/2,-Math.PI/2+TAU*Math.min(1,k)); g.stroke(); this.ringTex.needsUpdate=true; }
 
 
 
  tickEgg(dt){
    const E=this.egg;
    if(!E||this.ready) return;

    const A=this.ai;
    const total=this.eggT;
    E.t+=dt;

    const k=E.t/total;

    if(Math.floor(k*60)!==E.lastK){
      E.lastK=Math.floor(k*60);
      this.drawRing(k);
      this.G.ui.eggProgress(Math.min(1,k));
    }

    const left=Math.max(0,Math.ceil(total-E.t));
    const dg=Math.hypot(A.x-E.x,A.z-E.z);

    const danger=A.awake&&(
      dg<1.0 ||
      (E.spot&&A.searchHole===E.spot) ||
      A.eggKnown
    );

    // 죽음 장면에서는 일반 UI를 다시 띄우지 않는다.
    if(this.phase!=='dying'){
      this.G.ui.eggBar(
        `距离孵化还有 ${left} 秒`,
        danger
      );

      if(danger!==this.eggDanger){
        this.eggDanger=danger;
        this.G.ui.eggDanger(danger);
      }
    }

    this.ring.material.opacity=danger
      ? 0.35+0.65*Math.abs(Math.sin(this.G.time*9))
      : 1;

    if(k>=1){
      this.ready=true;
      SFX.eggReady();

      if(this.phase==='play'&&!this.hinted.ripe){
        this.hinted.ripe=true;
        this.G.ui.hint(HINTS.ripe,4.8,0.2);
      }

      if(this.phase!=='dying'){
        this.G.ui.eggReady(true);
        this.G.ui.eggBar(
          this.phase==='watch'
            ? '卵鞘孵化了'
            : '卵鞘已成熟',
          false
        );
      }

      // 살아 있는 동안에는 다음 세대로 넘어가지 않는다.
      // 먼저 죽어서 알집을 지켜보는 중일 때만 넘어간다.
      if(this.phase==='watch'){
        this.nextGen(650);
      }
    }
  }


  destroyEgg(){ if(!this.egg) return; SFX.eggCrush(); this.G.shake(0.5); this.eggMesh.visible=false; this.ring.visible=false; this.egg=null; this.G.ui.eggState('none'); this.G.ui.eggBar(null); this.lineEnd(); }
 
 
 // ── 죽음과 그 뒤 ──
  killPlayer(type){
    if(this.phase!=='play') return;
    this.roach.g.visible=true;   // 숨어서 내다보던 중이면 몸이 꺼져 있으므로 죽는 장면을 위해 되살린다

    const P=this.p;
    const A=this.ai;

    // 죽는 순간 카메라가 바라볼 위치
    let tx=A.x;
    let ty=1.12;
    let tz=A.z;

    // 吸尘器는 노즐을 바라본다.
    if(type==='vacuum'&&A.nozzle){
      tx=A.nozzle[0];
      ty=0.07;
      tz=A.nozzle[1];

    // 독 먹이는 가장 가까운 먹이를 바라본다.
    }else if(type==='trap'&&this.traps.length){
      let best=this.traps[0];
      let bd=Infinity;

      for(const q of this.traps){
        const d=dist2(P.x,P.z,q.x,q.z);

        if(d<bd){
          bd=d;
          best=q;
        }
      }

      tx=best.x;
      ty=0.04;
      tz=best.z;

    // 불과 杀虫剂는 사람이 들고 있는 도구 쪽을 바라본다.
    }else if(
      (type==='flame'||type==='poison')&&
      this.weaponMesh
    ){
      this.weaponMesh.getWorldPosition(this.tmp3);

      tx=this.tmp3.x;
      ty=this.tmp3.y;
      tz=this.tmp3.z;
    }

    let dx=tx-P.x;
    let dz=tz-P.z;

    if(Math.hypot(dx,dz)<0.02){
      tx=A.x;
      ty=1.12;
      tz=A.z;

      dx=tx-P.x;
      dz=tz-P.z;
    }

    this.phase='dying';

    this.death={
      type,
      t:0,
      weapon:A.weapon,
      target:{
        x:tx,
        y:ty,
        z:tz
      },
      faceYaw:Math.atan2(dx,dz),
      roll:Math.random()<0.5?-1:1,
      baked:false
    };

    P.spd=0;
    P.vx=0;
    P.vz=0;

    // 죽기 직전 누르고 있던 스틱과 버튼 입력을 초기화한다.
    this.G.input.reset();

    // 옛 코드처럼 즉시 암전하지 않는다.
    this.G.blackout(false,true);

    this.G.ui.tox(0);
    this.G.ui.eggState('none');
    this.G.ui.miniOn(false);
    this.G.ui.hintClear();
    this.G.ui.vignette(false);

    document.getElementById('stick').style.display='none';

    this.hideWarn();

    SFX.stopLoop('spray');
    SFX.stopLoop('flame');
    SFX.stopLoop('vacuum');

    // 이미 넣어둔 새 죽음 음향을 실제로 호출한다.
    SFX.deathSequence(type,A.weapon);

    // 이미 넣어둔 DeathFX 화면을 실제로 시작한다.
    this.deathFX.start(type);

    this.G.shake(
      type==='crush'
        ? 1.6
        : type==='vacuum'
          ? 1.1
          : 0.85
    );
  }

  updateDeath(dt){
    const D=this.death;
    const P=this.p;

    D.t=Math.min(2.3,D.t+dt);

    // 체액, 파편, 점멸, 화면 찢김 등을 매 프레임 갱신한다.
    this.deathFX.update(dt);

    if(D.type==='crush'){
      this.roach.pose(
        0,
        dt,
        clamp(D.t/0.24,0,1)
      );

      if(D.t>=0.18&&!D.baked){
        D.baked=true;

        this.G.paint.corpse(
          P.x,
          P.z,
          P.h,
          0.5,
          'crushed'
        );

        this.G.corpses.add(
          P.x,
          P.z,
          P.h,
          'crushed'
        );
      }

    }else if(D.type==='vacuum'){
      const k=clamp(D.t/0.92,0,1);

      this.roach.g.position.set(
        lerp(P.x,D.target.x,k*0.82),
        lerp(0,0.05,k),
        lerp(P.z,D.target.z,k*0.82)
      );

      this.roach.g.rotation.y+=dt*(12+24*k);
      this.roach.pose(1,dt,0.08*k);

      if(D.t>0.82){
        this.roach.g.visible=false;
      }

    }else if(D.type==='flame'){
      const k=clamp(D.t/1.05,0,1);

      this.roach.pose(
        0.25,
        dt,
        0.72*k
      );

      this.roach.g.rotation.z=
        Math.sin(D.t*34)*0.12*(1-k);

      if(D.t>=0.86&&!D.baked){
        D.baked=true;

        this.G.paint.corpse(
          P.x,
          P.z,
          P.h,
          0.5,
          'burnt'
        );

        this.G.corpses.add(
          P.x,
          P.z,
          P.h,
          'burnt'
        );
      }

    }else{
      // 杀虫剂·독 먹이
      const fall=clamp(D.t/1.48,0,1);

      this.roach.pose(
        0.45+0.55*Math.sin(D.t*38),
        dt*rand(0.4,2.2),
        0.12+0.18*fall
      );

      this.roach.g.rotation.z=
        D.roll*Math.PI*fall;

      this.roach.g.position.y=
        ROACH_L*ROACH_TOP*fall;

      if(Math.random()<dt*7){
        SFX.poisonTwitch();
      }

      if(D.t>=1.72&&!D.baked){
        D.baked=true;

        this.G.paint.corpse(
          P.x,
          P.z,
          P.h,
          0.5,
          'belly'
        );

        this.G.corpses.add(
          P.x,
          P.z,
          P.h,
          'belly'
        );
      }
    }

    if(D.t>=2.3){
      this.afterDeath();
    }
  }

  afterDeath(){
    if(this.doneStep) return;

    this.doneStep=true;

    // DeathFX가 완전히 검게 닫힌 상태를 실제 fade로 이어받는다.
    this.G.blackout(true,true);
    this.deathFX.stop();
    this.G.camera.up.set(0,1,0);
    this.roach.g.visible=false;

    // 알집을 남기지 못했으면 종료
    if(!this.egg){
      this.lineEnd();
      return;
    }

    // 이미 성숙한 알집이 있으면 다음 세대
    if(this.ready){
      this.nextGen(450);
      return;
    }

    // 알집은 있지만 아직 성숙하지 않았으면 관전
    this.toWatch();
  }



  toWatch(){
    const E=this.egg;

    this.phase='watch';

    this.G.blackout(false,false);
    this.G.ui.vignette(false);
    this.G.ui.miniOn(true);

    this.G.ui.eggBar(
      `距离孵化还有 ${
        Math.max(
          0,
          Math.ceil(this.eggT-E.t)
        )
      } 秒`,
      false
    );

    this.G.ui.hintClear();

    this.watchYaw=
      Math.atan2(
        0.2-E.x,
        0.6-E.z
      );

    if(!this.hinted.watch){
      this.hinted.watch=true;

      this.G.ui.hint(
        HINTS.watch,
        3.2,
        0.2
      );
    }
  }




 lineEnd(){
    if(this.phase==='over') return;
    this.phase='over'; this.overT=0;
    this.G.ui.eggState('none');
    this.G.ui.eggBar(null);
    this.G.ui.hintClear();
    this.G.ui.vignette(false);
  }



  nextGen(delay=650){
    if(this.finished) return;

    this.finished=true;
    this.G.blackout(true,false);

    setTimeout(()=>{
      if(!this.active) return;

      this.finished=false;
      this.gen++;

      if(this.gen>=this.weapons.length){
        this.gen=this.weapons.length;
        this.beginLeave();
      }else{
        this.startGen();
      }
    },delay);
  }



  // ── 엔딩: 사람이 떠난다 ──
  beginLeave(){ const A=this.ai, H=this.human; this.phase='leave'; this.G.blackout(false); this.G.setLighting('on'); A.lightsOn=true; A.state='leave'; A.leaveT=0; A.leaveStep=0; A.done=false; A.doorShut=false; this.eggMesh.visible=false; this.ring.visible=false; this.hatchMesh.visible=false; this.hideWarn(); this.clearNpcs(); this.clearHatchNymphs(); this.clearTraps(); this.resetCushion(); this.G.ui.vignette(false); this.G.ui.tox(0); this.G.ui.eggState('none'); this.G.ui.eggBar(null); this.G.ui.hintClear(); this.G.ui.genLabel(null); this.G.ui.miniOn(false);
    this.dropWeapon();
    H.root.visible=true; H.root.rotation.set(0,0,0); H.hips.rotation.x=0; H.crouch=0; H.headPitch=0.2; H.strikeAnim=false; A.x=BEDSIDE.x; A.z=BEDSIDE.z; A.h=0; this.G.room.blanket.visible=true;
    this.suitcase.visible=true; this.roach.g.visible=false;
    this.leaveCam={x:0.2,z:0.6,yaw:Math.atan2(1.55-0.2,2.9-0.6)}; this.goTo(1.5,2.35);
  }
  updateLeave(dt){ const A=this.ai, H=this.human, R=this.G.room; A.leaveT+=dt;
    if(A.leaveStep===0){ if(this.walk(dt)){ A.leaveStep=1; A.t=0; SFX.door(true); } }
    else if(A.leaveStep===1){ A.t+=dt; R.door.rotation.y=-Math.min(1,A.t/1.1)*1.5; A.spd=0; A.h=angleDamp(A.h,0,6,dt); if(A.t>1.2){ A.leaveStep=2; A.path=[[1.55,2.75],[1.55,3.45]]; A.wp=0; } }
    else if(A.leaveStep===2){ const [tx,tz]=A.path[A.wp]; const dx=tx-A.x, dz=tz-A.z, d=Math.hypot(dx,dz); if(d<0.06){ A.wp++; if(A.wp>=A.path.length){ A.leaveStep=3; A.t=0; H.root.visible=false; this.suitcase.visible=false; } } else { A.h=angleDamp(A.h,Math.atan2(dx,dz),7,dt); A.spd=0.8; A.x+=Math.sin(A.h)*0.8*dt; A.z+=Math.cos(A.h)*0.8*dt; } }
    else if(A.leaveStep===3){ A.t+=dt; R.door.rotation.y=-1.5*(1-Math.min(1,A.t/0.7)); if(A.t>0.75&&!A.doorShut){ A.doorShut=true; SFX.door(false); this.G.shake(0.6); } if(A.t>1.6){ A.leaveStep=4; A.t=0; SFX.click(0.4); this.G.setLighting('empty'); this.leaveCam={x:0.3,z:1.9,yaw:Math.PI}; this.spawnSwarm(); } }
    else if(A.leaveStep===4){ A.t+=dt; this.updateSwarm(dt); if(A.t>11&&!A.done){ A.done=true; this.G.blackout(true); setTimeout(()=>this.G.ending(this.gen),1400); } }
    this.humanPos(); H.pose(dt,A.spd);
    if(this.suitcase.visible){ H.armL.hand.updateWorldMatrix(true,false); H.armL.hand.getWorldPosition(this.tmp); this.suitcase.position.set(this.tmp.x,0,this.tmp.z); this.suitcase.rotation.y=A.h; H.armL.sh.rotation.x=0.1; }
  }
  spawnSwarm(){ const n=150; const GS=roachGeos('adult');
    const legA=SWARM_LEGS[0]||(SWARM_LEGS[0]=legPoseGeo('adult',Math.PI/2)), legB=SWARM_LEGS[1]||(SWARM_LEGS[1]=legPoseGeo('adult',-Math.PI/2));
    const mk=(g,m)=>{ const I=new THREE.InstancedMesh(g,m,n); I.castShadow=true; I.frustumCulled=false; this.grp.add(I); return I; };
    const mesh=mk(GS.body,MAT.roachShell), heads=mk(legA,MAT.roachLimb), legs=mk(legB,MAT.roachLimb);
    const list=[]; for(let i=0;i<n;i++){ const h=HOLES[i%HOLES.length]; list.push({x:h.x+rand(-0.05,0.05),z:h.z+rand(-0.05,0.05),h:Math.atan2(h.dx,h.dz)+rand(-0.9,0.9),sp:rand(0.35,0.95),delay:rand(0,3.4),t:rand(TAU),turn:rand(-0.6,0.6),tx:rand(-1.2,1.4),tz:rand(-1.2,2.2),arrived:false}); }
    this.swarm={mesh,legs,heads,list,d:new THREE.Object3D(),zero:new THREE.Matrix4().makeScale(0,0,0)}; }
  // 떼거리: 몸통 하나 + 번갈아 딛는 다리 자세 두 벌을 깜빡여 달리는 것처럼 보이게 한다
  updateSwarm(dt){ const S=this.swarm; if(!S) return; const d=S.d;
    for(let i=0;i<S.list.length;i++){ const r=S.list[i]; r.delay-=dt; if(r.delay>0){ S.mesh.setMatrixAt(i,S.zero); S.heads.setMatrixAt(i,S.zero); S.legs.setMatrixAt(i,S.zero); continue; }
      r.t+=dt*18; if(!r.arrived){ const dx=r.tx-r.x, dz=r.tz-r.z; if(Math.hypot(dx,dz)<0.15) r.arrived=true; else r.h=angleDamp(r.h,Math.atan2(dx,dz),3,dt); } else { r.h+=r.turn*dt; if(Math.random()<dt*0.5) r.turn=rand(-1,1); } const nx=r.x+Math.sin(r.h)*r.sp*dt, nz=r.z+Math.cos(r.h)*r.sp*dt; const [px,pz]=roachMove(r.x,r.z,nx,nz); if(px===r.x&&pz===r.z) r.h+=2.5; r.x=px; r.z=pz;
      d.position.set(r.x,0,r.z); d.rotation.set(0,r.h,0); d.scale.setScalar(ROACH_L); d.updateMatrix(); S.mesh.setMatrixAt(i,d.matrix);
      const a=Math.sin(r.t)>0; S.heads.setMatrixAt(i,a?d.matrix:S.zero); S.legs.setMatrixAt(i,a?S.zero:d.matrix); }
    S.mesh.instanceMatrix.needsUpdate=true; S.legs.instanceMatrix.needsUpdate=true; S.heads.instanceMatrix.needsUpdate=true; }
  miniData(){ if(!this.active||!this.ai) return null; const A=this.ai; return {me:this.phase==='play'?[this.p.x,this.p.z,this.p.h]:null,human:(A.awake||A.state==='sit')?[A.x,A.z]:null,egg:this.egg?[this.egg.x,this.egg.z]:null,traps:this.traps.map(t=>[t.x,t.z]),ready:this.ready}; }
  // ── 매 프레임 ──


  update(dt){
    if(!this.active) return;
    this.updateHatchNymphs(dt);
    const G=this.G, inp=G.input, P=this.p, A=this.ai;

    if(this.phase==='leave'){ this.updateLeave(dt); this.puffs.update(dt); this.leaveCamera(dt); return; }
    if(this.phase==='over'){ this.overT+=dt; this.updateHuman(dt); this.updateNpcs(dt); this.puffs.update(dt); this.updateVac(); if(this.overT>1.3&&!this.finished){ this.finished=true; G.blackout(true); setTimeout(()=>{ if(this.active) G.lineEnded(this.gen); },900); } this.watchCamera(dt); return; }
    
    
       if(this.phase==='dying'){
      this.tickEgg(dt);
      this.updateDeath(dt);
      // 死亡演出的最后一帧会切到观战/下一步，这时不能再把倾斜的死亡镜头写回去
      if(this.phase==='dying') this.deathCamera(dt);

      // 사람과 타격 도구는 충돌 자세에 고정한다.
      this.updateNpcs(dt);
      this.puffs.update(dt);
      this.updateVac();

      return;
    }



    if(this.phase==='watch'){ this.tickEgg(dt); this.updateHuman(dt); this.updateNpcs(dt); this.puffs.update(dt); this.updateVac(); this.watchCamera(dt); this.footsteps(dt); return; }
    this.genT+=dt;
    if(this.hatch){ this.hatch.t+=dt; const k=this.hatch.t; if(k<0.5){ this.hatchMesh.scale.set(1+k*0.5,1-k*0.3,1+k*0.3); } else { const q=Math.min(1,(k-0.5)/0.6); this.hatchMesh.scale.set(1.25*(1-q),0.85*(1-q)+0.001,1.15*(1-q)); if(q>=1){ this.hatchMesh.visible=false; this.hatch=null; } } }
    // 이동
    const [vx,vy]=inp.vec(); const R=G.camRight, F=G.camFwd; let mx=R.x*vx-F.x*vy, mz=R.z*vx-F.z*vy; const mag=Math.min(1,Math.hypot(mx,mz));
    P.dashCd=Math.max(0,P.dashCd-dt); if(P.dash>0) P.dash-=dt;
    if(inp.dashReq&&P.dashCd<=0&&mag>0.05){ P.dash=0.4; P.dashCd=0.9; SFX.noise({dur:0.05,gain:0.2,freq:2500,q:1}); } inp.dashReq=false; G.ui.dashCool(P.dashCd/0.9);
    let spd=mag*0.95; if(P.dash>0) spd=1.9*(0.6+0.4*(P.dash/0.4));
    if(mag>0.05){ P.h=angleDamp(P.h,Math.atan2(mx,mz),P.dash>0?18:11,dt); }
    if(spd>0.01){ const nx=P.x+Math.sin(P.h)*spd*dt, nz=P.z+Math.cos(P.h)*spd*dt; const [px,pz]=roachMove(P.x,P.z,nx,nz); P.vx=(px-P.x)/Math.max(dt,1e-4); P.vz=(pz-P.z)/Math.max(dt,1e-4); P.x=px; P.z=pz; } else { P.vx=P.vz=0; }
    P.spd=spd; P.noise=spd>0.3?spd:0; P.stillT=spd<0.05?(P.stillT||0)+dt:0;
    const wasHidden=P.hidden; const hh=spotAt(P.x,P.z); P.hidden=!!hh; if(P.hidden&&!wasHidden) this.lastHideHole=hh; if(P.hidden!==wasHidden) G.ui.vignette(P.hidden);
    if(hh!==this.curSpot){ if(P.hidden!==wasHidden) this.hintHide(this.curSpot,hh); this.curSpot=hh; } this.hintTrap();
    if(P.expo>0&&!(A.state==='use'&&A.burstOn)){ P.expo=Math.max(0,P.expo-dt*0.5); if(P.tox<=0) G.ui.tox(clamp(P.expo/1.7,0,1)); }
    // 사람이 놓아둔 먹이
    let onTrap=false; for(const t of this.traps){ if(dist2(P.x,P.z,t.x,t.z)<0.15*0.15){ onTrap=true; break; } }
    if(onTrap){ P.tox+=dt; if(Math.random()<dt*3) SFX.toxWarn(); G.ui.tox(clamp(P.tox/1.8,0,1)); if(P.tox>=1.8){ this.killPlayer('trap'); return; } }
    else if(P.tox>0){ P.tox=Math.max(0,P.tox-dt*0.35); G.ui.tox(clamp(Math.max(P.tox/1.8,P.expo/1.7),0,1)); }
    this.roach.g.position.set(P.x,0,P.z); this.roach.g.rotation.set(0,P.h,0); this.roach.pose(clamp(spd/1.5,0,1),dt,0);
    // 방석
    const underCushion=P.hidden&&hh&&hh.cushion; { const c=this.cushion; const op=underCushion?0.35:1; if(c.material.opacity!==op){ c.material.opacity=op; c.material.transparent=op<1; c.material.needsUpdate=true; } const lift=(A.state==='search'&&A.searchHole&&A.searchHole.cushion)||(A.state==='use'&&A.aimHole&&A.aimHole.cushion)?this.cushionLift:0; if(lift>0||c.position.y!==this.cushionBase.y){ const L=lift>0?lift:Math.max(0,(this.cushionLift-=dt*3)); c.position.y=this.cushionBase.y+0.32*L; c.position.z=this.cushionBase.z-0.12*L; c.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),-0.75*L); if(L<=0) this.cushionLift=0; } }
    // 알
    G.ui.eggState(this.egg?'laid':'show'); this.layTick(dt,inp.eggHold); this.tickEgg(dt);
    this.updateHuman(dt); this.updateNpcs(dt); this.puffs.update(dt); this.updateVac(); this.footsteps(dt);
    this.playCamera(dt);
  }
  footsteps(dt){ const A=this.ai, P=this.p, G=this.G; if(A.spd>0.1){ const ph=Math.floor(this.human.walk/Math.PI); if(ph!==A.footPhase){ A.footPhase=ph; const d=Math.hypot(P.x-A.x,P.z-A.z); SFX.footstep(d,clamp(Math.sin(wrapAng(Math.atan2(A.x-P.x,A.z-P.z)-this.camYaw)),-1,1)); G.shake(clamp(0.35/(0.4+d),0,0.5)); } } }
  // ── 카메라 ──


  playCamera(dt){ const P=this.p, G=this.G, inp=G.input;
    // 카메라는 플레이어가 시선을 조작할 때만 돈다. 사람·무기·진행 방향을 저절로 따라가거나 고개를 되돌리지 않는다.
    const lk=inp.consumeLook(); const [lx,ly]=inp.lookKeys();
    if(lk.dx||lk.dy){ this.camYaw-=lk.dx*0.0065; this.camPitch=clamp(this.camPitch-lk.dy*0.0055,-0.3,1.25); }
    if(lx||ly){ this.camYaw-=lx*1.9*dt; this.camPitch=clamp(this.camPitch+ly*1.5*dt,-0.3,1.25); }
    this.applyCam(P.x,P.z,this.camYaw,this.camPitch,0,null);
    this.roach.g.visible=!this.camPeek;   // 바닥에 붙어 내다볼 때는 카메라가 내 몸 속이라 내 몸을 숨긴다
  }



  applyCam(x,z,yaw,pitch,w,tgt){ const G=this.G, cam=G.camera; const fx=Math.sin(yaw), fz=Math.cos(yaw);
    let cx=x, cz=z, short=0.37, found=false;
    // 방 경계는 ±1.9 / ±2.9 — 벽에 붙은 문짝·문틀 두께 안으로 카메라가 들어가지 않게
    for(let back=0.42;back>=0.05;back-=0.04){ const tx=clamp(x-fx*back,-1.9,1.9), tz=clamp(z-fz*back,-2.9,2.9); let ok=true; for(const o of OBST){ if(!o.roach&&inObst(o,tx,tz,0.02)){ ok=false; break; } } if(ok){ cx=tx; cz=tz; short=0.42-back; found=true; break; } }
    // 뒤에 카메라 놓을 자리가 없으면(냉장고·水槽底下에 숨었을 때) 가구 몸통 속에 박히지 않게 바닥에 바짝 붙어 밖을 내다본다
    this.camPeek=!found;
    if(!found){ G.camBase.set(x-fx*0.03,0.042,z-fz*0.03); this.tmp.set(x+fx*0.6,0.042+0.6*Math.tan(clamp(pitch,-0.2,0.5)),z+fz*0.6);
      cam.position.copy(G.camBase); cam.up.set(0,1,0); cam.lookAt(this.tmp); cam.updateMatrixWorld();
      G.camRight.set(1,0,0).applyQuaternion(cam.quaternion); G.camRight.y=0; G.camRight.normalize(); G.camFwd.set(fx,0,fz); return; }
    const cy=0.16+short*0.8;   // 벽에 몰려 카메라가 붙을수록 위로 올라가 내려다본다
    G.camBase.set(cx,cy,cz);
    const pit=pitch-short*0.42;
    const reach=Math.max(0.34,0.72-short*0.8); this.tmp.set(x+fx*reach*Math.cos(pit),Math.max(0,0.13-short*0.3)+reach*Math.sin(pit)+cy-0.15,z+fz*reach*Math.cos(pit));
    if(w>0.001&&tgt){ const hd=Math.max(0.45,Math.hypot(tgt.x-cx,tgt.z-cz)); this.tmp2.set(cx+fx*hd,Math.min(tgt.y,cy+hd*0.95),cz+fz*hd); this.tmp.lerp(this.tmp2,w); }
    cam.position.copy(G.camBase); cam.up.set(0,1,0); cam.lookAt(this.tmp); cam.updateMatrixWorld();
    G.camRight.set(1,0,0).applyQuaternion(cam.quaternion); G.camRight.y=0; G.camRight.normalize(); G.camFwd.set(fx,0,fz); }
  



  
    deathCamera(dt){
    const P=this.p;
    const D=this.death;
    const cam=this.G.camera;
    const t=Math.min(2.3,D.t);

    const yaw=D.faceYaw;
    const fx=Math.sin(yaw);
    const fz=Math.cos(yaw);

    const rx=fz;
    const rz=-fx;

    // 吸尘器: 노즐 안으로 끌려가며 회전
    if(D.type==='vacuum'){
      const k=clamp(t/1.22,0,1);
      const e=k*k*(3-2*k);
      const spin=D.roll*k*k*5.6;

      cam.position.set(
        lerp(P.x,D.target.x,e*0.88),
        lerp(0.075,0.038,e),
        lerp(P.z,D.target.z,e*0.88)
      );

      cam.up.set(
        rx*Math.sin(spin),
        Math.cos(spin),
        rz*Math.sin(spin)
      ).normalize();

      this.tmp.set(
        D.target.x,
        D.target.y,
        D.target.z
      );

      cam.lookAt(this.tmp);
      return;
    }

    // 압사: 첫 0.2초 동안 손이나 도구를 정면에서 본다.
    if(
      D.type==='crush' &&
      t<0.2 &&
      this.strikeMesh
    ){
      const k=clamp(t/0.2,0,1);
      const back=lerp(0.11,0.035,k);

      cam.position.set(
        P.x-fx*back,
        lerp(0.075,0.028,k),
        P.z-fz*back
      );

      cam.up.set(0,1,0);

      this.tmp.copy(
        this.strikeMesh.position
      );

      this.tmp.y=Math.max(
        0.028,
        this.strikeMesh.position.y+0.028
      );

      cam.lookAt(this.tmp);
      return;
    }

    let fall=0;
    let roll=0;
    let y=0.065;
    let side=0;

    if(D.type==='crush'){
      fall=clamp((t-0.18)/0.78,0,1);
      roll=D.roll*(0.12+1.18*fall);
      y=lerp(0.064,0.018,fall);
      side=D.roll*0.025*fall;

    }else if(D.type==='flame'){
      fall=clamp(t/1.18,0,1);

      roll=
        D.roll*0.68*fall+
        Math.sin(t*27)*0.07*(1-fall);

      y=lerp(0.072,0.022,fall);
      side=Math.sin(t*23)*0.012*(1-fall);

    }else{
      // 杀虫剂·독 먹이
      fall=clamp(t/1.5,0,1);

      roll=
        D.roll*1.16*fall+
        Math.sin(t*22)*0.12*(0.25+fall);

      y=lerp(0.068,0.02,fall);
      side=Math.sin(t*29)*0.018*(0.2+fall);
    }

    cam.position.set(
      P.x-fx*0.045+rx*side,
      y,
      P.z-fz*0.045+rz*side
    );

    cam.up.set(
      rx*Math.sin(roll),
      Math.cos(roll),
      rz*Math.sin(roll)
    ).normalize();

    const targetY=
      lerp(D.target.y,0.055,fall);

    this.tmp.set(
      D.target.x,
      targetY,
      D.target.z
    );

    cam.lookAt(this.tmp);
  }




  // 죽은 뒤에는 알집 곁에서 사람이 다가오는 것을 지켜본다
  watchCamera(dt){ const E=this.egg, cam=this.G.camera, A=this.ai; cam.up.set(0,1,0);
    if(!E){ this.applyCam(this.p.x,this.p.z,this.camYaw,this.camPitch,0,null); return; }
    const yaw=Math.atan2(A.x-E.x,A.z-E.z); this.watchYaw=angleDamp(this.watchYaw===undefined?yaw:this.watchYaw,yaw,2.2,dt);
    // 卵鞘在坐垫底下时，从哪个方向都看不见，像玩家躲进去时一样把坐垫调成半透明
    const underCushion=!!(E.spot&&E.spot.cushion), c=this.cushion, op=underCushion?0.35:1;
    if(c.material.opacity!==op){ c.material.opacity=op; c.material.transparent=op<1; c.material.needsUpdate=true; }
    const fresh=!this.watchCam||this.watchCamT!==E;
    this.watchPickT=(this.watchPickT||0)-dt;
    if(fresh||this.watchPickT<=0){ this.watchPickT=0.25; this.watchGoal=this.pickWatchCam(E,this.watchYaw,underCushion); }
    const G=this.watchGoal;
    if(fresh){ this.watchCam=G.pos.clone(); this.watchW=G.w; this.watchCamT=E; } else { const k=1-Math.exp(-5*dt); this.watchCam.lerp(G.pos,k); this.watchW=lerp(this.watchW,G.w,k); }
    const w=this.watchW; this.tmp.set(E.x*(1-w)+A.x*w,0.16,E.z*(1-w)+A.z*w);   // 看卵鞘和人类之间（w 是人类那一侧的比重）
    cam.position.copy(this.watchCam); cam.lookAt(this.tmp); }
  // 观战镜头站位：在卵鞘四周按方向、距离、高度挑候选，要求看得到卵鞘、眼前没有贴脸的墙或家具；
  // 优先站在“卵鞘背后、朝着人类”的方向，离远一点、高一点。卵鞘在冰箱底下这类缝里时会选贴地的低机位。
  watchBlockers(){
    if(this._watchBlockers) return this._watchBlockers;
    const skip=new Set(); for(const g of [this.grp,this.G.r1.grp]) g.traverse(o=>skip.add(o));
    const out=[]; this.G.scene.traverse(o=>{ if(o.isMesh&&!o.isInstancedMesh&&!skip.has(o)&&!(o.geometry.type==='PlaneGeometry'&&Math.abs(o.rotation.x)>1)) out.push(o); });   // 地板、污渍层、天花板不算
    return this._watchBlockers=out;
  }
  pickWatchCam(E,prefYaw,underCushion){
    const ray=this.watchRay||(this.watchRay=new THREE.Raycaster()), P=new THREE.Vector3(), D=new THREE.Vector3(), eggLo=new THREE.Vector3(E.x,0.008,E.z), eggHi=new THREE.Vector3(E.x,0.03,E.z);
    const blockers=this.watchBlockers().filter(o=>!(underCushion&&o===this.cushion));
    const hitWithin=(from,dir,far)=>{ ray.set(from,dir); ray.near=0; ray.far=far; return ray.intersectObjects(blockers,false).some(h=>h.object.visible); };
    const q=new THREE.Quaternion(), m=new THREE.Matrix4(), up=new THREE.Vector3(0,1,0), side=new THREE.Vector3(), upv=new THREE.Vector3();
    const cam=this.G.camera, ty=Math.tan(cam.fov*Math.PI/360), tx=ty*cam.aspect;
    const probe=this.watchProbe||(this.watchProbe=new THREE.PerspectiveCamera()); probe.fov=cam.fov; probe.aspect=cam.aspect; probe.near=0.01; probe.far=40; probe.updateProjectionMatrix();
    const A=this.ai, humanP=new THREE.Vector3(A.x,0.7,A.z), ndc=new THREE.Vector3();
    const inFrame=(pt,mx,my)=>{ ndc.copy(pt).project(probe); return ndc.z<1&&Math.abs(ndc.x)<mx&&Math.abs(ndc.y)<my; };
    const look=new THREE.Vector3(); let best=null, bw=0.38, bs=1e9;
    for(const h of [0.25,0.14,0.05]) for(let k=0;k<16;k++){ const off=wrapAng(k/16*TAU), a=prefYaw+off;
      for(const back of [0.5,0.4,0.3,0.22]){
        const x=E.x-Math.sin(a)*back, z=E.z-Math.cos(a)*back;
        if(x<-1.9||x>1.9||z<-2.9||z>2.9) continue;
        let inside=false; for(const o of OBST){ if(!o.roach&&h<o.h+0.02&&inObst(o,x,z,0.03)){ inside=true; break; } } if(inside) continue;
        let score=Math.abs(off)*1.0+(0.5-back)*1.5+(h===0.25?0:h===0.14?0.35:0.7);
        if(score-0.8>=bs) continue;   // 加上“看得到人类”的最大奖励也比不过当前最好的，就不用细算
        P.set(x,h,z);
        // 卵鞘必须在画面里：先按“卵鞘和人类之间”取景，放不进就把视线往卵鞘这边收
        let w=-1; probe.position.copy(P);
        for(const ww of [0.38,0.2,0]){ look.set(E.x*(1-ww)+this.ai.x*ww,0.16,E.z*(1-ww)+this.ai.z*ww); probe.lookAt(look); probe.updateMatrixWorld(); if(inFrame(eggLo,0.8,0.8)){ w=ww; break; } }
        if(w<0) continue;
        score+=(0.38-w)*1.2;
        // 卵鞘只有 3 厘米高，底部和顶部都要看得到，免得刚好从柜子底边擦过
        let hidden=false; for(const T of [eggLo,eggHi]){ D.copy(T).sub(P); const dist=D.length(); if(hitWithin(P,D.normalize(),dist-0.02)){ hidden=true; break; } } if(hidden) continue;
        // 按实际视野在画面上取 3×3 个方向，眼前 0.25 米内就撞到墙或家具的超过一个，就换位置
        m.lookAt(P,look,up); q.setFromRotationMatrix(m); side.set(1,0,0).applyQuaternion(q); upv.set(0,1,0).applyQuaternion(q); D.set(0,0,-1).applyQuaternion(q);
        let near=0, close=0; for(const sx of [-0.8,0,0.8]) for(const sy of [-0.8,0,0.8]){ const dd=D.clone().addScaledVector(side,sx*tx).addScaledVector(upv,sy*ty).normalize(); if(hitWithin(P,dd,0.25)) near++; else if(hitWithin(P,dd,0.45)) close++; }
        if(near>=2) continue;
        score+=0.25*(near+close);   // 离得近的墙、柜子占画面越多越差
        // 人类也在画面里、中间没被挡住更好
        if(inFrame(humanP,0.9,0.95)){ D.copy(humanP).sub(P); const dist=D.length(); if(!hitWithin(P,D.normalize(),dist-0.3)) score-=0.8; }
        if(score>=bs) continue;
        bs=score; best=P.clone(); bw=w;
      } }
    return best?{pos:best,w:bw}:{pos:new THREE.Vector3(clamp(E.x,-1.9,1.9),0.75,clamp(E.z,-2.9,2.9)),w:0};   // 实在没有位置就从上方往下看卵鞘
  }
  leaveCamera(dt){ const L=this.leaveCam; const cam=this.G.camera; cam.position.set(L.x,0.1,L.z); this.tmp.set(L.x+Math.sin(L.yaw)*1,0.1,L.z+Math.cos(L.yaw)*1); cam.lookAt(this.tmp); }
}
