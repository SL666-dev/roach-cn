// 依次运行全部实测脚本：node tools/run-all.cjs [名字过滤]
// 例：node tools/run-all.cjs round2   只跑名字含 round2 的脚本
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const ALL=['check-browser.cjs','check-pan.cjs','test-round1.cjs','test-lab.cjs','test-round2.cjs','test-layout.cjs','test-perf.cjs','test-letters.cjs','test-watchcam.cjs'];
const filter=process.argv[2];
const list=ALL.filter(f=>!filter||f.includes(filter));
const result=[];
for(const f of list){
  console.log(`\n========== ${f} ==========`);
  const t=Date.now();
  const r=spawnSync(process.execPath,[path.join(__dirname,f)],{stdio:'inherit'});
  result.push({f,ok:r.status===0,s:((Date.now()-t)/1000).toFixed(0)});
}
console.log('\n========== 汇总 ==========');
for(const r of result) console.log(`${r.ok?'✓':'✗'} ${r.f}（${r.s}s）`);
process.exitCode=result.every(r=>r.ok)?0:1;
