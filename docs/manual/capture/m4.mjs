// M4 챗봇 기능 촬영. 사용: node m4.mjs [티켓ID ...] (생략 시 기본 목록)
import {launch,openStudent,shot,sleep,boxes,clearMine,closeNotice,finishVideo,at} from './lib.mjs';
import {annotate,zoom,union,toMp4,pair} from './tools.mjs';
import fs from 'node:fs';
const want=process.argv.slice(2);
const LOGF='out/m4_log.json',log=fs.existsSync(LOGF)?JSON.parse(fs.readFileSync(LOGF,'utf8')):{};
const save=()=>fs.writeFileSync(LOGF,JSON.stringify(log,null,1));
const b=await launch();
const s=await openStudent(b,1,{record:true}),p=s.page;
const cnt=async(q=p)=>(await q.getByLabel('에셋 수').textContent()).split(' ')[0]*1;
const R=sel=>p.locator(sel).first();
const L=n=>p.getByRole('button',{name:n+' 배치'});
const objs=async(q=p)=>q.locator('.scene-list button[aria-label$=" 선택"]').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label').replace(/ 선택$/,'')));
async function zoomIn(q=p,lo=7.5,hi=10){await q.keyboard.press('Escape');for(let i=0;i<12;i++){const D=parseFloat(await q.getByLabel('카메라 거리').textContent());if(D>hi)await q.getByRole('button',{name:'확대',exact:true}).click();else if(D<lo)await q.getByRole('button',{name:'축소',exact:true}).click();else break;await sleep(200);}}
async function fresh(q=p){await clearMine(q);await q.keyboard.press('Escape');await closeNotice(q);await sleep(500);}
async function place(n,q=p){const c=await cnt(q);await q.getByRole('button',{name:n+' 배치'}).dblclick();await q.getByLabel('에셋 수').filter({hasText:new RegExp('^'+(c+1)+' ')}).waitFor({timeout:8000}).catch(()=>{});await sleep(500);}
async function selFirst(q=p){await q.locator('.scene-list button[aria-label$=" 선택"]').first().click();await sleep(500);}
async function select(name,q=p){await q.getByRole('button',{name:name+' 선택'}).first().click();await sleep(500);}
// AI 요청: 보내고 처리 완료(적용 취소 버튼 사라짐)까지 대기. 마지막 대화 카드 반환
async function ask(text,q=p,{timeout=120000}={}){
 await q.getByLabel('AI에게 요청').fill(text);await sleep(300);
 const before=await q.locator('.chat-log article').count();
 await q.getByRole('button',{name:'AI 요청 보내기'}).click();
 await q.locator('.chat-log article').nth(before).waitFor({timeout:10000});
 await sleep(500);const t0=Date.now();
 while(Date.now()-t0<timeout){if(!(await q.getByRole('button',{name:'적용 취소'}).count()))break;await sleep(400);}
 await sleep(1200);
 const art=q.locator('.chat-log article').last();art.scrollIntoViewIfNeeded().catch(()=>{});
 return {text:(await art.innerText()).replace(/\n+/g,' / '),art};
}
const chatBox=async(q=p)=>{const a=await q.locator('.chat-log article').last().boundingBox();return a;};
const propBox=async(q=p)=>{const rp=await q.locator('.right-panel').first().boundingBox();const dl=await q.getByRole('button',{name:'삭제',exact:true}).boundingBox().catch(()=>null);return dl?{x:rp.x,y:rp.y,width:rp.width,height:dl.y+dl.height+8-rp.y}:null;};
// 표준 전후 촬영: before/after 스샷 + 대화 카드 확대
async function beforeAfter(id,request,{prep=()=>{},marksBefore=[],selectName,label='AI 응답'}={}){
 await prep();if(selectName)await select(selectName);
 const c0=await cnt(),o0=await objs();
 const bx0={ta:await R('.chat-input').boundingBox(),...Object.fromEntries(await Promise.all(marksBefore.map(async([k,loc])=>[k,await loc.boundingBox().catch(()=>null)])))};
 await p.getByLabel('AI에게 요청').fill(request);await sleep(300);
 const srcB=await shot(p,id+'_before');
 await annotate(srcB,id+'-before',[{box:bx0.ta,n:1,label:'요청: '+request.slice(0,18)+(request.length>18?'…':''),side:'left'},...marksBefore.map(([k],i)=>({box:bx0[k],n:i+2}))]);
 await p.getByLabel('AI에게 요청').fill('');
 const t=at(s);const r=await ask(request);const t1=at(s);
 const c1=await cnt(),o1=await objs();const cb=await chatBox();const count=await p.getByLabel('에셋 수').boundingBox();
 const srcA=await shot(p,id+'_after');
 await annotate(srcA,id+'-after',[{box:cb,n:1,label,side:'left'},{box:count,n:2,label:`에셋 수 ${c0}→${c1}`}]);
 if(cb)await zoom(srcA,id+'-chat',cb,{margin:12,marks:[]});
 log[id]={request,response:r.text,count:[c0,c1],objects:[o0,o1],t:[t,t1]};save();console.log(id,JSON.stringify(log[id]).slice(0,300));
 return {c0,c1,r,srcB,srcA};
}
let m409;
const T={
 'M4-01':async()=>{await fresh();await zoomIn();
  const bx=await boxes(p,{log:R('.chat-log'),ta:p.getByLabel('AI에게 요청'),send:p.getByRole('button',{name:'AI 요청 보내기'}),cap:R('.chat-caption'),title:R('.assistant-title')});
  const src=await shot(p,'M4-01_panel');
  await annotate(src,'M4-01-panel',[{box:bx.title,n:1,label:'AI 도우미',side:'left'},{box:bx.log,n:2,label:'대화 기록',side:'left'},{box:bx.ta,n:3,label:'요청 입력',side:'left'},{box:bx.send,n:4},{box:bx.cap,n:5,label:'강사 열람 안내',side:'left'}]);
  await zoom(src,'M4-01-panel-zoom',union(bx.title,bx.cap),{margin:10});},
 'M4-03':async()=>{await fresh();await zoomIn();await beforeAfter('M4-03','벤치 하나 놔줘');},
 'M4-04':async()=>{await fresh();await zoomIn();await place('둥근 테이블');const v0=at(s);
  await beforeAfter('M4-04','선택한 탁자 주위에 새 의자 4개를 반경 2m로 배치해 줘',{selectName:'둥근 테이블'});log['M4-04'].video=[v0,at(s)];save();},
 'M4-05':async()=>{await p.keyboard.press('Escape');await beforeAfter('M4-05','의자들 한 줄로 세워줘');},
 'M4-06':async()=>{await select('라운지 의자');await p.getByLabel('위치 X').fill('5');await p.getByLabel('위치 X').press('Enter');await sleep(500);await p.keyboard.press('Escape');
  await beforeAfter('M4-06','의자들 간격 똑같이 맞춰줘');},
 'M4-07':async()=>{await fresh();await zoomIn();await beforeAfter('M4-07','화분 세 개 여기저기 놔줘');},
 'M4-08':async()=>{await fresh();await zoomIn();await place('둥근 테이블');await place('화분');await select('화분');await p.getByLabel('위치 X').fill('3');await p.getByLabel('위치 X').press('Enter');await sleep(500);await p.keyboard.press('Escape');
  await beforeAfter('M4-08','화분을 탁자 위에 올려줘');await select('화분');log['M4-08'].potY=await p.getByLabel('위치 Y').inputValue();save();},
 'M4-09':async()=>{for(let k=0;k<3;k++){await m409();const r=log['M4-09'];r.attempt=k+1;save();if(r.rotY&&r.rotY.some(x=>!x.startsWith('0/')))break;}},
 'M4-09x':async()=>{await fresh();await zoomIn();await place('둥근 테이블');await select('둥근 테이블');await p.getByLabel('위치 X').fill('3');await p.getByLabel('위치 X').press('Enter');await sleep(400);
  for(const z of ['-2','0','2']){await place('라운지 의자');await p.getByLabel('위치 X').fill('-2');await p.getByLabel('위치 X').press('Enter');await p.getByLabel('위치 Z').fill(z);await p.getByLabel('위치 Z').press('Enter');await sleep(400);}
  await p.keyboard.press('Escape');await p.locator('.scene-list button[aria-label="라운지 의자 선택"]').first().click();await sleep(400);await beforeAfter('M4-09',process.env.M409||'이 의자가 탁자를 보게 해줘');
  const rots=[];const items=p.locator('.scene-list button[aria-label="라운지 의자 선택"]');for(let i=0;i<await items.count();i++){await items.nth(i).scrollIntoViewIfNeeded();await items.nth(i).click();await sleep(400);rots.push(await p.getByLabel('회전 Y').inputValue()+'/'+await p.getByLabel('위치 X').inputValue());}log['M4-09'].rotY=rots;save();},
 'M4-10':async()=>{await fresh();await zoomIn();for(const n of ['둥근 테이블','라운지 의자','라운지 의자','화분','둥근 나무','공원 벤치'])await place(n);
  await p.keyboard.press('Escape');const r=await beforeAfter('M4-10','알아서 어울리게 정리해줘');await pair(r.srcB,r.srcA,'M4-10-compare',['정리 전','정리 후']);},
 'M4-11':async()=>{await fresh();await zoomIn();const v0=at(s);await beforeAfter('M4-11','카페처럼 탁자랑 의자랑 화분으로 꾸며줘');log['M4-11'].video=[v0,at(s)];save();},
 'M4-12':async()=>{await fresh();await zoomIn();await place('공원 벤치');await select('공원 벤치');await p.getByLabel('위치 X').fill('3');await p.getByLabel('위치 X').press('Enter');await sleep(500);const pb=async()=>await propBox();
  const st=async()=>{await selFirst();return {x:+await p.getByLabel('위치 X').inputValue(),y:+await p.getByLabel('위치 Y').inputValue(),r:+await p.getByLabel('회전 Y').inputValue(),rx:+await p.getByLabel('회전 X').inputValue(),rz:+await p.getByLabel('회전 Z').inputValue(),sc:+await p.getByLabel('크기 X').inputValue(),name:await p.getByLabel('에셋 이름').inputValue(),n:await cnt()};};
  const sh=async(id,req,ok,{props=true}={})=>{const fails=[];for(let k=0;k<3;k++){const s0=await st();let b0=await pb();const sp=await shot(p,id+'_pb');if(props)await zoom(sp,id+'-props-before',b0,{margin:6});
    await selFirst();await beforeAfter(id,req);const s1=await st();
    if(ok(s0,s1)){const sa=await shot(p,id+'_pa');if(props)await zoom(sa,id+'-props-after',await pb(),{margin:6});log[id].state=[s0,s1];log[id].attempts=k+1;log[id].failures=fails;save();return;}
    fails.push({before:s0,after:s1,response:log[id].response});if(JSON.stringify(s0)!==JSON.stringify(s1)){await p.getByRole('button',{name:'되돌리기',exact:true}).click();await sleep(800);}}
   log[id].attempts='3회 실패';log[id].failures=fails;save();};
  await sh('M4-12','이거 왼쪽으로 1미터 옮겨줘',(a,b)=>Math.abs(b.x-(a.x-1))<.01);
  await sh('M4-13','이거 두 배 크게 해줘',(a,b)=>Math.abs(b.sc-2*a.sc)<.01);
  await sh('M4-14',process.env.M414||'이거 45도 돌려줘',(a,b)=>Math.abs(((b.r-a.r)%360+360)%360-45)<.6&&Math.abs(b.rx-a.rx)<.1&&Math.abs(b.rz-a.rz)<.1);
  await sh('M4-16','이거 이름 쉼터로 바꿔줘',(a,b)=>b.name==='쉼터');
  await selFirst();await p.getByLabel('위치 Y').fill('1.5');await p.getByLabel('위치 Y').press('Enter');await sleep(600);
  await sh('M4-18','이거 바닥에 붙여줘',(a,b)=>Math.abs(b.y)<.01);
  await sh('M4-15','이거 세 개 복사해줘',(a,b)=>b.n===a.n+3,{props:false});
  await sh('M4-17','이거 지워줘',(a,b)=>b.n===a.n-1,{props:false});},
 'M4-19':async()=>{await fresh();await zoomIn();await place('둥근 나무');await place('화분');await p.keyboard.press('Escape');await beforeAfter('M4-19','나무 어디 있어?',{label:'조회 결과'});},
 'M4-20':async()=>{await p.keyboard.press('Escape');await beforeAfter('M4-20','내가 뭐 놨지?',{label:'목록 응답'});await beforeAfter('M4-20b','현재 씬 설명해줘',{label:'공간 설명'});},
 'M4-22':async()=>{await fresh();await zoomIn();await place('둥근 테이블');await p.keyboard.press('Escape');await beforeAfter('M4-22','뭐 놓으면 어울릴까?',{label:'추천 에셋'});
  const btn=p.locator('.chat-suggestions button').filter({hasText:'놓기'}).first();if(await btn.count()){const bb=await btn.boundingBox();const s0=await shot(p,'M4-22_card');await annotate(s0,'M4-22-card',[{box:await p.locator('.chat-suggestions').last().boundingBox(),n:1,label:'추천 카드',side:'left'},{box:bb,n:2,label:'놓기'}]);
   const c0=await cnt();await btn.click();await sleep(2000);const c1=await cnt();const s1=await shot(p,'M4-22_placed');await annotate(s1,'M4-22-placed',[{box:await p.getByLabel('에셋 수').boundingBox(),n:1,label:`에셋 수 ${c0}→${c1}`}]);log['M4-22'].placeClick=[c0,c1];save();}else{log['M4-22'].placeClick='놓기 버튼 없음';save();}},
 'M4-24':async()=>{await fresh();await zoomIn();await p.getByLabel('AI에게 요청').fill('화분 다섯 개를 탁자 주변에 예쁘게 놔줘');await p.getByRole('button',{name:'AI 요청 보내기'}).click();
  const cb=p.getByRole('button',{name:'적용 취소'});await cb.waitFor({timeout:8000});await sleep(300);const s0=await shot(p,'M4-24_pending');
  await annotate(s0,'M4-24-pending',[{box:await cb.boundingBox(),n:1,label:'처리 중 적용 취소',side:'left'}]);const c0=await cnt();await cb.click();
  const t0=Date.now();while(Date.now()-t0<60000&&await cb.count())await sleep(400);await sleep(1500);const c1=await cnt();const r=(await p.locator('.chat-log article').last().innerText()).replace(/\n+/g,' / ');
  const s1=await shot(p,'M4-24_after');await annotate(s1,'M4-24-after',[{box:await chatBox(),n:1,label:'취소 결과',side:'left'},{box:await p.getByLabel('에셋 수').boundingBox(),n:2,label:`에셋 수 ${c0}→${c1}`}]);log['M4-24']={count:[c0,c1],response:r};save();},
 'M4-25':async()=>{await fresh();await zoomIn();await place('둥근 테이블');await beforeAfter('M4-25','선택한 탁자 주위에 새 의자 4개를 반경 2m로 배치해 줘',{selectName:'둥근 테이블'});
  const btn=p.getByRole('button',{name:'방금 거 취소',exact:true});const bb=await btn.boundingBox();const s0=await shot(p,'M4-25_btn');await annotate(s0,'M4-25-cancel-button',[{box:bb,n:1,label:'방금 거 취소',side:'left'}]);
  const c0=await cnt();const v0=at(s);await btn.click();await sleep(2000);const c1=await cnt();const s1=await shot(p,'M4-25_after');await annotate(s1,'M4-25-cancelled',[{box:await p.getByRole('button',{name:'취소했어요'}).boundingBox().catch(()=>bb),n:1,label:'취소했어요',side:'left'},{box:await p.getByLabel('에셋 수').boundingBox(),n:2,label:`에셋 수 ${c0}→${c1}`}]);
  log['M4-25'].cancel=[c0,c1];log['M4-25'].video=[v0,at(s)];save();},
 'M4-26':async()=>{await fresh();await zoomIn();await place('공원 벤치');await p.keyboard.press('Escape');await beforeAfter('M4-26','되돌려줘');await beforeAfter('M4-26b','다시 해줘');},
 'M4-27':async()=>{await fresh();await zoomIn();await place('라운지 의자');await p.keyboard.press('Escape');await beforeAfter('M4-27','내 의자 잠가줘',{label:'잠금 응답'});
  const s0=await shot(p,'M4-27_locked');await annotate(s0,'M4-27-locked-scene',[{box:await R('.scene-list').boundingBox(),n:1,label:'잠금 상태',side:'above'}]);await beforeAfter('M4-27b','의자 잠금 풀어줘',{label:'해제 응답'});},
 'M4-28':async()=>{await fresh();await zoomIn();await place('공원 벤치');const s2=await openStudent(b,2);const q=s2.page;await zoomIn(q);await sleep(800);
  const c0=await cnt(q);await q.getByLabel('AI에게 요청').fill('다른 애 벤치 지워줘');const sb=await shot(q,'M4-28_before');await annotate(sb,'M4-28-before',[{box:await q.locator('.chat-input').boundingBox(),n:1,label:'학생 2 요청',side:'left'}]);await q.getByLabel('AI에게 요청').fill('');
  const r=await ask('다른 애 벤치 지워줘',q);const c1=await cnt(q);const sa=await shot(q,'M4-28_after');
  await annotate(sa,'M4-28-after',[{box:await q.locator('.chat-log article').last().boundingBox(),n:1,label:'거절 응답',side:'left'},{box:await q.getByLabel('에셋 수').boundingBox(),n:2,label:`에셋 수 ${c0}→${c1}`}]);await zoom(sa,'M4-28-chat',await q.locator('.chat-log article').last().boundingBox(),{margin:12});
  log['M4-28']={response:r.text,count:[c0,c1]};save();await s2.ctx.close();},
 'M4-31':async()=>{await fresh();await zoomIn();await place('공원 벤치');await select('공원 벤치');await beforeAfter('M4-31','이거 금색으로 바꿔줘',{label:'재질 변경 응답'});},
 'M4-23':async()=>{await fresh();await zoomIn();await place('둥근 테이블');await p.keyboard.press('Escape');
  for(const req of ['어울리는 거 하나 만들어줘','탁자에 어울리는 새 에셋 하나 만들어줘','뭐 놓으면 어울릴까?']){await beforeAfter('M4-23',req,{label:'추천 결과'});
   const list=p.locator('.chat-suggestions').last();const btn=list.locator('button',{hasText:'만들기'}).first();
   if(await btn.count()){await list.scrollIntoViewIfNeeded();await sleep(500);const s0=await shot(p,'M4-23_card');await annotate(s0,'M4-23-card',[{box:await list.boundingBox(),n:1,label:'추천 카드',side:'left'},{box:await btn.boundingBox(),n:2,label:'만들기'}]);
    await btn.click();await sleep(3000);const s1=await shot(p,'M4-23_made');await annotate(s1,'M4-23-generating',[{box:await chatBox(),n:1,label:'생성 요청 접수',side:'left'}]);log['M4-23'].made=req;save();return;}}
  log['M4-23'].made='만들기 카드 미출현';save();},
 'M4-29':async()=>{await p.keyboard.press('Escape');await beforeAfter('M4-29','피 흘리며 싸우는 좀비 만들어줘',{label:'거절 응답'});},
};
const order=want.length?want:['M4-01','M4-03','M4-04','M4-05','M4-06','M4-07','M4-08','M4-09','M4-10','M4-11','M4-12','M4-19','M4-20','M4-22','M4-24','M4-25','M4-26','M4-27','M4-28','M4-29'];
m409=T['M4-09x'];
for(const id of order){try{await T[id]();}catch(e){console.log('FAIL',id,e.message.split('\n')[0]);log[id+'_error']=e.message.split('\n')[0];save();}}
const vid=await finishVideo(s);log._video=vid;save();
const cut=(id,name,pre=1,post=2,max=14)=>{const v=log[id]?.video;if(v&&order.includes(id))toMp4(vid,name,{start:Math.max(0,v[0]-pre),dur:Math.min(max,v[1]-v[0]+pre+post)});};
cut('M4-04','M4-04-around');cut('M4-11','M4-11-cafe',1,2,16);cut('M4-25','M4-25-cancel',1,1.5,6);
await b.close();
