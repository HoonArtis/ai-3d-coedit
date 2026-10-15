import {chromium,WEB,api,VIEW,shot,saveState,loadState,sleep,OUT} from './lib.mjs';
import fs from 'node:fs';
const st=loadState();
if(!st.teacher){
 const username='guide-teacher-'+Date.now().toString(36);
 const t=await api('/teachers/register',{body:{username,password:'guide-password-1234'}});
 st.teacher={username,password:'guide-password-1234',token:t.token,actor:t.actor};
 saveState(st);
}
const browser=await chromium.launch({headless:true});
const tctx=await browser.newContext({viewport:VIEW});const tp=await tctx.newPage();
// teacher login UI
await tp.goto(WEB+'/?login=1');await sleep(800);await shot(tp,'x_login');
await tp.getByRole('button',{name:'강사',exact:true}).click();
await tp.getByLabel('강사 아이디').fill(st.teacher.username);await tp.getByLabel('비밀번호').fill(st.teacher.password);
await shot(tp,'x_login_teacher');
const btns=await tp.getByRole('button').allInnerTexts();console.log('login buttons',btns);
await tp.getByRole('button',{name:'입장하기',exact:true}).click();
await tp.getByRole('heading',{name:'내 수업',exact:true}).waitFor();await sleep(500);
if(!st.classId){
 await tp.getByLabel('수업 이름').fill('AI 공간 꾸미기 1반');await tp.getByLabel('방 개수').fill('2');await tp.getByRole('button',{name:'수업 만들기'}).click();
 await tp.getByLabel('AI 공간 꾸미기 1반 초대 코드').waitFor();
 st.code=await tp.getByLabel('AI 공간 꾸미기 1반 초대 코드').inputValue();
 const classes=await api('/classes',{token:st.teacher.token});st.classes=classes;saveState(st);
}
await sleep(800);await shot(tp,'x_teacher_dash',{fullPage:true});
console.log('teacher buttons',await tp.getByRole('button').allInnerTexts());
// students
const ss=[];
for(const n of [1,2]){
 const c=await browser.newContext({viewport:VIEW});const p=await c.newPage();
 await p.goto(WEB+'/?login=1');await p.getByLabel('수업 초대 코드').fill(st.code);
 await p.getByRole('button',{name:'자리 선택하기',exact:true}).click();await sleep(800);
 if(n===1)await shot(p,'x_seat_lobby');
 await p.getByRole('button',{name:'1조 학생 '+n+' 자리 선택',exact:true}).click();
 await p.getByText('서버 연결됨',{exact:true}).waitFor({timeout:30000});await sleep(2500);
 ss.push(p);
 fs.writeFileSync(OUT+`/student${n}_storage.json`,JSON.stringify(await c.storageState()));
}
await shot(ss[0],'x_editor');
console.log('editor buttons',(await ss[0].getByRole('button').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')||e.textContent.trim()))).join(' | '));
console.log('labels',(await ss[0].locator('[aria-label]').evaluateAll(es=>es.map(e=>e.tagName+':'+e.getAttribute('aria-label')))).join(' | '));
await browser.close();
