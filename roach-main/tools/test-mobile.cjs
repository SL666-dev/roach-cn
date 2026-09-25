// 移动端模拟：手机横屏视口 + 触屏 + CPU 降速 4 倍，记录各场景的 draw call、三角形和每帧耗时并截图；另测多指操作和横竖屏切换。
// GPU 仍是本机显卡，所以只看 JS 端耗时和 draw call / 三角形；真机帧率用 ?debug 面板看。
// 结果写到 out/mobile-<设备>.json；把某次结果复制成 out/mobile-<设备>.base.json 当基线，之后每次运行会打印对比。
const L=require('./lib.cjs');

const DEVICES=[
  {name:'android',viewport:{width:915,height:412},dpr:2.625},
  {name:'iphone',viewport:{width:844,height:390},dpr:3},
];
const touch=(cdp,type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y,id])=>({x,y,id}))});
const pct=(a,b)=>b?`${a>=b?'+':''}${((a-b)/b*100).toFixed(0)}%`:'';

(async()=>{
  for(const dev of DEVICES){
    await L.run(`移动端 ${dev.name} ${dev.viewport.width}×${dev.viewport.height}`,{viewport:dev.viewport,touch:true,mobile:true,dpr:dev.dpr},async(t,{page,cdp})=>{
      const game=await L.openGame(page);
      await L.startFromIntro(page,game);
      await L.autoCloseLetters(page);
      await L.instrument(game);
      const quality=await game.evaluate(()=>{const R=__g.renderer,c=R.domElement;return {pr:R.getPixelRatio(),buf:[c.width,c.height],css:[innerWidth,innerHeight],shadowType:R.shadowMap.type,sm:__g.sun.shadow.mapSize.x,paint:[__g.paint.W,__g.paint.H],corpseCap:__g.corpses.cap,q:__g.quality||null};});
      t.info('画质',JSON.stringify(quality));
      t.ok(quality.pr<=1.5,`像素比不超过 1.5（实际 ${quality.pr}）`);
      t.ok(Math.abs(quality.buf[0]-Math.round(quality.css[0]*quality.pr))<=1,'绘制尺寸 = 视口 × 像素比');

      const result={device:dev.name,quality,scenes:{}};
      const scene=async(key,label)=>{
        await page.waitForTimeout(400);
        const a=await L.measure(game,1500);
        await L.throttle(cdp,4);
        const b=await L.measure(game,2500);
        await page.screenshot({path:L.path.join(L.OUT,`mobile-${dev.name}-${key}.png`)});
        await L.throttle(cdp,1);
        const s={calls:a.calls,tris:a.tris,fps4x:b.fps,update4x:b.update&&b.update.avg,render4x:b.render&&b.render.avg,roaches:a.roaches,nymphs:a.nymphs,npcs:a.npcs,corpses:a.corpses};
        result.scenes[key]=s;
        t.info(`${label}：draw call ${s.calls}，三角形 ${(s.tris/1e4).toFixed(1)} 万，降速 4 倍 渲染 ${s.render4x}ms / 逻辑 ${s.update4x}ms / ${s.fps4x}fps`);
        return s;
      };

      await scene('r1-start','第一阶段开局');
      await game.evaluate(()=>{const r1=__g.r1;while(r1.roaches.filter(r=>r.state!=='dead').length<40) r1.spawn(true); for(let i=0;i<18;i++) r1.spawnNymph(r1.cam.x,r1.cam.z,i);});
      await scene('r1-peak','第一阶段高峰 40 成虫 + 18 若虫');
      await game.evaluate(()=>{const r1=__g.r1;for(const r of r1.roaches.slice()) if(r.state!=='dead') r1.killRoach(r,'slipper',r.x,r.z);});
      for(let k=0;k<2;k++){ await game.evaluate(()=>{const r1=__g.r1;for(let i=0;i<300;i++){const r=r1.spawn(true);r1.killRoach(r,['hand','slipper','flame','spray'][i%4],r.x,r.z);}}); await page.waitForTimeout(1500); }
      const cs=await scene('r1-corpses','第一阶段打死 600 只后');
      t.ok(cs.corpses<=quality.corpseCap,`尸体不超过上限（${cs.corpses} / ${quality.corpseCap}）`);

      // 双指拖动画面：画面要移动；不该打出工具（记录拖动期间落地的打击和放下的诱饵）
      await game.evaluate(()=>{__g.corpses.clear();const r1=__g.r1;r1.selectItem('slipper');window.__hits=0;for(const k of ['impact','placeBait']){const f=r1[k].bind(r1);r1[k]=(...a)=>{__hits++;return f(...a);};}});
      const cam0=await game.evaluate(()=>({x:__g.r1.cam.x,z:__g.r1.cam.z}));
      const [W,H]=[dev.viewport.width,dev.viewport.height];
      await touch(cdp,'touchStart',[[W*0.42,H*0.5,1]]);
      await page.waitForTimeout(30);
      await touch(cdp,'touchStart',[[W*0.42,H*0.5,1],[W*0.55,H*0.5,2]]);
      for(let i=1;i<=8;i++){ await touch(cdp,'touchMove',[[W*0.42-i*12,H*0.5,1],[W*0.55-i*12,H*0.5,2]]); await page.waitForTimeout(16); }
      await touch(cdp,'touchEnd',[]);
      await page.waitForTimeout(400);
      const pan=await game.evaluate(c=>({moved:Math.hypot(__g.r1.cam.x-c.x,__g.r1.cam.z-c.z),hits:__hits}),cam0);
      t.ok(pan.moved>0.05,`双指拖动移动画面（${pan.moved.toFixed(3)} 米）`);
      result.panHits=pan.hits;
      t.info(`双指拖动期间误打出 ${pan.hits} 次工具`);

      // 第二阶段：左手摇杆 + 右手转视角同时进行
      await game.evaluate(()=>__g.toRound2());
      await game.waitForFunction(()=>__g.state==='r2'&&__g.input.mode==='r2');
      await page.waitForTimeout(2500);
      const yaw0=await game.evaluate(()=>__g.r2.camYaw);
      await touch(cdp,'touchStart',[[W*0.2,H*0.7,1]]);
      await touch(cdp,'touchStart',[[W*0.2,H*0.7,1],[W*0.7,H*0.4,2]]);
      for(let i=1;i<=6;i++){ await touch(cdp,'touchMove',[[W*0.2,H*0.7-i*8,1],[W*0.7+i*15,H*0.4,2]]); await page.waitForTimeout(30); }
      const both=await game.evaluate(()=>({stick:__g.input.stick.active,vy:__g.input.stick.vy,look:__g.input.lookOn,n:__g.input.pointers.size}));
      await page.waitForTimeout(200);
      const yaw1=await game.evaluate(()=>__g.r2.camYaw);
      await touch(cdp,'touchEnd',[]);
      t.ok(both.n===2&&both.stick&&both.vy<0&&both.look,`摇杆和转视角同时生效（${JSON.stringify(both)}）`);
      t.ok(Math.abs(yaw1-yaw0)>0.01,`右手拖动转了视角（${(yaw1-yaw0).toFixed(3)}）`);
      await page.waitForTimeout(300);
      t.ok(await game.evaluate(()=>!__g.input.stick.active&&__g.input.pointers.size===0),'松手后摇杆复位');

      await game.evaluate(()=>{const r2=__g.r2;r2.gen=7;while(r2.npcs.length<30) r2.addNpc(0);for(const n of r2.npcs) n.t=0;});
      await page.waitForTimeout(3000);
      await scene('r2-npc','第二阶段 30 只 NPC');

      // 横竖屏切换：渲染尺寸跟着变，摇杆回到屏幕内
      await page.setViewportSize({width:H,height:W});
      await page.waitForTimeout(600);
      const por=await game.evaluate(()=>{const R=__g.renderer,c=R.domElement,s=document.getElementById('stick').getBoundingClientRect();return {buf:[c.width,c.height],pr:R.getPixelRatio(),css:[innerWidth,innerHeight],portrait:__g.portrait,stick:[s.left,s.top,s.right,s.bottom]};});
      await page.screenshot({path:L.path.join(L.OUT,`mobile-${dev.name}-portrait.png`)});
      t.ok(por.portrait&&Math.abs(por.buf[1]-Math.round(por.css[1]*por.pr))<=1,`切到竖屏后绘制尺寸跟着变（${por.buf.join('×')}）`);
      await page.setViewportSize(dev.viewport);
      await page.waitForTimeout(600);
      const land=await game.evaluate(()=>{const R=__g.renderer,c=R.domElement,s=document.getElementById('stick').getBoundingClientRect();return {buf:[c.width,c.height],portrait:__g.portrait,stick:[s.left,s.top,s.right,s.bottom],css:[innerWidth,innerHeight]};});
      t.ok(!land.portrait&&land.stick[3]<=land.css[1]&&land.stick[0]>=0,`切回横屏后摇杆在屏幕内（${land.stick.map(Math.round).join(',')}）`);

      await game.evaluate(()=>{__g.setLighting('empty');__g.r2.spawnSwarm();});
      await scene('r2-swarm','结尾蟑螂潮 150 只');

      L.fs.writeFileSync(L.path.join(L.OUT,`mobile-${dev.name}.json`),JSON.stringify(result,null,1));
      const baseFile=L.path.join(L.OUT,`mobile-${dev.name}.base.json`);
      if(L.fs.existsSync(baseFile)){
        const base=JSON.parse(L.fs.readFileSync(baseFile,'utf8'));
        t.info('与基线对比：');
        for(const [k,s] of Object.entries(result.scenes)){ const b=base.scenes[k]; if(!b) continue;
          t.info(`  ${k}：draw call ${b.calls}→${s.calls}（${pct(s.calls,b.calls)}），三角形 ${(b.tris/1e4).toFixed(0)}→${(s.tris/1e4).toFixed(0)} 万（${pct(s.tris,b.tris)}），降速 4 倍渲染 ${b.render4x}→${s.render4x}ms`); }
      }
    });
  }
})();
