import {test,expect,beforeAll,afterAll} from 'vitest';import {Pool} from 'pg';import {randomUUID} from 'node:crypto';
import {AccountService} from '../../apps/server/src/accounts/service';import {GenerationRepository} from '../../apps/server/src/generation/repository';import {FinishingRepository} from '../../apps/server/src/generation/finishing-repository';
import {RetextureService} from '../../apps/server/src/generation/retexture-service';
import {RoomService} from '../../apps/server/src/rooms/room-service';
import {BUILTIN_LIBRARY} from '@coedit/contracts';
const connectionString='postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit',schema='retexture_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString}),pool=new Pool({connectionString,options:'-c search_path='+schema}),accounts=new AccountService(pool),repository=new GenerationRepository(pool),finishing=new FinishingRepository(pool);
beforeAll(async()=>{await admin.query('CREATE SCHEMA '+schema);await accounts.migrate();await repository.migrate();await finishing.migrate();});afterAll(async()=>{await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();});
test('retexture reserves one charge and a durable texture outbox with the exact original object target',async()=>{
 const teacher=await accounts.registerTeacher({username:'retexture-'+randomUUID(),password:'test-password-1234'}),c=await accounts.createClass(teacher.token,{name:'retexture',roomCount:1}),[s]=await accounts.issueStudents(teacher.token,c.id,1),scope={...s,role:'student' as const};
 const prepared={shapeKey:'a'.repeat(64),imageKey:'b'.repeat(64),target:{objectId:'object',revision:7,generation:2,assetId:'original'}};
 const input={requestId:'retexture-once',source:{kind:'text',prompt:'빨간 나무 재질'}};
 const rows=await Promise.all(Array.from({length:5},()=>repository.reserveRetexture(scope,2,input,prepared)));
 expect(new Set(rows.map(r=>r.id)).size).toBe(1);expect(rows[0]).toMatchObject({state:'shape_ready',shapeKey:prepared.shapeKey,imageKey:prepared.imageKey,target:prepared.target});expect((await repository.usage(scope)).used).toBe(1);
 expect(await repository.pending()).toHaveLength(0);await finishing.discover();expect(await finishing.pending()).toMatchObject([{jobId:rows[0].id,phase:'texture_queued',shapeKey:prepared.shapeKey,imageKey:prepared.imageKey}]);
 await expect(repository.reserveRetexture(scope,2,input,{...prepared,target:{...prepared.target,revision:8}})).rejects.toThrow('REQUEST_CONFLICT');expect((await repository.usage(scope)).used).toBe(1);
 const reference=await repository.reserveRetexture(scope,2,{...input,requestId:'builtin-reference'},{shapeKey:prepared.shapeKey,target:prepared.target});expect(reference.state).toBe('shape_ready');expect(reference.imageKey).toBeNull();
 await finishing.discover();expect((await finishing.pending()).find(p=>p.jobId===reference.id)).toMatchObject({target:prepared.target,shapeKey:prepared.shapeKey,imageKey:null});
 // A failed retry keeps the immutable geometry/target and never regenerates a shape.
 await pool.query("UPDATE coedit_generation_versions SET state='failed',charged=false WHERE job_id=$1",[reference.id]);
 const redraw=await repository.reserve(scope,2,{requestId:'retexture-redraw',source:{kind:'text',prompt:'파란 금속'},jobId:reference.id,expectedVersion:1});expect(redraw.target).toEqual(prepared.target);expect(redraw.shapeKey).toBe(prepared.shapeKey);expect(redraw.state).toBe('shape_ready');

});
test('retexture command checks ownership and selection locks before it reaches generation storage',async()=>{
 const teacher=await accounts.registerTeacher({username:'retexture-cmd-'+randomUUID(),password:'test-password-1234'}),c=await accounts.createClass(teacher.token,{name:'retexture cmd',roomCount:1}),[s,other]=await accounts.issueStudents(teacher.token,c.id,2);
 const room=new RoomService(s.roomKey,BUILTIN_LIBRARY);room.join('owner',{actor:s.actor,role:'student'});room.join('other',{actor:other.actor,role:'student'});
 const send=(client:string,actor:string,ops:unknown[],requestId=randomUUID(),lockTokens={})=>room.submit(client,{actor,source:'gizmo',requestId,ops,lockTokens});
 send('owner',s.actor,[{op:'place',id:'one',assetId:'cube',position:[0,0,0]}]);
 let reads=0;const service=new RetextureService(repository,{retextureSource:async()=>{reads++;return {shapeKey:'a'.repeat(64),imageKey:'b'.repeat(64)};}});
 const command=(actor:string,source='gizmo',lockTokens={})=>({actor,source,requestId:'request-'+actor,ops:[{op:'retexture',id:'one',prompt:'빨간 나무'}],lockTokens});
 await expect(service.request(room,'other',command(other.actor))).rejects.toThrow();await expect(service.request(room,'owner',command(s.actor))).rejects.toThrow();expect(reads).toBe(0);
 const result=await service.request(room,'owner',command(s.actor,'chat'));expect(result.state).toBe('shape_ready');expect(result.target).toMatchObject({objectId:'one',revision:1,generation:0,assetId:'cube'});expect(reads).toBe(1);expect(room.snapshot.seq).toBe(1);expect(room.locks).toEqual({});
});
