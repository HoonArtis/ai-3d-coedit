import {useEffect,useRef,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {XR,XROrigin,TeleportTarget,createXRStore} from '@react-three/xr';
import {vrBakeRecordSchema,vrEnvironmentSchema,type VrBakeRecord,type VrEnvironment,type Vec3} from '@coedit/contracts';
import {accountApi} from '../accounts/api';
import {GeneratedModelProvider,ProtectedModel} from '../editor/GeneratedModel';
import {canTeleport} from '@coedit/placement';
import {Presence,useViewingRoom} from './Presence';
import './vr.css';
import {AvatarPicker} from './AvatarPicker';
export default function VrLobby({roomId,viewOnly=false}:{roomId:string;viewOnly?:boolean}){
 const [records,setRecords]=useState<VrBakeRecord[]>([]),[selected,setSelected]=useState<string|null>(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[support,setSupport]=useState('VR 지원 확인 중…'),[active,setActive]=useState(false);
 const [environment,setEnvironment]=useState<VrEnvironment|null>(null),[position,setPosition]=useState<Vec3>([0,0,0]);
 const selectionVersion=useRef(0);
 const submitting=useRef(false),requestId=useRef<string|null>(null),token=localStorage.getItem('coedit-account-token')??'';
 const [store]=useState(()=>createXRStore({offerSession:false,enterGrantedSession:false,emulate:false,anchors:false,bodyTracking:false,meshDetection:false,planeDetection:false,hitTest:false,layers:false,handTracking:true,controller:{teleportPointer:true},hand:{teleportPointer:true}}));
 const presence=useViewingRoom(roomId,selected,token,support===''&&ready&&Boolean(environment?.spawn));
 useEffect(()=>{if(active&&!presence.room)void store.getState().session?.end();},[active,presence.room,store]);
 const path='/rooms/'+encodeURIComponent(roomId)+'/vr';
 useEffect(()=>{
  let disposed=false;
  const refresh=async()=>{try{const rows=vrBakeRecordSchema.array().parse(await accountApi(path));if(!disposed)setRecords(rows);}catch(e){if(!disposed)setError(e instanceof Error?e.message:'목록을 읽지 못했어요.');}};
  void refresh();const timer=setInterval(()=>void refresh(),1500);
  if(!window.isSecureContext)setSupport('HTTPS 주소로 접속해야 VR에 입장할 수 있어요.');
  else if(!navigator.xr)setSupport('이 브라우저는 VR 세션을 지원하지 않아요.');
  else void navigator.xr.isSessionSupported('immersive-vr').then(supported=>{if(!disposed)setSupport(supported?'':'이 브라우저는 VR 세션을 지원하지 않아요.');}).catch(()=>{if(!disposed)setSupport('VR 지원을 확인하지 못했어요.');});
  const unsubscribe=store.subscribe(state=>setActive(Boolean(state.session)));
  return()=>{disposed=true;clearInterval(timer);unsubscribe();void store.getState().session?.end();store.destroy();};
 },[path,store]);
 const select=async(id:string)=>{const version=++selectionVersion.current;setSelected(null);setReady(false);setEnvironment(null);setError('');try{const data=vrEnvironmentSchema.parse(await accountApi(path+'/'+id));if(version!==selectionVersion.current)return;setEnvironment(data);setSelected(id);if(data.spawn)setPosition(data.spawn);else setError('안전하게 설 수 있는 빈 바닥이 없어요. 편집에서 공간을 확보해 주세요.');}catch{if(version===selectionVersion.current)setError('제출본 이동 정보를 읽지 못했어요.');}};
 const submit=async()=>{
  if(submitting.current)return;submitting.current=true;setBusy(true);setError('');requestId.current??=crypto.randomUUID();
  try{await accountApi(path,{requestId:requestId.current});requestId.current=null;setRecords(vrBakeRecordSchema.array().parse(await accountApi(path)));}catch(e){setError(e instanceof Error?e.message:'제출에 실패했어요.');}finally{submitting.current=false;setBusy(false);}
 };
 const enter=()=>{setError('');void store.enterVR().catch(()=>setError('VR 입장이 취소되었거나 기기를 사용할 수 없어요. 다시 시도해 주세요.'));};
 return <main className="vr-page"><header><a href={viewOnly?'/?login=1':'/'}>{viewOnly?'다른 자리 선택':'편집으로 돌아가기'}</a><h1>우리 공간 VR 감상</h1><p>{viewOnly?'자유 VR 감상 · 선택한 자리의 캐릭터로 입장해요.':'제출한 작품을 읽기 전용으로 감상해요.'}</p></header>
  {!viewOnly&&<AvatarPicker roomId={roomId} token={token} disabled={active} onApplied={()=>presence.room?.send('avatar-refresh')}/>}
  <section className="vr-submissions" aria-label="제출 작품">{!viewOnly&&<button disabled={busy||active} onClick={()=>void submit()}>{busy?'제출 중…':'현재 작품 제출'}</button>}
   {!records.length&&<p>{viewOnly?'PC 편집 화면에서 VR 감상 → 현재 작품 제출을 먼저 눌러 주세요.':'제출된 작품이 없어요.'}</p>}{records.map(record=><div key={record.snapshotId}><span>제출본 seq {record.seq} · {record.state==='ready'?'준비 완료':record.state==='queued'?'VR 변환 중':'변환 실패'}</span>{record.state==='ready'&&<button disabled={active} onClick={()=>void select(record.snapshotId)}>제출본 seq {record.seq} 미리보기</button>}{record.state==='failed'&&<p>변환하지 못했어요. 지원되지 않는 모델이나 재질을 확인한 뒤 다시 제출해 주세요.</p>}</div>)}
  </section><section className="vr-view"><div className="vr-actions"><button disabled={!ready||!environment?.spawn||!presence.room||Boolean(support)||active} onClick={enter}>VR 입장</button>{active&&<button onClick={()=>void store.getState().session?.end()}>VR 나가기</button>}<span role="status">{support}</span><span aria-label="함께 감상하는 사람">{presence.avatars.length}명</span></div>
  {selected&&<><p role="status">{ready?'읽기 전용 장면 준비 완료':'장면을 읽는 중…'}</p><div className="vr-canvas"><Canvas camera={{position:[6,5,8],fov:55}}><XR store={store}><XROrigin position={position}/><hemisphereLight args={['#ffffff','#8e9e91',2]}/><directionalLight position={[4,8,6]} intensity={2}/><GeneratedModelProvider><Presence room={presence.room} avatars={presence.avatars} origin={position} active={active} token={token}/><ProtectedModel key={selected} path={'/api'+path+'/'+selected+'/glb'} token={token} onError={message=>{setError(message);setReady(false);}} onLoaded={()=>setReady(true)}/></GeneratedModelProvider><TeleportTarget onTeleport={(origin,event)=>{const target:Vec3=[event.point.x,0,event.point.z],from:Vec3=[position[0]+event.point.x-origin.x,0,position[2]+event.point.z-origin.z];if(active&&environment&&canTeleport(from,target,environment.obstacles))setPosition([origin.x,0,origin.z]);}}><mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]}><planeGeometry args={[100,100]}/><meshStandardMaterial color="#d7e1d4"/></mesh></TeleportTarget>{!active&&<OrbitControls target={[0,1,0]}/>}</XR></Canvas></div></>}
  </section>{error&&<p role="alert">{error}</p>}{presence.error&&<p role="alert">{presence.error}</p>}</main>;
}
