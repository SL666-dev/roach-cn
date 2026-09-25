// 界面 UI：工具栏、卵鞘按钮、小地图、提示、排名
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── UI ─────────
class UI{
  constructor(G){ this.G=G;
    const wcol=document.getElementById('wcol'), bcol=document.getElementById('bcol'); this.slotEls={};
    for(const k of [...SLOT_ORDER,...BAIT_SLOTS]){ const d=document.createElement('div'); d.className='slot'+(BAIT_SLOTS.includes(k)?' bait':''); d.textContent=LABEL[k]; d.dataset.item=k; d.select=()=>G.r1.selectItem(k); d.addEventListener('pointerdown',e=>{ e.stopPropagation(); e.preventDefault(); SFX.ensure(); G.r1.selectItem(k); }); (BAIT_SLOTS.includes(k)?bcol:wcol).appendChild(d); this.slotEls[k]=d; }
    this.killsEl=document.getElementById('kills'); this.killsN=this.killsEl.querySelector('.n');
    this.quit=document.getElementById('quit'); this.confirm=document.getElementById('confirm');
    this.quit.addEventListener('pointerdown',e=>{ e.stopPropagation(); SFX.ensure(); this.quit.style.transition='none'; this.quit.classList.remove('show'); setTimeout(()=>{ this.quit.style.transition=''; },50); this.confirm.classList.add('show'); G.state='confirm'; });
    this.confirm.querySelector('.more').addEventListener('pointerdown',e=>{ e.stopPropagation(); this.confirm.classList.remove('show'); G.state='r1'; G.r1.touch(); this.quit.style.transition='none'; this.showQuit(true); setTimeout(()=>{ this.quit.style.transition=''; },50); });
    this.confirm.querySelector('.stop').addEventListener('pointerdown',e=>{ e.stopPropagation(); this.confirm.classList.remove('show'); G.toRound2(); });
    this.tapfx=document.getElementById('tapfx'); G.input.onDashTap=(x,y)=>{ const t=this.tapfx; t.style.left=x+'px'; t.style.top=y+'px'; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); };
    this.pad=document.getElementById('pad'); this.egg=document.getElementById('egg'); this.dash=document.getElementById('dash'); this.eggbar=document.getElementById('eggbar');
    const eDown=e=>{ e.stopPropagation(); e.preventDefault(); SFX.ensure(); G.input.eggHold=true; }; const eUp=()=>{ G.input.eggHold=false; };
    this.egg.addEventListener('pointerdown',eDown); this.egg.addEventListener('pointerup',eUp); this.egg.addEventListener('pointercancel',eUp); this.egg.addEventListener('pointerleave',eUp);
    this.dash.addEventListener('pointerdown',e=>{ e.stopPropagation(); e.preventDefault(); SFX.ensure(); G.input.dashReq=true; });
    this.mini=document.getElementById('mini'); this.mctx=this.mini.getContext('2d'); this.miniT=0;
    this.rank=document.getElementById('rank');
    this.rank.addEventListener('pointerdown',e=>{ if(e.target.classList.contains('allover')) return; e.stopPropagation(); if(G.state==='rank'&&G.rankT>0.8) G.restart(); });
    this.rank.querySelector('.allover').addEventListener('pointerdown',e=>{ e.stopPropagation(); if(G.rankT>0.8) G.restartAll(); });
    this.endtext=document.getElementById('endtext'); this.fade=document.getElementById('fade');
    this.refreshKeys();
  }
  selectSlot(k){ for(const s in this.slotEls) this.slotEls[s].classList.toggle('sel',s===k); }
  slotList(){ return [...document.querySelectorAll('#wcol .slot, #bcol .slot')]; }
  refreshKeys(){ const keys=['1','2','3','4','5','6','7','8','9','0','-','=']; this.slotList().forEach((e,i)=>{ if(keys[i]) e.dataset.key=keys[i]; else delete e.dataset.key; }); }
  setKills(n){ if(n===null){ this.killsEl.classList.remove('show'); return; } this.killsN.textContent=n; this.killsEl.classList.toggle('show',n>0); }
  showQuit(b){ this.quit.classList.toggle('show',b&&this.G.state==='r1'); }
  eggState(mode){ const e=this.egg; if(e.dataset.mode===mode) return; const was=e.dataset.mode; e.dataset.mode=mode;
    this.pad.style.display=(mode==='none')?'none':'flex';
       e.classList.toggle(
      'laid',
      mode==='laid'
    );

    e.textContent=
      mode==='laid'
        ? '卵鞘'
        : '产卵';
    if(mode==='show'&&was!=='show'){ e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
    if(mode!=='laid'){ e.classList.remove('ready','danger'); }
    if(mode==='none'){ e.style.setProperty('--p','0'); this.eggBar(null); } }
  eggProgress(k){ this.egg.style.setProperty('--p',k.toFixed(3)); }
  eggReady(b){ this.egg.classList.toggle('ready',b); }
  eggDanger(b){ this.egg.classList.toggle('danger',b); }
  eggBar(text,warn){ const el=this.eggbar; if(!text){ el.classList.remove('show'); return; } el.textContent=text; el.classList.add('show'); el.classList.toggle('warn',!!warn); }
  dashCool(k){ this.dash.style.setProperty('--c',clamp(k,0,1).toFixed(2)); this.dash.classList.toggle('off',k>0.02); }
  vignette(b){ document.getElementById('vig').style.opacity=b?'1':'0'; }
  tox(k){ document.getElementById('tox').style.opacity=clamp(k,0,1).toFixed(2); }
  miniOn(b){ this.mini.classList.toggle('show',b); document.getElementById('ui').classList.toggle('mini-on',b); }
  drawMini(d){
    if(!d) return; const c=this.mctx, W=176, H=264, px=x=>(x+2)/4*W, pz=z=>(z+3)/6*H;
    c.clearRect(0,0,W,H);
    c.fillStyle='rgba(240,232,210,0.10)'; c.fillRect(0,0,W,H);
    c.fillStyle='rgba(240,232,210,0.22)';
    for(const o of OBST) c.fillRect(px(o.x1),pz(o.z1),(o.x2-o.x1)/4*W,(o.z2-o.z1)/6*H);
    c.fillStyle='rgba(251,244,228,0.85)';
    for(const h of HOLES){ c.beginPath(); c.arc(px(h.x),pz(h.z),4,0,TAU); c.fill(); }
    c.fillStyle='rgba(150,190,60,0.95)';
    for(const t of d.traps){ c.beginPath(); c.arc(px(t[0]),pz(t[1]),4,0,TAU); c.fill(); }
    if(d.egg){ c.strokeStyle=d.ready?'#FBF4E4':'#F0C419'; c.lineWidth=3; c.beginPath(); c.arc(px(d.egg[0]),pz(d.egg[1]),7,0,TAU); c.stroke(); }
    if(d.human){ c.fillStyle='rgba(210,60,40,0.95)'; c.beginPath(); c.arc(px(d.human[0]),pz(d.human[1]),9,0,TAU); c.fill(); }
    if(d.me){ c.fillStyle='#FFFFFF'; c.beginPath(); c.arc(px(d.me[0]),pz(d.me[1]),5,0,TAU); c.fill(); c.strokeStyle='#FFFFFF'; c.lineWidth=2.5; c.beginPath(); c.moveTo(px(d.me[0]),pz(d.me[1])); c.lineTo(px(d.me[0])+Math.sin(d.me[2])*11,pz(d.me[1])+Math.cos(d.me[2])*11); c.stroke(); }
  }
  hint(text,dur=4.5,delay=0,dark=false){ this.hq=this.hq||[]; this.hq.push({text,dur,delay,dark}); if(!this.hintBusy) this.hintNext(); }
  hintNext(){ const el=document.getElementById('hint'); const q=this.hq; if(!q||!q.length){ this.hintBusy=false; return; } this.hintBusy=true; const h=q.shift(); this.hintTimer=setTimeout(()=>{ el.textContent=h.text; el.classList.toggle('dark',!!h.dark); el.classList.add('show'); this.hintTimer=setTimeout(()=>{ el.classList.remove('show'); this.hintTimer=setTimeout(()=>this.hintNext(),600); },h.dur*1000); },h.delay*1000); }
  hintClear(){ this.hq=[]; clearTimeout(this.hintTimer); this.hintBusy=false; document.getElementById('hint').classList.remove('show'); }
  genLabel(text,sub){ const el=document.getElementById('genlabel'); clearTimeout(this.genTimer); if(!text){ el.classList.remove('show'); return; } el.innerHTML=text+(sub?`<small>${sub}</small>`:''); el.classList.add('show'); this.genTimer=setTimeout(()=>el.classList.remove('show'),2600); }
}
