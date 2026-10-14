import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {JobQueues,runWorkerProcess} from '@coedit/jobs';
import {LocalObjectStore} from '@coedit/artifacts';
import {objectKeySchema} from '@coedit/contracts';
import {generationSeed} from './generation-seed';
import {prepareImagePrompt} from './image-prompt';
import {optimizeStaticGlb} from './optimization/mesh';
const root=resolve(process.cwd()),queues=new JobQueues();
const store=new LocalObjectStore(process.env.OBJECT_STORE_DIR??join(root,'.data/objects'));
const python=process.env.GPU_PYTHON??join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const abort=new AbortController();
await queues.ready();
const worker=queues.worker('gpu',async(input,executionId)=>{
 if(!['image','shape','texture'].includes(input.stage))throw Error('STAGE_UNAVAILABLE');
 const key=createHash('sha256').update(executionId).digest('hex'),directory=join(root,'.cache/jobs',key);
 await mkdir(directory,{recursive:true});const receipt=join(directory,'result.json');
 try{const result=JSON.parse(await readFile(receipt,'utf8'));objectKeySchema.parse(result.key);await store.get(result.key);return result;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const run=(stage:string,args:string[])=>runWorkerProcess(python,['-m','workers.gpu.run_stage',stage,...args],{cwd:root,timeoutMs:600000,signal:abort.signal});
 const output=join(directory,input.stage==='image'?'image.png':'shape.glb');
 let imagePrompt:Awaited<ReturnType<typeof prepareImagePrompt>>|undefined;
 if(input.stage==='image'){
  if(typeof input.payload.prompt!=='string'||input.payload.prompt.length>2000)throw Error('INVALID_PROMPT');
  imagePrompt=await prepareImagePrompt(input.payload.prompt,{url:process.env.OLLAMA_URL,model:process.env.OLLAMA_MODEL,signal:abort.signal});
  await writeFile(join(directory,'prompt.json'),JSON.stringify(imagePrompt));
  await run('image',['--prompt',imagePrompt.prepared,'--output',output,'--seed',String(generationSeed(input.jobId,input.inputVersion))]);
 }else if(input.stage==='shape'){
  const imageKey=objectKeySchema.parse(input.payload.imageKey),source=join(directory,'source.png'),foreground=join(directory,'foreground.png');
  await writeFile(source,await store.get(imageKey));
  await run('background',['--input',source,'--output',foreground]);
  await run('shape',['--input',foreground,'--output',output]);
 }else{
  const shapeKey=objectKeySchema.parse(input.payload.shapeKey),textGeometry=input.payload.textureMode==='text-geometry';
  if(input.payload.textureMode!==undefined&&!['text-geometry','image-geometry'].includes(String(input.payload.textureMode)))throw Error('INVALID_TEXTURE_MODE');
  if(typeof input.payload.prompt!=='string'||input.payload.prompt.length>2000)throw Error('INVALID_PROMPT');
  const source=join(directory,'source.png'),foreground=join(directory,'foreground.png'),mesh=join(directory,'texture-input.glb');
  if(!textGeometry){const imageKey=objectKeySchema.parse(input.payload.imageKey);await writeFile(source,await store.get(imageKey));await run('background',['--input',source,'--output',foreground]);}
  await writeFile(mesh,(await optimizeStaticGlb(await store.get(shapeKey),'desktop')).bytes);
  const container='coedit-texture-'+key.slice(0,20),local=(path:string)=>relative(root,path).replaceAll('\\','/');
  try{
   await runWorkerProcess('docker',['run','--rm','--name',container,'--gpus','all','--network','none','--shm-size=2g','--mount',`type=bind,source=${root},target=/workspace`,'--mount','type=volume,source=coedit-texture-kernel-cache,target=/root/.cache/torch_extensions','coedit-texture:research','python','-X','faulthandler','-m','workers.gpu.run_texture','--mesh',local(mesh),...(textGeometry?['--steps','50']:['--image',local(foreground)]),'--output',local(output),'--prompt',input.payload.prompt],{cwd:root,timeoutMs:600000,signal:abort.signal});
  }finally{
   // Killing the Docker client alone does not terminate its GPU container.
   await runWorkerProcess('docker',['rm','-f',container],{cwd:root,timeoutMs:30000}).catch(()=>{});
  }
 }
 const result={key:await store.put(await readFile(output)),metadata:JSON.parse(await readFile(output+'.json','utf8'))};
 if(imagePrompt)result.metadata.imagePrompt=imagePrompt;
 await writeFile(receipt+'.tmp',JSON.stringify(result));await rename(receipt+'.tmp',receipt);return result;
});
console.log('GPU worker ready (one active GPU job, local model cache)');
let stopping=false;
const stop=async()=>{if(stopping)return;stopping=true;abort.abort();await worker.close();await queues.close();};
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
