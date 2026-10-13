import {Pool} from 'pg';
import {singleFlight} from './single-flight';
import {startServer} from './server';
import {PostgresRoomRepository} from './storage/postgres-room';
import {AccountService} from './accounts/service';
import {JobQueues} from '@coedit/jobs';
import {ChatRepository} from './chat/repository';
import {ChatService} from './chat/service';
import {LocalObjectStore} from '@coedit/artifacts';
import {GenerationRepository} from './generation/repository';
import {ImageService} from './generation/image-service';
import {FinishingRepository} from './generation/finishing-repository';
import {FinishingService} from './generation/finishing-service';
import {AssetService} from './assets/service';
import {RoomHistoryService} from './storage/room-history';
import {SubmissionService} from './storage/submissions';
import {VrBakeService} from './vr/bake-service';
import {RetextureService} from './generation/retexture-service';
export async function startRuntime(preview=false){
  const connectionString=process.env.DATABASE_URL??(preview?'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit':undefined);
  if(!connectionString)throw Error('DATABASE_URL is required');
  const pool=new Pool({connectionString});const repository=new PostgresRoomRepository(pool),accounts=new AccountService(pool);
  const queues=new JobQueues(),chatRepository=new ChatRepository(pool),generation=new GenerationRepository(pool);
  try{
    await repository.migrate();await accounts.migrate();await chatRepository.migrate();await generation.migrate();await queues.ready();
    const store=new LocalObjectStore(process.env.OBJECT_STORE_DIR??'.data/objects'),finishingRepository=new FinishingRepository(pool);await finishingRepository.migrate();
    const finishing=new FinishingService(finishingRepository,queues,store,async roomId=>(await repository.load(roomId))?.snapshot.generation??0),images=new ImageService(generation,queues,store,finishing);
    const assets=new AssetService(accounts,store);await assets.migrate();
    const submissions=new SubmissionService(pool,repository,store);await submissions.migrate();
    const history=new RoomHistoryService(pool,accounts,submissions),vr=new VrBakeService(accounts,submissions,queues,store,assets);await vr.migrate();
    const retexture=new RetextureService(generation,assets);
    const server=await startServer(Number(process.env.PORT??2567),preview,{repository,accounts,chat:new ChatService(chatRepository,queues),images,assets,history,vr,retexture,webRoot:process.env.SERVE_WEB==='1'?'dist/web':undefined,registrationEnabled:process.env.DISABLE_TEACHER_REGISTRATION!=='1'});
    const reconcile=singleFlight(async()=>{for(const result of await Promise.allSettled([images.reconcile(),finishing.reconcile(),vr.enqueuePending()]))if(result.status==='rejected')console.error('Job coordinator:',result.reason);});
    const timer=setInterval(()=>void reconcile(),500);
    return {...server,close:async()=>{clearInterval(timer);await server.close();await reconcile();await queues.close();await pool.end();}};
  }catch(error){await queues.close();await pool.end();throw error;}
}
