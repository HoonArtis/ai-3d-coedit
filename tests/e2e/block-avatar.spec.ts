import {test,expect} from './fixture';
import {randomUUID} from 'node:crypto';
import {Client} from '@colyseus/sdk';
test('choose a block character without files, persist after reload, and broadcast it in VR',async({page,request})=>{
 test.setTimeout(90000);
 const base='http://127.0.0.1:2568/api',teacher=await(await request.post(base+'/teachers/register',{data:{username:'block-'+randomUUID(),password:'test-password-1234'}})).json(),headers={Authorization:'Bearer '+teacher.token},c=await(await request.post(base+'/classes',{headers,data:{name:'블록 캐릭터',roomCount:1}})).json(),[s]=await(await request.post(base+'/classes/'+c.id+'/students',{headers,data:{count:1}})).json(),identity=await(await request.post(base+'/students/login',{data:{roomCode:s.roomCode,issuedId:s.issuedId}})).json(),studentHeaders={Authorization:'Bearer '+identity.token};
 await page.addInitScript(identity=>{localStorage.setItem('coedit-account-token',identity.token);localStorage.setItem('coedit-account-identity',JSON.stringify(identity));},identity);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'내 캐릭터',exact:true}).click();await page.getByRole('button',{name:'노을',exact:true}).click();
 await page.getByRole('button',{name:'내 캐릭터 적용',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'내 캐릭터로 적용됐어요'})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'내 캐릭터',exact:true}).click();await expect(page.getByLabel('상의 색')).toHaveValue('#ed8955');
 await expect(page.getByRole('button',{name:'현재 내 캐릭터 · 다시 적용'})).toBeVisible();await page.screenshot({path:'docs/evidence/block-avatar-picker.png'});
 await page.getByRole('button',{name:'캐릭터 닫기'}).click();await page.getByRole('link',{name:'VR 감상'}).click();
 await page.getByRole('button',{name:'내 캐릭터',exact:true}).click();await expect(page.getByLabel('상의 색')).toHaveValue('#ed8955');await page.getByRole('button',{name:'캐릭터 닫기'}).click();
 await page.getByRole('button',{name:'현재 작품 제출'}).click();await expect(page.getByRole('button',{name:/제출본.*미리보기/})).toBeVisible({timeout:45000});
 const records=await(await request.get(base+'/rooms/'+s.roomKey+'/vr',{headers:studentHeaders})).json(),peer=await new Client('http://127.0.0.1:2568').joinOrCreate('viewing',{token:identity.token,roomKey:s.roomKey,snapshotId:records[0].snapshotId});
 let avatar:any;peer.onMessage('poses',data=>{if(data.avatars.length)avatar=data.avatars[0];});
 try{peer.send('pose',{seq:1,head:{position:[0,1.6,0],quaternion:[0,0,0,1]},left:null,right:null});await expect.poll(()=>avatar?.blockAvatar?.shirt).toBe('#ed8955');expect(avatar.actor).toBe(identity.actor);
 const updated={...avatar.blockAvatar,shirt:'#4e9864'};
 await request.post(base+'/rooms/'+s.roomKey+'/avatar',{headers:studentHeaders,data:updated});peer.send('avatar-refresh');
 peer.send('pose',{seq:2,head:{position:[0,1.6,0],quaternion:[0,0,0,1]},left:null,right:null});await expect.poll(()=>avatar?.blockAvatar?.shirt).toBe('#4e9864');
 await request.post(base+'/rooms/'+s.roomKey+'/avatar',{headers:{...studentHeaders,'Content-Type':'application/json'},data:'null'});peer.send('avatar-refresh');await expect.poll(()=>avatar?.blockAvatar).toBeNull();}finally{await peer.leave();}
 expect(errors).toEqual([]);
});
