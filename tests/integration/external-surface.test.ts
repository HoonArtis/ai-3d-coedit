import {test,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../apps/server/src/server';
import type {AccountService} from '../../apps/server/src/accounts/service';

test('external surface serves only built files, denies registration and anonymous sessions, preserves API routes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'coedit-public-'));
 await writeFile(join(dir,'index.html'),'<html>built-app</html>');
 let registered=false;
 const accounts={registerTeacher:async()=>{registered=true;return {};}} as unknown as AccountService;
 const server=await startServer(0,false,{accounts,webRoot:dir,registrationEnabled:false});
 try{
  expect(await (await fetch(server.url)).text()).toContain('built-app');
  expect((await fetch(server.url+'/api/local-session',{method:'POST'})).status).toBe(404);
  expect((await fetch(server.url+'/api/teachers/register',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status).toBe(403);
  expect(registered).toBe(false);
  expect(await (await fetch(server.url+'/api/runtime-config')).json()).toEqual({localPreview:false,registrationEnabled:false});
  expect((await fetch(server.url+'/.env')).status).toBe(404);
  expect((await fetch(server.url+'/api/missing')).status).toBe(404);
  expect((await fetch(server.url+'/health')).status).toBe(200);
  expect((await fetch(server.url+'/health',{headers:{Origin:'https://untrusted.invalid'}})).status).toBe(403);
 }finally{await server.close();await rm(dir,{recursive:true,force:true});}
});
