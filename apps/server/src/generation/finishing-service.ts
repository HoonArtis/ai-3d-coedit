import {artifactManifestSchema,objectKeySchema,type JobInput,type Session} from '@coedit/contracts';
import type {ObjectStore} from '@coedit/artifacts';
import type {JobQueues} from '@coedit/jobs';
import {FinishingRepository,type PendingFinish} from './finishing-repository';
export class FinishingService{
 private running:Promise<void>|undefined;
 constructor(readonly repository:FinishingRepository,private queues:JobQueues,private store:ObjectStore,private currentGeneration:(roomId:string)=>Promise<number>=async()=>0){}
 private input(row:PendingFinish):JobInput{
  if(row.source.kind==='character')return {jobId:row.jobId,inputVersion:row.version,actor:row.actor,roomId:row.roomId,generation:row.generation,stage:'character',payload:{inputKey:row.source.inputKey!,format:row.source.format!}};
  const texture=row.phase==='texture_queued';
  return {jobId:row.jobId,inputVersion:row.version,actor:row.actor,roomId:row.roomId,generation:row.generation,stage:texture?'texture':'optimize',payload:texture?{textureMode:row.target?'text-geometry':'image-geometry',shapeKey:row.shapeKey,imageKey:row.imageKey,prompt:row.source.prompt??'a single object matching the reference image'}:{rawKey:row.textureKey??row.shapeKey,preset:row.preset,texture:row.preset?'preset':'mv-adapter',researchOnly:true}};
 }
 async choosePreset(scope:Session&{roomKey:string},id:string,version:number,preset:unknown){return this.repository.choosePreset(scope,id,version,preset);}
 reconcile(){
  if(this.running)return this.running;
  this.running=(async()=>{
   await this.repository.discover();
   for(const row of await this.repository.pending()){
    const id=await this.queues.enqueue(this.input(row)),state=await this.queues.status(id);if(!state)continue;
    if(state.status==='failed'){
     if(row.phase==='texture_queued')await this.repository.textureFailed(row.jobId,row.version,'TEXTURE_FAILED');
     else await this.repository.fail(row.jobId,row.version,'OPTIMIZE_FAILED');continue;
    }
    if(state.status!=='completed')continue;
    try{
     if(row.phase==='texture_queued'){
      const key=objectKeySchema.parse((state.result as {key?:unknown})?.key);await this.store.get(key);await this.repository.textureReady(row.jobId,row.version,key);
     }else{
      const artifactId=objectKeySchema.parse((state.result as {artifactId?:unknown})?.artifactId),manifest=artifactManifestSchema.parse(JSON.parse(new TextDecoder().decode(await this.store.get(artifactId))));
      if(manifest.jobId!==row.jobId||manifest.version!==row.version||manifest.generation!==row.generation)throw Error('STALE_ARTIFACT');
      await this.store.get(manifest.originalKey);await this.store.get(manifest.desktop.key);
      await this.repository.artifactReady(row.jobId,row.version,artifactId,(await this.currentGeneration(row.roomId))!==row.generation);
     }
    }catch{
     if(row.phase==='texture_queued')await this.repository.textureFailed(row.jobId,row.version,'INVALID_TEXTURE_RESULT');
     else await this.repository.fail(row.jobId,row.version,'INVALID_ARTIFACT_RESULT');
    }
   }
  })().finally(()=>{this.running=undefined;});return this.running;
 }
}
