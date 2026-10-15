// M5-00/01/02/03/05/08/10: 실제 이미지 생성 → 확인 → 3D 생성 진행 촬영
import {launch,openStudent,shot,sleep,boxes,closeNotice} from './lib.mjs';
import {annotate,zoom,union} from './tools.mjs';
import fs from 'node:fs';
const LOGF='out/m5_log.json',log=fs.existsSync(LOGF)?JSON.parse(fs.readFileSync(LOGF,'utf8')):{};const save=()=>fs.writeFileSync(LOGF,JSON.stringify(log,null,1));
const PROMPT=process.env.GEN_PROMPT||'파란 고래 모양 벤치';
const b=await launch();const s=await openStudent(b,1);const p=s.page;await p.keyboard.press('Escape');await closeNotice(p);
const R=sel=>p.locator(sel).first();
await p.getByText('새 에셋 만들기',{exact:true}).click();await sleep(800);
const panel=R('.generation-panel');
let bx=await boxes(p,{panel,desc:p.getByLabel('생성할 물건 설명'),draw:p.getByRole('button',{name:'이미지 그리기',exact:true}),up:p.getByText('그림 업로드').first(),use:p.getByLabel('생성 사용량')});
let src=await shot(p,'m5_panel');
await annotate(src,'M5-01-panel',[{box:bx.desc,n:1,label:'만들 물건 설명',side:'left'},{box:bx.draw,n:2,label:'이미지 그리기',side:'left'},{box:bx.up,n:3,label:'그림 업로드',side:'left'},{box:bx.use,n:4,label:'사용량',side:'left'}]);
await zoom(src,'M5-01-panel-zoom',bx.panel,{margin:8});
// 이미지 생성 요청
await p.getByLabel('생성할 물건 설명').fill(PROMPT);await sleep(300);
const t0=Date.now();await p.getByRole('button',{name:'이미지 그리기',exact:true}).click();await sleep(1500);
bx=await boxes(p,{prog:p.getByLabel('생성 진행 상황'),panel});src=await shot(p,'m5_requested');
await annotate(src,'M5-02-requested',[{box:bx.prog||bx.panel,n:1,label:'요청 접수·진행',side:'left'}]);
if(bx.prog)await zoom(src,'M5-03-progress-zoom',bx.prog,{margin:12});
log.image={prompt:PROMPT,progressText:await p.getByLabel('생성 진행 상황').innerText().catch(()=>null)};save();
const cancelBtn=p.getByRole('button',{name:'대기 요청 취소'});log.image.cancelVisible=await cancelBtn.count();
if(log.image.cancelVisible){const c=await shot(p,'m5_cancel');await annotate(c,'M5-04-cancel-button',[{box:await cancelBtn.first().boundingBox(),n:1,label:'대기 요청 취소',side:'left'}]);}
// 확인 대기(최대 6분)
const confirm=p.getByRole('button',{name:'이 이미지로 3D 만들기'});
let ok=false;for(let i=0;i<180;i++){if(await confirm.count()&&await confirm.first().isVisible()){ok=true;break;}
 if(i%15===0){const t=await p.getByLabel('생성 진행 상황').innerText().catch(()=>'');console.log('wait image',Math.round((Date.now()-t0)/1000),t.replace(/\n/g,' ').slice(0,80));}
 if(await p.getByText('설명으로 재시도').count()){console.log('image failed');break;}await sleep(2000);}
log.image.ok=ok;log.image.seconds=Math.round((Date.now()-t0)/1000);save();console.log('image',ok,log.image.seconds);
if(!ok){src=await shot(p,'m5_image_fail');await annotate(src,'M5-07-image-failed',[{box:await panel.boundingBox(),n:1,label:'생성 실패',side:'left'}]);await b.close();process.exit(0);}
await confirm.first().scrollIntoViewIfNeeded();await sleep(800);
bx=await boxes(p,{img:p.getByAltText('확인할 생성 이미지'),confirm:confirm.first(),redraw:p.getByRole('button',{name:'설명으로 다시 그리기'})});
src=await shot(p,'m5_confirm');
await annotate(src,'M5-05-confirm-generated',[{box:bx.img,n:1,label:'생성 이미지 확인',side:'left'},{box:bx.confirm,n:2,label:'이 이미지로 3D 만들기',side:'left'},{box:bx.redraw,n:3,label:'설명으로 다시 그리기',side:'left'}]);
if(bx.img)await zoom(src,'M5-05-image-zoom',bx.img,{margin:8});
if(process.env.SKIP3D){await b.close();process.exit(0);}
// 3D 생성
const t1=Date.now();await confirm.first().click();await sleep(2000);const stages=[];
for(let i=0;i<600;i++){const t=(await p.getByLabel('생성 진행 상황').innerText().catch(()=>'')).replace(/\n/g,' ');
 if(!stages.length||stages.at(-1).text!==t){stages.push({sec:Math.round((Date.now()-t1)/1000),text:t.slice(0,120)});console.log('3d',stages.at(-1));
  const pr=await p.getByLabel('생성 진행 상황').boundingBox().catch(()=>null);if(pr){const sh=await shot(p,'m5_stage_'+stages.length);await zoom(sh,'M5-08-stage-'+stages.length,pr,{margin:12});}}
 log.shape={stages};save();
 if(!t||/완성|완료|History/.test(t)&&!/중/.test(t))break;
 if(await p.getByLabel('실패 후 재질 선택').count()){log.shape.materialChoice=true;const sh=await shot(p,'m5_material');await annotate(sh,'M5-09-material-choice',[{box:await p.getByLabel('실패 후 재질 선택').boundingBox(),n:1,label:'재질 직접 선택',side:'left'}]);break;}
 await sleep(3000);}
log.shape.seconds=Math.round((Date.now()-t1)/1000);save();
src=await shot(p,'m5_done');await annotate(src,'M5-08-done',[{box:await panel.boundingBox(),n:1,label:'생성 결과',side:'left'}]);
await b.close();
