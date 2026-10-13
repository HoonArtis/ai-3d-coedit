import {ImageService} from '../apps/server/src/generation/image-service';
import {Pool} from 'pg';import {randomUUID} from 'node:crypto';import {readFile,writeFile} from 'node:fs/promises';
import {LocalObjectStore} from '@coedit/artifacts';import {JobQueues} from '@coedit/jobs';import {BUILTIN_LIBRARY,artifactManifestSchema} from '@coedit/contracts';
import {AccountService} from '../apps/server/src/accounts/service';import {GenerationRepository} from '../apps/server/src/generation/repository';import {FinishingRepository} from '../apps/server/src/generation/finishing-repository';import {FinishingService} from '../apps/server/src/generation/finishing-service';import {RetextureService} from '../apps/server/src/generation/retexture-service';import {AssetService} from '../apps/server/src/assets/service';import {RoomService} from '../apps/server/src/rooms/room-service';import {PostgresRoomRepository} from '../apps/server/src/storage/postgres-room';import {DurableRoom} from '../apps/server/src/rooms/durable-room';
const pool=new Pool({connectionString:'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'}),accounts=new AccountService(pool),generation=new GenerationRepository(pool),finishing=new FinishingRepository(pool),store=new LocalObjectStore('.data/objects'),queues=new JobQueues(),assets=new AssetService(accounts,store),finisher=new FinishingService(finishing,queues,store),repository=new PostgresRoomRepository(pool);
await generation.migrate();await queues.ready();const teacher=await accounts.registerTeacher({username:'retexture-smoke-'+randomUUID(),password:randomUUID()});let roomId:string|undefined;
try{
 const c=await accounts.createClass(teacher.token,{name:'Actual retexture smoke',roomCount:1}),[student]=await accounts.issueStudents(teacher.token,c.id,1),scope={...student,role:'student' as const};roomId=student.roomKey;
 const evidence=JSON.parse(await readFile('docs/evidence/textured-artifact.json','utf8')),imageKey=await store.put(await readFile('.cache/smoke/whale.png'));
 const original=await generation.reserve(scope,0,{requestId:randomUUID(),source:{kind:'upload',imageKey}});await generation.confirm(scope,original.id,1);await generation.shapeReady(original.id,1,evidence.manifest.originalKey);await finishing.discover();await finishing.textureReady(original.id,1,evidence.manifest.originalKey);
 const originalArtifact=await store.put(new TextEncoder().encode(JSON.stringify({...evidence.manifest,jobId:original.id})));await finishing.artifactReady(original.id,1,originalArtifact);await assets.decide(teacher.token,c.id,original.id,1,'approved');
 const room=new RoomService(roomId,{...BUILTIN_LIBRARY,...await assets.catalogForRoom(roomId)}),durable=await DurableRoom.open(room,repository);room.join('s',{actor:student.actor,role:'student'});
 const send=(ops:unknown[],lockTokens={})=>durable.submit('s',{actor:student.actor,source:'gizmo',requestId:randomUUID(),ops,lockTokens});
 const placed=await send([{op:'place',id:'whale',assetId:'generated-'+originalArtifact,position:[2,0,1]}]);if(!placed.ok)throw Error(placed.code);
 const service=new RetextureService(generation,assets),job=await service.request(room,'s',{actor:student.actor,source:'chat',requestId:randomUUID(),ops:[{op:'retexture',id:'whale',prompt:'a whale shaped wooden bench, entirely painted vivid red, red wooden surface, matte wood grain'}]});
 const started=Date.now(),phases:string[]=[];let completed=false;const images=new ImageService(generation,queues,store);
 while(Date.now()-started<600000){
  await images.reconcile();const image=await generation.get(scope,job.id);if(image.state==='failed')throw Error(image.error??'IMAGE_FAILED');if(image.state==='awaiting_confirmation'){await writeFile('.cache/smoke/retexture-reference.png',await store.get(image.imageKey!));await generation.confirm(scope,job.id,1);console.log('new reference explicitly confirmed by test');}if(image.state==='image_queued'){await new Promise(resolve=>setTimeout(resolve,750));continue;}
  await finisher.reconcile();const row=await finishing.get(scope,job.id,1);if(phases.at(-1)!==row.phase){phases.push(row.phase);console.log(row.phase);}
  if(['failed','material_choice'].includes(row.phase))throw Error(row.error??row.phase);
  if(row.phase==='pending_approval'){
   await assets.decide(teacher.token,c.id,job.id,1,'approved');room.setLibrary({...BUILTIN_LIBRARY,...await assets.catalogForRoom(roomId)});
   await send([{op:'lock',ids:['whale']}]);const lockTokens={whale:room.locks.whale.token},op={op:'replace_asset',id:'whale',assetId:'generated-'+row.artifactId,expectedRevision:job.target!.revision,expectedGeneration:job.target!.generation};
   const stale=await send([{...op,expectedRevision:0}],lockTokens);if(stale.ok||stale.code!=='STALE_RETEXTURE')throw Error('STALE_RESULT_ACCEPTED');
   const applied=await send([op],lockTokens);if(!applied.ok||applied.snapshot.objects.whale.assetId!==op.assetId||applied.snapshot.objects.whale.owner!==student.actor)throw Error('APPLY_FAILED');
   const undone=await send([{op:'undo'}],lockTokens);if(!undone.ok||undone.snapshot.objects.whale.assetId!=='generated-'+originalArtifact)throw Error('UNDO_FAILED');
   const manifest=artifactManifestSchema.parse(JSON.parse(new TextDecoder().decode(await store.get(row.artifactId!))));
   await writeFile('.cache/smoke/whale-retextured.glb',await store.get(manifest.desktop.key));
   const report={date:new Date().toISOString(),seconds:(Date.now()-started)/1000,phases,usage:await generation.usage(scope),target:job.target,staleRejected:true,appliedSeq:applied.snapshot.seq,undoSeq:undone.snapshot.seq,artifactId:row.artifactId,manifest};await writeFile('docs/evidence/retexture-gpu.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));completed=true;break;
  }
  await new Promise(resolve=>setTimeout(resolve,750));
 }
 if(!completed)throw Error('SMOKE_TIMEOUT');
}finally{if(roomId)await pool.query('DELETE FROM coedit_rooms WHERE id=$1',[roomId]);await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[teacher.actor]);await queues.close();await pool.end();}
