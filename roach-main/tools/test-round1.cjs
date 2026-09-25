// 第一阶段：真实点击、工具、按键、滚轮、提示文字、卵鞘资源释放
const L=require('./lib.cjs');

// 屏幕上可点的活蟑螂
const targets=game=>game.evaluate(()=>{
  const out=[];for(const r of __g.r1.roaches){ if(r.state==='dead'||r.state==='poison'||r.gone||!r.m.g.visible||__g.r1.underCushion(r.x,r.z)) continue;
    const p=new __THREE.Vector3(r.x,.02,r.z).project(__g.camera);const x=(p.x*.5+.5)*innerWidth,y=(-p.y*.5+.5)*innerHeight;
    if(x>90&&x<innerWidth-90&&y>60&&y<innerHeight-60) out.push({x,y});}
  return out;});

L.run('第一阶段',{},async(t,{page})=>{
  const game=await L.openGame(page);
  await game.evaluate(()=>{window.__hints=[];const h=document.getElementById('hint');new MutationObserver(()=>{const s=h.textContent;if(s&&__hints[__hints.length-1]!==s)__hints.push(s)}).observe(h,{childList:true,characterData:true,subtree:true});});
  await L.startFromIntro(page,game);
  await L.autoCloseLetters(page);
  await page.mouse.move(640,400);
  await page.waitForTimeout(3000);

  // 徒手真实点击
  let clicks=0,hits=0;const t0=Date.now();
  while(Date.now()-t0<12000){
    const ts=await targets(game); if(!ts.length){await page.waitForTimeout(200);continue;}
    const k0=await game.evaluate(()=>__g.r1.kills);const p=ts[Math.floor(Math.random()*ts.length)];
    await page.mouse.click(p.x,p.y);clicks++;await page.waitForTimeout(250);
    if(await game.evaluate(()=>__g.r1.kills)>k0) hits++;
  }
  t.info(`徒手点击 ${clicks} 次，命中 ${hits} 次`);
  t.ok(hits>0&&hits/clicks>0.6,'徒手点击能打死蟑螂');

  // 提示文字跟随实际输入设备（本机触控板会让 maxTouchPoints>0）
  const hints=await game.evaluate(()=>__hints);
  t.ok(hints.some(h=>h.includes('空格 + 左键拖动')),'鼠标操作时显示键鼠提示');
  t.ok(!hints.some(h=>h.includes('双指拖动')),'鼠标操作时不显示触屏提示');

  // 数字键与屏幕上的按钮顺序一致，按钮上有快捷键角标
  const slots=await game.evaluate(()=>[...document.querySelectorAll('#wcol .slot, #bcol .slot')].map(e=>({name:e.textContent,key:e.dataset.key||''})));
  t.info('按钮/快捷键:',slots.map(s=>s.name+(s.key?`[${s.key}]`:'')).join(' '));
  const codes={'1':'Digit1','2':'Digit2','3':'Digit3','4':'Digit4','5':'Digit5','6':'Digit6','7':'Digit7','8':'Digit8','9':'Digit9','0':'Digit0','-':'Minus','=':'Equal'};
  let keysOk=slots.every(s=>s.key);
  for(const s of slots){ if(!codes[s.key]) continue; await page.keyboard.press(codes[s.key]); const item=await game.evaluate(()=>__g.r1.item); const sel=await game.evaluate(()=>document.querySelector('.slot.sel')?.textContent); if(sel!==s.name){ keysOk=false; t.info(`按 ${s.key} 选中了 ${sel}(${item})，期望 ${s.name}`);} }
  t.ok(keysOk,'每个按钮都有快捷键，且按键选中的就是对应按钮');
  await page.keyboard.press('KeyT');
  t.eq(await game.evaluate(()=>__g.r1.item),'tweezer','T 键仍可选镊子');
  await page.keyboard.press('Digit1');

  // 滚轮：触控板一次轻滑的一串小增量不应连跳多个工具；鼠标滚一格切一个
  await page.mouse.move(640,400);
  for(let i=0;i<12;i++) await page.mouse.wheel(0,4);
  await page.waitForTimeout(100);
  t.eq(await game.evaluate(()=>__g.r1.item),'hand','触控板小幅滚动（12×4px）不切换工具');
  await page.mouse.wheel(0,100); await page.waitForTimeout(100);
  const after1=await game.evaluate(()=>document.querySelector('.slot.sel')?.textContent);
  t.eq(after1,slots[1].name,'鼠标滚一格切到下一个按钮');
  await page.waitForTimeout(300);
  for(let i=0;i<8;i++) await page.mouse.wheel(0,100);
  await page.waitForTimeout(100);
  const idx=await game.evaluate(()=>[...document.querySelectorAll('#wcol .slot, #bcol .slot')].findIndex(e=>e.classList.contains('sel')));
  t.ok(idx>=1&&idx<=3,`快速连滚 8 格只前进 1～2 个（实际到第 ${idx+1} 个）`);
  await page.keyboard.press('Digit1');

  // 长按类工具松手后不残留
  for(const k of ['spray','flame','vacuum']){
    await game.evaluate(k=>__g.r1.selectItem(k),k);
    await page.mouse.move(560,400);await page.mouse.down();
    for(let i=0;i<10;i++){await page.mouse.move(560+i*12,400+Math.sin(i)*20);await page.waitForTimeout(50);}
    await page.mouse.up();await page.waitForTimeout(200);
    t.ok(!(await game.evaluate(()=>!!__g.r1.hold)),`${k} 松手后停止`);
  }
  await game.evaluate(()=>__g.r1.selectItem('hand'));

  // 卵鞘被打碎/孵化时不能释放共享的几何体和材质
  const disposed=await game.evaluate(()=>{
    const r1=__g.r1;let n=0;
    for(let i=0;i<3;i++){ r1.spawnOotheca(r1.cam.x,r1.cam.z,0); const o=r1.oothecae[r1.oothecae.length-1];
      o.mesh.traverse(m=>{ if(m.isMesh){ m.geometry.addEventListener('dispose',()=>n++); m.material.addEventListener('dispose',()=>n++);} });
      i<2?r1.destroyOotheca(o):r1.hatchOotheca(o); }
    return n;});
  t.eq(disposed,0,'卵鞘消失时不释放共享资源');
  await page.screenshot({path:L.path.join(L.OUT,'round1.png')});
});
