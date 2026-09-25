// 道具模型 makeItem 与复用池 ITEM_POOL
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 아이템 ─────────
function makeItem(kind){
  const g=new THREE.Group();
  switch(kind){
    case 'slipper':{ const sh=new THREE.Shape(); sh.moveTo(-0.05,-0.13); sh.quadraticCurveTo(-0.07,0,-0.055,0.11); sh.quadraticCurveTo(-0.03,0.145,0,0.145); sh.quadraticCurveTo(0.055,0.14,0.055,0.09); sh.quadraticCurveTo(0.06,-0.02,0.045,-0.13); sh.quadraticCurveTo(0,-0.15,-0.05,-0.13);
      const sole=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:0.025,bevelEnabled:true,bevelSize:0.004,bevelThickness:0.004,bevelSegments:2}),MAT.black); sole.rotation.x=-Math.PI/2; sole.position.y=0.03; sole.castShadow=true; g.add(sole);
      const strap=new THREE.Mesh(new THREE.TorusGeometry(0.052,0.014,8,14,Math.PI),M.std(0x2c2c32)); strap.position.set(0,0.035,0.02); strap.castShadow=true; g.add(strap);
      for(let i=-1;i<=1;i++){ const st=new THREE.Mesh(new THREE.TorusGeometry(0.0535,0.004,6,14,Math.PI),MAT.white); st.position.set(0,0.035,0.02+i*0.012); g.add(st); }
      break; }
    case 'tissue':{ const r=cyl(0.055,0.055,0.11,MAT.paper); r.rotation.x=Math.PI/2; r.position.y=0.055; g.add(r); const hole=cyl(0.02,0.02,0.112,M.std(0x8a7a60)); hole.rotation.x=Math.PI/2; hole.position.y=0.055; g.add(hole); break; }
    case 'book':{ g.add(box(0.16,0.035,0.22,M.std(0xb8402f,{roughness:0.5}),0,0.0175,0)); g.add(box(0.15,0.028,0.215,MAT.cream,0.006,0.0175,0.004)); g.add(box(0.05,0.004,0.08,MAT.cream,0,0.037,-0.02)); break; }
    case 'pan':{ g.add(cyl(0.13,0.12,0.03,MAT.iron,0,0.015,0,28)); const rim=new THREE.Mesh(new THREE.TorusGeometry(0.125,0.008,8,32),MAT.iron); rim.rotation.x=Math.PI/2; rim.position.y=0.03; rim.castShadow=true; g.add(rim); const h=box(0.03,0.02,0.2,MAT.black,0,0.035,0.22); g.add(h); g.add(box(0.032,0.024,0.11,MAT.wood,0,0.035,0.27)); break; }
    case 'spray':{ const can=cyl(0.033,0.033,0.19,MAT.green); can.position.y=0.095; g.add(can); g.add(cyl(0.02,0.02,0.03,MAT.red,0,0.205,0)); g.add(box(0.012,0.012,0.03,MAT.red,0,0.215,0.02)); g.add(box(0.05,0.07,0.001,MAT.white,0,0.1,0.034)); break; }
    case 'flame':{ const can=cyl(0.033,0.033,0.19,MAT.grey); can.position.y=0.095; g.add(can); g.add(cyl(0.02,0.02,0.03,MAT.black,0,0.205,0)); g.add(box(0.012,0.012,0.03,MAT.black,0,0.215,0.02)); g.add(box(0.025,0.07,0.012,MAT.yellow,0.03,0.185,0.03)); g.add(box(0.02,0.012,0.012,MAT.steel,0.03,0.226,0.03)); break; }
    case 'vacuum':{ g.add(box(0.26,0.06,0.12,M.std(0x8e8e96),0,0.03,0)); g.add(box(0.24,0.012,0.09,M.std(0x3a3a3f),0,0.004,0)); const tube=cyl(0.02,0.02,0.9,M.std(0xa5a5ad)); tube.position.set(0,0.42,-0.25); tube.rotation.x=-0.55; g.add(tube); break; }
    case 'hand':{ const palm=box(0.09,0.028,0.1,MAT.skin,0,0.02,0); g.add(palm); for(let i=0;i<4;i++){ const f=cyl(0.011,0.012,0.075,MAT.skin,-0.033+i*0.022,0.02,0.085); f.rotation.x=Math.PI/2; g.add(f); } const th=cyl(0.011,0.013,0.06,MAT.skin,-0.06,0.02,0.02); th.rotation.z=Math.PI/2.4; g.add(th); const wrist=cyl(0.03,0.032,0.1,MAT.skin,0,0.02,-0.09); wrist.rotation.x=Math.PI/2; g.add(wrist); break; }
    case 'bone':{ const b=cyl(0.012,0.012,0.11,MAT.paper); b.rotation.z=Math.PI/2; b.position.y=0.012; g.add(b); g.add(sph(0.016,MAT.paper,-0.055,0.014,0)); g.add(sph(0.016,MAT.paper,0.055,0.014,0)); const meat=sph(0.03,M.std(0xc9773a,{roughness:0.6}),0.01,0.02,0); meat.scale.set(1.2,0.8,1); g.add(meat); break; }
    case 'cola':{ const can=cyl(0.033,0.033,0.12,M.std(0xb8232f,{roughness:0.35,metalness:0.4})); can.rotation.z=Math.PI/2; can.position.y=0.033; g.add(can); break; }
    case 'rice':{ const bowl=new THREE.Mesh(new THREE.SphereGeometry(0.05,16,10,0,TAU,0,Math.PI/2),MAT.paper); bowl.rotation.x=Math.PI; bowl.position.y=0.05; bowl.castShadow=true; g.add(bowl); break; }
    case 'egg':{ const e=new THREE.Mesh(oothecaGeo(),MAT.roachShell); e.castShadow=true; e.receiveShadow=true; g.add(e); break; }
    case 'suitcase':{ g.add(box(0.4,0.55,0.2,M.std(0x2f4a8a,{roughness:0.5}),0,0.275,0)); g.add(box(0.14,0.03,0.03,MAT.black,0,0.57,0)); break; }
  }
  return g;
}
// 反复出现又消失的道具（人类出招、手里的武器、诱饵、陷阱）用完放回池里，下次直接拿来用，不再每次新建模型
const ITEM_POOL={free:{},
  get(kind){ const a=this.free[kind]; const m=a&&a.length?a.pop():makeItem(kind); m.userData.poolKind=kind; m.position.set(0,0,0); m.rotation.set(0,0,0); m.scale.setScalar(1); m.visible=true; return m; },
  put(m){ if(!m) return; m.removeFromParent(); (this.free[m.userData.poolKind]||(this.free[m.userData.poolKind]=[])).push(m); }};
