import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {instantiateModel} from './model-instance';
import {useFrame,useThree} from '@react-three/fiber';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {Texture,type Group,type Object3D,type Mesh,type Material} from 'three';
import {apiEndpoint} from '../accounts/api';
type Entry={promise:Promise<GLTF>;refs:number;timer?:ReturnType<typeof setTimeout>};
function dispose(scene:Group){const resources=new Set<{dispose():void}>();scene.traverse(node=>{const mesh=node as Mesh;if(mesh.geometry)resources.add(mesh.geometry);const materials:Material[]=Array.isArray(mesh.material)?mesh.material:mesh.material?[mesh.material]:[];for(const m of materials){resources.add(m);for(const value of Object.values(m))if(value instanceof Texture)resources.add(value);}});resources.forEach(r=>r.dispose());}
type Cache={acquire(path:string,token:string):{promise:Promise<GLTF>;release():void};close():void};
const Context=createContext<Cache|null>(null);
export function GeneratedModelProvider({children}:{children:ReactNode}){
 const {gl}=useThree();
 const cache=useMemo<Cache>(()=>{
  const ktx=new KTX2Loader().setTranscoderPath('/basis/').setWorkerLimit(2).detectSupport(gl),loader=new GLTFLoader().setKTX2Loader(ktx),entries=new Map<string,Entry>();
  const remove=(key:string,entry:Entry)=>{if(entries.get(key)!==entry)return;entries.delete(key);void entry.promise.then(gltf=>dispose(gltf.scene)).catch(()=>{});};
  return {acquire(path,token){const key=JSON.stringify([path,token]);let entry=entries.get(key);
   if(!entry){entry={refs:0,promise:fetch(apiEndpoint+path,{headers:{Authorization:'Bearer '+token}}).then(async response=>{if(!response.ok)throw Error('ASSET_UNAVAILABLE');return loader.parseAsync(await response.arrayBuffer(),'');})};entries.set(key,entry);}
   entry.refs++;clearTimeout(entry.timer);const held=entry;return {promise:held.promise,release(){if(--held.refs===0)held.timer=setTimeout(()=>remove(key,held),1000);}};
  },close(){for(const [key,entry] of entries){clearTimeout(entry.timer);remove(key,entry);}ktx.dispose();}};
 },[gl]);
 useEffect(()=>()=>cache.close(),[cache]);return <Context.Provider value={cache}>{children}</Context.Provider>;
}
export function GeneratedModel({artifactId,token,preview=false,onError}:{artifactId:string;token:string;preview?:boolean;onError?:(message:string)=>void}){
 return <ProtectedModel path={'/api/assets/'+artifactId+'/'+(preview?'preview':'glb')} token={token} onError={onError}/>;
}
export function ProtectedModel({path,token,onError,onLoaded,onFrame}:{path:string;token:string;onError?:(message:string)=>void;onLoaded?:()=>void;onFrame?:(scene:Object3D)=>void}){
 const cache=useContext(Context),[model,setModel]=useState<ReturnType<typeof instantiateModel>|null>(null);
 useEffect(()=>{if(!cache)return;let disposed=false;let instance:ReturnType<typeof instantiateModel>|undefined;setModel(null);const resource=cache.acquire(path,token);
  void resource.promise.then(gltf=>{if(!disposed){instance=instantiateModel(gltf.scene,gltf.animations);setModel(instance);onLoaded?.();}}).catch(()=>{if(!disposed)onError?.('에셋 파일을 읽지 못했어요. 접근 권한과 연결을 확인해 주세요.');});
  return()=>{disposed=true;instance?.dispose();resource.release();};
 },[cache,path,token]);
 useFrame((_state,delta)=>{model?.mixer?.update(Math.min(delta,.1));if(model)onFrame?.(model.scene);});
 return model?<primitive object={model.scene} dispose={null}/>:<mesh position={[0,.5,0]}><boxGeometry/><meshBasicMaterial color="#7b9194" wireframe/></mesh>;
}
