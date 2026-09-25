const {chromium}=require(process.env.PLAYWRIGHT_PATH);
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:800},offline:true});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure().errorText));
 const root=path.resolve(__dirname,'..');
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);
 await page.waitForFunction(()=>document.querySelector('#gameFrame').contentWindow.__g?.r1?.roaches?.length>0,{},{timeout:30000});
 console.log('Offline index game connected');
 await page.locator('#intro').click();
 await page.locator('#introGo').click();
 await page.waitForTimeout(1000);
 const game=page.frames().find(f=>f.name()==='gameFrame');
 console.log('Game UI:',await game.locator('#wcol').innerText());
 await page.screenshot({path:path.join(root,'tools/check-game.png')});
 console.log('Frames',page.frames().map(f=>({name:f.name(),url:f.url()})));
 await game.getByText('镊子',{exact:true}).click();
 await page.waitForFunction(()=>!!document.querySelector('#labFrame').contentWindow.SpecimenLab,{},{timeout:30000});
 console.log('Lab preloaded');
 for(let attempt=0;attempt<8;attempt++){
  if(await page.locator('#labLayer').getAttribute('aria-hidden')==='false')break;
  const point=await game.evaluate(()=>{
   for(const r of __g.r1.roaches){
    if(r.state==='dead'||r.state==='poison'||!r.m.g.visible||__g.r1.underCushion(r.x,r.z))continue;
    const p=new __THREE.Vector3(r.x,.035,r.z).project(__g.camera);
    const x=(p.x*.5+.5)*innerWidth,y=(-p.y*.5+.5)*innerHeight;
    if(x>100&&x<innerWidth-120&&y>120&&y<innerHeight-100)return {x,y};
   }
  });
  if(point)await page.mouse.click(point.x,point.y);
  await page.waitForTimeout(1200);
 }
 await page.waitForFunction(()=>document.querySelector('#labLayer').classList.contains('open'));
 await page.locator('#mailOk').click();
 await page.waitForTimeout(400);
 const lab=page.frames().find(f=>f.name()==='labFrame');
 await lab.locator('#flipBtn').click();
 assert.equal(await lab.locator('#flipBtn').innerText(),'翻回正面');
 await page.waitForTimeout(1200);
 await lab.locator('#flipBtn').click();
 await page.waitForTimeout(1200);
 await lab.evaluate(()=>SpecimenLab.debug.pin('head_core'));
 await lab.locator('#flipBtn').click();
 assert.equal(await lab.locator('#toast').innerText(),'请先拔出固定针');
 await lab.locator('#unpinBtn').click();
 assert.equal(await lab.locator('#toast').innerText(),'已拔出所有固定针');
 await lab.locator('#wipeBtn').click();
 assert.equal(await lab.locator('#wipeBtn').innerText(),'再点一次确认清理');
 await lab.locator('#wipeBtn').click();
 assert.equal(await lab.locator('#toast').innerText(),'已清理操作台，并换上一只新蟑螂');
 await page.screenshot({path:path.join(root,'tools/check-lab.png')});
 await page.locator('#labBack').click();
 assert.equal(await page.locator('#labLayer').getAttribute('aria-hidden'),'true');
 assert.equal(await game.evaluate(()=>__g.sleep),false);
 await game.getByText('镊子',{exact:true}).click();
 console.log('Capture -> lab -> flip/pin/unpin/clear -> return passed');
 await game.evaluate(()=>__g.toRound2());
 await game.waitForFunction(()=>__g.state==='r2');
 assert.equal(await game.locator('#egg').innerText(),'产卵');
 await game.evaluate(()=>__g.showRank(2,false));
 console.log('Rank:',await game.locator('#rank').innerText());
 assert.equal(await game.evaluate(()=>JSON.parse(localStorage.getItem('roach_gens'))[0].g),2);
 await page.waitForTimeout(1500);
 await game.locator('.allover').click();
 await game.waitForFunction(()=>__g.state==='r1');
 for(const name of ['game.html','specimen-lab.html']){
  await page.goto(pathToFileURL(path.join(root,name)).href);
  await page.waitForFunction(()=>!!(window.__g||window.SpecimenLab));
  assert(!/[가-힣]/.test(await page.locator('body').innerText()));
  console.log('Offline standalone',name,'passed');
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);
 await page.waitForFunction(()=>!!document.querySelector('#gameFrame').contentWindow.__g);
 await page.locator('#intro').click();
 await page.waitForTimeout(800);
 await page.screenshot({path:path.join(root,'tools/check-mobile.png')});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // Also check normal HTTP iframe navigation without srcdoc.
 const server=require('node:http').createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 await context.setOffline(false);
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?r=2&pause=1');
 await page.waitForFunction(()=>document.querySelector('#gameFrame').contentWindow.__g?.state==='r2');
 console.log('HTTP iframe and forwarded round/pause parameters passed');
 await page.goto('about:blank');
 await new Promise(resolve=>server.close(resolve));
 fs.writeFileSync(path.join(root,'tools/check-errors.json'),JSON.stringify(errors,null,2));
 console.log('ERRORS',errors);
 assert.deepEqual(errors,[]);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
