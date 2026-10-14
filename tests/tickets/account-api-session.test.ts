import {test,expect,vi,afterEach} from 'vitest';
import {accountApi} from '../../apps/web/src/accounts/api';

afterEach(()=>vi.unstubAllGlobals());
test('room-scoped API requests use the live editor identity even when the account token belongs to another actor',async()=>{
 vi.stubGlobal('localStorage',{getItem:()=> 'old-teacher-token'});
 let authorization:string|null=null;
 vi.stubGlobal('fetch',async(_url:string,options:RequestInit)=>{
  authorization=new Headers(options.headers).get('Authorization');
  return new Response(JSON.stringify({shared:true}),{status:200,headers:{'Content-Type':'application/json'}});
 });
 const result=await accountApi('/rooms/current/assets/artifact/share',{},undefined,'active-student-token');
 expect(result).toEqual({shared:true});expect(authorization).toBe('Bearer active-student-token');
});
test('an explicitly missing room token never falls back to a different global account',async()=>{
 vi.stubGlobal('localStorage',{getItem:()=> 'old-teacher-token'});
 let authorization:string|null=null;
 vi.stubGlobal('fetch',async(_url:string,options:RequestInit)=>{authorization=new Headers(options.headers).get('Authorization');return new Response('[]');});
 await accountApi('/rooms/current/asset-history',undefined,undefined,'');
 expect(authorization).toBeNull();
});
