// M7 강사 기능 촬영. PART=1(장면 변경 없음) / PART=2(이력·복원)
import {launch,openTeacher,shot,sleep,boxes,WEB} from './lib.mjs';
import {annotate,zoom,union} from './tools.mjs';
import fs from 'node:fs';
const LOGF='out/m7_log.json',log=fs.existsSync(LOGF)?JSON.parse(fs.readFileSync(LOGF,'utf8')):{};const save=()=>fs.writeFileSync(LOGF,JSON.stringify(log,null,1));
const PART=process.env.PART||'1';
const b=await launch();const t=await openTeacher(b);const p=t.page;await p.getByRole('heading',{name:'내 수업',exact:true}).waitFor();await sleep(1200);
const card=p.locator('.class-card').filter({has:p.getByRole('heading',{name:'AI 공간 꾸미기 1반'})});
let bx,src;
if(PART==='1'||PART==='logs'){const only=PART==='logs';
 // M7-01 조별 미리보기 / M7-02 생성 한도 표시
 const thumb=card.getByRole('img',{name:'방 배치 미리보기'}).first();await thumb.scrollIntoViewIfNeeded();await sleep(500);
 bx=await boxes(p,{thumb,limit:card.getByText(/생성 횟수 제한|생성 한도/).first()});
 src=await shot(p,'m7_dash');
 await annotate(src,'M7-01-room-preview',[{box:bx.thumb,n:1,label:'1조 배치 미리보기'}]);await zoom(src,'M7-01-preview-zoom',bx.thumb,{margin:12});
 await annotate(src,'M7-02-generation-limit',[{box:bx.limit,n:1,label:'테스트 모드: 생성 횟수 무제한'}]);
 log.limitText=await card.getByText(/생성 횟수 제한|생성 한도/).first().innerText().catch(()=>null);
 // M7-03 학생 관리
 await card.getByRole('button',{name:'1조 학생 관리'}).click();await sleep(1500);
 const panel=p.getByLabel('1조 학생 관리');log.seats=await panel.innerText().catch(()=>null);save();
 bx=await boxes(p,{panel,s1:p.getByLabel('학생 1',{exact:true}),s2:p.getByLabel('학생 2',{exact:true})});
 src=await shot(p,'m7_manage');await annotate(src,'M7-03-student-status',[{box:bx.panel,n:1,label:'자리별 접속 상태'}],{pad:2});
 // M7-04 접속 종료 버튼(클릭하지 않음)
 const disc=panel.getByRole('button',{name:'접속 종료'}).first();bx=await boxes(p,{disc,del:panel.getByRole('button',{name:'학생 삭제'}).first()});
 await annotate(src,'M7-04-disconnect',[{box:bx.disc,n:1,label:'접속 종료',side:'left'},{box:bx.del,n:2,label:'학생 삭제·자리 비우기',side:'left'}]);
 // M7-05 학생 삭제 확인창 → 취소
 const del2=p.getByLabel('학생 2',{exact:true}).getByRole('button',{name:'학생 삭제'});
 if(await del2.count()){await del2.click();await sleep(800);const dlg=p.getByLabel('학생 삭제 확인');log.deleteDialog=await dlg.innerText().catch(()=>null);
  src=await shot(p,'m7_delete');await annotate(src,'M7-05-delete-confirm',[{box:await dlg.boundingBox(),n:1,label:'삭제 확인',side:'left'}]);
  await dlg.getByRole('button',{name:/취소|삭제하지 않기/}).first().click();await sleep(600);log.deleteCancelled=!(await dlg.count()&&await dlg.isVisible());}
 save();await p.getByRole('button',{name:'학생 관리 닫기'}).click().catch(()=>{});await sleep(500);
 }
 if(true){
 // M7-06/07 대화 로그
 await card.getByRole('button',{name:'학생 대화 로그 열기'}).click();await sleep(1500);
 const sel=p.getByLabel('로그 학생 선택');const opts=await sel.locator('option').evaluateAll(os=>os.map(o=>({v:o.value,t:o.textContent})));log.logOptions=opts;
 const s1opt=opts.find(o=>/학생 1/.test(o.t)),s2opt=opts.find(o=>/학생 2/.test(o.t));log.initialEmpty=await p.getByText('저장된 대화가 없어요.').count();if(s2opt){await sel.selectOption(s2opt.v);await sleep(2000);}if(s1opt)await sel.selectOption(s1opt.v);await p.locator('.teacher-log-entry').first().waitFor({timeout:15000}).catch(()=>{});await sleep(1500);
 bx=await boxes(p,{sel,first:p.locator('.teacher-log-entry').first()});
 src=await shot(p,'m7_logs');await annotate(src,'M7-06-chat-logs',[{box:bx.sel,n:1,label:'학생 선택'},{box:bx.first,n:2,label:'대화 기록'}]);
 log.logCount=await p.locator('.teacher-log-entry').count();
 const det=p.locator('.teacher-log-entry').first().getByText('호출 명령과 원본 응답',{exact:true});
 if(await det.count()){await det.click();await sleep(600);const pre=p.locator('.teacher-log-entry').first().locator('pre');await pre.scrollIntoViewIfNeeded();
  const more=p.getByRole('button',{name:'이전 대화 더 보기'});bx=await boxes(p,{pre,more});src=await shot(p,'m7_logdetail');
  await annotate(src,'M7-07-log-detail',[{box:bx.pre,n:1,label:'호출 명령·원본 응답'},{box:bx.more,n:2,label:'이전 대화 더 보기'}]);log.preText=(await pre.innerText()).slice(0,300);}
 save();await p.getByRole('button',{name:'대화 로그 닫기'}).click().catch(()=>{});await sleep(500);
 }
 if(PART==='1'){
 // M7-08 강사 편집 참여
 const roomBtn=card.getByRole('button',{name:/1조/}).filter({hasNotText:'학생 관리'}).first();await roomBtn.click();await p.getByText('서버 연결됨',{exact:true}).waitFor({timeout:30000});await sleep(2000);
 bx=await boxes(p,{dash:p.getByRole('link',{name:'강사 대시보드'})});src=await shot(p,'m7_teacher_room');
 await annotate(src,'M7-08-teacher-room',[{box:bx.dash,n:1,label:'강사 대시보드로 복귀',side:'left'}]);log.teacherRoom=true;save();
}
if(PART==='2'){
 const roomBtn=card.getByRole('button',{name:/1조/}).filter({hasNotText:'학생 관리'}).first();await roomBtn.click();await p.getByText('서버 연결됨',{exact:true}).waitFor({timeout:30000});await sleep(2000);
 // M5-18 강사 History
 await p.getByRole('button',{name:/History/}).first().click();await sleep(1500);const tabs=p.getByLabel('에셋 History 분류');log.teacherTabs=await tabs.innerText().catch(()=>null);
 src=await shot(p,'m5_18');await annotate(src,'M5-18-teacher-history',[{box:await tabs.boundingBox(),n:1,label:'학생 에셋 · 수업 공유'},{box:await p.getByRole('dialog').locator('li,article').first().boundingBox().catch(()=>null),n:2,label:'학생이 만든 에셋',side:'right'}]);
 await p.getByRole('button',{name:/닫기/}).first().click().catch(()=>{});await sleep(600);
 for(let i=0;i<3;i++){await p.getByRole('button',{name:'확대',exact:true}).click();await sleep(150);}
 const items=p.locator('.scene-list button[aria-label$=" 선택"]');log.sceneBefore=await items.evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
 // M7-09 에셋 개별 복원: 강사가 첫 에셋을 X+4 이동 → 이전 리비전 복원
 await items.first().click();await sleep(500);const x0=await p.getByLabel('위치 X').inputValue();
 await p.getByLabel('위치 X').fill(String(+x0+4));await p.getByLabel('위치 X').press('Enter');await sleep(1200);const x1=await p.getByLabel('위치 X').inputValue();
 await p.getByRole('button',{name:'이력 · 복원'}).click();await sleep(800);await p.getByRole('button',{name:'선택 에셋 이력'}).click();await sleep(1500);
 const list=p.locator('.history-list');const btns=list.getByRole('button',{name:/에셋을 seq \d+로 복원/});log.objEntries=await btns.count();
 const target=btns.nth(1);await target.scrollIntoViewIfNeeded().catch(()=>{});
 src=await shot(p,'m7_obj_hist');await annotate(src,'M7-09-object-history',[{box:await list.boundingBox(),n:1,label:'선택 에셋 이력',side:'left'},{box:await target.boundingBox().catch(()=>null),n:2,label:'이 에셋 복원',side:'left'},{box:await p.getByLabel('위치 X').boundingBox(),n:3,label:'현재 X='+x1,side:'left'}]);
 await target.click();await sleep(2000);const x2=await p.getByLabel('위치 X').inputValue();log.objRestore={x0,x1,x2};save();
 src=await shot(p,'m7_obj_restored');await annotate(src,'M7-09-object-restored',[{box:await p.getByLabel('위치 X').boundingBox(),n:1,label:'복원 후 X='+x2,side:'left'}]);
 // M7-10 방 시점 복원: 의자 2개 배치 후 배치 이전 시점으로 복원
 await p.keyboard.press('Escape');await p.getByRole('button',{name:'방 이력'}).click();await sleep(1200);
 const firstSeq=await list.locator('strong').first().innerText();log.seqBefore=firstSeq;const c0=await p.getByLabel('에셋 수').textContent();
 for(let i=0;i<2;i++){await p.getByRole('button',{name:'라운지 의자 배치'}).dblclick();await sleep(1000);}await p.keyboard.press('Escape');await sleep(800);const c1=await p.getByLabel('에셋 수').textContent();
 await sleep(1200);const seqNum=firstSeq.match(/seq (\d+)/)[1];const rb=list.getByRole('button',{name:'방을 seq '+seqNum+'로 복원'});await rb.scrollIntoViewIfNeeded().catch(()=>{});
 src=await shot(p,'m7_room_hist');await annotate(src,'M7-10-room-history',[{box:await rb.boundingBox().catch(()=>null),n:1,label:'의자 배치 전 시점(seq '+seqNum+')',side:'left'},{box:await p.getByLabel('에셋 수').boundingBox(),n:2,label:'현재 '+c1}]);
 await rb.click();await sleep(2500);const c2=await p.getByLabel('에셋 수').textContent();log.roomRestore={c0,c1,c2,seq:seqNum};save();
 src=await shot(p,'m7_room_restored');await annotate(src,'M7-10-room-restored',[{box:await p.getByLabel('에셋 수').boundingBox(),n:1,label:'복원 후 '+c2}]);
}
console.log(JSON.stringify(log).slice(0,1800));
await b.close();
