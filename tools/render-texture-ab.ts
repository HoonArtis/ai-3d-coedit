// Renders each texture A/B variant from four sides into one grid image.
// Usage: npx tsx tools/render-texture-ab.ts <dir> <variant...>  → <dir>/comparison.png
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,join} from 'node:path';
import {chromium} from '@playwright/test';
const dir=resolve(process.argv[2]??'.cache/texture-ab/cat'),variants=process.argv.slice(3),cell=320,angles=[0,90,180,270];
const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff;font:16px sans-serif}div{height:28px;padding:4px 8px}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three.js","three/addons/":"/addons/"}}</script></head><body><script type="module">
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const names=${JSON.stringify(variants)},cell=${cell},angles=${JSON.stringify(angles)};
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(cell*angles.length,cell*names.length);renderer.setPixelRatio(1);renderer.setClearColor(0xf2f2f2);renderer.setScissorTest(true);document.body.append(renderer.domElement);
const loader=new GLTFLoader();
for(const [row,name] of names.entries()){
 const gltf=await loader.loadAsync('/v/'+name+'.glb'),scene=new T.Scene();scene.add(new T.AmbientLight(0xffffff,2.2));const light=new T.DirectionalLight(0xffffff,1.2);light.position.set(1,2,2);scene.add(light);scene.add(gltf.scene);
 // TRELLIS GLBs omit metallicFactor, which glTF reads as fully metallic and renders black without an environment map.
 gltf.scene.traverse(o=>{if(o.material&&!o.material.metalnessMap)o.material.metalness=0;});
 const box=new T.Box3().setFromObject(gltf.scene),center=box.getCenter(new T.Vector3()),radius=box.getSize(new T.Vector3()).length()/2;
 for(const [col,deg] of angles.entries()){const a=deg*Math.PI/180,camera=new T.PerspectiveCamera(30,1,.01,100);camera.position.set(center.x+Math.sin(a)*radius*3.4,center.y+radius*.6,center.z+Math.cos(a)*radius*3.4);camera.lookAt(center);
  const y=(names.length-1-row)*cell;renderer.setViewport(col*cell,y,cell,cell);renderer.setScissor(col*cell,y,cell,cell);renderer.render(scene,camera);}
}
const label=document.createElement('div');label.textContent='rows: '+names.join(' / ')+'  ·  cols: 0° 90° 180° 270°';document.body.prepend(label);window.renderComplete=true;
</script></body></html>`;
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url??'/','http://localhost').pathname;let file:string;
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 if(path==='/three.js')file=resolve('node_modules/three/build/three.module.js');
 else if(path==='/three.core.js')file=resolve('node_modules/three/build/three.core.js');
 else if(path.startsWith('/v/')){const name=path.slice(3,-4);if(!variants.includes(name))throw Error('NOT_FOUND');file=join(dir,name,'textured.glb');}
 else if(path.startsWith('/addons/')){const root=resolve('node_modules/three/examples/jsm');file=resolve(root,path.slice(8));if(!file.startsWith(root+sep))throw Error('NOT_FOUND');}
 else throw Error('NOT_FOUND');
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(await readFile(file));
}catch{res.statusCode=404;res.end();}});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:cell*angles.length,height:cell*variants.length+40}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+(server.address() as {port:number}).port);await page.waitForFunction(()=>Boolean((window as any).renderComplete),{},{timeout:120000});
 if(errors.length)throw Error(errors.join('\n'));await page.screenshot({path:join(dir,'comparison.png'),fullPage:true});console.log('wrote',join(dir,'comparison.png'));
}finally{await browser.close();server.close();}
