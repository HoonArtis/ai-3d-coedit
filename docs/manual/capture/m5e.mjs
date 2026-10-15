// M5-04/05(업로드)/06/14/15/16/17 + M4-30/31 촬영
import {launch,openStudent,shot,sleep,boxes,closeNotice} from './lib.mjs';
import {annotate,zoom,union} from './tools.mjs';
import fs from 'node:fs';
const LOGF='out/m5_log.json',log=JSON.parse(fs.readFileSync(LOGF,'utf8'));const save=()=>fs.writeFileSync(LOGF,JSON.stringify(log,null,1));
const STEP=(process.env.STEP||'upload,queue,redraw,hide,retex').split(',');
const b=await launch();
const s=await openStudent(b,1);const p=s.page;await closeNotice(p);
const openGen=async q=>{if(!(await q.getByLabel('생성할 물건 설명').isVisible().catch(()=>false))){await q.getByText('새 에셋 만들기',{exact:true}).click();await sleep(800);}};
const job=(q,name)=>q.locator('.generation-job').filter({hasText:name}).first();
async function waitText(loc,re,sec=600){const t0=Date.now();while(Date.now()-t0<sec*1000){const t=await loc.innerText().catch(()=>'');if(re.test(t))return t;await sleep(3000);}return null;}
async function askChat(q,text){await q.getByLabel('AI에게 요청').fill(text);const n=await q.locator('.chat-log article').count();await q.getByRole('button',{name:'AI 요청 보내기'}).click();await q.locator('.chat-log article').nth(n).waitFor();const t0=Date.now();while(Date.now()-t0<120000&&await q.getByRole('button',{name:'적용 취소'}).count())await sleep(400);await sleep(1500);return (await q.locator('.chat-log article').last().innerText()).replace(/\n+/g,' / ');}
await openGen(p);

if(STEP.includes('upload')){ // M5-05 그림 업로드 → 확인 단계
 await p.getByLabel('그림 업로드').setInputFiles('../media/M5-05-image-zoom.png');await sleep(4000);
 const j=p.locator('.generation-job').filter({has:p.getByRole('button',{name:'이 이미지로 3D 만들기'})}).first();await j.scrollIntoViewIfNeeded();
 const bx=await boxes(p,{up:p.getByText('그림 업로드').first(),j,c:j.getByRole('button',{name:'이 이미지로 3D 만들기'})});
 const src=await shot(p,'m5_upload');await annotate(src,'M5-05-upload-confirm',[{box:bx.up,n:1,label:'그림 업로드',side:'left'},{box:bx.j,n:2,label:'업로드 이미지 확인',side:'left'}]);
 log.upload={job:(await j.innerText()).slice(0,200)};save();}

if(STEP.includes('queue')){ // M5-04 대기 요청 취소 + M4-30 자연어 생성 요청
 await p.getByLabel('생성할 물건 설명').fill('노란 오리 모양 의자');await p.getByRole('button',{name:'이미지 그리기',exact:true}).click();await sleep(2500);
 const s2=await openStudent(b,2);const q=s2.page;await closeNotice(q);
 const r=await askChat(q,'빨간 우산 쓴 고양이 만들어줘');log.m430={response:r};save();
 let src=await shot(q,'m4_30_chat');await annotate(src,'M4-30-chat-generate',[{box:await q.locator('.chat-log article').last().boundingBox(),n:1,label:'생성 시작 안내',side:'left'}]);
 await openGen(q);const cj=job(q,'고양이');await cj.scrollIntoViewIfNeeded().catch(()=>{});await sleep(1000);
 const cancel=q.getByRole('button',{name:'대기 요청 취소'});log.queue={jobText:(await cj.innerText().catch(()=>'')).slice(0,160),cancelVisible:await cancel.count()};
 src=await shot(q,'m5_queue');
 if(log.queue.cancelVisible){await annotate(src,'M5-04-queued',[{box:await cj.boundingBox(),n:1,label:'대기 순번',side:'left'},{box:await cancel.first().boundingBox(),n:2,label:'대기 요청 취소',side:'left'}]);
  await cancel.first().click();await sleep(2500);src=await shot(q,'m5_queue_cancelled');log.queue.after=(await cj.innerText().catch(()=>'')).slice(0,160);
  await annotate(src,'M5-04-cancelled',[{box:await cj.boundingBox().catch(()=>null),n:1,label:'요청 취소·횟수 반환',side:'left'}]);}
 save();await s2.ctx.close();}

if(STEP.includes('redraw')){ // M5-06 다시 그리기(오리 의자 확인 대기 상태에서)
 const dj=job(p,'오리');const ok=await waitText(dj,/이미지를 확인해 주세요|이 이미지로 3D/,420);log.redraw={ready:!!ok};
 if(ok){await dj.scrollIntoViewIfNeeded();const rb=dj.getByRole('button',{name:'설명으로 다시 그리기'});let src=await shot(p,'m5_redraw_before');
  await annotate(src,'M5-06-redraw-before',[{box:await dj.locator('img').first().boundingBox().catch(()=>null),n:1,label:'첫 이미지',side:'left'},{box:await rb.boundingBox(),n:2,label:'설명으로 다시 그리기',side:'left'}]);
  await rb.click();await sleep(3000);const ok2=await waitText(dj,/이미지를 확인해 주세요|이 이미지로 3D/,420);log.redraw.second=!!ok2;await dj.scrollIntoViewIfNeeded();
  src=await shot(p,'m5_redraw_after');await annotate(src,'M5-06-redraw-after',[{box:await dj.locator('img').first().boundingBox().catch(()=>null),n:1,label:'다시 그린 이미지',side:'left'}]);}
 save();}

if(STEP.includes('hide')){ // M5-16 숨김·복구, M5-17 삭제 확인창(업로드 이미지 대상)
 const uj=p.locator('.generation-job').filter({has:p.getByRole('button',{name:'목록에서 숨기기'})}).last();await uj.scrollIntoViewIfNeeded();
 const name=(await uj.innerText()).split('\n').slice(0,2).join(' ');log.hide={target:name};
 let src=await shot(p,'m5_hide0');await annotate(src,'M5-16-hide',[{box:await uj.getByRole('button',{name:'목록에서 숨기기'}).boundingBox(),n:1,label:'목록에서 숨기기',side:'left'}]);
 await uj.getByRole('button',{name:'목록에서 숨기기'}).click();await sleep(1500);
 const show=p.getByRole('button',{name:/숨긴 항목 보기/});log.hide.showBtn=await show.count();
 if(log.hide.showBtn){src=await shot(p,'m5_hide1');await annotate(src,'M5-16-hidden',[{box:await show.boundingBox(),n:1,label:'숨긴 항목 보기',side:'left'}]);await show.click();await sleep(1200);
  const rs=p.getByRole('button',{name:'다시 표시'}).first();src=await shot(p,'m5_hide2');await annotate(src,'M5-16-restore',[{box:await rs.boundingBox(),n:1,label:'다시 표시',side:'left'}]);await rs.click();await sleep(1200);}
 const del=p.getByRole('button',{name:'이미지 삭제'}).first();if(await del.count()){await del.scrollIntoViewIfNeeded();await del.click();await sleep(800);const dlg=p.getByLabel('이미지 삭제 확인');log.hide.dialog=(await dlg.innerText().catch(()=>'')).slice(0,200);
  src=await shot(p,'m5_delete');await annotate(src,'M5-17-delete-confirm',[{box:await dlg.boundingBox(),n:1,label:'삭제 확인',side:'left'}]);await dlg.getByRole('button',{name:'삭제하지 않기'}).click().catch(()=>{});await sleep(500);}
 save();}

if(STEP.includes('retex')){ // M5-14 재질 변경 요청 → M5-15 완성 재질 적용, M4-31 자연어 재질 변경
 await p.locator('.scene-list button[aria-label="파란 고래 모양 벤치 선택"]').first().click();await sleep(600);
 await p.getByLabel('변경할 재질 설명').fill('반짝이는 금색 금속 재질');let src=await shot(p,'m5_retex0');
 await annotate(src,'M5-14-retexture-request',[{box:union(await p.getByLabel('변경할 재질 설명').boundingBox(),await p.getByRole('button',{name:'재질 변경 요청'}).boundingBox()),n:1,label:'재질 설명 + 요청',side:'left'}]);
 const vb=await p.locator('.viewport').boundingBox();const area={x:vb.x+vb.width*.2,y:vb.y+vb.height*.1,width:vb.width*.6,height:vb.height*.8};await zoom(src,'M5-15-before',area,{margin:0});
 await p.getByRole('button',{name:'재질 변경 요청'}).click();await sleep(3000);
 await openGen(p);const rj=job(p,'금색');await rj.scrollIntoViewIfNeeded().catch(()=>{});src=await shot(p,'m5_retex1');
 await annotate(src,'M5-14-retexture-queued',[{box:await rj.boundingBox().catch(()=>null),n:1,label:'재질 변경 진행',side:'left'}]);
 const done=await waitText(rj,/원래 객체에 완성 재질|완성됐어요|실패/,1500);log.retex={done:(done||'').slice(0,200)};save();
 const ap=p.getByRole('button',{name:/원래 객체에 완성 재질/});
 if(await ap.count()){await rj.scrollIntoViewIfNeeded();src=await shot(p,'m5_retex2');await annotate(src,'M5-15-apply-button',[{box:await ap.first().boundingBox(),n:1,label:'완성 재질 적용',side:'left'}]);
  await ap.first().click();await sleep(4000);await p.keyboard.press('Escape');await sleep(1000);src=await shot(p,'m5_retex3');await zoom(src,'M5-15-after',area,{margin:0});log.retex.applied=true;save();}
 // M4-31 자연어 재질 변경 요청
 await p.locator('.scene-list button[aria-label$=" 선택"]').first().click();await sleep(500);
 const r=await askChat(p,'이거 빨간색으로 바꿔줘');log.m431={response:r};save();
 src=await shot(p,'m4_31');await annotate(src,'M4-31-chat-retexture',[{box:await p.locator('.chat-log article').last().boundingBox(),n:1,label:'재질 변경 요청 접수',side:'left'}]);}
console.log(JSON.stringify({upload:log.upload,queue:log.queue,m430:log.m430,redraw:log.redraw,hide:log.hide,retex:log.retex,m431:log.m431}).slice(0,2000));
await b.close();
