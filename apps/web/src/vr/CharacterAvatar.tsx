import {useMemo,useRef,useState} from 'react';
import {Bone,Euler,Quaternion,type Object3D} from 'three';
import {DEFAULT_BLOCK_AVATAR,type VrAvatar} from '@coedit/contracts';
import {BlockCharacter} from './BlockCharacter';
import {ProtectedModel} from '../editor/GeneratedModel';
export function DefaultHead({avatar}:{avatar:VrAvatar}){return <group position={avatar.head.position} quaternion={avatar.head.quaternion}><mesh><sphereGeometry args={[.13,12,8]}/><meshStandardMaterial color="#528bb0"/></mesh><mesh position={[0,0,-.12]}><boxGeometry args={[.16,.06,.04]}/><meshStandardMaterial color="#183644"/></mesh></group>;}
export function CharacterAvatar({avatar,token}:{avatar:VrAvatar;token:string}){
 const [failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false),bones=useRef<{scene:Object3D;head:Bone|null;rest:Quaternion}|null>(null);
 const orientation=useMemo(()=>{const head=new Quaternion().fromArray(avatar.head.quaternion),angles=new Euler().setFromQuaternion(head,'YXZ'),body=new Quaternion().setFromEuler(new Euler(0,angles.y,0,'YXZ'));return {body,relative:body.clone().invert().multiply(head)};},[avatar.head.quaternion]);
 if(avatar.blockAvatar||!avatar.avatarId||failed)return <group position={[avatar.head.position[0],avatar.head.position[1]-1.6,avatar.head.position[2]]} quaternion={orientation.body}><BlockCharacter profile={avatar.blockAvatar??DEFAULT_BLOCK_AVATAR} headRotation={orientation.relative.toArray() as [number,number,number,number]}/></group>;
 return <>{!loaded&&<DefaultHead avatar={avatar}/>}<group visible={loaded} position={[avatar.head.position[0],Math.max(0,avatar.head.position[1]-1.6),avatar.head.position[2]]} quaternion={orientation.body}>
  <ProtectedModel path={'/api/assets/'+avatar.avatarId+'/avatar'} token={token} onLoaded={()=>setLoaded(true)} onError={()=>setFailed(true)} onFrame={scene=>{
   if(bones.current?.scene!==scene){let head:Bone|null=null;scene.traverse(o=>{if(o instanceof Bone&&/(^|[:_])head$|^head$/i.test(o.name))head=o;});bones.current={scene,head,rest:(head as Bone|null)?.quaternion.clone()??new Quaternion()};}
   const current=bones.current;if(current.head)current.head.quaternion.copy(current.rest).multiply(orientation.relative);else setFailed(true);
  }}/>
 </group></>;
}
