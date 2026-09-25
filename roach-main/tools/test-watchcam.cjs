// 观战镜头：卵鞘放在各个藏身处和空地、人类站在不同位置时，镜头看得到卵鞘，画面不被近处的墙/家具糊住
const L=require('./lib.cjs');

L.run('观战镜头',{},async(t,{page})=>{
  const game=await L.openGame(page,'?r=2&w=slipper');
  await page.waitForTimeout(1500);
  const res=await game.evaluate(async()=>{
    const r=__g.r2, cam=__g.camera, T=__THREE;
    const occ=[]; __g.scene.traverse(o=>{ if(o.isMesh&&!o.isInstancedMesh) occ.push(o); });
    const skip=new Set(); for(const g of [r.grp,__g.r1.grp]) g.traverse(o=>skip.add(o));
    // 家具和墙面；地板、污渍层、天花板这些水平平面不算遮挡
    const blockers=occ.filter(o=>!skip.has(o)&&!(o.geometry.type==='PlaneGeometry'&&Math.abs(o.rotation.x)>1));
    const ray=new T.Raycaster(), v=new T.Vector3(), d=new T.Vector3();
    // 调成半透明的（如坐垫）不算遮挡
    const firstHit=()=>{ const h=ray.intersectObjects(blockers,false).find(h=>h.object.visible&&!(h.object.material.transparent&&h.object.material.opacity<0.6)); return h?h.distance:Infinity; };
    const spots=[...__g.HOLES.map(h=>({n:h.label,x:h.x+(h.dx||0)*0.05,z:h.z+(h.dz||1)*0.05})),{n:'房间中央',x:0.2,z:0.8},{n:'门边',x:1.3,z:2.4},{n:'书桌前',x:-0.9,z:-1.6}];
    const humans=[[0.35,1.35],[-0.75,-1.05],[0.95,0.35]];
    const out=[];
    for(const s of spots) for(const [hx,hz] of humans){
      r.phase='play'; r.death=null; r.doneStep=false; r.finished=false; r.startGen();
      r.p.x=s.x; r.p.z=s.z; r.p.spd=0; r.placeEgg(); r.egg.x=s.x; r.egg.z=s.z;
      r.phase='watch'; r.watchYaw=undefined; r.watchCam=null;
      const A=r.ai; A.x=hx; A.z=hz; A.state='look'; A.t=0;
      for(let i=0;i<240;i++) r.watchCamera(1/60);   // 4 秒，让平滑移动落定
      cam.updateMatrixWorld();
      // 卵鞘可见：镜头到卵鞘之间没有遮挡
      v.set(r.egg.x,0.02,r.egg.z); d.copy(v).sub(cam.position); const dist=d.length(); ray.set(cam.position,d.normalize()); ray.far=dist;
      const pr=v.clone().project(cam); const eggHidden=firstHit()<dist-0.02||pr.z>1||Math.abs(pr.x)>0.95||Math.abs(pr.y)>0.95;   // 被挡住或不在画面里
      const hp=new T.Vector3(hx,0.7,hz).project(cam); const humanIn=hp.z<1&&Math.abs(hp.x)<1&&Math.abs(hp.y)<1;
      // 画面被糊住：7×7 采样中，0.25 米内就撞到东西的比例
      let near=0,n=0; ray.far=0.25;
      for(let i=0;i<7;i++) for(let j=0;j<7;j++){ ray.setFromCamera({x:-0.9+i*0.3,y:-0.9+j*0.3},cam); ray.far=0.25; if(firstHit()<0.25) near++; n++; }
      out.push({spot:s.n,human:hx+','+hz,eggHidden,humanIn,near:+(near/n).toFixed(2),cam:[+cam.position.x.toFixed(2),+cam.position.y.toFixed(2),+cam.position.z.toFixed(2)]});
    }
    return out;
  });
  const bad=res.filter(x=>x.eggHidden||x.near>0.3);
  for(const x of res) t.info(`${x.spot} / 人在(${x.human})：${x.eggHidden?'卵鞘看不到':'卵鞘可见'}，${x.humanIn?'人类在画面里':'人类不在画面里'}，近处遮挡 ${Math.round(x.near*100)}%`);
  t.info(`人类在画面里：${res.filter(x=>x.humanIn).length}/${res.length}`);
  t.ok(!bad.length,`${res.length} 个观战场景都看得到卵鞘、画面不被近处遮挡糊住（问题 ${bad.length} 个）`);
  // 截一张最典型的：卵在冰箱底下
  await game.evaluate(()=>{const r=__g.r2,h=__g.HOLES[0];r.phase='play';r.startGen();r.p.x=h.x+0.05;r.p.z=h.z;r.p.spd=0;r.placeEgg();r.killPlayer('crush');});
  await page.waitForTimeout(3400);
  await page.screenshot({path:L.path.join(L.OUT,'watch-fridge.png')});
});
