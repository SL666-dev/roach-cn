// 第二阶段：从第一阶段真实进入 → 产卵 → 成熟 → 死亡/观战 → 各代 → 结局 → 排名 → 重开
const L=require('./lib.cjs');
const phase=game=>game.evaluate(()=>__g.r2.phase);
const gen=game=>game.evaluate(()=>__g.r2.gen);

L.run('第二阶段',{},async(t,{page,cdp})=>{
  const game=await L.openGame(page);
  await L.startFromIntro(page,game);
  await L.autoCloseLetters(page);
  await game.evaluate(()=>{window.__hints=[];const h=document.getElementById('hint');new MutationObserver(()=>{const s=h.textContent;if(s&&__hints[__hints.length-1]!==s)__hints.push(s)}).observe(h,{childList:true,characterData:true,subtree:true});
    window.__eggbar=[];const eb=document.getElementById('eggbar');new MutationObserver(()=>{if(eb.textContent)__eggbar.push(eb.textContent)}).observe(eb,{childList:true,characterData:true,subtree:true});
    window.__gen=[];const gl=document.getElementById('genlabel');new MutationObserver(()=>{if(gl.textContent)__gen.push(gl.innerText.replace(/\n/g,' / '))}).observe(gl,{childList:true,subtree:true});});
  // 第一阶段用拖鞋、平底锅、杀虫剂，再放一次米饭
  for(const k of ['slipper','pan','spray','rice']){ await game.evaluate(k=>__g.r1.selectItem(k),k); await page.mouse.click(640,420); await page.waitForTimeout(400);}
  await game.evaluate(()=>{__g.r1.selectItem('hand');const r=__g.r1.roaches.find(r=>r.state!=='dead');__g.r1.killRoach(r,'hand',r.x,r.z);});
  await game.waitForFunction(()=>document.getElementById('quit').classList.contains('show'),{},{timeout:20000});
  await game.locator('#quit').dispatchEvent('pointerdown');await page.waitForTimeout(200);
  await game.locator('#confirm .stop').dispatchEvent('pointerdown');
  await game.waitForFunction(()=>__g.state==='r2',{},{timeout:5000});
  t.eq(await game.evaluate(()=>__g.r2.weapons.join(',')),'slipper,pan,spray,slipper','第二阶段武器序列来自第一阶段用过的工具');
  t.eq(await game.evaluate(()=>__g.r2.baitKinds.join(',')),'rice','第二阶段陷阱来自第一阶段放过的诱饵');
  await page.waitForTimeout(1500);
  t.ok((await game.evaluate(()=>__gen[0]||'')).includes('人类手持：拖鞋'),'代数标签写明人类手里的武器');
  t.ok((await game.evaluate(()=>document.getElementById('eggbar').textContent)).includes('按住 E 键 2 秒'),'桌面卵鞘条说明按键');
  await L.instrument(game);
  t.info('第 1 代性能',JSON.stringify(await L.measure(game,2000)));

  // 真实按键：W 前进，停下按住 E 产卵
  await page.keyboard.down('KeyW');await page.waitForTimeout(600);await page.keyboard.up('KeyW');await page.waitForTimeout(200);
  await page.keyboard.down('KeyE');await page.waitForTimeout(2300);await page.keyboard.up('KeyE');
  t.ok(await game.evaluate(()=>!!__g.r2.egg||__g.r2.phase!=='play'),'按住 E 2 秒产下卵鞘');
  if(await phase(game)==='play'){
    if(!(await game.evaluate(()=>!!__g.r2.egg))) await game.evaluate(()=>{const r=__g.r2;r.p.spd=0;r.placeEgg();});
    await game.waitForFunction(()=>!__g.ui.hintBusy,{},{timeout:20000});   // 等开局提示放完（真实游玩成熟至少要 32 秒）
    await game.evaluate(()=>{const r=__g.r2;r.egg.t=r.eggT-0.2;});
    await page.waitForTimeout(1500);
    t.ok(await game.evaluate(()=>__g.r2.ready),'卵鞘成熟');
    t.ok((await game.evaluate(()=>__hints)).some(h=>h.includes('下一代也会从这里出生')),'成熟后提示接下来会发生什么');
    t.eq(await gen(game),0,'活着时不自动交接（保持原设计）');
  }

  // 人类出招不累积几何体
  const leak=await game.evaluate(()=>{const r=__g.r2,R=__g.renderer;R.render(__g.scene,__g.camera);const g0=R.info.memory.geometries;
    for(let i=0;i<30;i++){ const A=r.ai; A.state='hunt'; A.rec=0; r.beginStrike(A.x+0.4,A.z+0.3,false); for(let k=0;k<300;k++){ r.updateStrike(1/60); if(k===30)R.render(__g.scene,__g.camera); if(A.state!=='strike')break; } }
    R.render(__g.scene,__g.camera);return {g0,g1:R.info.memory.geometries,children:r.grp.children.length};});
  t.ok(leak.g1-leak.g0<=8,`人类出招 30 次几何体基本不增长（${leak.g0}→${leak.g1}）`);

  // 死于卵成熟前 → 观战（画面必须是正的）→ 孵化 → 下一代
  await game.evaluate(()=>{const r=__g.r2;r.phase='play';r.death=null;r.doneStep=false;r.finished=false;r.deathFX.stop();r.startGen();});
  await page.waitForTimeout(600);
  const g0=await gen(game);
  for(const type of ['crush','poison','flame']){
    await game.evaluate(t=>{const r=__g.r2;r.phase='play';r.death=null;r.doneStep=false;r.finished=false;r.startGen();r.p.spd=0;r.placeEgg();r.killPlayer(t);},type);
    await page.waitForTimeout(3300);
    const s=await game.evaluate(()=>({phase:__g.r2.phase,upY:__g.camera.up.y}));
    t.ok(s.phase==='watch'&&s.upY>0.999,`${type} 死后观战画面是正的（phase=${s.phase}, up.y=${s.upY.toFixed(3)}）`);
  }
  await page.screenshot({path:L.path.join(L.OUT,'round2-watch.png')});
  t.ok((await game.evaluate(()=>__hints)).includes('你死了，但卵鞘还在。守住它，等它孵化。'),'观战提示');
  await game.evaluate(()=>{__g.r2.egg.t=__g.r2.eggT-0.1;});
  await page.waitForTimeout(2000);
  t.eq(await gen(game),g0+1,'观战中卵鞘孵化 → 下一代');
  t.ok((await game.evaluate(()=>__eggbar)).includes('卵鞘孵化了'),'观战时卵鞘条写“卵鞘孵化了”');

  // 一路推进到结局
  for(let i=0;i<10&&await phase(game)!=='leave';i++){
    await game.evaluate(()=>{const r=__g.r2;if(r.phase!=='play')return;r.p.spd=0;r.placeEgg();r.egg.t=r.eggT;r.tickEgg(0.01);r.killPlayer('crush');});
    await page.waitForTimeout(3500);
  }
  t.eq(await phase(game),'leave','所有代数走完后进入“人类离开”结局');
  await game.waitForFunction(()=>__g.state==='rank',{},{timeout:30000});
  const rank=(await game.locator('#rank').innerText()).replace(/\n+/g,' | ');
  t.info('排名页：'+rank);
  t.ok(rank.includes('人类离开了房间'),'结局排名页');
  t.ok(rank.includes('5代 / 共 5 代')&&rank.includes('第 1 名 · 5 代 / 共 5 代 · 已通关'),'排名记录显示“X 代 / 共 Y 代”');
  t.ok(rank.includes('点击屏幕，用同样的条件再来一局'),'排名页再来一局的说明');
  await page.screenshot({path:L.path.join(L.OUT,'rank.png')});

  // 同条件再玩：没产卵就死 → “没有留下卵鞘” → 排名
  await page.waitForTimeout(900);await game.locator('#rank .sub').dispatchEvent('pointerdown');
  await game.waitForFunction(()=>__g.state==='r2');await page.waitForTimeout(600);
  t.eq(await game.evaluate(()=>__g.r2.weapons.join(',')),'slipper,pan,spray,slipper','再玩一次沿用相同条件');
  await game.evaluate(()=>__g.r2.killPlayer('crush'));
  await game.waitForFunction(()=>getComputedStyle(document.getElementById('endtext')).display!=='none',{},{timeout:10000});
  t.eq(await game.locator('#endtext').innerText(),'没有留下卵鞘。','没留卵鞘的结局文字');
  await game.waitForFunction(()=>__g.state==='rank',{},{timeout:10000});

  // 多次重开，内存平稳。先把各种尸体形状都画一遍（第一次画才上传显存，不算泄漏）
  await game.evaluate(()=>{const C=__g.corpses;for(let i=0;i<300;i++)C.add(0,0,0,['crushed','belly','burnt'][i%3]);__g.renderer.render(__g.scene,__g.camera);C.clear();});
  const mem=[];
  for(let i=0;i<4;i++){ await page.waitForTimeout(900); await game.locator('#rank .sub').dispatchEvent('pointerdown'); await game.waitForFunction(()=>__g.state==='r2'); await page.waitForTimeout(400); await game.evaluate(()=>__g.r2.killPlayer('crush')); await game.waitForFunction(()=>__g.state==='rank',{},{timeout:20000}); await L.gc(cdp); mem.push(await game.evaluate(()=>__g.renderer.info.memory.geometries)); }
  t.ok(mem[mem.length-1]-mem[0]<=2,`重开 4 次几何体不增长（${mem.join('→')}）`);
  await page.waitForTimeout(900);await game.locator('#rank .allover').dispatchEvent('pointerdown');
  t.eq(await game.evaluate(()=>__g.state),'r1','“从头开始”回到第一阶段');
});
