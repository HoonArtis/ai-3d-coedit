import {test,expect} from './fixture';
import {randomUUID} from 'node:crypto';
import {Client} from '@colyseus/sdk';
test('Quest-style fresh browser chooses occupied student 2 in VR mode without credentials',async({page,request,browser})=>{
 test.setTimeout(90000);
 const base='http://127.0.0.1:2568/api',teacher=await(await request.post(base+'/teachers/register',{data:{username:'vr-free-'+randomUUID(),password:'test-password-1234'}})).json(),headers={Authorization:'Bearer '+teacher.token},c=await(await request.post(base+'/classes',{headers,data:{name:'자유 VR 테스트',roomCount:1}})).json(),students=await(await request.post(base+'/classes/'+c.id+'/students',{headers,data:{count:3}})).json(),s=students[1],invite=await(await request.get(base+'/classes/'+c.id+'/invite',{headers})).json(),identity=await(await request.post(base+'/students/login',{data:{roomCode:s.roomCode,issuedId:s.issuedId}})).json();
 await page.addInitScript(identity=>{localStorage.setItem('coedit-account-token',identity.token);localStorage.setItem('coedit-account-identity',JSON.stringify(identity));},identity);
 await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();await page.getByRole('link',{name:'VR 감상'}).click();await page.getByRole('button',{name:'현재 작품 제출'}).click();await expect(page.getByRole('button',{name:/제출본.*미리보기/})).toBeVisible({timeout:45000});
 const context=await browser.newContext(),quest=await context.newPage();
 try{
  await quest.goto('http://127.0.0.1:4174/?login=1');await quest.getByRole('button',{name:'VR 감상으로 입장',exact:true}).click();await quest.getByLabel('수업 초대 코드').fill(invite.code);await quest.getByRole('button',{name:'자리 선택하기'}).click();
  for(const n of [1,2,3,4,5])await expect(quest.getByRole('button',{name:'1조 학생 '+n+' 자리 선택'})).toBeEnabled();
  await quest.getByRole('button',{name:'1조 학생 2 자리 선택'}).click();await expect(quest.getByText('자유 VR 감상 · 선택한 자리의 캐릭터로 입장해요.')).toBeVisible();
  await expect(quest.getByRole('button',{name:'현재 작품 제출'})).toHaveCount(0);await expect(quest.getByRole('button',{name:'내 캐릭터',exact:true})).toHaveCount(0);
  await quest.getByRole('button',{name:/제출본.*미리보기/}).click();await expect(quest.getByText('읽기 전용 장면 준비 완료')).toBeVisible();
  const linked=await quest.evaluate(()=>JSON.parse(localStorage.getItem('coedit-account-identity')!));expect(linked.actor).toBe(s.actor);expect(linked.viewOnly).toBe(true);
  const vh={Authorization:'Bearer '+linked.token};expect((await request.post(base+'/room-session',{headers:vh,data:{roomKey:s.roomKey}})).status()).toBe(403);
  expect((await request.post(base+'/rooms/'+s.roomKey+'/vr',{headers:vh,data:{requestId:randomUUID()}})).status()).toBe(403);
  expect((await request.post(base+'/rooms/'+s.roomKey+'/avatar',{headers:vh,data:{kind:'block',skin:'#ffffff',hair:'#ffffff',shirt:'#ffffff',pants:'#ffffff'}})).status()).toBe(403);
  const records=await(await request.get(base+'/rooms/'+s.roomKey+'/vr',{headers:vh})).json();const viewer=await new Client('http://127.0.0.1:2568').joinOrCreate('viewing',{token:linked.token,roomKey:s.roomKey,snapshotId:records[0].snapshotId});viewer.onMessage('poses',()=>{});await viewer.leave();
  await quest.goto('http://127.0.0.1:4174/');await expect(quest.getByText('자유 VR 감상 · 선택한 자리의 캐릭터로 입장해요.')).toBeVisible();
  await quest.screenshot({path:'docs/evidence/vr-free-seat.png'});
 }finally{await context.close();}
});
