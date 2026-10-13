import {readFile,writeFile} from 'node:fs/promises';
import {LocalObjectStore} from '@coedit/artifacts';
import {publishArtifact} from '../apps/workers/src/optimization/publish';
import {inspectGlb} from '../apps/workers/src/optimization/mesh';
const store=new LocalObjectStore('.data/objects'),raw=await readFile('.cache/smoke/whale-textured.glb'),start=performance.now();
const result=await publishArtifact(store,{jobId:'smoke-textured-whale',version:1,generation:0,raw,provenance:{texture:'mv-adapter',researchOnly:true,sources:[{name:'MV-Adapter',revision:'4277e0018232bac82bb2c103caf0893cedb711be',license:'Apache-2.0'},{name:'nvdiffrast',revision:'253ac4fcea7de5f396371124af597e6cc957bfae',license:'NVIDIA research only'},{name:'RMBG-1.4',revision:'2ceba5a5efaec153162aedea169f76caf9b46cf8',license:'BRIA noncommercial'}]}});
const desktop=await store.get(result.manifest.desktop.key);await writeFile('.cache/smoke/whale-delivery.glb',desktop);
const report={date:new Date().toISOString(),seconds:(performance.now()-start)/1000,rawBytes:raw.length,desktopBytes:desktop.length,original:await inspectGlb(raw),...result};
await writeFile('docs/evidence/textured-artifact.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
