// M1 수업 준비와 입장 촬영
import {launch,WEB,api,CTX,shot,sleep,boxes,loadState,saveState,openStudent} from './lib.mjs';
import {annotate,zoom,union} from './tools.mjs';
const st=loadState(),b=await launch();
const role=(p,n)=>p.locator('.role-tabs').first().getByRole('button',{name:n,exact:true});
const nearest=async(p,locs,ref)=>{const rb=await ref.boundingBox();let best=null,d=1e9;for(const x of await locs.all()){const bb=await x.boundingBox();if(bb&&Math.abs(bb.y-rb.y)<d){d=Math.abs(bb.y-rb.y);best=x;}}return best;};

// 로그인 화면(학생)
const c=await b.newContext(CTX),p=await c.newPage();await p.goto(WEB+'/?login=1');await sleep(800);
let bx=await boxes(p,{s:role(p,'학생'),t:role(p,'강사'),edit:p.getByRole('button',{name:'작품 만들기'}),vr:p.getByRole('button',{name:'VR 감상으로 입장'})});
let src=await shot(p,'m1_login');
await annotate(src,'M1-01-login',[{box:union(bx.s,bx.t),n:1,label:'역할 선택'},{box:union(bx.edit,bx.vr),n:2,label:'입장 목적'}]);
await p.getByLabel('수업 초대 코드').fill(st.code);
bx=await boxes(p,{code:p.getByLabel('수업 초대 코드'),go:p.getByRole('button',{name:'자리 선택하기'}),room:p.getByLabel('방 코드'),id:p.getByLabel('발급 ID')});
src=await shot(p,'m1_code');
await annotate(src,'M1-08-class-code',[{box:bx.code,n:1,label:'공통 수업 코드'},{box:bx.go,n:2}]);
await annotate(src,'M1-10-issued-id',[{box:union(bx.room,bx.id),n:1,label:'방 코드 + 발급 ID'}]);

// 강사 탭
await role(p,'강사').click();await sleep(300);
await p.getByLabel('강사 아이디').fill('teacher-example');await p.getByLabel('비밀번호').fill('example-password-0000');
bx=await boxes(p,{id:p.getByLabel('강사 아이디'),pw:p.getByLabel('비밀번호'),reg:p.getByRole('button',{name:'강사 계정 만들기'}),login:p.getByRole('button',{name:'입장하기'})});
src=await shot(p,'m1_teacher_reg');
await annotate(src,'M1-02-teacher-register',[{box:union(bx.id,bx.pw),n:1,label:'아이디·비밀번호(12자 이상)'},{box:bx.reg,n:2,label:'강사 계정 만들기'}]);
await p.getByLabel('강사 아이디').fill(st.teacher.username);await p.getByLabel('비밀번호').fill(st.teacher.password);
src=await shot(p,'m1_teacher_login');
await annotate(src,'M1-03-teacher-login',[{box:union(bx.id,bx.pw),n:1},{box:bx.login,n:2,label:'입장하기'}]);
await p.getByRole('button',{name:'입장하기'}).click();await p.getByRole('heading',{name:'내 수업',exact:true}).waitFor();await sleep(800);

// 수업 만들기(입력만, 생성 안 함)
await p.getByLabel('수업 이름').fill('3학년 2반 공간 꾸미기');await p.getByLabel('방 개수').fill('6');
bx=await boxes(p,{name:p.getByLabel('수업 이름'),n:p.getByLabel('방 개수'),mk:p.getByRole('button',{name:'수업 만들기'})});
src=await shot(p,'m1_create');
await annotate(src,'M1-04-create-class',[{box:bx.name,n:1,label:'수업 이름',side:'below'},{box:bx.n,n:2,label:'방(조) 개수',side:'below'},{box:bx.mk,n:3}]);
await p.getByLabel('수업 이름').fill('');

// 초대 코드
bx=await boxes(p,{code:p.getByLabel('AI 공간 꾸미기 1반 초대 코드'),copy:p.getByRole('button',{name:'코드 복사'}).first()});
src=await shot(p,'m1_invite');
await annotate(src,'M1-05-invite-code',[{box:bx.code,n:1,label:'공통 수업 코드'},{box:bx.copy,n:2,label:'코드 복사'}]);
await zoom(src,'M1-05-invite-code-zoom',union(bx.code,bx.copy),{margin:30,marks:[{box:bx.code}]});

// 신규 입장 닫기 → 열기
await p.getByRole('button',{name:'새 학생 입장 닫기'}).first().click();await sleep(900);
console.log('after close buttons',(await p.getByRole('button').allInnerTexts()).filter(t=>t.includes('입장')));
const toggle=p.getByRole('button',{name:/새 학생 입장/}).first();
let row=union(await toggle.boundingBox(),await p.getByText(/^(입장 가능|새 학생 입장 닫힘)$/).first().boundingBox());
src=await shot(p,'m1_closed');
await annotate(src,'M1-06-invite-closed',[{box:row,n:1,label:'신규 입장 닫힘 상태',side:'below'}]);
await toggle.click();await sleep(900);
row=union(await p.getByRole('button',{name:/새 학생 입장/}).first().boundingBox(),await p.getByText(/^(입장 가능|새 학생 입장 닫힘)$/).first().boundingBox());
src=await shot(p,'m1_opened');
await annotate(src,'M1-06-invite-open',[{box:row,n:1,label:'신규 입장 가능 상태',side:'below'}]);
console.log('after reopen',(await p.getByRole('button').allInnerTexts()).filter(t=>t.includes('입장')));

// 발급 ID 시연 수업(별도 수업, 좌석 소모 방지)
if(!st.issueClass){const cl=await api('/classes',{token:st.teacher.token,body:{name:'발급 ID 시연',roomCount:1}});st.issueClass=cl.id;saveState(st);}
{const cls=await api('/classes',{token:st.teacher.token});const ic=(cls.classes||cls).find(x=>x.id===st.issueClass);for(const r of ic.rooms){const list=await api('/rooms/'+r.id+'/students',{token:st.teacher.token});for(const s of (list.seats||[])){if(s.actor)await api('/rooms/'+r.id+'/students/'+s.actor+'/manage',{token:st.teacher.token,body:{action:'remove'}});}}}
await p.reload();const h=p.getByRole('heading',{name:'발급 ID 시연'});await h.waitFor();await sleep(500);
const target=await nearest(p,p.getByRole('button',{name:/학생 \d+명 발급/}),h);
await target.scrollIntoViewIfNeeded();await target.click();await sleep(1500);
const dl=p.getByText('발급 ID 내려받기').first();await dl.scrollIntoViewIfNeeded().catch(()=>{});await sleep(400);
bx=await boxes(p,{dl,list:p.getByLabel('발급 학생 목록')});
src=await shot(p,'m1_issue');
await annotate(src,'M1-07-issue-ids',[{box:bx.list,n:1,label:'발급 학생 목록'},{box:bx.dl,n:2,label:'CSV 내려받기'}]);
await c.close();

// 학생 로비
const c2=await b.newContext(CTX),q=await c2.newPage();await q.goto(WEB+'/?login=1');await q.getByLabel('수업 초대 코드').fill(st.code);await q.getByRole('button',{name:'자리 선택하기',exact:true}).click();await sleep(1200);
console.log('lobby buttons',await q.getByRole('button').evaluateAll(es=>es.map(e=>(e.getAttribute('aria-label')||'')+'|'+e.textContent.trim()+'|'+e.disabled)));
bx=await boxes(q,{used:q.getByRole('button',{name:/1조 학생 1 /}),free:q.getByRole('button',{name:/1조 학생 3 /})});
src=await shot(q,'m1_lobby');
await annotate(src,'M1-09-seat-lobby',[{box:bx.used,n:1,label:'사용 중인 자리',side:'left'},{box:bx.free,n:2,label:'빈 자리',side:'left'}]);
await c2.close();

// 편집실 입장 + 복귀
const s=await openStudent(b,1);
bx=await boxes(s.page,{con:s.page.getByText('서버 연결됨',{exact:true})});
src=await shot(s.page,'m1_editor');
await annotate(src,'M1-11-editor-entered',[{box:bx.con,n:1,label:'서버 연결됨'}]);
await zoom(src,'M1-11-connected-zoom',bx.con,{margin:24,marks:[{box:bx.con}]});
const before=await s.page.getByLabel('에셋 수').textContent();
await s.page.goto(WEB+'/?login=1');await s.page.getByLabel('수업 초대 코드').fill(st.code);await s.page.getByRole('button',{name:'자리 선택하기',exact:true}).click();await sleep(1000);
const back=s.page.getByRole('button',{name:'내 자리로 돌아가기',exact:true});bx=await boxes(s.page,{back});
src=await shot(s.page,'m1_return');
await annotate(src,'M1-12-return-seat',[{box:bx.back,n:1,label:'내 자리로 돌아가기'}]);
await back.click();await s.page.getByText('서버 연결됨',{exact:true}).waitFor();await sleep(1500);
console.log('count before/after',before,await s.page.getByLabel('에셋 수').textContent());
await b.close();
