import {spawn} from 'node:child_process';
/** Arguments come from a trusted stage adapter, never a client-provided command. */
export function runWorkerProcess(executable:string,args:string[],options:{timeoutMs:number;signal?:AbortSignal;cwd?:string}):Promise<string>{
 if(!Number.isFinite(options.timeoutMs)||options.timeoutMs<=0)return Promise.reject(Error('INVALID_WORKER_TIMEOUT'));
 if(options.signal?.aborted)return Promise.reject(Error('WORKER_CANCELLED'));
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{cwd:options.cwd,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',failure:string|undefined;
  const stop=(reason:string)=>{failure??=reason;child.kill('SIGKILL');};
  const timer=setTimeout(()=>stop('WORKER_TIMEOUT'),options.timeoutMs);
  const cancel=()=>stop('WORKER_CANCELLED');options.signal?.addEventListener('abort',cancel,{once:true});
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',(data:string)=>{stdout+=data;if(stdout.length>65536)stop('WORKER_OUTPUT_LIMIT');});
  child.stderr.on('data',(data:string)=>{stderr=(stderr+data).slice(-8192);});
  child.once('error',error=>{failure='WORKER_START_FAILED: '+error.message;});
  child.once('close',code=>{
   clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);
   if(failure)reject(Error(failure));else if(code!==0)reject(Error('WORKER_EXIT_'+code+': '+stderr));else resolve(stdout);
  });
 });
}
