// 镊子夹取 → 标本室：来信频率、来信打开时按返回、键盘、翻面/固定针/清理
const L=require('./lib.cjs');

async function capture(page,game){
  await game.getByText('镊子',{exact:true}).click();
  for(let a=0;a<12;a++){
    if(await page.locator('#labLayer').getAttribute('aria-hidden')==='false') return true;
    const p=await game.evaluate(()=>{for(const r of __g.r1.roaches){if(r.state==='dead'||r.state==='poison'||r.gone||!r.m.g.visible||__g.r1.underCushion(r.x,r.z))continue;const v=new __THREE.Vector3(r.x,.035,r.z).project(__g.camera);const x=(v.x*.5+.5)*innerWidth,y=(-v.y*.5+.5)*innerHeight;if(x>100&&x<innerWidth-120&&y>100&&y<innerHeight-100)return{x,y}}});
    if(p) await page.mouse.click(p.x,p.y); await page.waitForTimeout(1300);
  }
  return false;
}
const mailOpen=page=>page.evaluate(()=>{const m=document.querySelector('#mail');return m.classList.contains('show')&&!m.classList.contains('closing')});
const labOpen=async page=>await page.locator('#labLayer').getAttribute('aria-hidden')==='false';

L.run('镊子与标本室',{},async(t,{page,cdp})=>{
  const game=await L.openGame(page);
  await L.startFromIntro(page,game);
  const letters=[];
  for(let i=1;i<=3;i++){
    t.ok(await capture(page,game),`第 ${i} 次夹取进入标本室`);
    await page.waitForTimeout(1200);
    const open=await mailOpen(page);
    letters.push(open);
    if(i===1){
      t.ok(open,'第一次夹取弹出标本室来信');
      t.ok(!!(await page.locator('#mailFactText').innerText()),'来信里带冷知识');
      // 来信开着时按“返回”：信关掉，同时回到游戏
      await page.locator('#labBack').dispatchEvent('pointerdown');
      await page.waitForTimeout(400);
      t.ok(!(await mailOpen(page))&&!(await labOpen(page)),'来信打开时按“返回”会关信并回到游戏');
      t.ok(await capture(page,game),'再次夹取进入标本室');
      await page.waitForTimeout(1200);
      t.ok(!(await mailOpen(page)),'之后的夹取不再弹来信');
      const lab=page.frames().find(f=>f.name()==='labFrame');
      // 键盘：F 翻面、Esc 返回
      const f0=await lab.evaluate(()=>SpecimenLab.specimen.flip.on);
      await page.keyboard.press('KeyF');await page.waitForTimeout(300);
      t.ok(await lab.evaluate(()=>SpecimenLab.specimen.flip.on)!==f0,'F 键翻面');
      await page.keyboard.press('KeyF');await page.waitForTimeout(1200);
      await lab.evaluate(()=>SpecimenLab.debug.pin('head_core'));
      await lab.locator('#flipBtn').click();
      t.eq(await lab.locator('#toast').innerText(),'请先拔出固定针','有固定针时不能翻面');
      await lab.locator('#unpinBtn').click();
      t.eq(await lab.locator('#toast').innerText(),'已拔出所有固定针','拔出所有固定针');
      const r=await lab.evaluate(()=>{const leg=[...SpecimenLab.specimen.parts.values()].find(p=>/胫节/.test(p.label));return SpecimenLab.debug.detach(leg.id,0.9)});
      t.ok(r.detachedPartIds.length>0,'能拉下腿');
      await page.screenshot({path:L.path.join(L.OUT,'lab.png')});
      await L.throttle(cdp,4);
      const perf=await lab.evaluate(async()=>{const a=[];let l=performance.now();await new Promise(res=>{let n=0;const f=()=>{const x=performance.now();a.push(x-l);l=x;if(++n<120)requestAnimationFrame(f);else res()};requestAnimationFrame(f)});return +(a.reduce((x,y)=>x+y)/a.length).toFixed(2)});
      await L.throttle(cdp,1);
      t.info(`标本室帧间隔（CPU 降速 4 倍）${perf}ms`);
      await page.keyboard.press('Escape');await page.waitForTimeout(400);
      t.ok(!(await labOpen(page)),'Esc 返回游戏');
    }else{
      t.ok(!open,`第 ${i+1} 次夹取不弹来信`);
      await page.locator('#labBack').dispatchEvent('pointerdown');await page.waitForTimeout(400);
    }
    t.eq(await game.evaluate(()=>`${__g.state}/${__g.paused}/${__g.sleep}`),'r1/false/false','返回后游戏继续');
  }
});
