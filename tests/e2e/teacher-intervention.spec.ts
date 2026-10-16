import {test,expect} from './fixture';
import {Client} from '@colyseus/sdk';
import {randomUUID} from 'node:crypto';
test('teacher force unlock cancels an active drag and teacher edits block stale personal undo',async({page,request})=>{
 const base='http://127.0.0.1:2568';
 const teacher=await (await request.post(base+'/api/teachers/register',{data:{username:'drag-'+randomUUID(),password:'test-password-1234'}})).json();
 const headers={Authorization:'Bearer '+teacher.token};
 const classroom=await (await request.post(base+'/api/classes',{headers,data:{name:'drag test',roomCount:1}})).json();
 const students=await (await request.post(base+`/api/classes/${classroom.id}/students`,{headers,data:{count:1}})).json();
 const student=await (await request.post(base+'/api/students/login',{data:{roomCode:students[0].roomCode,issuedId:students[0].issuedId}})).json();
 const identity=await (await request.post(base+'/api/room-session',{headers,data:{roomKey:classroom.rooms[0].id}})).json();
 await page.addInitScript(value=>localStorage.setItem('coedit-account-identity',JSON.stringify(value)),student);
 const room=await new Client(base).joinOrCreate('studio',{token:identity.token,roomKey:identity.roomKey});
 let snapshot:any;
 room.onMessage('event',(e:any)=>{if(e.type==='snapshot')snapshot=e.snapshot;});
 const pending=new Map<string,(r:any)=>void>();room.onMessage('result',(r:any)=>pending.get(r.requestId)?.(r.result));room.onMessage('preview',()=>{});
 const send=(ops:unknown[],lockTokens:Record<string,string>={})=>new Promise<any>(resolve=>{const requestId=randomUUID();pending.set(requestId,resolve);room.send('command',{actor:identity.actor,source:'teacher',requestId,ops,lockTokens});});
 try{
  await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'컬러 블록 배치'}).dblclick();await expect(page.getByLabel('위치 Z')).toBeEnabled();
  await expect.poll(()=>Object.keys(snapshot?.objects??{}).length).toBe(1);const id=Object.keys(snapshot.objects)[0];
  const box=(await page.locator('canvas').boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y-65);await page.mouse.down();await page.mouse.move(x,y-130,{steps:10});
  expect((await send([{op:'force_unlock',ids:[id]}])).ok).toBe(true);
  await expect(page.getByRole('status',{name:'작업 안내'})).toContainText('잠금이 해제');await page.mouse.up();
  await page.getByRole('button',{name:'컬러 블록 선택'}).click();await expect(page.getByLabel('위치 Z')).toHaveValue('0');
  expect(snapshot.seq).toBe(1);
  await send([{op:'force_unlock',ids:[id]}]);await send([{op:'lock',ids:[id]}]);
  let token='';room.onMessage('event',(e:any)=>{if(e.type==='locks')token=e.locks[id]?.token??'';});room.send('sync');await expect.poll(()=>token).not.toBe('');
  expect((await send([{op:'move',id,value:[0,3,0]}],{[id]:token})).ok).toBe(true);
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();await expect(page.getByRole('status',{name:'작업 안내'})).toContainText('다른');
  expect(snapshot.objects[id].position[1]).toBe(3);
 }finally{await page.goto('about:blank');await room.leave();}
});
