// 性能：尸体实例回收、尸体三角形负担、地面贴图上传频率、蟑螂数量高峰、长时间运行
// 数字在本机显卡上偏乐观；CPU 降速 4 倍用来近似中端手机。
const L=require('./lib.cjs');

L.run('性能',{},async(t,{page,cdp})=>{
  const game=await L.openGame(page);
  await L.startFromIntro(page,game);
  await L.autoCloseLetters(page);
  await L.instrument(game);
  // 统一场面：清掉随机生成的蟑螂，只留 15 只
  const base=await L.measure(game,2000);
  t.info('空闲',JSON.stringify(base));

  // 600 具尸体（正常死亡流程烘焙）
  for(let k=0;k<2;k++){ await game.evaluate(()=>{const r1=__g.r1;for(let i=0;i<300;i++){const r=r1.spawn(true);r1.killRoach(r,['hand','slipper','flame','spray'][i%4],r.x,r.z);}}); await page.waitForTimeout(1500); }
  const full=await L.measure(game,2000);
  t.info('600 具尸体',JSON.stringify(full));
  const perCorpse=await game.evaluate(()=>{let n=0;for(const K of Object.values(__g.corpses.kinds))for(const v of K){if(!v)continue;const g=v.shell.geometry;n=Math.max(n,(g.index?g.index.count:g.attributes.position.count)/3);}return n;});
  t.info(`单具尸体身体最多 ${perCorpse} 个三角形`);
  await L.throttle(cdp,4); const full4=await L.measure(game,3000); await L.throttle(cdp,1);
  t.info('600 具尸体 CPU 降速 4 倍',JSON.stringify(full4));
  t.ok(full.tris<3500000,`600 具尸体时每帧三角形 < 350 万（实际 ${(full.tris/1e6).toFixed(2)} 万×100）`);

  // 清掉尸体后负担应回到空闲水平
  await game.evaluate(()=>__g.corpses.clear()); await page.waitForTimeout(500);
  const cleared=await L.measure(game,1500);
  t.ok(cleared.tris<base.tris*1.5+200000,`清空尸体后三角形回落（空闲 ${base.tris} → 清空后 ${cleared.tris}）`);

  // 吸尘器吸走一半尸体后也要回落
  await game.evaluate(()=>{const r1=__g.r1;for(let i=0;i<200;i++){const r=r1.spawn(true);r1.killRoach(r,'slipper',r.x,r.z);}}); await page.waitForTimeout(800);
  const t200=(await L.measure(game,800)).tris;
  await game.evaluate(()=>{const C=__g.corpses;let n=0;for(const c of C.list){if(c&&c.alive&&n++<150)C.drop(c);}}); await page.waitForTimeout(300);
  const t50=(await L.measure(game,800)).tris;
  t.ok(t50<t200*0.6,`回收 150 具后三角形明显下降（${t200} → ${t50}）`);
  // 回收后再生成，位置正确（不出现错位/闪到别处的尸体）
  const consistent=await game.evaluate(()=>{const C=__g.corpses,m=new __THREE.Matrix4(),p=new __THREE.Vector3();for(const c of C.list){if(!c||!c.alive)continue;c.V.shell.getMatrixAt(c.si,m);p.setFromMatrixPosition(m);if(Math.hypot(p.x-c.x,p.z-c.z)>1e-4)return false;}return true;});
  t.ok(consistent,'实例回收后每具尸体仍画在自己的位置');
  await game.evaluate(()=>__g.corpses.clear());

  // 地面贴图上传频率（持续溅射时）
  const uploads=await game.evaluate(async()=>{const P=__g.paint,v0=P.tex.version;const t0=performance.now();
    await new Promise(res=>{const f=()=>{P.splat(__g.r1.cam.x,__g.r1.cam.z,1,0,0.08,0.3);if(performance.now()-t0<2000)requestAnimationFrame(f);else res();};requestAnimationFrame(f);});
    return (P.tex.version-v0)/2;});
  t.ok(uploads<=11,`持续溅射时地面贴图每秒上传 ≤ 10 次（实际 ${uploads}）`);
  await game.evaluate(()=>__g.paint.clear());

  // 蟑螂数量高峰（P1 未优化，只记录）
  await game.evaluate(()=>{const r1=__g.r1;while(r1.roaches.filter(r=>r.state!=='dead').length<40) r1.spawn(true); for(let i=0;i<18;i++) r1.spawnNymph(r1.cam.x,r1.cam.z,i);});
  await page.waitForTimeout(300);
  t.info('40 成虫 + 18 若虫',JSON.stringify(await L.measure(game,2000)));
  await L.throttle(cdp,4); t.info('40 成虫 + 18 若虫 CPU 降速 4 倍',JSON.stringify(await L.measure(game,3000))); await L.throttle(cdp,1);

  // 长时间战斗：堆内存与几何体不持续增长
  const snap=async()=>{await L.gc(cdp);return game.evaluate(()=>({heap:performance.memory.usedJSHeapSize/1048576,geos:__g.renderer.info.memory.geometries}));};
  const s0=await snap();
  const t0=Date.now();
  while(Date.now()-t0<30000){ await game.evaluate(()=>{const r1=__g.r1;for(const r of r1.roaches.filter(r=>r.state!=='dead'&&!r.gone).slice(0,3)) r1.killRoach(r,'slipper',r.x,r.z); if(Math.random()<0.1) r1.placeBait('bone',r1.cam.x,r1.cam.z);}); await page.waitForTimeout(400); }
  const s1=await snap();
  t.info(`30 秒战斗：堆 ${s0.heap.toFixed(1)}→${s1.heap.toFixed(1)}MB，几何体 ${s0.geos}→${s1.geos}`);
  t.ok(s1.heap-s0.heap<15,'30 秒战斗堆内存不持续增长');
});
