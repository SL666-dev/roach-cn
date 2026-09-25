const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright-core');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},offline:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.waitForFunction(()=>!!document.querySelector('#gameFrame').contentWindow.__g);
  await page.locator('#intro').click();await page.locator('#introGo').click();
  const frame=page.frames().find(f=>f.name()==='gameFrame');
  await frame.waitForFunction(()=>!__g.r1.intro);
  await frame.evaluate(()=>{
   window.events={press:0,pan:0,cancel:0};
   for(const [name,key] of [['onPress','press'],['onPan','pan'],['onCancel','cancel']]){
    const original=__g.input[name];__g.input[name]=(...args)=>{events[key]++;return original(...args)};
   }
  });
  const stats=()=>frame.evaluate(()=>({...events,cam:{...__g.r1.cam}}));
  const drag=async(button)=>{await page.mouse.move(600,350);await page.mouse.down({button});await page.mouse.move(680,430,{steps:5});await page.mouse.up({button})};
  let before=await stats();await page.keyboard.down('Space');await drag('left');await page.keyboard.up('Space');let after=await stats();
  assert(after.pan>before.pan);assert.equal(after.press,before.press);assert.notDeepEqual(after.cam,before.cam);
  before=await stats();await drag('middle');after=await stats();assert(after.pan>before.pan);assert.equal(after.press,before.press);
  before=await stats();await drag('right');after=await stats();assert.equal(after.pan,before.pan);assert.equal(after.press,before.press);
  assert(await frame.evaluate(()=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.querySelector('#gl').dispatchEvent(e);return e.defaultPrevented}));
  before=await stats();await drag('left');after=await stats();assert.equal(after.press,before.press+1);assert.equal(after.pan,before.pan);
  // Releasing Space mid-drag must stop panning without activating a tool.
  await page.keyboard.down('Space');await page.mouse.move(600,350);await page.mouse.down();await page.mouse.move(620,370);
  await page.keyboard.up('Space');before=await stats();await page.mouse.move(660,410);await page.mouse.up();after=await stats();assert.equal(after.pan,before.pan);assert.equal(after.press,before.press);
  // The original two-finger recognition and cancellation thresholds remain intact.
  await frame.evaluate(()=>{
   const send=(type,id,x,y)=>document.querySelector('#gl').dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true,buttons:type==='pointerup'?0:1}));
   send('pointerdown',11,300,300);send('pointerdown',12,400,300);
   send('pointermove',11,330,330);send('pointermove',12,430,330);send('pointermove',11,350,350);
   if(![...__g.input.pointers.values()].every(p=>p.role==='pan'))throw Error('Two-finger pan failed');
   send('pointerup',11,350,350);send('pointerup',12,430,330);
  });
  // Tweezer gestures must route through panning, without attempting a capture.
  await frame.getByText('镊子',{exact:true}).click();before=await stats();
  await page.keyboard.down('Space');await drag('left');await page.keyboard.up('Space');await drag('middle');after=await stats();
  assert.equal(after.press,before.press);assert(after.pan>before.pan);
  assert.equal(await page.locator('#labLayer').getAttribute('aria-hidden'),'true');
  assert.deepEqual(errors,[]);
  console.log('PASS: space+left, middle, right ignored/menu blocked, ordinary left, Space release, touch two-finger and tweezer; offline iframe; no script errors.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
