// 死亡来信间隔：第一封之后至少 90 秒才会有下一封（真实计时，约 70 秒）
const L=require('./lib.cjs');

L.run('来信频率',{},async(t,{page})=>{
  const game=await L.openGame(page);
  await L.startFromIntro(page,game);
  await L.autoCloseLetters(page);
  const burst=()=>game.evaluate(()=>{const r1=__g.r1;for(const r of r1.roaches.filter(r=>r.state!=='dead'&&!r.gone).slice(0,3)) r1.killRoach(r,'slipper',r.x,r.z);});
  const deaths=()=>page.evaluate(()=>__mails.filter(m=>m.includes('爱')).length);
  const t0=Date.now();
  while(!(await deaths())&&Date.now()-t0<20000){ await burst(); await page.waitForTimeout(700); }
  t.eq(await deaths(),1,'连续击杀后出现第一封死亡来信');
  t.eq(await page.evaluate(()=>__mails.find(m=>m.includes('爱'))),'即便如此，/爱还是会赢的','死亡来信文案');
  const t1=Date.now();
  while(Date.now()-t1<65000){ await burst(); await page.waitForTimeout(1500); }
  t.eq(await deaths(),1,'之后 65 秒内持续成批击杀，不再弹第二封');
});
