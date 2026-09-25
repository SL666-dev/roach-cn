// 各种屏幕尺寸：开场“开始”按钮可点、手机竖屏提示不压小地图、触屏文案、调试入口
const L=require('./lib.cjs');
const overlap=(a,b)=>a&&b&&a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;

(async()=>{
  for(const vp of [{width:844,height:390},{width:667,height:375},{width:390,height:844},{width:1366,height:650}]){
    const mobile=vp.width<1000;
    await L.run(`开场页 ${vp.width}×${vp.height}`,{viewport:vp,touch:mobile,mobile,dpr:mobile?2:1},async(t,{page})=>{
      const game=await L.openGame(page);
      await page.waitForTimeout(600);
      const tap=mobile?(sel)=>page.locator(sel).tap({timeout:5000}):(sel)=>page.locator(sel).click({timeout:5000});
      t.eq(await page.locator('#intro .tag').innerText(),'脱敏小练习','开场标签');
      await tap('#intro');
      await page.waitForTimeout(300);
      const b=await page.evaluate(()=>{const r=document.getElementById('introGo').getBoundingClientRect();return {bottom:r.bottom,vh:innerHeight}});
      t.ok(b.bottom<=b.vh+1,`“开始”按钮在屏幕内（底边 ${Math.round(b.bottom)} / 屏高 ${b.vh}）`);
      if(b.bottom>b.vh+1){ await page.locator('#introGo').scrollIntoViewIfNeeded().catch(()=>{}); }
      await tap('#introGo');
      await game.waitForFunction(()=>__g.state==='r1'&&!__g.r1.intro,{},{timeout:10000});
      t.ok(true,'点“开始”进入游戏');
      if(mobile){
        await page.waitForTimeout(500);
        const hints=await game.evaluate(()=>document.getElementById('hint').textContent);
        await page.screenshot({path:L.path.join(L.OUT,`layout-${vp.width}x${vp.height}-r1.png`)});
        await game.evaluate(()=>{const r=__g.r1.roaches.find(r=>r.state!=='dead');__g.r1.killRoach(r,'hand',r.x,r.z);__g.toRound2();});
        await game.waitForFunction(()=>__g.state==='r2');await page.waitForTimeout(1500);
        t.ok((await game.evaluate(()=>document.getElementById('eggbar').textContent)).includes('按住「产卵」2 秒'),'触屏卵鞘条说明怎么操作');
        await game.evaluate(()=>__g.ui.hint('即使蟑螂死了，只要卵鞘还在，下一代就能延续下去。',5,0));
        await page.waitForTimeout(3000);
        const box=await game.evaluate(()=>{const q=id=>{const e=document.getElementById(id);if(getComputedStyle(e).display==='none'||getComputedStyle(e).opacity==='0')return null;const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {mini:q('mini'),hint:q('hint'),egg:q('eggbar')}});
        t.ok(!overlap(box.mini,box.hint),'提示框不压小地图');
        t.ok(!overlap(box.mini,box.egg),'卵鞘条不压小地图');
        await page.screenshot({path:L.path.join(L.OUT,`layout-${vp.width}x${vp.height}-r2.png`)});
      }
    });
  }
  await L.run('调试入口 ?r=2',{},async(t,{page})=>{
    const game=await L.openGame(page,'?r=2&w=slipper');
    await page.waitForTimeout(800);
    t.eq(await page.evaluate(()=>getComputedStyle(document.getElementById('intro')).display),'none','带 r 参数时不显示开场遮罩');
    t.eq(await game.evaluate(()=>__g.state),'r2','直接进入第二阶段');
  });
})();
