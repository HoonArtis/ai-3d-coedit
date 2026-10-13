import React from 'react';import {WebGLRenderTarget} from 'three';import {createRoot} from 'react-dom/client';import {useFrame,useThree} from '@react-three/fiber';import {Viewport} from '../../apps/web/src/editor/Viewport';import '../../apps/web/src/editor/editor.css';import {emptyScene} from '@coedit/contracts';import {FrameMeasurement} from './measurement';
const w=window as any;w.failures=[];const snapshot=emptyScene('performance'),library:any={};
for(let i=0;i<200;i++){const id='perf-'+i;library[id]={id,name:id,kind:'generated',artifactId:id,color:'#ffffff',dimensions:[1,1,1]};snapshot.objects[id]={id,assetId:id,owner:'benchmark',name:id,position:[(i%20-9.5)*1.2,0,(Math.floor(i/20)-4.5)*1.2],rotation:[0,0,0],scale:[1,1,1],revision:1,lastActor:'benchmark'};}
const editor:any={snapshot,library,actor:'benchmark',selected:null,locks:{},previews:{},setNotice:(s:string)=>w.failures.push(s),select:async()=>{},cameraCenter:{current:[0,0,0]},chatTransport:{identity:{token:'synthetic-benchmark'}},restorationSeq:0};
const captureOnly=new URLSearchParams(location.search).has('capture');const measurement=new FrameMeasurement(captureOnly?1000:10000,captureOnly?1000:60000);
function Diagnostics(){const {camera,gl,scene}=useThree();React.useEffect(()=>{camera.position.set(22,22,27);camera.lookAt(0,0,0);},[]);useFrame(()=>{
 let count=0;scene.traverse((n:any)=>{if(n.isMesh&&n.geometry.attributes.position?.count>100)count++;});
 const ready=count===200;w.loaded=count;
 if(!w.result&&measurement.frame(performance.now(),ready,{...gl.info.render,...gl.info.memory})){
  const ctx=gl.getContext(),ext=ctx.getExtension('WEBGL_debug_renderer_info');w.result={...measurement.result(),renderer:ext?ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',heap:(performance as any).memory?.usedJSHeapSize,canvas:[gl.domElement.width,gl.domElement.height],objects:count,contextLost:ctx.isContextLost()};
  const width=1280,height=720,target=new WebGLRenderTarget(width,height),pixels=new Uint8Array(width*height*4);gl.setRenderTarget(target);gl.render(scene,camera);gl.getContext().finish();gl.readRenderTargetPixels(target,0,0,width,height,pixels);w.result.capture={error:ctx.getError(),lost:ctx.isContextLost(),nonzero:pixels.reduce((n,v)=>n+(v>0?1:0),0),coloredPixels:pixels.reduce((n,v,i)=>n+(i%4!==3&&v>8?1:0),0)};gl.setRenderTarget(null);target.dispose();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d')!,data=c.createImageData(width,height);for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);c.putImageData(data,0,0);w.capture=canvas.toDataURL('image/png');

 }
 },-100);return null;}
createRoot(document.getElementById('root')!).render(<div style={{width:'1280px',height:'720px',display:'flex'}}><Viewport editor={editor} mode="translate" cameraRequest={null} diagnostics={<Diagnostics/>}/></div>);
