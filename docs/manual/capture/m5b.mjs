// M5-08 후반(텍스처·감량·완성) 대기 촬영 → M5-10~13 History·배치·공유
import {launch,openStudent,shot,sleep,boxes,closeNotice} from './lib.mjs';
import {annotate,zoom,pair} from './tools.mjs';
import fs from 'node:fs';
const LOGF='out/m5_log.json',log=fs.existsSync(LOGF)?JSON.parse(fs.readFileSync(LOGF,'utf8')):{};const save=()=>fs.writeFileSync(LOGF,JSON.stringify(log,null,1));
const NAME=process.env.GEN_NAME||'파란 고래 모양 벤치';
const b=await launch();const s=await openStudent(b,1);const p=s.page;await p.keyboard.press('Escape');await closeNotice(p);
await p.getByText('새 에셋 만들기',{exact:true}).click();await sleep(800);
const job=p.locator('.generation-job').filter({hasText:NAME}).first();
const t0=Date.now();const seen=log.finish||[];let last=null;
for(let i=0;i<400;i++){
 const txt=(await job.innerText().catch(()=>'')).split('\n')[0]||'';
 if(txt!==last){last=txt;seen.push({sec:Math.round((Date.now()-t0)/1000),text:txt});console.log('stage',seen.at(-1));
  await job.scrollIntoViewIfNeeded().catch(()=>{});const sh=await shot(p,'m5_fin_'+seen.length);const bb=await job.boundingBox().catch(()=>null);if(bb)await zoom(sh,'M5-08-finish-'+seen.length,bb,{margin:8});log.finish=seen;save();}
 if(/완성됐어요|실패|사용할 수 없어요/.test(txt))break;
 await sleep(4000);if(i%15===14){await p.reload();await p.getByText('서버 연결됨',{exact:true}).waitFor();await p.getByText('새 에셋 만들기',{exact:true}).click();await sleep(800);}
}
log.finishSeconds=Math.round((Date.now()-t0)/1000);save();
if(await p.getByLabel('실패 후 재질 선택').count()){const sh=await shot(p,'m5_material');await annotate(sh,'M5-09-material-choice',[{box:await p.getByLabel('실패 후 재질 선택').boundingBox(),n:1,label:'재질 직접 선택',side:'left'}]);}
if(!/완성됐어요/.test(last)){console.log('not completed',last);await b.close();process.exit(0);}
// History
await p.getByRole('button',{name:/History/}).first().click();await sleep(1500);
const tabs=p.getByLabel('에셋 History 분류');let src=await shot(p,'m5_history');
const item=p.locator('[class*=history] li, [class*=history] article').filter({hasText:NAME}).first();
let bx=await boxes(p,{tabs,item,place:item.getByRole('button',{name:'배치'}),share:item.getByRole('button',{name:'수업에 공유'})});
await annotate(src,'M5-11-history',[{box:bx.tabs,n:1,label:'내 에셋 · 수업 공유'},{box:bx.item,n:2,label:'완성 에셋 자동 등록'}]);
log.history={tabs:await tabs.innerText().catch(()=>null),item:await item.innerText().catch(()=>null)};save();
const c0=await p.getByLabel('에셋 수').textContent();
await item.getByRole('button',{name:'배치'}).click();await sleep(2500);
const c1=await p.getByLabel('에셋 수').textContent();log.place=[c0,c1];save();
await p.keyboard.press('Escape');await sleep(500);
src=await shot(p,'m5_placed');await annotate(src,'M5-12-history-place',[{box:await p.getByLabel('에셋 수').boundingBox(),n:1,label:`에셋 수 ${c0}→${c1}`}]);
// 공유
await p.getByRole('button',{name:/History/}).first().click();await sleep(1200);
const shareBtn=p.locator('[class*=history] li, [class*=history] article').filter({hasText:NAME}).first().getByRole('button',{name:'수업에 공유'});
if(await shareBtn.count()){await shareBtn.click();await sleep(1500);}
const a=await shot(p,'m5_shared_1');
const s2=await openStudent(b,2);const q=s2.page;await q.getByRole('button',{name:/History/}).first().click();await sleep(1200);
const shareTab=q.getByLabel('에셋 History 분류').getByRole('button',{name:/수업 공유/});if(await shareTab.count()){await shareTab.click();await sleep(1200);}
log.sharedSeen=await q.getByText(NAME).count();save();
const bq=await shot(q,'m5_shared_2');await pair(a,bq,'M5-13-share',['학생 1 · 수업에 공유','학생 2 · 수업 공유 탭']);
console.log(JSON.stringify(log).slice(-400));
await b.close();
