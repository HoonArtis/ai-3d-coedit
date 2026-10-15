// M6 캐릭터 + M8 VR 감상(학생 2 자리 사용)
import {launch,openStudent,shot,sleep,boxes,closeNotice,loadState,CTX,WEB} from './lib.mjs';
import {annotate,zoom,union} from './tools.mjs';
import fs from 'node:fs';
const LOGF='out/m68_log.json',log={};const save=()=>fs.writeFileSync(LOGF,JSON.stringify(log,null,1));
const st=loadState(),b=await launch();
let s=await openStudent(b,2);let p=s.page;await closeNotice(p);
// M6-01 블록 캐릭터 색 선택
await p.getByRole('button',{name:'내 캐릭터'}).first().click();await sleep(1500);
const dlg=p.getByRole('dialog').first();const pv=p.getByLabel('내 블록 캐릭터 3D 미리보기');
log.picker=(await dlg.innerText().catch(()=>'')).slice(0,400);
const presets=dlg.getByRole('button',{name:/노을|바다|숲|보라/});log.presetCount=await presets.count();
if(log.presetCount)await presets.nth(1).click();await sleep(1200);
let bx=await boxes(p,{dlg,pv,presets:dlg.getByRole('button',{name:'노을'}),colors:dlg.getByLabel('피부 색'),apply:dlg.getByRole('button',{name:'내 캐릭터 적용'}),useUp:dlg.getByRole('button',{name:'기존 업로드 캐릭터 사용'})});
const colorsBox=union(...(await Promise.all(['피부','머리','상의','바지'].map(n=>dlg.getByLabel(n+' 색').boundingBox().catch(()=>null)))));
let src=await shot(p,'m6_picker');
await annotate(src,'M6-01-block-character',[{box:bx.pv,n:1,label:'3D 미리보기',side:'left'},{box:union(bx.presets,...(await Promise.all(['바다','숲','보라'].map(n=>dlg.getByRole('button',{name:n}).boundingBox().catch(()=>null))))),n:2,label:'프리셋 4종',side:'left'},{box:colorsBox,n:3,label:'피부·머리·상의·바지 색',side:'left'}]);
if(bx.pv)await zoom(src,'M6-01-preview-zoom',bx.pv,{margin:6});
// M6-02 적용 → 재입장 유지
const shirt=dlg.getByLabel('상의 색');const before={shirt:await shirt.inputValue().catch(()=>null)};
await dlg.getByRole('button',{name:'내 캐릭터 적용'}).click();await sleep(2000);log.applyMsg=(await dlg.innerText().catch(()=>'')).match(/현재 내 VR 캐릭터예요\.|적용[^\n]*/)?.[0]||null;
src=await shot(p,'m6_applied');await annotate(src,'M6-02-applied',[{box:await dlg.getByRole('button',{name:/내 캐릭터 적용|적용/}).first().boundingBox().catch(()=>null),n:1,label:'내 캐릭터 적용',side:'left'},{box:bx.useUp,n:2,label:'기존 업로드 캐릭터 사용',side:'left'}]);
await p.reload();await p.getByText('서버 연결됨',{exact:true}).waitFor();await sleep(1200);
await p.getByRole('button',{name:'내 캐릭터'}).first().click();await sleep(1500);
const after={shirt:await p.getByRole('dialog').first().getByLabel('상의 색').inputValue().catch(()=>null)};log.persist={before,after};save();
src=await shot(p,'m6_reloaded');await annotate(src,'M6-02-after-reload',[{box:await p.getByLabel('내 블록 캐릭터 3D 미리보기').boundingBox().catch(()=>null),n:1,label:'재입장 후 동일 캐릭터',side:'left'}]);
await p.getByLabel('캐릭터 닫기').click().catch(()=>{});await sleep(500);
// M6-03 캐릭터 업로드 입력
await p.getByText('새 에셋 만들기',{exact:true}).click();await sleep(800);
const cu=p.getByLabel('캐릭터 업로드');await cu.scrollIntoViewIfNeeded();const note=p.getByText(/캐릭터는 뼈대와/).first();
src=await shot(p,'m6_upload');await annotate(src,'M6-03-character-upload',[{box:union(await p.getByText('캐릭터 업로드').first().boundingBox(),await note.boundingBox().catch(()=>null)),n:1,label:'리깅 캐릭터 업로드',side:'left'}]);
log.uploadNote=await note.innerText().catch(()=>null);log.accept=await cu.getAttribute('accept');save();
// M8-01 VR 감상 화면
await p.getByRole('link',{name:'VR 감상'}).click();await sleep(2500);
bx=await boxes(p,{h:p.getByRole('heading',{name:/VR 감상/}).first(),submit:p.getByRole('button',{name:'현재 작품 제출'}),list:p.getByLabel('제출 작품')});
src=await shot(p,'m8_lobby');await annotate(src,'M8-01-vr-lobby',[{box:bx.submit,n:1,label:'현재 작품 제출'},{box:bx.list,n:2,label:'제출 작품 목록'}]);
// M8-02 제출
const t0=Date.now();await p.getByRole('button',{name:'현재 작품 제출'}).click();
const prev=p.getByRole('button',{name:/제출본.*미리보기/}).first();await prev.waitFor({timeout:120000}).catch(()=>{});log.submitSec=Math.round((Date.now()-t0)/1000);await sleep(1000);
src=await shot(p,'m8_submitted');await annotate(src,'M8-02-submitted',[{box:await prev.boundingBox().catch(()=>null),n:1,label:'제출본 생성',side:'left'}]);
log.list=(await p.getByLabel('제출 작품').innerText().catch(()=>'')).slice(0,300);save();
// M8-03 미리보기
await prev.click().catch(()=>{});await p.getByText(/읽기 전용 장면 준비 완료|준비 완료/).first().waitFor({timeout:60000}).catch(()=>{});await sleep(2500);
const ready=p.getByText(/읽기 전용 장면 준비 완료/).first();log.ready=await ready.count();
bx=await boxes(p,{ready,enter:p.getByRole('button',{name:'VR 입장'}),viewers:p.getByLabel('함께 감상하는 사람'),canvas:p.locator('canvas').first()});
src=await shot(p,'m8_preview');await annotate(src,'M8-03-readonly-preview',[{box:bx.ready,n:1,label:'읽기 전용 장면'},{box:bx.canvas,n:2,label:'제출본 3D'}]);
// M8-04 입장 조건 / M8-05 감상 인원
log.enter={visible:await p.getByRole('button',{name:'VR 입장'}).count(),disabled:await p.getByRole('button',{name:'VR 입장'}).isDisabled().catch(()=>null)};
log.unsupported=await p.getByText(/VR 세션을 지원/).first().innerText().catch(()=>null);
log.viewers=await p.getByLabel('함께 감상하는 사람').innerText().catch(()=>null);save();
await annotate(src,'M8-04-vr-enter',[{box:bx.enter,n:1,label:'VR 입장(헤드셋 브라우저)'},{box:await p.getByText(/VR 세션을 지원/).first().boundingBox().catch(()=>null),n:2,label:'PC 미지원 안내'}]);
if(bx.viewers)await annotate(src,'M8-05-viewers',[{box:bx.viewers,n:1,label:'함께 감상하는 사람'}]);
await s.ctx.close();
// M8-06 VR 감상 전용 입장(새 브라우저)
const c=await b.newContext(CTX),q=await c.newPage();await q.goto(WEB+'/?login=1');await sleep(800);
await q.getByRole('button',{name:'VR 감상으로 입장',exact:true}).click();await q.getByLabel('수업 초대 코드').fill(st.code);
src=await shot(q,'m8_vr1');await annotate(src,'M8-06-vr-entry-1',[{box:await q.getByRole('button',{name:'VR 감상으로 입장'}).boundingBox(),n:1,label:'VR 감상으로 입장'},{box:await q.getByLabel('수업 초대 코드').boundingBox(),n:2,label:'공통 수업 코드'}]);
await q.getByRole('button',{name:'자리 선택하기'}).click();await sleep(1500);
src=await shot(q,'m8_vr2');await annotate(src,'M8-06-vr-entry-2',[{box:await q.getByRole('button',{name:'1조 학생 2 자리 선택'}).boundingBox(),n:1,label:'사용 중 자리도 감상 선택',side:'left'}]);
await q.getByRole('button',{name:'1조 학생 2 자리 선택'}).click();await sleep(2500);
const free=q.getByText(/자유 VR 감상/).first();log.freeVr=await free.innerText().catch(()=>null);
src=await shot(q,'m8_vr3');await annotate(src,'M8-06-vr-entry-3',[{box:await free.boundingBox().catch(()=>null),n:1,label:'자유 VR 감상 안내'}]);
save();console.log(JSON.stringify(log).slice(0,2000));
await b.close();
