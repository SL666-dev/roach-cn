// 实测脚本公共部分：启动本机 Chrome、打开游戏、插桩测性能。
// 依赖 playwright-core：在 tools 目录执行 npm install，或用 PLAYWRIGHT_PATH 指向已有的 playwright(-core)。
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright-core');

const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(__dirname,'out');
fs.mkdirSync(OUT,{recursive:true});
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function launch(opts={}){
  const browser=await chromium.launch({executablePath:CHROME,headless:true,args:['--enable-precise-memory-info']});
  const context=await browser.newContext({viewport:opts.viewport||{width:1280,height:800},hasTouch:!!opts.touch,isMobile:!!opts.mobile,deviceScaleFactor:opts.dpr||1,offline:opts.offline!==false});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
  page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure().errorText));
  const cdp=await context.newCDPSession(page);
  return {browser,context,page,errors,cdp};
}
const fileUrl=(name,query='')=>pathToFileURL(path.join(ROOT,name)).href+query;
async function openGame(page,query=''){
  await page.goto(fileUrl('index.html',query));
  await page.waitForFunction(()=>document.querySelector('#gameFrame').contentWindow.__g?.ui?.slotEls?.tweezer,{},{timeout:30000});
  return page.frames().find(f=>f.name()==='gameFrame');
}
async function startFromIntro(page,game){
  await page.locator('#intro').click();
  await page.locator('#introGo').click();
  await game.waitForFunction(()=>__g.state==='r1'&&!__g.r1.intro,{},{timeout:10000});
}
// 来信自动点“知道了”，并记下每封信的正文
async function autoCloseLetters(page){
  await page.evaluate(()=>{window.__mails=[];setInterval(()=>{const m=document.querySelector('#mail');if(m.classList.contains('open')&&!m.classList.contains('closing')){__mails.push(document.querySelector('#mailBody').innerText.replace(/\n/g,'/'));document.querySelector('#mailOk').click();}},200);});
}
// 记录 update/render 耗时和 rAF 间隔
async function instrument(frame){
  await frame.evaluate(()=>{
    if(window.__perf) return;
    const P=window.__perf={on:false,upd:[],ren:[],gap:[],last:0};
    const R=__g.renderer, ren=R.render.bind(R);
    R.render=(s,c)=>{const t=performance.now();ren(s,c);if(P.on)P.ren.push(performance.now()-t)};
    for(const k of ['r1','r2']){const o=__g[k], u=o.update.bind(o); o.update=function(dt){const t=performance.now();const r=u(dt);if(P.on)P.upd.push(performance.now()-t);return r}}
    const loop=()=>{const t=performance.now();if(P.on&&P.last)P.gap.push(t-P.last);P.last=t;requestAnimationFrame(loop)};requestAnimationFrame(loop);
  });
}
async function measure(frame,ms){
  await frame.evaluate(()=>{const P=__perf;P.upd=[];P.ren=[];P.gap=[];P.last=0;P.on=true});
  await frame.page().waitForTimeout(ms);
  return frame.evaluate(()=>{
    const P=__perf;P.on=false;
    const st=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return {avg:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2),p95:+s[Math.floor(s.length*.95)].toFixed(2)}};
    const I=__g.renderer.info;
    return {fps:P.gap.length?+(1000/(P.gap.reduce((a,b)=>a+b,0)/P.gap.length)).toFixed(1):0,update:st(P.upd),render:st(P.ren),
      calls:I.render.calls,tris:I.render.triangles,geos:I.memory.geometries,
      heapMB:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(1):null,
      roaches:__g.r1.roaches.length,nymphs:__g.r1.nymphs.length,npcs:__g.r2.npcs.length,corpses:__g.corpses.list.filter(c=>c&&c.alive).length};
  });
}
const gc=cdp=>cdp.send('HeapProfiler.collectGarbage').catch(()=>{});
const throttle=(cdp,rate)=>cdp.send('Emulation.setCPUThrottlingRate',{rate});

// 极简断言/汇总
function suite(name){
  const fails=[];
  const t={
    ok(cond,msg){ console.log((cond?'  ✓ ':'  ✗ ')+msg); if(!cond) fails.push(msg); },
    eq(a,b,msg){ t.ok(a===b,`${msg}（实际 ${JSON.stringify(a)}，期望 ${JSON.stringify(b)}）`); },
    info(...a){ console.log('  ·',...a); },
    done(errors=[]){ t.ok(!errors.length,'无脚本错误'+(errors.length?'：'+errors.join(' | '):'')); console.log(fails.length?`✗ ${name}：${fails.length} 项失败`:`✓ ${name}`); if(fails.length) process.exitCode=1; }
  };
  console.log('▶ '+name);
  return t;
}
async function run(name,opts,fn){
  const t=suite(name);
  const env=await launch(opts);
  try{ await fn(t,env); }
  catch(e){ t.ok(false,'异常：'+(e.stack||e)); }
  finally{ await env.browser.close(); }
  t.done(env.errors);
}
module.exports={launch,openGame,startFromIntro,autoCloseLetters,instrument,measure,gc,throttle,run,fileUrl,ROOT,OUT,path,fs};
