import {test,expect,beforeAll,afterAll} from 'vitest';
import {Pool} from 'pg';import {randomUUID} from 'node:crypto';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {LocalObjectStore} from '@coedit/artifacts';
import {AccountService} from '../../apps/server/src/accounts/service';import {GenerationRepository} from '../../apps/server/src/generation/repository';import {FinishingRepository} from '../../apps/server/src/generation/finishing-repository';import {AssetService} from '../../apps/server/src/assets/service';
const connectionString='postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit',schema='asset_test_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString}),pool=new Pool({connectionString,options:'-c search_path='+schema}),accounts=new AccountService(pool),generation=new GenerationRepository(pool),finishing=new FinishingRepository(pool);
let dir:string,store:LocalObjectStore,service:AssetService;
beforeAll(async()=>{await admin.query('CREATE SCHEMA '+schema);await accounts.migrate();await generation.migrate();await finishing.migrate();dir=await mkdtemp(join(tmpdir(),'coedit-assets-'));store=new LocalObjectStore(dir);service=new AssetService(accounts,store);await service.migrate();});
afterAll(async()=>{await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();await rm(dir,{recursive:true,force:true});});
test('only owning teacher decides; pending artifacts private, approved catalog scoped, conflicting decisions rejected',async()=>{
 const teacher=await accounts.registerTeacher({username:'approval-'+randomUUID(),password:'test-password-1234'}),foreign=await accounts.registerTeacher({username:'foreign-'+randomUUID(),password:'test-password-1234'}),c=await accounts.createClass(teacher.token,{name:'approved',roomCount:1}),[s,other]=await accounts.issueStudents(teacher.token,c.id,2),owner=await accounts.joinStudent({roomCode:s.roomCode,issuedId:s.issuedId}),peer=await accounts.joinStudent({roomCode:other.roomCode,issuedId:other.issuedId});
 const scope={...s,role:'student' as const},key=await store.put(Buffer.from('fixture-glb')),job=await generation.reserve(scope,0,{requestId:randomUUID(),source:{kind:'text',prompt:'파란 벤치'}});await generation.imageReady(job.id,1,key);await generation.confirm(scope,job.id,1);await generation.shapeReady(job.id,1,key);await finishing.discover();await finishing.textureReady(job.id,1,key);
 const manifest={formatVersion:1,jobId:job.id,version:1,generation:0,originalKey:key,desktop:{key,triangles:1,drawCalls:1,dimensions:[1,1,1],textures:[]},provenance:{texture:'mv-adapter',researchOnly:true,sources:[]}},artifactId=await store.put(new TextEncoder().encode(JSON.stringify(manifest)));await finishing.artifactReady(job.id,1,artifactId);
 expect(await service.library(owner.token,s.roomKey)).toEqual({});await expect(service.file(peer.token,artifactId,false)).rejects.toThrow('FORBIDDEN');await expect(service.file(peer.token,artifactId,true)).rejects.toThrow('FORBIDDEN');
 expect(await service.file(teacher.token,artifactId,true)).toEqual(await store.get(key));expect(await service.file(owner.token,artifactId,true)).toEqual(await store.get(key));
 await expect(service.decide(foreign.token,c.id,job.id,1,'approved')).rejects.toThrow('FORBIDDEN');await expect(service.decide(owner.token,c.id,job.id,1,'approved')).rejects.toThrow('FORBIDDEN');
 await Promise.all([service.decide(teacher.token,c.id,job.id,1,'approved'),service.decide(teacher.token,c.id,job.id,1,'approved')]);
 await expect(service.decide(teacher.token,c.id,job.id,1,'rejected')).rejects.toThrow('DECISION_CONFLICT');
 expect(Object.values(await service.library(peer.token,s.roomKey))).toMatchObject([{id:'generated-'+artifactId,kind:'generated',name:'파란 벤치',artifactId}]);expect(await service.file(peer.token,artifactId,false)).toEqual(await store.get(key));await expect(service.file(foreign.token,artifactId,true)).rejects.toThrow('FORBIDDEN');
 expect(await service.retextureSource({...scope,roomKey:s.roomKey},'generated-'+artifactId)).toEqual({shapeKey:key});
 await expect(service.retextureSource({...scope,actor:foreign.actor},'generated-'+artifactId)).rejects.toThrow('FORBIDDEN');
 const rejected=await generation.reserve(scope,0,{requestId:randomUUID(),source:{kind:'upload',imageKey:key}});await generation.confirm(scope,rejected.id,1);await generation.shapeReady(rejected.id,1,key);await finishing.discover();await finishing.textureReady(rejected.id,1,key);
 const rejectedArtifact=await store.put(new TextEncoder().encode(JSON.stringify({...manifest,jobId:rejected.id})));await finishing.artifactReady(rejected.id,1,rejectedArtifact);
 await service.decide(teacher.token,c.id,rejected.id,1,'rejected');await service.decide(teacher.token,c.id,rejected.id,1,'rejected');
 expect(Object.keys(await service.library(owner.token,s.roomKey))).toHaveLength(1);await expect(service.file(owner.token,rejectedArtifact,false)).rejects.toThrow('FORBIDDEN');await expect(service.file(peer.token,rejectedArtifact,true)).rejects.toThrow('FORBIDDEN');
 await expect(service.retextureSource(scope,'generated-'+rejectedArtifact)).rejects.toThrow('FORBIDDEN');
 await expect(service.decide(teacher.token,c.id,rejected.id,1,'approved')).rejects.toThrow('DECISION_CONFLICT');
});

test('only an approved own character becomes the VR avatar; files remain class scoped',async()=>{
 const teacher=await accounts.registerTeacher({username:'character-owner-'+randomUUID(),password:'test-password-1234'}),c=await accounts.createClass(teacher.token,{name:'character approval',roomCount:1}),[s,other]=await accounts.issueStudents(teacher.token,c.id,2),scope={...s,role:'student' as const};
 const owner=await accounts.joinStudent({roomCode:s.roomCode,issuedId:s.issuedId}),peer=await accounts.joinStudent({roomCode:other.roomCode,issuedId:other.issuedId});
 const key=await store.put(Buffer.from('fixture-input')),desktopKey=await store.put(Buffer.from('fixture-desktop')),avatarKey=await store.put(Buffer.from('fixture-avatar'));
 const job=await generation.reserve(scope,0,{requestId:randomUUID(),source:{kind:'character',format:'fbx',name:'My character',inputKey:key}});await finishing.discover();
 const manifest={formatVersion:1,jobId:job.id,version:1,generation:0,originalKey:key,desktop:{key:desktopKey,triangles:100,drawCalls:1,dimensions:[.5,1.7,.5],textures:[]},character:{avatarKey,vrKey:desktopKey,joints:2,clips:['Idle'],avatarTriangles:200},provenance:{texture:'uploaded',researchOnly:false,sources:[]}},artifactId=await store.put(new TextEncoder().encode(JSON.stringify(manifest)));await finishing.artifactReady(job.id,1,artifactId);
 expect(await service.avatarFor(s.actor,s.roomKey)).toBeNull();await expect(service.file(peer.token,artifactId,false,true)).rejects.toThrow('FORBIDDEN');
 await service.decide(teacher.token,c.id,job.id,1,'approved');expect(await service.avatarFor(s.actor,s.roomKey)).toBe(artifactId);expect(await service.avatarFor(other.actor,s.roomKey)).toBeNull();expect(await service.avatarFor(s.actor,'different-room')).toBeNull();
 expect(await service.file(peer.token,artifactId,false,true)).toEqual(await store.get(avatarKey));expect(Object.values(await service.library(owner.token,s.roomKey))[0]).toMatchObject({character:true});
 await expect(service.retextureSource(scope,'generated-'+artifactId)).rejects.toThrow('CHARACTER_RETEXTURE_UNSUPPORTED');
});
