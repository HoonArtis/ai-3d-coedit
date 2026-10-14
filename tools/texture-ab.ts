// Texture A/B: one shape + reference image, textured under each input variant, so a single cause can be isolated.
// Usage: npx tsx tools/texture-ab.ts <dir with shape.glb, foreground.png, foreground-rgba.png> [variant...]
import {readFile,writeFile,access} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {optimizeStaticGlb} from '../apps/workers/src/optimization/mesh';

type Variant={reference:'foreground.png'|'foreground-rgba.png';resolution:number;steps:number;prompt?:string};
// v0 reproduces the production settings before this change; each later variant adds one fix.
const VARIANTS:Record<string,Variant>={
 v0_baseline:{reference:'foreground.png',resolution:512,steps:30},
 v1_rgba:{reference:'foreground-rgba.png',resolution:512,steps:30},
 v2_rgba_768_50:{reference:'foreground-rgba.png',resolution:768,steps:50},
 // Same as v1 with a subject description; set TEXTURE_PROMPT to describe the unseen sides.
 v3_rgba_prompt:{reference:'foreground-rgba.png',resolution:512,steps:30,prompt:process.env.TEXTURE_PROMPT},
};
const root=resolve('.'),dir=resolve(process.argv[2]??'.cache/texture-ab'),chosen=process.argv.slice(3);
const docker=process.env.DOCKER??'docker',local=(path:string)=>relative(root,path).replaceAll('\\','/');
// Same production preprocessing as gpu-worker: desktop-budget decimation before texturing.
const mesh=join(dir,'texture-input.glb');await writeFile(mesh,(await optimizeStaticGlb(await readFile(join(dir,'shape.glb')),'desktop')).bytes);
for(const [name,variant] of Object.entries(VARIANTS)){
 if(chosen.length&&!chosen.includes(name))continue;
 const output=join(dir,name,'textured.glb');
 if(await access(output).then(()=>true,()=>false)){console.log('skip',name);continue;}
 const started=Date.now();
 const result=spawnSync(docker,['run','--rm','--gpus','all','--network','none','--shm-size=2g',...(process.env.TEXTURE_SEQUENTIAL_OFFLOAD?['-e','TEXTURE_SEQUENTIAL_OFFLOAD=1']:[]),'--mount',`type=bind,source=${root},target=/workspace`,'--mount','type=volume,source=coedit-texture-kernel-cache,target=/root/.cache/torch_extensions','coedit-texture:research','python','-X','faulthandler','-m','workers.gpu.run_texture','--mesh',local(mesh),'--image',local(join(dir,variant.reference)),'--output',local(output),'--prompt',variant.prompt??'high quality','--steps',String(variant.steps),'--resolution',String(variant.resolution)],{stdio:'inherit'});
 console.log(name,result.status===0?'ok':'FAILED '+result.status,Math.round((Date.now()-started)/1000)+'s');
}
