import {test,expect} from './fixture';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
test('teacher creates a six-room class and exports 30 student credentials',async({page})=>{
  const username='e2e-'+randomUUID();
  try{
    await page.goto('/?login=1');
    await page.getByRole('button',{name:'강사',exact:true}).click();
    await page.getByLabel('강사 아이디').fill(username);await page.getByLabel('비밀번호').fill('test-password-1234');
    await page.getByRole('button',{name:'강사 계정 만들기'}).click();
    await expect(page.getByRole('heading',{name:'내 수업'})).toBeVisible();
    await page.getByLabel('수업 이름').fill('우리 반');await page.getByRole('button',{name:'수업 만들기'}).click();
    await expect(page.getByRole('button',{name:/조 편집/})).toHaveCount(6);
    await page.screenshot({path:'docs/evidence/teacher-dashboard.png',fullPage:true});
    await page.getByRole('button',{name:'학생 30명 발급'}).click();
    await expect(page.getByLabel('발급 학생 목록').locator('tbody tr')).toHaveCount(30);
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'발급 ID 내려받기'}).click();
    expect((await download).suggestedFilename()).toMatch(/students.*csv/);
    await page.getByRole('button',{name:'1조 편집',exact:true}).click();
    await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
    await expect(page.getByText('자동 저장 사용',{exact:true})).toBeVisible();
  }finally{
    if(!page.isClosed())await page.goto('about:blank').catch(()=>{});
    const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'});
    await pool.query('DELETE FROM coedit_rooms WHERE id IN (SELECT r.id FROM coedit_class_rooms r JOIN coedit_classes c ON c.id=r.class_id JOIN coedit_teachers t ON t.id=c.teacher_id WHERE t.username=$1)',[username]);
    await pool.query('DELETE FROM coedit_teachers WHERE username=$1',[username]);await pool.end();
  }
});

test('student enters with issued ID, creates an asset and continues after login',async({page,request})=>{
  const username='student-e2e-'+randomUUID(),base='http://127.0.0.1:2568/api';
  const response=await request.post(base+'/teachers/register',{data:{username,password:'test-password-1234'}});
  const teacher=await response.json();const headers={Authorization:'Bearer '+teacher.token};
  const classroom=await (await request.post(base+'/classes',{headers,data:{name:'학생 입장 검증',roomCount:1}})).json();
  const [student]=await (await request.post(base+'/classes/'+classroom.id+'/students',{headers,data:{count:1}})).json();
  try{
    const login=async(id=student.issuedId)=>{await page.goto('/?login=1');await page.getByLabel('방 코드').fill(student.roomCode);await page.getByLabel('발급 ID').fill(id);await page.getByRole('button',{name:'입장하기',exact:true}).click();};
    await login('invalid-id');await expect(page.getByRole('alert')).toBeVisible();
    await login();await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'라운지 의자 배치'}).dblclick();await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
    await login();await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
    await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
    await page.getByRole('button',{name:'라운지 의자 선택'}).click();await expect(page.getByLabel('위치 X')).toBeEnabled();
  }finally{
    if(!page.isClosed())await page.goto('about:blank').catch(()=>{});
    const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'});
    await pool.query('DELETE FROM coedit_rooms WHERE id=$1',[classroom.rooms[0].id]);await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[teacher.actor]);await pool.end();
  }
});
