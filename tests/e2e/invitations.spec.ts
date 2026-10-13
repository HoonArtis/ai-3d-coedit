import {test,expect} from './fixture';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
test('teacher creates a classroom and student chooses a seat using the common class code',async({page,browser})=>{
 const username='invite-'+randomUUID();let studentContext;
 try{
  await page.goto('/?login=1');await page.getByRole('button',{name:'강사',exact:true}).click();
  await page.getByLabel('강사 아이디').fill(username);await page.getByLabel('비밀번호').fill('test-password-1234');await page.getByRole('button',{name:'강사 계정 만들기'}).click();
  await expect(page.getByRole('heading',{name:'내 수업',exact:true})).toBeVisible();
  await page.route('**/api/runtime-config',route=>route.fulfill({json:{localPreview:false,registrationEnabled:true}}));
  await page.goto('/');await expect(page.getByRole('heading',{name:'내 수업',exact:true})).toBeVisible({timeout:3000});
  await page.getByLabel('수업 이름').fill('공통 코드 수업');await expect(page.getByLabel('방 개수')).toBeVisible({timeout:3000});await page.getByLabel('방 개수').fill('1');await page.getByRole('button',{name:'수업 만들기'}).click();
  const code=await page.getByLabel('공통 코드 수업 초대 코드').inputValue();expect(code.length).toBeGreaterThanOrEqual(10);
  studentContext=await browser.newContext();const student=await studentContext.newPage();await student.goto('/?login=1');await student.getByLabel('수업 초대 코드').fill(code);await student.getByRole('button',{name:'자리 선택하기',exact:true}).click();
  await expect(student.getByRole('heading',{name:'공통 코드 수업',exact:true})).toBeVisible();await student.getByRole('button',{name:'1조 학생 3 자리 선택',exact:true}).click();await expect(student.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await student.getByRole('button',{name:'라운지 의자 배치'}).dblclick();await expect(student.getByLabel('에셋 수')).toHaveText('1 / 200');
  await student.goto('/?login=1');await student.getByLabel('수업 초대 코드').fill(code);await student.getByRole('button',{name:'자리 선택하기',exact:true}).click();await student.getByRole('button',{name:'내 자리로 돌아가기',exact:true}).click();await expect(student.getByLabel('에셋 수')).toHaveText('1 / 200');
 }finally{
  await studentContext?.close();await page.goto('about:blank');const pool=new Pool({connectionString:'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'});await pool.query('DELETE FROM coedit_teachers WHERE username=$1',[username]);await pool.end();
 }
});
