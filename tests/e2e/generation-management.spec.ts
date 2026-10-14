import {test,expect} from './fixture';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';

test('generation queue is prominent and supports cancellation, hide/show and confirmed deletion',async({page,request})=>{
 const base='http://127.0.0.1:2568/api';
 const teacher=await(await request.post(base+'/teachers/register',{data:{username:'generation-management-'+randomUUID(),password:'test-password-1234'}})).json();
 const headers={Authorization:'Bearer '+teacher.token},classroom=await(await request.post(base+'/classes',{headers,data:{name:'generation management',roomCount:1}})).json();
 const [student]=await(await request.post(base+'/classes/'+classroom.id+'/students',{headers,data:{count:1}})).json();
 const identity=await(await request.post(base+'/students/login',{data:{roomCode:student.roomCode,issuedId:student.issuedId}})).json();
 const common={actor:identity.actor,roomId:student.roomKey,generation:0,version:1,imageKey:null,shapeKey:null,error:null,position:1,running:false,visibility:'visible'};
 let jobs:any[]=[{...common,id:'queue-job',state:'image_queued',source:{kind:'text',prompt:'파란 고래 벤치'}},{...common,id:'finished-job',state:'awaiting_confirmation',source:{kind:'text',prompt:'노란 별 의자'}},{...common,id:'shape-job',state:'shape_ready',source:{kind:'text',prompt:'완성된 3D 의자'}}];
 const actions:string[]=[];let release=()=>{},releaseStalePoll=()=>{},holdNextPoll=false,staleStarted=false,staleDelivered=false;
 try{
  await page.route('**/api/generation/'+student.roomKey+'**',async route=>{
   const url=new URL(route.request().url()),parts=url.pathname.split('/'),action=parts.at(-1);
   if(route.request().method()==='GET'){const snapshot=JSON.parse(JSON.stringify({jobs:jobs.filter(job=>job.visibility!=='deleted'),usage:{used:jobs.filter(job=>job.state!=='cancelled').length,limit:8}}));const stale=holdNextPoll;if(stale){holdNextPoll=false;staleStarted=true;await new Promise<void>(resolve=>releaseStalePoll=resolve);}await route.fulfill({json:snapshot});if(stale)staleDelivered=true;return;}
   const job=jobs.find(job=>job.id===parts.at(-2)),body=route.request().postDataJSON();actions.push(action!);expect(body.version).toBe(1);
   if(action==='cancel'){await new Promise<void>(resolve=>release=resolve);job.state='cancelled';}
   if(action==='visibility')job.visibility=body.visibility;
   await route.fulfill({json:job});
  });
  await page.addInitScript(value=>localStorage.setItem('coedit-account-identity',JSON.stringify(value)),identity);
  await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await expect(page.locator('.generation-badge')).toHaveText('1건 진행 중');
  await page.getByText('새 에셋 만들기',{exact:true}).click();
  const panel=page.locator('.generation-panel'),queued=page.locator('[data-job-id="queue-job"]'),finished=page.locator('[data-job-id="finished-job"]');
  await panel.getByLabel('생성할 물건 설명').fill('또 다른 의자');
  await expect(panel.getByLabel('생성 진행 상황')).toContainText('이미지 대기 1번째');
  await expect(panel.getByRole('button',{name:'이미지 그리기',exact:true})).toBeDisabled();
  await expect(queued).toContainText('파란 고래 벤치');
  await page.screenshot({path:'docs/evidence/generation-management.png',fullPage:true});
  holdNextPoll=true;await expect.poll(()=>staleStarted).toBe(true);
  const cancel=queued.getByRole('button',{name:'대기 요청 취소'});await cancel.evaluate((button:HTMLButtonElement)=>{button.click();button.click();});
  await expect(cancel).toBeDisabled();await expect.poll(()=>actions.length).toBe(1);release();
  await expect(queued).toContainText('요청 취소');await expect(panel.getByLabel('생성 진행 상황')).toHaveCount(0);
  releaseStalePoll();await expect.poll(()=>staleDelivered).toBe(true);await expect(queued).toContainText('요청 취소');await expect(panel.getByLabel('생성 진행 상황')).toHaveCount(0);
  await finished.getByRole('button',{name:'목록에서 숨기기'}).click();await expect(finished).toHaveCount(0);
  await panel.getByRole('button',{name:'숨긴 항목 보기 (1)'}).click();await expect(finished).toContainText('목록에서 숨긴 항목');
  await finished.getByRole('button',{name:'다시 표시'}).click();await expect(finished.getByRole('button',{name:'이 이미지로 3D 만들기'})).toBeVisible();
  await finished.getByRole('button',{name:'이미지 삭제',exact:true}).click();await expect(finished.getByLabel('이미지 삭제 확인')).toContainText('이미 제작한 3D/배치물은 삭제하지 않습니다.');
  await finished.getByRole('button',{name:'삭제하지 않기'}).click();await expect(finished.getByLabel('이미지 삭제 확인')).toHaveCount(0);
  await finished.getByRole('button',{name:'목록에서 숨기기'}).click();await expect(finished).toContainText('목록에서 숨긴 항목');
  await finished.getByRole('button',{name:'이미지 삭제',exact:true}).click();await finished.getByRole('button',{name:'삭제 확인',exact:true}).click();await expect(finished).toHaveCount(0);
  expect(actions).toEqual(['cancel','visibility','visibility','visibility','visibility']);
  await expect(page.locator('[data-job-id="shape-job"]').getByRole('button',{name:'이미지 삭제',exact:true})).toHaveCount(0);
  jobs=[{...common,id:'running-job',state:'image_queued',source:{kind:'text',prompt:'구름'},running:true}];
  await expect(panel.getByLabel('생성 진행 상황')).toContainText('프롬프트 정리·이미지 생성 중…');
  await expect(panel.getByRole('button',{name:'대기 요청 취소'})).toHaveCount(0);
  await expect(panel).toContainText('처리 중인 작업은 취소할 수 없어요.');
  jobs=[];await expect(panel.getByRole('button',{name:'이미지 그리기',exact:true})).toBeEnabled();
  await panel.getByLabel('생성할 물건 설명').fill('nude girl');await panel.getByRole('button',{name:'이미지 그리기',exact:true}).click();
  await expect(panel.getByLabel('생성 안내')).toContainText('수업에 적합');await expect(panel.getByLabel('생성 안내')).not.toContainText('접수했어요');
 }finally{
  release();releaseStalePoll();await page.goto('about:blank').catch(()=>{});const pool=new Pool({connectionString:'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'});
  try{await pool.query('DELETE FROM coedit_rooms WHERE id=$1',[student.roomKey]);await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[teacher.actor]);}finally{await pool.end();}
 }
});
