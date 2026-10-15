// M3 메인 기능 — 실시간 협업 촬영(학생 1·2 동시)
import {launch,openStudent,shot,sleep,boxes,clearMine,finishVideo,at,projector,drag} from './lib.mjs';
import {annotate,zoom,union,sideBySide,pair} from './tools.mjs';
import fs from 'node:fs';
const b=await launch(),log={};
const s1=await openStudent(b,1,{record:true}),s2=await openStudent(b,2,{record:true});
const p1=s1.page,p2=s2.page,cnt=p=>p.getByLabel('에셋 수').textContent();
await clearMine(p2);await clearMine(p1);await sleep(800);
for(const p of [p1,p2]){await p.keyboard.press('Escape');for(let i=0;i<3;i++){await p.getByRole('button',{name:'확대',exact:true}).click();await sleep(200);}}
await sleep(1000);log.start=[await cnt(p1),await cnt(p2)];
const off=(s2.t0-s1.t0)/1000;log.offset=off; // 학생1 영상 시각 = 학생2 영상 시각 + off

// M3-01 배치 동기화
const e1=at(s1);await p1.getByRole('button',{name:'공원 벤치 배치'}).dblclick();
await p2.getByLabel('에셋 수').filter({hasText:'1 / 200'}).waitFor({timeout:10000});const e2=at(s2);await sleep(1500);
log.place={s1:e1,s2:e2,s1in2:e1-off,latency:(e2-(e1-off)).toFixed(2)};log.afterPlace=[await cnt(p1),await cnt(p2)];
const a1=await shot(p1,'m3_place_1'),a2=await shot(p2,'m3_place_2');await pair(a1,a2,'M3-01-place-sync');

// M3-02 이동 동기화(학생 1이 X축 화살표로 천천히 이동)
await p1.getByRole('button',{name:'공원 벤치 선택'}).click();await sleep(500);await p1.keyboard.press('w');await sleep(300);
let pt=await projector(p1);const m0=at(s1);
const A=pt(.8,0,0),B=pt(2.4,0,0);await p1.mouse.move(A.x,A.y,{steps:8});await sleep(200);await p1.mouse.down();
await p1.mouse.move((A.x+B.x)/2,(A.y+B.y)/2,{steps:30});await sleep(600);
// M3-03 작업 중 테두리: 학생 1 드래그 중 학생 2 화면
const mid2=await shot(p2,'m3_editing_2');
await p1.mouse.move(B.x,B.y,{steps:30});await sleep(200);await p1.mouse.up();await sleep(1500);const m1=at(s1);
log.move={from:m0,to:m1,x1:await p1.getByLabel('위치 X').inputValue()};
const b1=await shot(p1,'m3_move_1'),b2=await shot(p2,'m3_move_2');await pair(b1,b2,'M3-02-move-sync');
const vb=await p2.locator('.viewport').boundingBox();
await annotate(mid2,'M3-03-editing-outline',[{box:{x:vb.x+vb.width*0.25,y:vb.y+vb.height*0.2,width:vb.width*0.5,height:vb.height*0.55},n:1,label:'조원 작업 중 테두리'}]);

// M3-04 타인 에셋 수정 차단
await p2.getByRole('button',{name:'공원 벤치 선택'}).click();await sleep(800);
const st=p2.getByRole('status',{name:'작업 안내'});log.denied=await st.textContent().catch(()=>null);
let bx=await boxes(p2,{st,item:p2.getByRole('button',{name:'공원 벤치 선택'})});
let src=await shot(p2,'m3_denied');await annotate(src,'M3-04-not-owner',[{box:bx.st,n:1,label:'수정 권한 없음 안내'},{box:bx.item,n:2,label:'학생 1 소유',side:'above'}]);
log.noInputs=await p2.getByLabel('위치 X').count();
await p2.keyboard.press('Escape');await sleep(400);

// M3-05 개인 되돌리기
await p2.getByRole('button',{name:'화분 배치'}).dblclick();await p1.getByLabel('에셋 수').filter({hasText:'2 / 200'}).waitFor({timeout:10000});await sleep(1200);
log.beforeUndo=[await cnt(p1),await cnt(p2)];const benchX=await p1.getByLabel('위치 X').inputValue().catch(()=>null);
const c1=await shot(p1,'m3_undo_before_1'),c2=await shot(p2,'m3_undo_before_2');await pair(c1,c2,'M3-05-undo-before');
await p2.getByRole('button',{name:'되돌리기',exact:true}).click();await p1.getByLabel('에셋 수').filter({hasText:'1 / 200'}).waitFor({timeout:10000});await sleep(1200);
log.afterUndo=[await cnt(p1),await cnt(p2)];
await p1.getByRole('button',{name:'공원 벤치 선택'}).click();await sleep(400);log.benchXAfter=await p1.getByLabel('위치 X').inputValue();log.benchXBefore=benchX;
const d1=await shot(p1,'m3_undo_after_1'),d2=await shot(p2,'m3_undo_after_2');await pair(d1,d2,'M3-05-undo-after');

// M3-06 재접속 후 장면 유지
const snap=async()=>({name:await p1.getByLabel('에셋 이름').inputValue(),pos:await Promise.all(['X','Y','Z'].map(a=>p1.getByLabel('위치 '+a).inputValue())),rot:await p1.getByLabel('회전 Y').inputValue(),scale:await p1.getByLabel('크기 X').inputValue()});
log.beforeReload=await snap();
bx=await boxes(p1,{save:p1.getByText('자동 저장 사용'),count:p1.getByLabel('에셋 수')});src=await shot(p1,'m3_autosave');
await annotate(src,'M3-06-autosave',[{box:bx.save,n:1,label:'자동 저장 사용'}]);await zoom(src,'M3-06-autosave-zoom',union(bx.save,bx.count),{margin:16,marks:[{box:bx.save}]});
await p1.reload();await p1.getByText('서버 연결됨',{exact:true}).waitFor();await sleep(1500);
await p1.getByRole('button',{name:'공원 벤치 선택'}).click();await sleep(500);log.afterReload=await snap();
src=await shot(p1,'m3_reloaded');await annotate(src,'M3-06-after-reload',[{box:await p1.locator('.right-panel').boundingBox().then(r=>({...r,height:300})),n:1,label:'새로고침 후 동일 값'}]);
const v1=await finishVideo(s1),v2=await finishVideo(s2);
fs.writeFileSync('out/m3_log.json',JSON.stringify(log,null,1));console.log(JSON.stringify(log));
// 영상: 학생1 기준 시각 t → 학생2 기준 t-off
const T0=Math.max(0,log.place.s1-1.5);sideBySide(v1,v2,'M3-01-place-sync',{offA:T0,offB:T0-off,dur:5});
const T1=Math.max(0,log.move.from-1);sideBySide(v1,v2,'M3-02-move-sync',{offA:T1,offB:T1-off,dur:Math.min(9,log.move.to-log.move.from+2)});
await b.close();
