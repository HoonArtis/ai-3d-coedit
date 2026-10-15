// M2 메인 기능 — 공간 편집 촬영
import {launch,openStudent,shot,sleep,boxes,clearMine,finishVideo,at,projector,drag} from './lib.mjs';
import {annotate,zoom,union,toMp4} from './tools.mjs';
import fs from 'node:fs';
const b=await launch(),log={};
// 준비: 1조 장면 비우기(학생 2 → 학생 1)
{const s2=await openStudent(b,2);await clearMine(s2.page);log.s2=await s2.page.getByLabel('에셋 수').textContent();await s2.ctx.close();}
const s=await openStudent(b,1,{record:true}),p=s.page;await clearMine(p);await p.keyboard.press('Escape');await sleep(800);
const cnt=()=>p.getByLabel('에셋 수').textContent();
log.start=await cnt();console.log('start',log.start);
const L=n=>p.getByRole('button',{name:n+' 배치'});
const propBox=async()=>{const rp=await p.locator('.right-panel').first().boundingBox(),dl=await p.getByRole('button',{name:'삭제',exact:true}).boundingBox();return {x:rp.x,y:rp.y,width:rp.width,height:dl.y+dl.height+8-rp.y};};

// M2-03 더블클릭 배치
let bx=await boxes(p,{card:L('둥근 테이블'),count:p.getByLabel('에셋 수')});
let src=await shot(p,'m2_place_before');
await annotate(src,'M2-03-place-before',[{box:bx.card,n:1,label:'카드 더블클릭'},{box:bx.count,n:2,label:'에셋 수 0'}]);
await zoom(src,'M2-03-count-before',bx.count,{margin:20,marks:[{box:bx.count}]});
await L('둥근 테이블').dblclick();await sleep(1200);log.afterPlace=await cnt();
for(let i=0;i<3;i++){await p.getByRole('button',{name:'확대',exact:true}).click();await sleep(250);}
await sleep(800);bx=await boxes(p,{count:p.getByLabel('에셋 수'),scene:p.locator('.scene-list')});
src=await shot(p,'m2_place_after');
await annotate(src,'M2-03-place-after',[{box:bx.scene,n:1,label:'장면 개체 추가',side:'above'},{box:bx.count,n:2,label:'에셋 수 1'}]);
await zoom(src,'M2-03-count-after',bx.count,{margin:20,marks:[{box:bx.count}]});

// M2-01 화면 영역 구성(테이블 선택 상태)
await p.getByRole('button',{name:'둥근 테이블 선택'}).click();await sleep(1800);
const R=sel=>p.locator(sel).first();
bx=await boxes(p,{top:R('.topbar'),lib:R('.library'),view:R('.viewport'),scene:R('.scene-list'),ai:R('.assistant-panel'),tool:R('.toolbar')});bx.prop=await propBox();
src=await shot(p,'m2_layout');console.log('layout boxes',JSON.stringify(bx));
await annotate(src,'M2-01-layout',[{box:bx.top,n:1},{box:bx.lib,n:2},{box:bx.tool,n:3},{box:bx.view,n:4},{box:bx.scene,n:5},{box:bx.prop,n:6},{box:bx.ai,n:7}],{pad:-3});

// M2-02 검색·분류
await p.getByLabel('에셋 검색').fill('의자');await sleep(500);bx=await boxes(p,{q:p.getByLabel('에셋 검색'),grid:R('.asset-grid')});
src=await shot(p,'m2_search');await annotate(src,'M2-02-search',[{box:bx.q,n:1,label:"검색어 '의자'"},{box:bx.grid,n:2,label:'검색 결과'}]);
await p.getByLabel('에셋 검색').fill('');await p.locator('.library .tabs').getByRole('button',{name:'자연'}).click();await sleep(500);
bx=await boxes(p,{tabs:R('.library .tabs'),grid:R('.asset-grid')});
src=await shot(p,'m2_filter');await annotate(src,'M2-02-filter',[{box:bx.tabs,n:1,label:"분류 '자연'"},{box:bx.grid,n:2,label:'자연 에셋만 표시'}]);
await p.locator('.library .tabs').getByRole('button',{name:'전체'}).click();await sleep(400);

// M2-04 끌어놓기(영상)
await p.keyboard.press('Escape');await sleep(500);
const v0=at(s);const card=await L('화분').boundingBox(),vb=await R('.viewport').boundingBox();
await p.mouse.move(card.x+card.width/2,card.y+card.height/2,{steps:10});await sleep(300);await p.mouse.down();
await p.mouse.move(vb.x+vb.width*0.62,vb.y+vb.height*0.55,{steps:40});await sleep(300);await p.mouse.up();await sleep(1500);
const v1=at(s);log.dragged=await cnt();console.log('after drag',log.dragged);
if(log.dragged===log.afterPlace){console.log('mouse DnD 미반영 → dragTo 재시도');await L('화분').dragTo(p.locator('canvas'));await sleep(1200);log.dragged2=await cnt();}
log.v_drag=[v0,v1];

// M2-05 선택·선택 해제
await p.getByRole('button',{name:'화분 선택'}).click();await sleep(600);
bx=await boxes(p,{item:p.getByRole('button',{name:'화분 선택'})});bx.prop=await propBox();
src=await shot(p,'m2_select');await annotate(src,'M2-05-select',[{box:bx.item,n:1,label:'목록에서 선택'},{box:bx.prop,n:2,label:'속성 표시'}]);
await p.keyboard.press('Escape');await sleep(500);bx=await boxes(p,{none:p.getByText('선택 없음').first(),noSel:R('.no-selection')});
src=await shot(p,'m2_deselect');await annotate(src,'M2-05-deselect',[{box:union(bx.none,bx.noSel),n:1,label:'Esc → 선택 해제'}]);

// M2-06~08 기즈모: 테이블(원점) 선택
await p.getByRole('button',{name:'둥근 테이블 선택'}).click();await sleep(500);
const posBox=async()=>union(...(await Promise.all(['X','Y','Z'].map(a=>p.getByLabel('위치 '+a).boundingBox()))));
await p.keyboard.press('w');await sleep(300);let pt=await projector(p);
const g0=at(s);await drag(p,pt(0,.8,0),{x:pt(0,.8,0).x,y:pt(0,.8,0).y-90});await sleep(700);const g1=at(s);log.v_move=[g0,g1];
bx=await boxes(p,{mode:p.getByRole('button',{name:'이동 모드'}),view:R('.viewport')});const pb=await posBox();log.posY=await p.getByLabel('위치 Y').inputValue();
src=await shot(p,'m2_move');await annotate(src,'M2-06-move',[{box:bx.mode,n:1,label:'이동 모드(W)'},{box:pb,n:2,label:'위치 값 변경'}]);
await p.getByRole('button',{name:'되돌리기',exact:true}).click();await sleep(500);
await p.keyboard.press('e');await sleep(300);pt=await projector(p);
const r0=at(s);await drag(p,pt(Math.cos(.3),0,Math.sin(.3)),pt(Math.cos(1.0),0,Math.sin(1.0)));await sleep(600);log.v_rot=[r0,at(s)];
const rb=union(...(await Promise.all(['X','Y','Z'].map(a=>p.getByLabel('회전 '+a).boundingBox()))));log.rot=await p.getByLabel('회전 Y').inputValue();
bx=await boxes(p,{mode:p.getByRole('button',{name:'회전 모드'})});
src=await shot(p,'m2_rotate');await annotate(src,'M2-07-rotate',[{box:bx.mode,n:1,label:'회전 모드(E)'},{box:rb,n:2,label:'회전 값 변경'}]);
await p.getByRole('button',{name:'되돌리기',exact:true}).click();await sleep(500);
await p.keyboard.press('r');await sleep(300);pt=await projector(p);
const k0=at(s);await drag(p,pt(0,.8,0),pt(0,1.3,0));await sleep(600);log.v_scale=[k0,at(s)];
const sb=union(...(await Promise.all(['X','Y','Z'].map(a=>p.getByLabel('크기 '+a).boundingBox()))));log.scaleY=await p.getByLabel('크기 Y').inputValue();
bx=await boxes(p,{mode:p.getByRole('button',{name:'크기 모드'})});
src=await shot(p,'m2_scale');await annotate(src,'M2-08-scale',[{box:bx.mode,n:1,label:'크기 모드(R)'},{box:sb,n:2,label:'크기 값 변경'}]);
await p.getByRole('button',{name:'되돌리기',exact:true}).click();await sleep(500);await p.keyboard.press('w');

// M2-09 수치 입력
let pb0=await posBox();src=await shot(p,'m2_num_before');await zoom(src,'M2-09-input-before',pb0,{margin:30,marks:[{box:pb0}]});
await p.getByLabel('위치 X').fill('3');await p.getByLabel('위치 X').press('Enter');await sleep(500);
await p.getByLabel('회전 Y').fill('45');await p.getByLabel('회전 Y').press('Enter');await sleep(500);
const allIn=union(pb0,...(await Promise.all(['회전 Y','크기 Z'].map(a=>p.getByLabel(a).boundingBox()))));
src=await shot(p,'m2_num_after');await annotate(src,'M2-09-input',[{box:allIn,n:1,label:'X=3, 회전 Y=45 입력'}]);await zoom(src,'M2-09-input-after',pb0,{margin:30,marks:[{box:pb0}]});
log.inputX=await p.getByLabel('위치 X').inputValue();

// M2-10 이름 변경
await p.getByLabel('에셋 이름').fill('쉼터 탁자');await p.getByLabel('에셋 이름').press('Enter');await sleep(600);
bx=await boxes(p,{name:p.getByLabel('에셋 이름'),item:p.getByRole('button',{name:'쉼터 탁자 선택'})});
src=await shot(p,'m2_rename');await annotate(src,'M2-10-rename',[{box:bx.name,n:1,label:'이름 입력'},{box:bx.item,n:2,label:'목록 반영'}]);

// M2-11 복제
const c0=await cnt();bx=await boxes(p,{dup:p.getByRole('button',{name:'복제',exact:true}),count:p.getByLabel('에셋 수')});
src=await shot(p,'m2_dup_before');await zoom(src,'M2-11-count-before',bx.count,{margin:20,marks:[{box:bx.count}]});
await p.getByRole('button',{name:'복제',exact:true}).click();await sleep(800);const c1=await cnt();log.dup=[c0,c1];
bx=await boxes(p,{dup:p.getByRole('button',{name:'복제',exact:true}),count:p.getByLabel('에셋 수'),scene:R('.scene-list')});
src=await shot(p,'m2_dup');await annotate(src,'M2-11-duplicate',[{box:bx.dup,n:1,label:'복제'},{box:bx.scene,n:2,label:'사본 추가',side:'above'},{box:bx.count,n:3}]);
await zoom(src,'M2-11-count-after',bx.count,{margin:20,marks:[{box:bx.count}]});

// M2-12 바닥 정렬
await p.getByLabel('위치 X').fill('-3');await p.getByLabel('위치 X').press('Enter');await sleep(500);await p.getByLabel('위치 Y').fill('1.5');await p.getByLabel('위치 Y').press('Enter');await sleep(700);
bx=await boxes(p,{y:p.getByLabel('위치 Y'),snap:p.getByRole('button',{name:'바닥에 붙이기'})});
src=await shot(p,'m2_float');await annotate(src,'M2-12-snap-before',[{box:bx.y,n:1,label:'위치 Y 1.5(공중)'},{box:bx.snap,n:2,label:'바닥에 붙이기'}]);
await p.getByRole('button',{name:'바닥에 붙이기'}).click();await sleep(700);log.snapY=await p.getByLabel('위치 Y').inputValue();
src=await shot(p,'m2_snapped');await annotate(src,'M2-12-snap-after',[{box:bx.y,n:1,label:'위치 Y '+log.snapY}]);

// M2-13 삭제 / M2-14 되돌리기 / M2-15 다시하기
const d0=await cnt();bx=await boxes(p,{del:p.getByRole('button',{name:'삭제',exact:true}),count:p.getByLabel('에셋 수')});
src=await shot(p,'m2_del_before');await annotate(src,'M2-13-delete-before',[{box:bx.del,n:1,label:'삭제(Delete 키)'},{box:bx.count,n:2}]);
await p.getByRole('button',{name:'삭제',exact:true}).click();await sleep(700);const d1=await cnt();
bx=await boxes(p,{count:p.getByLabel('에셋 수'),undo:p.getByRole('button',{name:'되돌리기',exact:true}),redo:p.getByRole('button',{name:'다시하기',exact:true}),scene:R('.scene-list')});
src=await shot(p,'m2_del_after');await annotate(src,'M2-13-delete-after',[{box:bx.count,n:1,label:'에셋 수 감소'}]);
await zoom(src,'M2-13-count-after',bx.count,{margin:20,marks:[{box:bx.count}]});
const u0=at(s);await p.getByRole('button',{name:'되돌리기',exact:true}).click();await sleep(800);const d2=await cnt();
bx=await boxes(p,{count:p.getByLabel('에셋 수'),undo:p.getByRole('button',{name:'되돌리기',exact:true}),scene:R('.scene-list')});
src=await shot(p,'m2_undo');await annotate(src,'M2-14-undo',[{box:bx.undo,n:1,label:'되돌리기(Ctrl+Z)'},{box:bx.scene,n:2,label:'삭제 항목 복귀',side:'above'},{box:bx.count,n:3}]);
await p.getByRole('button',{name:'다시하기',exact:true}).click();await sleep(800);const d3=await cnt();const u1=at(s);
bx=await boxes(p,{count:p.getByLabel('에셋 수'),redo:p.getByRole('button',{name:'다시하기',exact:true}),scene:R('.scene-list')});
src=await shot(p,'m2_redo');await annotate(src,'M2-15-redo',[{box:bx.redo,n:1,label:'다시하기(Ctrl+Y)'},{box:bx.count,n:2}]);
log.del=[d0,d1,d2,d3];log.v_undo=[u0,u1];

// M2-16 카메라 조작
bx=await boxes(p,{zin:p.getByRole('button',{name:'확대',exact:true}),zout:p.getByRole('button',{name:'축소',exact:true}),orbit:p.getByRole('button',{name:'카메라 궤도 회전'}),focus:R('.focus-button'),hint:R('.view-bottom'),label:R('.view-label'),dist:p.getByLabel('카메라 거리')});
src=await shot(p,'m2_camera');
await annotate(src,'M2-16-camera',[{box:union(bx.zin,bx.zout,bx.orbit,bx.focus),n:1,label:'확대·축소·궤도 회전·선택 보기(F)'},{box:bx.hint,n:2,label:'마우스 조작 안내'},{box:bx.label,n:3,label:'원근 보기 상태'}]);
await zoom(src,'M2-16-hint-zoom',bx.hint,{margin:16,marks:[]});

// M2-17 에셋 한도
bx=await boxes(p,{count:p.getByLabel('에셋 수'),foot:R('.scene-footer')});
src=await shot(p,'m2_limit');await zoom(src,'M2-17-limit-zoom',bx.foot||bx.count,{margin:16,marks:[{box:bx.count}]});
log.end=await cnt();
const vid=await finishVideo(s);log.video=vid;
fs.writeFileSync('out/m2_log.json',JSON.stringify(log,null,1));console.log(JSON.stringify(log));
toMp4(vid,'M2-04-drag-drop',{start:Math.max(0,log.v_drag[0]-0.5),dur:Math.min(8,log.v_drag[1]-log.v_drag[0]+1.5)});
toMp4(vid,'M2-06-move-gizmo',{start:Math.max(0,log.v_move[0]-0.8),dur:Math.min(6,log.v_move[1]-log.v_move[0]+1.6)});
toMp4(vid,'M2-14-undo-redo',{start:Math.max(0,log.v_undo[0]-0.8),dur:Math.min(6,log.v_undo[1]-log.v_undo[0]+1.6)});
await b.close();
