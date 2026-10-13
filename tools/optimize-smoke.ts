import {readFile,writeFile} from 'node:fs/promises';
import {optimizeStaticGlb} from '../apps/workers/src/optimization/mesh';
const start=performance.now(),input=await readFile('.cache/smoke/whale-raw.glb');
const desktop=await optimizeStaticGlb(input,'desktop');await writeFile('.cache/smoke/whale-desktop.glb',desktop.bytes);
const vr=await optimizeStaticGlb(desktop.bytes,'vr');await writeFile('.cache/smoke/whale-vr.glb',vr.bytes);
const report={date:new Date().toISOString(),seconds:(performance.now()-start)/1000,raw:desktop.before,desktop:desktop.stats,vr:vr.stats};
await writeFile('docs/evidence/mesh-optimization.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
