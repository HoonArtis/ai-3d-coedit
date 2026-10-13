import {test,expect} from './fixture';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {Pool} from 'pg';
import {LocalObjectStore} from '@coedit/artifacts';
import {Document,NodeIO} from '@gltf-transform/core';
test('student uploads a real image, previews it without starting 3D, rejects invalid file and blocked prompt',async({page,request})=>{
 const base='http://127.0.0.1:2568/api',teacher=await(await request.post(base+'/teachers/register',{data:{username:'gen-ui-'+randomUUID(),password:'test-password-1234'}})).json();
 const headers={Authorization:'Bearer '+teacher.token};const c=await(await request.post(base+'/classes',{headers,data:{name:'생성 확인',roomCount:1}})).json();
 const [s]=await(await request.post(base+'/classes/'+c.id+'/students',{headers,data:{count:1}})).json();
 const identity=await(await request.post(base+'/students/login',{data:{roomCode:s.roomCode,issuedId:s.issuedId}})).json();
 let releaseConfirm=()=>{};
 try{
  await page.addInitScript(value=>localStorage.setItem('coedit-account-identity',JSON.stringify(value)),identity);await page.goto('/');
  await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();await page.getByText('새 에셋 만들기',{exact:true}).click();
  await page.getByLabel('생성할 물건 설명').fill('nude girl');await page.getByRole('button',{name:'이미지 그리기',exact:true}).click();
  await expect(page.getByLabel('작업 안내')).toContainText('수업에 적합');
  await page.getByLabel('그림 업로드').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('broken')});
  await expect(page.getByLabel('생성 안내')).toBeVisible();
  await expect(page.getByLabel('생성 사용량')).toHaveText('0 / 3회 사용');
  let imageFailure=true;await page.route('**/api/generation/*/*/image',async route=>{if(imageFailure){imageFailure=false;await route.fulfill({status:503,body:'unavailable'});}else await route.continue();});
  const buffer=await sharp({create:{width:64,height:64,channels:4,background:'#50b5ca'}}).png().toBuffer();
  await page.getByLabel('그림 업로드').setInputFiles({name:'blue.png',mimeType:'image/png',buffer});
  await expect(page.getByText('이미지를 읽지 못했어요.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'미리보기 다시 읽기'}).click();
  await expect(page.getByAltText('확인할 생성 이미지')).toBeVisible();await expect(page.getByRole('button',{name:'이 이미지로 3D 만들기'})).toBeVisible();
  await expect(page.getByLabel('생성 사용량')).toHaveText('1 / 3회 사용');
  await page.reload();await page.getByText('새 에셋 만들기',{exact:true}).click();await expect(page.getByAltText('확인할 생성 이미지')).toBeVisible();
  await expect(page.getByLabel('에셋 수')).toHaveText('0 / 200');
  await page.screenshot({path:'docs/evidence/generation-confirmation.png',fullPage:true});
  const versions:number[]=[],gate=new Promise<void>(resolve=>releaseConfirm=resolve);await page.route('**/api/generation/*/*/confirm',async route=>{versions.push(route.request().postDataJSON().version);await gate;await route.fulfill({status:200,json:{}});});
  const confirm=page.getByRole('button',{name:'이 이미지로 3D 만들기'});await confirm.click();await expect(confirm).toBeDisabled();const box=await confirm.boundingBox();await page.mouse.click(box!.x+box!.width/2,box!.y+box!.height/2);expect(versions).toEqual([1]);releaseConfirm();await expect(confirm).toBeEnabled();
 }finally{releaseConfirm();await page.goto('about:blank').catch(()=>{});const pool=new Pool({connectionString:'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'});await pool.query('DELETE FROM coedit_rooms WHERE id=$1',[s.roomKey]);await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[teacher.actor]);await pool.end();}
});
test('texture failure stays visible until student explicitly chooses a preset',async({page,request})=>{
 const base='http://127.0.0.1:2568/api',teacher=await(await request.post(base+'/teachers/register',{data:{username:'preset-ui-'+randomUUID(),password:'test-password-1234'}})).json();
 const headers={Authorization:'Bearer '+teacher.token},c=await(await request.post(base+'/classes',{headers,data:{name:'재질 선택',roomCount:1}})).json(),[s]=await(await request.post(base+'/classes/'+c.id+'/students',{headers,data:{count:1}})).json(),identity=await(await request.post(base+'/students/login',{data:{roomCode:s.roomCode,issuedId:s.issuedId}})).json();
 const pool=new Pool({connectionString:'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'});
 try{
  const image=await sharp({create:{width:32,height:32,channels:3,background:'blue'}}).png().toBuffer();
  const uploaded=await(await request.post(base+'/generation/'+s.roomKey+'/upload/'+randomUUID(),{headers:{Authorization:'Bearer '+identity.token,'Content-Type':'image/png'},data:image})).json();
  const doc=new Document(),b=doc.createBuffer(),p=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0])).setBuffer(b));doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(p)));
  const key=await new LocalObjectStore('.data/objects').put(await new NodeIO().writeBinary(doc));
  const db=await pool.connect();try{await db.query('BEGIN');await db.query("UPDATE coedit_generation_versions SET state='shape_ready',shape_key=$2 WHERE job_id=$1",[uploaded.id,key]);await db.query("INSERT INTO coedit_generation_finishing(job_id,version,phase,error) VALUES($1,1,'material_choice','TEXTURE_FAILED')",[uploaded.id]);await db.query('COMMIT');}finally{db.release();}
  await page.addInitScript(value=>localStorage.setItem('coedit-account-identity',JSON.stringify(value)),identity);await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();await page.getByText('새 에셋 만들기',{exact:true}).click();
  await expect(page.getByText('텍스처 생성 실패 · 재질을 직접 골라 주세요',{exact:true})).toBeVisible();await expect(page.getByLabel('실패 후 재질 선택')).toBeVisible();await expect(page.getByText('텍스처를 만드는 단계에서 실패했어요.',{exact:true})).toBeVisible();
  await page.reload();await page.getByText('새 에셋 만들기',{exact:true}).click();await expect(page.getByLabel('실패 후 재질 선택')).toBeVisible();await expect(page.getByText('텍스처를 만드는 단계에서 실패했어요.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'나무 재질 사용',exact:true}).click();await expect(page.getByLabel('실패 후 재질 선택')).toHaveCount(0);await expect(page.getByLabel('생성 사용량')).toHaveText('1 / 3회 사용');
  expect((await pool.query('SELECT preset FROM coedit_generation_finishing WHERE job_id=$1',[uploaded.id])).rows[0].preset).toBe('wood');await expect(page.getByLabel('에셋 수')).toHaveText('0 / 200');
 }finally{await page.goto('about:blank').catch(()=>{});await pool.query('DELETE FROM coedit_rooms WHERE id=$1',[s.roomKey]);await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[teacher.actor]);await pool.end();}
});
