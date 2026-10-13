import {test,expect} from './fixture';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
test('teacher lists, disconnects and removes a student from the room card',async({page,request,browser})=>{
 const base='http://127.0.0.1:2568/api',username='manage-e2e-'+randomUUID();
 const teacher=await (await request.post(base+'/teachers/register',{data:{username,password:'test-password-1234'}})).json(),headers={Authorization:'Bearer '+teacher.token};
 const classroom=await (await request.post(base+'/classes',{headers,data:{name:'학생 관리 검증',roomCount:1}})).json();
 const [student]=await (await request.post(base+'/classes/'+classroom.id+'/students',{headers,data:{count:1}})).json();
 const context=await browser.newContext(),pupil=await context.newPage();
 try{
  await pupil.goto('/?login=1');await pupil.getByLabel('방 코드').fill(student.roomCode);await pupil.getByLabel('발급 ID').fill(student.issuedId);await pupil.getByRole('button',{name:'입장하기',exact:true}).click();await expect(pupil.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await pupil.getByRole('button',{name:'라운지 의자 배치'}).dblclick();await expect(pupil.getByLabel('에셋 수')).toHaveText('1 / 200');
  await page.goto('/?login=1');await page.getByRole('button',{name:'강사',exact:true}).click();await page.getByLabel('강사 아이디').fill(username);await page.getByLabel('비밀번호').fill('test-password-1234');await page.getByRole('button',{name:'입장하기',exact:true}).click();
  await page.getByRole('button',{name:'1조 학생 관리',exact:true}).click();const panel=page.getByRole('region',{name:'1조 학생 관리'}),row=panel.getByRole('listitem',{name:'학생 1',exact:true});
  await expect(row.getByText('접속 중',{exact:true})).toBeVisible();await row.getByRole('button',{name:'접속 종료',exact:true}).click();await expect(row.getByText('접속 안 함',{exact:true})).toBeVisible();
  await row.getByRole('button',{name:'학생 삭제',exact:true}).click();await expect(panel.getByLabel('학생이 배치한 물건도 장면에서 삭제')).not.toBeChecked();await panel.getByLabel('학생이 배치한 물건도 장면에서 삭제').check();
  await panel.getByRole('button',{name:'학생 삭제·자리 비우기',exact:true}).click();await expect(row.getByText('빈 자리',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'1조 편집',exact:true}).click();await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();await expect(page.getByLabel('에셋 수')).toHaveText('0 / 200');
 }finally{
  await context.close();if(!page.isClosed())await page.goto('about:blank').catch(()=>{});const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'});await pool.query('DELETE FROM coedit_rooms WHERE id=$1',[classroom.rooms[0].id]);await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[teacher.actor]);await pool.end();
 }
});
