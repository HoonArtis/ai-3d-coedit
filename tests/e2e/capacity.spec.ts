import {test,expect} from './fixture';import {Client} from '@colyseus/sdk';import {randomUUID} from 'node:crypto';
test('near-limit chat warning updates and the 201st UI placement is refused',async({page,request})=>{
 const endpoint='http://127.0.0.1:2568',identity=await(await request.post(endpoint+'/api/local-session')).json(),room=await new Client(endpoint).joinOrCreate('studio',{token:identity.token,roomKey:identity.roomKey});room.onMessage('event',()=>{});room.onMessage('preview',()=>{});
 const send=(start:number,count:number)=>new Promise<any>(resolve=>{const requestId=randomUUID(),off=room.onMessage('result',r=>{if(r.requestId===requestId){off();resolve(r.result);}});room.send('command',{actor:identity.actor,source:'chat',requestId,ops:Array.from({length:count},(_,i)=>({op:'place',id:'capacity-'+(start+i),assetId:'cube',position:[((start+i)%20)*2,0,Math.floor((start+i)/20)*2]}))});});
 try{
  expect((await send(0,180)).ok).toBe(true);await page.addInitScript(value=>localStorage.setItem('coedit-local-identity',JSON.stringify(value)),identity);await page.goto('/');await expect(page.getByLabel('에셋 수')).toHaveText('180 / 200');await expect(page.getByLabel('공간 한도 안내')).toContainText('20개');
  expect((await send(180,20)).ok).toBe(true);await expect(page.getByLabel('공간 한도 안내')).toContainText('가득');await page.getByRole('button',{name:'컬러 블록 배치'}).dblclick();await expect(page.getByRole('status',{name:'작업 안내'})).toContainText('200개');await expect(page.getByLabel('에셋 수')).toHaveText('200 / 200');
 }finally{await page.goto('about:blank');await room.leave();}
});
