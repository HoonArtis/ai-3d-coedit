// M5-12/13 재촬영: 빈 장면에 생성 에셋 배치·확대, 학생 2 수업 공유 탭
import {launch,openStudent,shot,sleep,boxes,clearMine,closeNotice} from './lib.mjs';
import {annotate,zoom,pair} from './tools.mjs';
import fs from 'node:fs';
const LOGF='out/m5_log.json',log=JSON.parse(fs.readFileSync(LOGF,'utf8'));const save=()=>fs.writeFileSync(LOGF,JSON.stringify(log,null,1));
const NAME='파란 고래 모양 벤치';
const b=await launch();const s2=await openStudent(b,2);await clearMine(s2.page);
const s=await openStudent(b,1);const p=s.page;await clearMine(p);await closeNotice(p);
const hist=async q=>{await q.getByRole('button',{name:/History/}).first().click();await sleep(1200);};
const dlgItem=q=>q.getByRole('dialog').locator('li,article').filter({hasText:NAME}).first();
await hist(p);const c0=await p.getByLabel('에셋 수').textContent();
const item=dlgItem(p);await item.click().catch(()=>{});await sleep(2500);
let src=await shot(p,'m5_hist_preview');await annotate(src,'M5-11-history-preview',[{box:await p.getByRole('dialog').boundingBox(),n:1,label:'선택 에셋 3D 미리보기',side:'above'}],{pad:2});
await item.getByRole('button',{name:'배치'}).click();await sleep(2500);const c1=await p.getByLabel('에셋 수').textContent();
await p.keyboard.press('Escape');await sleep(400);
await p.locator('.scene-list button[aria-label$=" 선택"]').first().click();await sleep(500);await p.keyboard.press('f');await sleep(1500);
const vb=await p.locator('.viewport').boundingBox();
src=await shot(p,'m5_placed2');
await annotate(src,'M5-12-history-place',[{box:{x:vb.x+vb.width*.2,y:vb.y+vb.height*.15,width:vb.width*.6,height:vb.height*.7},n:1,label:'생성 에셋 배치'},{box:await p.getByLabel('에셋 수').boundingBox(),n:2,label:`에셋 수 ${c0}→${c1}`}]);
await zoom(src,'M5-12-model-zoom',{x:vb.x+vb.width*.2,y:vb.y+vb.height*.1,width:vb.width*.6,height:vb.height*.8},{margin:0});
log.place2=[c0,c1];save();
// 학생 1 History(공유됨) + 학생 2 수업 공유 탭
await hist(p);const a=await shot(p,'m5_share1');
const q=s2.page;await hist(q);await q.getByRole('dialog').getByText('수업 공유',{exact:true}).first().click();await sleep(1500);
log.sharedVisible=await dlgItem(q).count();save();
const bq=await shot(q,'m5_share2');await pair(a,bq,'M5-13-share',['학생 1 · 수업에 공유됨','학생 2 · 수업 공유 탭']);
if(log.sharedVisible){const c2=await q.getByLabel('에셋 수').textContent();await dlgItem(q).getByRole('button',{name:'배치'}).click();await sleep(2500);log.s2place=[c2,await q.getByLabel('에셋 수').textContent()];save();}
console.log(JSON.stringify({place2:log.place2,sharedVisible:log.sharedVisible,s2place:log.s2place}));
await b.close();
