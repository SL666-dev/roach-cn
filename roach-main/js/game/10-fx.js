// 粒子（溅射、喷雾、火焰）与第二阶段死亡画面 DeathFX
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 튐 입자 ─────────
class Splatter{
  constructor(scene,paint){
    this.n=320; this.paint=paint; const geo=new THREE.SphereGeometry(1,6,5);
    this.mesh=new THREE.InstancedMesh(geo,M.gloss(0xffffff,{roughness:0.3}),this.n); this.mesh.castShadow=false; this.mesh.frustumCulled=false; scene.add(this.mesh); this.cream=new THREE.Color(); this.gutCol=new THREE.Color(0x3a2210); for(let i=0;i<this.n;i++) this.mesh.setColorAt(i,this.gutCol);
    this.p=[]; for(let i=0;i<this.n;i++) this.p.push({on:false,x:0,y:0,z:0,vx:0,vy:0,vz:0,r:0.01,yel:false});
    this.dummy=new THREE.Object3D(); this.next=0; this.color=new THREE.Color(); this.L=0; this.hideAll();
  }
  hideAll(){ for(let i=0;i<this.n;i++){ this.p[i].on=false; this.dummy.position.set(0,-10,0); this.dummy.scale.setScalar(0.0001); this.dummy.updateMatrix(); this.mesh.setMatrixAt(i,this.dummy.matrix); } this.mesh.instanceMatrix.needsUpdate=true; }
  setLevel(L){ this.L=L; this.cream.setHSL(lerp(47,42,L)/360,lerp(0.42,0.48,L),lerp(0.86,0.8,L)); }
  burst(x,z,dx,dz,count,power=1){
    const base=Math.atan2(dz,dx);
    for(let i=0;i<count;i++){ const q=this.p[this.next]; this.next=(this.next+1)%this.n; const a=base+rand(-0.9,0.9), sp=rand(0.3,1.5)*power; q.on=true; q.x=x; q.z=z; q.y=0.02; q.vx=Math.cos(a)*sp; q.vz=Math.sin(a)*sp; q.vy=rand(0.5,1.8)*power; q.r=rand(0.004,0.012); q.yel=Math.random()<0.25; q.gut=Math.random()<0.2; this.mesh.setColorAt(this.next===0?this.n-1:this.next-1,q.gut?this.gutCol:this.cream); }
    if(this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate=true;
  }
  update(dt){
    let any=false;
    for(let i=0;i<this.n;i++){ const q=this.p[i]; if(!q.on) continue; any=true;
      q.vy-=9.8*dt; q.x+=q.vx*dt; q.y+=q.vy*dt; q.z+=q.vz*dt;
      if(q.y<=0){ q.on=false; if(q.x>ROOM.x1&&q.x<ROOM.x2&&q.z>ROOM.z1&&q.z<ROOM.z2) this.paint.drop(q.x,q.z,q.r*1.6,this.L,q.yel,q.gut); this.dummy.position.set(0,-10,0); this.dummy.scale.setScalar(0.0001); }
      else { this.dummy.position.set(q.x,q.y,q.z); this.dummy.scale.set(q.r,q.r*0.7,q.r); }
      this.dummy.updateMatrix(); this.mesh.setMatrixAt(i,this.dummy.matrix);
    }
    if(any) this.mesh.instanceMatrix.needsUpdate=true;
  }
}

// ───────── 뿌리기/불꽃/흡입 입자 ─────────
class Puffs{
  constructor(scene){
    this.n=180; const geo=new THREE.SphereGeometry(1,8,6);
    this.mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.85,depthWrite:false});
    this.mesh=new THREE.InstancedMesh(geo,this.mat,this.n); this.mesh.frustumCulled=false; scene.add(this.mesh);
    this.p=[]; for(let i=0;i<this.n;i++) this.p.push({on:false,life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,r:0.01,kind:'spray'});
    this.dummy=new THREE.Object3D(); this.next=0; this.col=new THREE.Color();
    for(let i=0;i<this.n;i++) this.mesh.setColorAt(i,this.col.set(0xffffff));
    this.clear();
  }
  clear(){ for(const q of this.p) q.on=false; for(let i=0;i<this.n;i++){ this.dummy.position.set(0,-10,0); this.dummy.scale.setScalar(0.0001); this.dummy.updateMatrix(); this.mesh.setMatrixAt(i,this.dummy.matrix);} this.mesh.instanceMatrix.needsUpdate=true; }
  emit(kind,x,y,z,dx,dz,n=3,spd=1.6){
    const base=Math.atan2(dz,dx);
    for(let i=0;i<n;i++){ const q=this.p[this.next]; this.next=(this.next+1)%this.n; const a=base+rand(-0.3,0.3), s=rand(0.5,1)*spd; q.on=true; q.kind=kind; q.x=x; q.y=y; q.z=z; q.vx=Math.cos(a)*s; q.vz=Math.sin(a)*s; q.vy=kind==='flame'?(y>0.3?rand(-2.2,-1.2):rand(0.2,0.6)):(y>0.3?rand(-2.6,-1.4):rand(-0.25,0.05)); q.life=kind==='flame'?(y>0.3?rand(0.45,0.7):rand(0.18,0.35)):(y>0.3?rand(0.7,1.1):rand(0.35,0.7)); q.r=kind==='flame'?rand(0.012,0.03):rand(0.01,0.025); }
  }
  update(dt){
    let any=false;
    for(let i=0;i<this.n;i++){ const q=this.p[i]; if(!q.on) continue; any=true; q.life-=dt;
      if(q.life<=0||q.y<0){ q.on=false; this.dummy.position.set(0,-10,0); this.dummy.scale.setScalar(0.0001); }
      else { q.x+=q.vx*dt; q.y+=q.vy*dt; q.z+=q.vz*dt; q.vx*=0.94; q.vz*=0.94; const grow=q.kind==='flame'?1+ (0.35-q.life)*1.5:1+dt*2; this.dummy.position.set(q.x,q.y,q.z); this.dummy.scale.setScalar(q.r*grow);
        if(q.kind==='flame'){ const k=clamp(q.life/0.35,0,1); this.col.setRGB(1,0.25+0.7*k*k,0.02+0.5*k*k*k); } else this.col.setRGB(0.93,0.96,1);
        this.mesh.setColorAt(i,this.col); }
      this.dummy.updateMatrix(); this.mesh.setMatrixAt(i,this.dummy.matrix);
    }
    if(any){ this.mesh.instanceMatrix.needsUpdate=true; if(this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate=true; }
  }
}




// ───────── 2라운드 죽음 화면 ─────────
class DeathFX{
  constructor(G){
    this.G=G;
    this.c=document.getElementById('deathfx');
    this.g=this.c.getContext('2d');
    this.active=false;
    this.duration=2.3;
    this.w=1;
    this.h=1;
    this.drops=[];
    this.shards=[];
    this.tears=[];
    window.addEventListener('resize',()=>{ if(this.active) this.resize(); });
  }

  resize(){
    this.w=Math.max(1,innerWidth);
    this.h=Math.max(1,innerHeight);
    this.dpr=Math.min(devicePixelRatio||1,1.5);
    this.c.width=Math.round(this.w*this.dpr);
    this.c.height=Math.round(this.h*this.dpr);
    this.g.setTransform(this.dpr,0,0,this.dpr,0,0);
  }

  start(type){
    this.stop();
    this.active=true;
    this.type=type;
    this.t=0;
    this.roll=Math.random()<0.5?-1:1;
    this.resize();
    this.c.classList.add('show');

    const slow=type==='poison'||type==='trap';
    const cx=this.w*0.5;
    const cy=this.h*(type==='trap'?0.62:0.47);
    const fluidN=type==='crush'?42:type==='flame'?18:type==='vacuum'?14:20;
    const shardN=type==='crush'?18:type==='flame'?11:type==='vacuum'?8:7;

    this.drops=[];
    for(let i=0;i<fluidN;i++){
      this.drops.push({
        birth:slow?rand(0.08,1.28):rand(0.025,0.30),
        life:slow?rand(0.55,1.05):rand(0.52,0.95),
        x:cx+rand(-this.w*0.035,this.w*0.035),
        y:cy+rand(-this.h*0.025,this.h*0.025),
        vx:slow?rand(-this.w*0.09,this.w*0.09):rand(-this.w*0.55,this.w*0.55),
        vy:slow?rand(this.h*0.04,this.h*0.24):rand(-this.h*0.96,-this.h*0.16),
        gravity:slow?rand(this.h*0.18,this.h*0.48):rand(this.h*1.25,this.h*2.15),
        len:slow?rand(8,26):rand(16,58),
        width:rand(1.2,4.6),
        dark:Math.random()<(type==='flame'?0.48:0.22)
      });
    }

    this.shards=[];
    for(let i=0;i<shardN;i++){
      this.shards.push({
        birth:rand(0.035,0.42),
        life:rand(0.55,1.05),
        x:cx+rand(-this.w*0.025,this.w*0.025),
        y:cy+rand(-this.h*0.02,this.h*0.02),
        vx:rand(-this.w*0.48,this.w*0.48),
        vy:rand(-this.h*0.72,-this.h*0.06),
        gravity:rand(this.h*1.0,this.h*1.8),
        rot:rand(TAU),
        vr:rand(-10,10),
        w:rand(2,6),
        h:rand(10,34)
      });
    }

    this.tears=[];
    for(let i=0;i<12;i++){
      this.tears.push({
        birth:rand(0.10,1.68),
        life:rand(0.045,0.19),
        y:rand(0,this.h),
        h:rand(4,22),
        x:rand(-this.w*0.08,this.w*0.58),
        w:rand(this.w*0.28,this.w*0.78)
      });
    }

    this.G.canvas.style.transformOrigin='50% 50%';
    this.G.canvas.style.willChange='transform,filter';
  }

  stop(){
    this.active=false;
    this.c.classList.remove('show');
    this.g.clearRect(0,0,this.w||1,this.h||1);
    this.G.canvas.style.transform='';
    this.G.canvas.style.filter='';
    this.G.canvas.style.willChange='';
  }

  drawDrops(){
    const g=this.g;
    g.lineCap='round';

    for(const p of this.drops){
      const a=this.t-p.birth;
      if(a<0||a>p.life) continue;

      const alpha=clamp(1-a/p.life,0,1);
      const x=p.x+p.vx*a;
      const y=p.y+p.vy*a+0.5*p.gravity*a*a;
      const speedY=p.vy+p.gravity*a;
      const mag=Math.max(1,Math.hypot(p.vx,speedY));
      const tx=p.vx/mag*p.len;
      const ty=speedY/mag*p.len;

      g.strokeStyle=p.dark
        ? `rgba(62,35,18,${alpha*0.82})`
        : `rgba(246,240,216,${alpha*0.92})`;
      g.lineWidth=p.width;
      g.beginPath();
      g.moveTo(x-tx,y-ty);
      g.lineTo(x,y);
      g.stroke();
    }
  }

  drawShards(){
    const g=this.g;
    for(const p of this.shards){
      const a=this.t-p.birth;
      if(a<0||a>p.life) continue;

      const alpha=clamp(1-a/p.life,0,1);
      const x=p.x+p.vx*a;
      const y=p.y+p.vy*a+0.5*p.gravity*a*a;
      g.save();
      g.translate(x,y);
      g.rotate(p.rot+p.vr*a);
      g.fillStyle=`rgba(54,29,14,${alpha*0.9})`;
      g.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      g.restore();
    }
  }

  drawTears(){
    const g=this.g;
    for(const q of this.tears){
      const a=this.t-q.birth;
      if(a<0||a>q.life) continue;

      const k=clamp(1-a/q.life,0,1);
      g.beginPath();
      g.moveTo(q.x,q.y);
      for(let i=1;i<=7;i++){
        g.lineTo(q.x+q.w*i/7,q.y+rand(-q.h,q.h));
      }
      for(let i=7;i>=0;i--){
        g.lineTo(q.x+q.w*i/7,q.y+q.h+rand(-q.h*0.35,q.h*0.35));
      }
      g.closePath();
      g.fillStyle=`rgba(0,0,0,${0.35+0.62*k})`;
      g.fill();

      g.strokeStyle=`rgba(248,241,218,${0.16*k})`;
      g.lineWidth=1;
      g.stroke();
    }
  }

  drawCrush(){
    const g=this.g,t=this.t,w=this.w,h=this.h;
    if(t<0.085){
      g.fillStyle=`rgba(255,250,229,${1-t/0.085})`;
      g.fillRect(0,0,w,h);
    }

    const edge=clamp((t-0.22)/1.35,0,0.82);
    const gr=g.createRadialGradient(w*0.5,h*0.5,0,w*0.5,h*0.5,Math.max(w,h)*0.72);
    gr.addColorStop(0,'rgba(0,0,0,0)');
    gr.addColorStop(0.48,`rgba(0,0,0,${edge*0.25})`);
    gr.addColorStop(1,`rgba(0,0,0,${edge})`);
    g.fillStyle=gr;
    g.fillRect(0,0,w,h);

    if(
      (t>0.22&&t<0.255)||
      (t>0.43&&t<0.485)||
      (t>0.76&&t<0.82)||
      (t>1.12&&t<1.17)
    ){
      g.fillStyle='rgba(0,0,0,0.78)';
      g.fillRect(0,0,w,h);
    }
  }

  drawVacuum(){
    const g=this.g,t=this.t,w=this.w,h=this.h;
    const p=clamp(t/1.45,0,1);
    const r=Math.max(6,Math.min(w,h)*(0.48-0.39*p));
    const gr=g.createRadialGradient(w*0.5,h*0.5,r*0.08,w*0.5,h*0.5,r*2.2);
    gr.addColorStop(0,'rgba(0,0,0,0)');
    gr.addColorStop(0.34,`rgba(0,0,0,${0.08+0.22*p})`);
    gr.addColorStop(1,`rgba(0,0,0,${0.58+0.34*p})`);
    g.fillStyle=gr;
    g.fillRect(0,0,w,h);

    g.strokeStyle=`rgba(238,236,218,${0.16*(1-p)})`;
    g.lineWidth=1.2;
    for(let i=0;i<18;i++){
      const a=i/18*TAU+t*4.5;
      const x=w*0.5+Math.cos(a)*Math.max(w,h);
      const y=h*0.5+Math.sin(a)*Math.max(w,h);
      g.beginPath();
      g.moveTo(x,y);
      g.lineTo(w*0.5,h*0.5);
      g.stroke();
    }
  }

  drawFlame(){
    const g=this.g,t=this.t,w=this.w,h=this.h;
    const flash=clamp(1-t/0.28,0,1);
    g.fillStyle=`rgba(255,172,62,${0.42*flash})`;
    g.fillRect(0,0,w,h);

    const burn=clamp((t-0.16)/1.6,0,1);
    const gr=g.createRadialGradient(w*0.5,h*0.48,0,w*0.5,h*0.48,Math.max(w,h)*0.68);
    gr.addColorStop(0,`rgba(255,238,184,${0.08*(1-burn)})`);
    gr.addColorStop(0.42,`rgba(95,27,4,${0.15+0.2*burn})`);
    gr.addColorStop(1,`rgba(0,0,0,${0.56+0.38*burn})`);
    g.fillStyle=gr;
    g.fillRect(0,0,w,h);
  }

  drawPoison(){
    const g=this.g,t=this.t,w=this.w,h=this.h;
    const p=clamp(t/1.8,0,1);
    g.fillStyle=`rgba(80,92,28,${0.08+0.16*p})`;
    g.fillRect(0,0,w,h);

    const bands=3+Math.floor(p*5);
    for(let i=0;i<bands;i++){
      const y=(i/bands*h+t*83+i*37)%h;
      const hh=rand(4,22)*(0.4+p);
      g.fillStyle=`rgba(0,0,0,${rand(0.08,0.25)*p})`;
      g.fillRect(0,y,w,hh);
    }

    if((t>0.62&&t<0.69)||(t>1.08&&t<1.16)||(t>1.55&&t<1.68)){
      g.fillStyle='rgba(0,0,0,0.52)';
      g.fillRect(0,0,w,h);
    }
  }

  distort(){
    const t=this.t;
    let x=0,y=0,r=0,s=1,b=1,c=1,sat=1;

    if(this.type==='crush'){
      const k=clamp(1-t/0.72,0,1);
      x=rand(-17,17)*k;
      y=rand(-12,12)*k;
      r=this.roll*(4.5*clamp((t-0.18)/1.2,0,1))+rand(-2.6,2.6)*k;
      s=1+0.065*k;
      b=t<0.11?1.75:lerp(1,0.42,clamp((t-0.75)/1.45,0,1));
      c=1+1.7*k;
      sat=lerp(1,0.22,clamp((t-0.55)/1.65,0,1));
    }else if(this.type==='vacuum'){
      const k=clamp(t/1.5,0,1);
      r=this.roll*k*k*24;
      s=1+0.58*k*k;
      x=Math.sin(t*27)*5*(1-k);
      y=Math.cos(t*31)*4*(1-k);
      b=lerp(1,0.28,k);
      c=1+0.8*k;
      sat=lerp(1,0.12,k);
    }else if(this.type==='flame'){
      const k=clamp(t/1.35,0,1);
      x=rand(-8,8)*(1-k);
      y=rand(-6,6)*(1-k);
      r=this.roll*2.8*k+Math.sin(t*31)*0.8*(1-k);
      s=1.025+0.025*Math.sin(t*23);
      b=t<0.25?1.7:lerp(1.15,0.25,k);
      c=1.35+0.75*k;
      sat=lerp(1.4,0.08,k);
    }else{
      const k=clamp(t/1.75,0,1);
      x=Math.sin(t*19)*7*(0.35+k);
      y=Math.cos(t*23)*4*(0.25+k);
      r=this.roll*(0.4+5.5*k)+Math.sin(t*13)*1.1;
      s=1+0.018*Math.sin(t*17);
      b=lerp(1,0.33,k);
      c=1+0.9*k;
      sat=lerp(0.9,0.15,k);
    }

    this.G.canvas.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`;
    this.G.canvas.style.filter=`brightness(${b.toFixed(3)}) contrast(${c.toFixed(3)}) saturate(${sat.toFixed(3)})`;
  }

  update(dt){
    if(!this.active) return false;

    this.t=Math.min(this.duration,this.t+dt);
    const g=this.g;
    g.clearRect(0,0,this.w,this.h);

    if(this.type==='crush') this.drawCrush();
    else if(this.type==='vacuum') this.drawVacuum();
    else if(this.type==='flame') this.drawFlame();
    else this.drawPoison();

    this.drawDrops();
    this.drawShards();
    this.drawTears();

    const close=clamp((this.t-1.88)/0.42,0,1);
    if(close>0){
      g.fillStyle=`rgba(0,0,0,${close})`;
      g.fillRect(0,0,this.w,this.h);
    }

    this.distort();
    return this.t>=this.duration;
  }
}
