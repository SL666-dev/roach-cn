// 合成音效（Web Audio），SFX
// game.html 按文件编号顺序以普通 <script> 加载；各文件顶层的 const/class/function 在同一页面里互相可见。
"use strict";

// ───────── 소리 ─────────
class AudioFX{
  constructor(){this.ctx=null;this.loops={};}
  ensure(){
    if(!this.ctx){
      const C=window.AudioContext||window.webkitAudioContext; if(!C) return;
      try{ if(navigator.audioSession) navigator.audioSession.type='playback'; }catch(err){}
      this.ctx=new C();
      this.master=this.ctx.createGain(); this.master.gain.value=0.85;
      this.comp=this.ctx.createDynamicsCompressor(); this.comp.threshold.value=-14; this.comp.ratio.value=5; this.comp.attack.value=0.002; this.comp.release.value=0.12;
      this.master.connect(this.comp); this.comp.connect(this.ctx.destination);
      const len=this.ctx.sampleRate*2, buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate), d=buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
      this.noiseBuf=buf;
    }
    if(this.ctx.state==='suspended') this.ctx.resume().catch(()=>{});
  }
  get t(){return this.ctx?this.ctx.currentTime:0;}
  env(g,t,att,dur,peak){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(peak,0.0002),t+att); g.gain.exponentialRampToValueAtTime(0.0001,t+att+dur); }
  noise({t=0,dur=0.1,gain=0.5,att=0.002,type='bandpass',freq=2000,q=1,freqEnd=null,rate=1,pan=0,trem=0}={}){
    if(!this.ctx) return; const c=this.ctx, t0=c.currentTime+t;
    const s=c.createBufferSource(); s.buffer=this.noiseBuf; s.loop=true; s.playbackRate.value=rate;
    s.start(t0,Math.random()*1.5);
    const f=c.createBiquadFilter(); f.type=type; f.frequency.setValueAtTime(freq,t0); f.Q.value=q;
    if(freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20,freqEnd),t0+att+dur);
    const g=c.createGain(); this.env(g,t0,att,dur,gain);
    let node=g;
    if(trem>0){ const tg=c.createGain(); const n=Math.floor((att+dur)*trem*2)+2; const arr=new Float32Array(n); for(let i=0;i<n;i++) arr[i]=0.35+0.65*(i%2); tg.gain.setValueCurveAtTime(arr,t0,att+dur+0.01); g.connect(tg); node=tg; }
    const p=c.createStereoPanner(); p.pan.value=clamp(pan,-1,1);
    s.connect(f); f.connect(g); node.connect(p); p.connect(this.master);
    s.stop(t0+att+dur+0.05);
  }
  tone({t=0,dur=0.1,gain=0.3,att=0.002,freq=200,freqEnd=null,type='sine',pan=0}={}){
    if(!this.ctx) return; const c=this.ctx, t0=c.currentTime+t;
    const o=c.createOscillator(); o.type=type; o.frequency.setValueAtTime(freq,t0);
    if(freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20,freqEnd),t0+att+dur);
    const g=c.createGain(); this.env(g,t0,att,dur,gain);
    const p=c.createStereoPanner(); p.pan.value=clamp(pan,-1,1);
    o.connect(g); g.connect(p); p.connect(this.master); o.start(t0); o.stop(t0+att+dur+0.05);
  }
  loop(name,make){ if(!this.ctx||this.loops[name]) return; const c=this.ctx; const g=c.createGain(); g.gain.setValueAtTime(0.0001,c.currentTime); g.connect(this.master); const nodes=make(c,g); this.loops[name]={g,nodes}; g.gain.exponentialRampToValueAtTime(1,c.currentTime+0.06); }
  stopLoop(name){ const L=this.loops[name]; if(!L) return; const c=this.ctx; L.g.gain.cancelScheduledValues(c.currentTime); L.g.gain.setValueAtTime(L.g.gain.value||0.5,c.currentTime); L.g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+0.12); setTimeout(()=>{L.nodes.forEach(n=>{try{n.stop();}catch(e){}});},200); delete this.loops[name]; }
  setLoopGain(name,v){ const L=this.loops[name]; if(!L) return; L.g.gain.setTargetAtTime(Math.max(0.0001,v),this.ctx.currentTime,0.05); }

  // ── 바퀴가 눌려 죽는 소리. 1라운드와 2라운드가 같은 소리다. ──
  // bright: 1이면 위에서 내려다보며 듣는 소리(파작·바삭), 낮을수록 바닥에서 가까이 듣는 소리(고역이 눌리고 저역이 남는다)
  kill(weapon,combo=0,mult=1,delay=0,pan=0,bright=1){
    if(!this.ctx) return;
    const p=1+Math.min(combo,14)*0.045, g=mult*(0.75+Math.min(combo,14)*0.03);
    const hi=(weapon==='tissue'?0.45:1)*bright;              // 고역 성분
    const bp=f=>f*(0.3+0.7*bright);                          // 밝기에 따라 대역이 내려간다
    this.tone({t:delay,dur:0.09,gain:0.6*g*(2-bright),freq:130*p,freqEnd:40,pan});
    const n=4+Math.floor(Math.random()*4);
    for(let i=0;i<n;i++) this.noise({t:delay+i*(0.006+Math.random()*0.012),dur:0.018+Math.random()*0.02,gain:0.55*g*hi,freq:bp((2600+Math.random()*2600)*p),q:1.3,rate:0.9+Math.random()*0.5,pan});
    this.noise({t:delay,dur:0.07,gain:0.6*g*hi,freq:bp(1900*p),q:0.8,freqEnd:bp(800),pan});
    this.noise({t:delay+0.012,dur:0.17,gain:0.5*g,freq:bp(720*p),q:1.6,freqEnd:200,type:'lowpass',pan});
    switch(weapon){
      case 'slipper': this.noise({t:delay,dur:0.045,gain:0.7*g,freq:700,q:0.6,freqEnd:250,pan}); break;
      case 'pan': for(const f of [1240,2870,4300]) this.tone({t:delay,dur:0.32,gain:0.09*g*hi,freq:f*(1+Math.random()*0.01),type:'sine',pan}); this.noise({t:delay,dur:0.03,gain:0.6*g*hi,freq:bp(3200),q:0.5,pan}); this.noise({t:delay,dur:0.09,gain:0.6*g,freq:800,q:1,freqEnd:300,pan}); break;
      case 'book': this.noise({t:delay,dur:0.14,gain:0.9*g,freq:260,q:0.7,type:'lowpass',freqEnd:120,pan}); break;
      case 'tissue': this.noise({t:delay,dur:0.22,gain:0.6*g,freq:420,q:1.2,type:'lowpass',freqEnd:160,pan}); break;
      case 'hand': this.noise({t:delay,dur:0.028,gain:0.8*g*hi,freq:bp(1500),q:0.5,pan}); this.noise({t:delay,dur:0.06,gain:0.6*g,freq:500,q:0.8,freqEnd:200,pan}); break;
      case 'flame': for(let i=0;i<5;i++) this.noise({t:delay+0.03*i,dur:0.02,gain:0.3*g*hi,freq:bp(5000+Math.random()*3000),q:2,pan}); break;
      case 'vacuum': this.noise({t:delay,dur:0.14,gain:0.5*g,freq:400,q:1.5,freqEnd:bp(2800),pan}); break;
      case 'stomp': this.noise({t:delay,dur:0.09,gain:0.9*g,freq:300,q:0.7,type:'lowpass',freqEnd:100,pan}); break;
    }
  }
  miss(weapon,pan=0){
    if(!this.ctx) return;
    switch(weapon){
      case 'hand': this.noise({dur:0.03,gain:0.6,freq:1400,q:0.5,pan}); this.tone({dur:0.06,gain:0.25,freq:110,freqEnd:50,pan}); break;
      case 'slipper': this.noise({dur:0.05,gain:0.7,freq:650,q:0.6,freqEnd:220,pan}); this.tone({dur:0.07,gain:0.3,freq:120,freqEnd:45,pan}); break;
      case 'pan': for(const f of [1240,2870,4300]) this.tone({dur:0.5,gain:0.14,freq:f,pan}); this.noise({dur:0.03,gain:0.6,freq:3400,q:0.5,pan}); this.tone({dur:0.09,gain:0.35,freq:130,freqEnd:45,pan}); break;
      case 'book': this.noise({dur:0.16,gain:0.95,freq:240,q:0.7,type:'lowpass',freqEnd:100,pan}); this.tone({dur:0.1,gain:0.4,freq:100,freqEnd:40,pan}); break;
      case 'tissue': this.noise({dur:0.14,gain:0.4,freq:380,q:1,type:'lowpass',freqEnd:150,pan}); break;
    }
  }
  spawnBait(){ if(!this.ctx) return; this.noise({dur:0.08,gain:0.3,freq:900,q:0.8,freqEnd:300}); }
  startSpray(){ this.loop('spray',(c,g)=>{ const s=c.createBufferSource(); s.buffer=this.noiseBuf; s.loop=true; const f=c.createBiquadFilter(); f.type='highpass'; f.frequency.value=2600; const f2=c.createBiquadFilter(); f2.type='peaking'; f2.frequency.value=5000; f2.gain.value=6; const gg=c.createGain(); gg.gain.value=0.35; s.connect(f); f.connect(f2); f2.connect(gg); gg.connect(g); s.start(); return [s]; }); }
  startFlame(){ this.loop('flame',(c,g)=>{ const s=c.createBufferSource(); s.buffer=this.noiseBuf; s.loop=true; const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900; f.Q.value=1.2; const lfo=c.createOscillator(); lfo.type='sine'; lfo.frequency.value=7; const lg=c.createGain(); lg.gain.value=350; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); const gg=c.createGain(); gg.gain.value=0.6; s.connect(f); f.connect(gg); gg.connect(g); s.start(); return [s,lfo]; }); }
  startVacuum(){ this.loop('vacuum',(c,g)=>{ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=92; const o2=c.createOscillator(); o2.type='sawtooth'; o2.frequency.value=184.5; const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=700; const s=c.createBufferSource(); s.buffer=this.noiseBuf; s.loop=true; const nf=c.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=1800; nf.Q.value=0.6; const ng=c.createGain(); ng.gain.value=0.25; const og=c.createGain(); og.gain.value=0.16; o.connect(f); o2.connect(f); f.connect(og); og.connect(g); s.connect(nf); nf.connect(ng); ng.connect(g); o.start(); o2.start(); s.start(); return [o,o2,s]; }); }
  flameCrackle(){ if(!this.ctx) return; for(let i=0;i<3;i++) this.noise({t:Math.random()*0.08,dur:0.015,gain:0.25,freq:4500+Math.random()*4000,q:3}); }
  lighterClick(){ if(!this.ctx) return; this.noise({dur:0.012,gain:0.6,freq:5000,q:2}); this.noise({t:0.05,dur:0.09,gain:0.4,freq:900,q:1,freqEnd:2800}); }

  // ── 2라운드: 같은 소리를 바닥에서 듣는다 ──
  footstep(dist,pan=0){ if(!this.ctx) return; const g=clamp(1.4/(0.45+dist),0.06,1.15); this.tone({dur:0.32,gain:0.95*g,freq:58,freqEnd:22,pan}); this.tone({t:0.01,dur:0.11,gain:0.3*g,freq:125,freqEnd:48,type:'triangle',pan}); this.noise({dur:0.07,gain:0.45*g,freq:280,q:0.8,type:'lowpass',freqEnd:90,pan}); if(dist<1.2) this.noise({t:0.03,dur:0.18,gain:0.12*g,freq:900,q:6,freqEnd:600,pan}); }
  // 동료가 눌리는 소리 = 1라운드의 그 소리 + 바닥에서 듣는 저역·뼈
  npcCrush(dist,pan=0,weapon='hand'){ if(!this.ctx) return;
   
   const g=clamp(0.42/(0.65+dist),0.025,0.42),
      bright=clamp(0.28+dist*0.34,0.28,1);


    this.kill(weapon,0,g,0,pan,bright);
    this.tone({dur:0.26,gain:0.7*g,freq:62,freqEnd:26,pan});
    const n=3+Math.floor(Math.random()*3); for(let i=0;i<n;i++){ const t=0.02+i*(0.05+Math.random()*0.035); this.tone({t,dur:0.03,gain:0.5*g,freq:230+Math.random()*200,freqEnd:80,type:'square',pan}); this.noise({t,dur:0.022,gain:0.3*g,freq:1400+Math.random()*900,q:1.6,pan}); }
    this.noise({t:0.07,dur:0.34,gain:0.5*g,freq:1100,q:2.4,freqEnd:230,trem:15,pan});
    this.noise({t:0.12,dur:0.22,gain:0.3*g,freq:480,q:1.2,type:'lowpass',freqEnd:150,pan});
  }
  thud(dist=1,pan=0,big=1){ if(!this.ctx) return; const g=clamp(1.4/(0.5+dist),0.1,1)*big; this.tone({dur:0.32,gain:1.0*g,freq:58,freqEnd:28}); this.noise({dur:0.2,gain:0.6*g,freq:220,q:0.8,type:'lowpass',freqEnd:60,pan}); this.noise({dur:0.05,gain:0.4*g,freq:900,q:0.7,freqEnd:300,pan}); }
  // 내가 눌리는 소리 — 가장 가까이서 듣는 같은 소리
  crushDeath(weapon,g=1,pan=0){ if(!this.ctx) return;
    this.kill(weapon,0,g*1.15,0,pan,0.22);
    for(let i=0;i<4;i++){ const t=0.03+i*0.06; this.tone({t,dur:0.035,gain:0.6*g,freq:250+Math.random()*180,freqEnd:70,type:'square',pan}); }
    this.noise({t:0.1,dur:0.4,gain:0.5*g,freq:1200,q:2.4,freqEnd:210,trem:14,pan});
    this.tone({dur:0.42,gain:1.0*g,freq:60,freqEnd:24,pan});
    this.noise({t:0.02,dur:0.34,gain:0.85*g,freq:500,q:1.4,type:'lowpass',freqEnd:135,trem:26,pan});
    this.tone({t:0.04,dur:0.42,gain:0.45*g,freq:190,freqEnd:48,type:'triangle',pan});
    this.noise({t:0.08,dur:0.3,gain:0.4*g,freq:800,q:3,freqEnd:380,trem:34,pan});
  }



// 2라운드 세대 교대용 2.3초 죽음 음향
  deathSequence(type,weapon='hand'){
    if(!this.ctx) return;

    if(type==='crush'){
      this.crushDeath(weapon,1.18,0);
      for(let i=0;i<9;i++){
        const t=0.11+i*(0.035+Math.random()*0.024);
        this.noise({t,dur:0.012+Math.random()*0.018,gain:0.42,freq:1800+Math.random()*4200,q:2.2,pan:rand(-0.8,0.8)});
        if(i%2===0) this.tone({t,dur:0.045,gain:0.24,freq:260+Math.random()*260,freqEnd:55,type:'square',pan:rand(-0.5,0.5)});
      }
      this.noise({t:0.18,dur:0.92,gain:0.24,freq:760,q:2.6,freqEnd:95,trem:18});
      this.tone({t:0.55,dur:0.76,gain:0.18,freq:74,freqEnd:23,type:'triangle'});
      this.noise({t:1.06,dur:0.035,gain:0.18,freq:2400,q:2.2});
      return;
    }

    if(type==='vacuum'){
      this.vacuumSuck();
      this.noise({dur:1.18,gain:0.58,freq:240,q:0.8,freqEnd:4200});
      this.tone({dur:1.12,gain:0.34,freq:78,freqEnd:480,type:'sawtooth'});
      for(let i=0;i<3;i++){
        const t=0.56+i*0.27;
        this.tone({t,dur:0.1,gain:0.5,freq:105-i*18,freqEnd:28,type:'triangle',pan:i%2?-0.55:0.55});
        this.noise({t,dur:0.045,gain:0.4,freq:650+i*380,q:1.1,pan:i%2?-0.55:0.55});
      }
      this.noise({t:1.35,dur:0.38,gain:0.22,freq:440,q:2.4,freqEnd:80,trem:13});
      return;
    }

    if(type==='flame'){
      this.kill('flame',0,1.08,0,0,0.35);
      for(let i=0;i<13;i++){
        const t=i*0.055+Math.random()*0.035;
        this.noise({t,dur:0.012+Math.random()*0.022,gain:0.28,freq:3900+Math.random()*5200,q:2.8,pan:rand(-0.7,0.7)});
      }
      this.noise({dur:1.35,gain:0.4,freq:980,q:1.1,freqEnd:180,trem:21});
      this.tone({t:0.15,dur:1.2,gain:0.16,freq:118,freqEnd:30,type:'triangle'});
      return;
    }

    // 杀虫剂와 독 먹이: 큰 한 방보다 운동 회로가 하나씩 끊기는 소리
    for(let i=0;i<14;i++){
      const t=0.08+i*(0.09+Math.random()*0.055);
      this.noise({t,dur:0.012+Math.random()*0.016,gain:0.18+Math.random()*0.12,freq:2100+Math.random()*3300,q:2.5,pan:rand(-0.75,0.75)});
      if(i%3===0) this.tone({t,dur:0.055,gain:0.13,freq:180+Math.random()*170,freqEnd:48,type:'square',pan:rand(-0.5,0.5)});
    }
    this.noise({t:0.05,dur:1.75,gain:0.18,freq:620,q:2.0,freqEnd:90,trem:11});
    this.tone({t:0.32,dur:1.45,gain:0.13,freq:66,freqEnd:21,type:'triangle'});
  }



  eggHatch(){ if(!this.ctx) return; for(let i=0;i<7;i++) this.noise({t:i*0.07+Math.random()*0.03,dur:0.025,gain:0.3,freq:1800+Math.random()*2200,q:2.5}); this.noise({t:0.1,dur:0.3,gain:0.25,freq:600,q:1,type:'lowpass',freqEnd:200}); }
  eggReady(){ if(!this.ctx) return; this.tone({dur:0.25,gain:0.12,freq:330,type:'triangle'}); this.tone({t:0.18,dur:0.4,gain:0.12,freq:440,type:'triangle'}); }
  cushionFlip(){ if(!this.ctx) return; this.noise({dur:0.16,gain:0.5,freq:380,q:0.8,type:'lowpass',freqEnd:140}); this.noise({t:0.05,dur:0.08,gain:0.25,freq:1200,q:1,freqEnd:500}); }
  eggCrush(){ if(!this.ctx) return; this.noise({dur:0.5,gain:0.8,freq:1400,q:4,freqEnd:500,trem:22}); this.noise({t:0.02,dur:0.3,gain:0.5,freq:400,q:1,type:'lowpass',freqEnd:120}); for(let i=0;i<8;i++) this.noise({t:i*0.05,dur:0.02,gain:0.4,freq:2500+Math.random()*2500,q:2}); }
  creak(){ if(!this.ctx) return; this.tone({dur:0.35,gain:0.12,freq:300,freqEnd:220,type:'sawtooth'}); this.noise({dur:0.3,gain:0.2,freq:420,q:6,freqEnd:300}); }
  click(g=0.5){ if(!this.ctx) return; this.noise({dur:0.012,gain:g,freq:3500,q:1.5}); this.tone({dur:0.03,gain:g*0.4,freq:1600,freqEnd:900,type:'square'}); }
  lightSwitch(){ if(!this.ctx) return; this.click(0.6); this.noise({t:0.06,dur:0.02,gain:0.5,freq:2800,q:1.5}); this.tone({t:0.08,dur:0.5,gain:0.06,freq:120,type:'triangle'}); }
  door(open){ if(!this.ctx) return; if(open){ this.tone({dur:0.9,gain:0.1,freq:260,freqEnd:330,type:'sawtooth'}); this.noise({dur:0.8,gain:0.15,freq:600,q:5,freqEnd:800}); } else { this.tone({dur:0.3,gain:0.9,freq:70,freqEnd:30}); this.noise({dur:0.25,gain:0.6,freq:300,q:0.8,type:'lowpass',freqEnd:90}); this.click(0.5); } }
  poisonTwitch(){ if(!this.ctx) return; this.noise({dur:0.02,gain:0.2,freq:3000+Math.random()*2000,q:2}); }
  vacuumSuck(){ if(!this.ctx) return; this.noise({dur:0.35,gain:0.9,freq:300,q:1.5,freqEnd:3500}); this.tone({dur:0.3,gain:0.5,freq:120,freqEnd:400,type:'triangle'}); }
  nibble(pan=0){ if(!this.ctx) return; for(let i=0;i<3;i++) this.noise({t:i*0.05,dur:0.02,gain:0.14,freq:2200+Math.random()*1200,q:3,pan}); }
  toxWarn(){ if(!this.ctx) return; this.tone({dur:0.18,gain:0.1,freq:210,freqEnd:150,type:'sawtooth'}); }
}
const SFX=new AudioFX();
// 휴대폰 브라우저는 손가락을 '뗄 때'만 소리 재생을 허락한다. 누를 때만 깨우면 끝까지 무음이 된다.
for(const ev of ['pointerdown','pointerup','touchend','click','keydown']) window.addEventListener(ev,()=>SFX.ensure(),{capture:true,passive:true});
