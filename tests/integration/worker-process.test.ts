import {it,expect} from 'vitest';
import {runWorkerProcess} from '../../packages/jobs/src/index';
it('waits for process exit, rejects partial output on failure, and kills timed-out workers',async()=>{
 expect(await runWorkerProcess(process.execPath,['-e','process.stdout.write("artifact")'],{timeoutMs:2000})).toBe('artifact');
 await expect(runWorkerProcess(process.execPath,['-e','process.stdout.write("partial");process.exit(3)'],{timeoutMs:2000})).rejects.toThrow('WORKER_EXIT_3');
 const started=Date.now();await expect(runWorkerProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:100})).rejects.toThrow('WORKER_TIMEOUT');expect(Date.now()-started).toBeLessThan(3000);
 const abort=new AbortController();const running=runWorkerProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:5000,signal:abort.signal});abort.abort();await expect(running).rejects.toThrow('WORKER_CANCELLED');
});
