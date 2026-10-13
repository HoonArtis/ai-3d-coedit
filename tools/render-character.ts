import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {chromium} from '@playwright/test';
const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#eef1f5;font:20px sans-serif}header{display:flex}header span{width:50%;padding:18px;text-align:center}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three.js","three/addons/":"/addons/"}}</script></head><body><header><span>Character bind pose</span><span>Idle animation +0.5 seconds</span></header><script type="module">
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,700);renderer.setPixelRatio(1);renderer.setClearColor(0xeef1f5);document.body.append(renderer.domElement);renderer.setScissorTest(true);
const ktx=new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer),loader=new GLTFLoader().setKTX2Loader(ktx);
const scenes=[];for(const name of ['original','delivery']){const gltf=await loader.loadAsync('/'+name+'.glb'),scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0x88909b,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(2,4,3);scene.add(light);scene.add(gltf.scene);if(name==='delivery'&&gltf.animations.length){const mixer=new T.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations[0]).play();mixer.update(.5);}const bounds=new T.Box3().setFromObject(gltf.scene),center=bounds.getCenter(new T.Vector3());gltf.scene.position.sub(center);scenes.push(scene);}
const camera=new T.PerspectiveCamera(35,1,.01,100);camera.position.set(2,1.3,2.4);camera.lookAt(0,0,0);
for(let i=0;i<2;i++){renderer.setViewport(i*700,0,700,700);renderer.setScissor(i*700,0,700,700);renderer.render(scenes[i],camera);}window.renderComplete=true;window.stats={triangles:renderer.info.render.triangles,textureFormats:renderer.extensions.has('WEBGL_compressed_texture_s3tc')};
</script></body></html>`;
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url??'/','http://localhost'),path=url.pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 let file:string;
 if(path==='/three.js')file=resolve('node_modules/three/build/three.module.js');
 else if(path==='/three.core.js')file=resolve('node_modules/three/build/three.core.js');
 else if(path==='/original.glb')file=resolve('.cache/character-results/glb-desktop.glb');
 else if(path==='/delivery.glb')file=resolve(process.env.RETEXTURE_GLB??'.cache/character-results/glb-desktop.glb');
 else {const prefix=path.startsWith('/addons/')?'/addons/':path.startsWith('/basis/')?'/basis/':null;if(!prefix)throw Error('NOT_FOUND');const root=resolve('node_modules/three/examples/jsm',prefix==='/basis/'?'libs/basis':'');file=resolve(root,path.slice(prefix.length));if(!file.startsWith(root+sep))throw Error('NOT_FOUND');}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.end(await readFile(file));
 }catch{res.statusCode=404;res.end();}});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:1400,height:760}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+(server.address() as {port:number}).port);await page.waitForFunction(()=>Boolean((window as any).renderComplete),{},{timeout:60000});if(errors.length)throw Error(errors.join('\n'));await mkdir('docs/evidence',{recursive:true});await page.screenshot({path:process.env.RETEXTURE_SCREENSHOT??'docs/evidence/character-animation.png'});console.log(await page.evaluate(()=>(window as any).stats));}finally{await browser.close();server.close();}
