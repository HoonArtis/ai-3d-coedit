import {useEffect,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {Client,type Room} from '@colyseus/sdk';
import {vrAvatarsSchema,type VrAvatar,type Vec3} from '@coedit/contracts';
import {apiEndpoint} from '../accounts/api';
import {CharacterAvatar} from './CharacterAvatar';
import {poseFromFrame} from './pose';
export function useViewingRoom(roomKey:string,snapshotId:string|null,token:string,enabled:boolean){
 const [room,setRoom]=useState<Room|null>(null),[avatars,setAvatars]=useState<VrAvatar[]>([]),[error,setError]=useState('');
 useEffect(()=>{
  if(!snapshotId||!enabled)return;let disposed=false,connection:Room|undefined;setError('');setRoom(null);setAvatars([]);
  const close=()=>{void connection?.leave();};window.addEventListener('pagehide',close);
  void new Client(apiEndpoint).joinOrCreate('viewing',{token,roomKey,snapshotId}).then(joined=>{
   connection=joined;if(disposed){void joined.leave();return;}
   joined.onMessage('poses',raw=>{const parsed=vrAvatarsSchema.safeParse(raw);if(parsed.success&&!disposed)setAvatars(parsed.data.avatars.filter(a=>a.connectionId!==joined.sessionId));});
   joined.onLeave(()=>{if(!disposed){setRoom(null);setAvatars([]);setError('감상 방 연결이 끊겼어요. 제출본을 다시 선택해 주세요.');}});
   setRoom(joined);
  }).catch(e=>{if(!disposed)setError(String(e).includes('ROOM_FULL')?'편집자와 감상자를 합쳐 5명까지 입장할 수 있어요.':'감상 방에 연결하지 못했어요. 다시 선택해 주세요.');});
  return()=>{disposed=true;window.removeEventListener('pagehide',close);close();setRoom(null);setAvatars([]);};
 },[roomKey,snapshotId,token,enabled]);
 return {room,avatars,error};
}
export function Presence({room,avatars,origin,active,token}:{room:Room|null;avatars:VrAvatar[];origin:Vec3;active:boolean;token:string}){
 const time=useRef(0),sequence=useRef(0);
 useEffect(()=>{if(!active)room?.send('pose-stop');},[room,active]);
 useFrame(({gl},delta,frame)=>{
  if(!room||!active||!frame)return;time.current+=delta;if(time.current<.1)return;time.current=0;
  const reference=gl.xr.getReferenceSpace();if(!reference)return;
  const pose=poseFromFrame(frame,reference,origin,++sequence.current);room.send(pose?'pose':'pose-stop',pose??undefined);
 });
 return <>{avatars.map(avatar=><group key={avatar.connectionId}>
  <CharacterAvatar key={avatar.avatarId??'default'} avatar={avatar} token={token}/>
  {(['left','right'] as const).map(hand=>avatar[hand]&&<mesh key={hand} position={avatar[hand].position} quaternion={avatar[hand].quaternion}><boxGeometry args={[.08,.04,.14]}/><meshStandardMaterial color="#e6ad76"/></mesh>)}
 </group>)}</>;
}
