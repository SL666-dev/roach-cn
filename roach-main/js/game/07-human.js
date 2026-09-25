// 第二阶段的人类模型与动作
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 사람 ─────────
function makeHuman(){
  const root=new THREE.Group(); const H={root};
  const hips=new THREE.Group(); hips.position.y=0.96; root.add(hips); H.hips=hips;
  hips.add(box(0.36,0.22,0.24,MAT.pjPants,0,-0.02,0));
  const torso=new THREE.Group(); hips.add(torso); H.torso=torso;
  const t1=box(0.4,0.52,0.25,MAT.pjTop,0,0.34,0); torso.add(t1); torso.add(box(0.42,0.06,0.27,M.std(0xe9f1f8),0,0.6,0)); torso.add(box(0.1,0.16,0.01,M.std(0xe9f1f8),0,0.5,0.13));
  const neck=cyl(0.055,0.06,0.1,MAT.skin,0,0.65,0); torso.add(neck);
  const head=new THREE.Group(); head.position.y=0.7; torso.add(head); H.head=head;
  const skull=sph(0.115,MAT.skin,0,0.1,0,20,16); skull.scale.set(0.95,1.05,1); head.add(skull);
  const hair=sph(0.12,MAT.hair,0,0.14,-0.02,20,16); hair.scale.set(0.98,0.75,1.0); head.add(hair);
  head.add(box(0.05,0.06,0.02,MAT.hair,0.1,0.06,-0.04)); head.add(box(0.05,0.06,0.02,MAT.hair,-0.1,0.06,-0.04));
  for(const s of [1,-1]){ const e=sph(0.02,MAT.white,s*0.042,0.11,0.1); e.scale.set(1,0.8,0.6); e.castShadow=false; head.add(e); const p=sph(0.009,M.std(0x1a120c),s*0.042,0.108,0.113); p.castShadow=false; head.add(p); head.add(box(0.05,0.008,0.01,MAT.hair,s*0.045,0.145,0.1)); const ring=new THREE.Mesh(new THREE.TorusGeometry(0.03,0.004,6,16),MAT.black); ring.position.set(s*0.045,0.108,0.11); head.add(ring); }
  head.add(box(0.03,0.004,0.01,MAT.black,0,0.108,0.115)); head.add(box(0.04,0.008,0.012,M.std(0x9a4a3a),0,0.045,0.1)); head.add(sph(0.014,MAT.skin,0,0.075,0.115));
  const mkLeg=(s)=>{ const th=new THREE.Group(); th.position.set(s*0.1,-0.05,0); hips.add(th); const tm=cyl(0.085,0.07,0.44,MAT.pjPants,0,-0.22,0); th.add(tm); const kn=new THREE.Group(); kn.position.y=-0.45; th.add(kn); kn.add(sph(0.072,MAT.pjPants,0,0,0,12,10)); kn.add(cyl(0.068,0.055,0.42,MAT.pjPants,0,-0.21,0)); kn.add(cyl(0.05,0.045,0.04,MAT.skin,0,-0.44,0)); const foot=new THREE.Group(); foot.position.y=-0.46; kn.add(foot); const sole=box(0.11,0.025,0.27,MAT.black,0,0.012,0.05); foot.add(sole); const bridge=box(0.085,0.045,0.17,MAT.skin,0,0.045,0.04); foot.add(bridge); const strap=new THREE.Mesh(new THREE.TorusGeometry(0.056,0.012,8,14,Math.PI),M.std(0x2c2c32)); strap.position.set(0,0.026,0.06); strap.scale.set(1,1.3,1); foot.add(strap); for(let i=-1;i<=1;i++){ const st=new THREE.Mesh(new THREE.TorusGeometry(0.057,0.004,6,14,Math.PI),MAT.white); st.position.set(0,0.026,0.06+i*0.013); st.scale.set(1,1.3,1); foot.add(st); } for(let i=-1;i<=1;i++) foot.add(sph(0.017,MAT.skin,i*0.03,0.04,0.155)); return {th,kn,foot}; };
  H.legL=mkLeg(-1); H.legR=mkLeg(1);
  const mkArm=(s)=>{ const sh=new THREE.Group(); sh.position.set(s*0.24,0.55,0); torso.add(sh); sh.add(cyl(0.055,0.048,0.32,MAT.pjTop,0,-0.16,0)); const el=new THREE.Group(); el.position.y=-0.32; sh.add(el); el.add(sph(0.05,MAT.pjTop,0,0.01,0,12,10)); el.add(cyl(0.046,0.04,0.3,MAT.skin,0,-0.15,0)); const hand=new THREE.Group(); hand.position.y=-0.32; el.add(hand); const hm=sph(0.052,MAT.skin); hm.scale.set(0.8,1.1,0.55); hand.add(hm); return {sh,el,hand}; };
  H.armL=mkArm(-1); H.armR=mkArm(1);
  H.hold=new THREE.Group(); H.armR.hand.add(H.hold); H.hold.position.set(0,-0.03,0.03);
  root.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  H.walk=0; H.crouch=0; H.headPitch=0; H.headYaw=0; H.bob=0;
  H.pose=function(dt,speed){
    const s=clamp(speed/1.2,0,1); H.walk+=dt*(s>0.02?7.5*Math.max(s,0.35):0);
    const sw=Math.sin(H.walk)*0.55*s, c=H.crouch;
    H.legL.th.rotation.x=sw*(1-c)-c*1.5; H.legR.th.rotation.x=-sw*(1-c)-c*1.5;
    H.legL.kn.rotation.x=Math.max(0,-sw)*0.9*(1-c)+c*2.2; H.legR.kn.rotation.x=Math.max(0,sw)*0.9*(1-c)+c*2.2;
    H.legL.foot.rotation.x=-H.legL.th.rotation.x-H.legL.kn.rotation.x; H.legR.foot.rotation.x=-H.legR.th.rotation.x-H.legR.kn.rotation.x;
    H.hips.position.y=0.96-c*0.5+Math.abs(Math.sin(H.walk))*0.02*s;
    H.torso.rotation.x=c*0.7+H.bob;
    if(!H.strikeAnim){ H.armR.sh.rotation.x=-sw*0.7*(1-c)-c*0.6; H.armR.el.rotation.x=-0.25-c*0.6; }
    H.armL.sh.rotation.x=sw*0.7*(1-c)-c*0.4; H.armL.el.rotation.x=-0.3-c*0.6;
    H.head.rotation.x=H.headPitch-c*0.3; H.head.rotation.y=H.headYaw;
  };
  return H;
}
