import {useEffect,useRef,useState} from 'react';
import {BUILTIN_LIBRARY,emptyScene,type SceneSnapshot,type Op,type Lease,type PreviewEvent,type Vec3} from '@coedit/contracts';
import {retainLeasedPreviews,SelectionQueue,TransformEditQueue} from './interaction-state';
import {connectRoom,type RoomTransport} from './room-transport';
export function useEditor(){
  const [snapshot,setSnapshot]=useState<SceneSnapshot>(emptyScene());
  const [library,setLibrary]=useState(BUILTIN_LIBRARY);
  const snapshotRef=useRef(snapshot);
  const cameraCenter=useRef<Vec3>([0,0,0]);
  const edits=useRef<TransformEditQueue|null>(null);
  const [locks,setLocks]=useState<Record<string,Lease>>({});
  const [selected,setSelected]=useState<string|null>(null);
  const [status,setStatus]=useState('연결 중…'),[notice,setNotice]=useState('');
  const [actor,setActor]=useState('');
  const [restorationSeq,setRestorationSeq]=useState(0);
  const [storage,setStorage]=useState<'postgres'|'memory'>('memory');
  const [role,setRole]=useState<'student'|'teacher'>('student');
  const [previews,setPreviews]=useState<Record<string,PreviewEvent>>({});
  const transport=useRef<RoomTransport|null>(null);
  const selectedRef=useRef(selected);
  const selection=useRef<SelectionQueue|null>(null);
  useEffect(()=>{
    let cancelled=false;let connection:RoomTransport|undefined;
    void connectRoom().then(t=>{
      connection=t;if(cancelled){t.close();return;}
      transport.current=t;setActor(t.identity.actor);setRole(t.identity.role);setStorage(t.identity.storage??'memory');setStatus('서버 연결됨');
      t.onDisconnect=()=>{if(!cancelled){setStatus('연결 끊김');selection.current?.invalidate();setPreviews({});setLocks({});}};
      t.subscribe(event=>{
        if(cancelled)return;
        if(event.type==='library')setLibrary(event.library);
        if(event.type==='restored'){
          setRestorationSeq(event.seq);setPreviews({});
          setNotice('선생님이 '+event.count+'개 에셋을 복원했어요. 관련 되돌리기 기록이 초기화됐어요.');
        }
        if(event.type==='snapshot'&&event.snapshot.seq>=snapshotRef.current.seq){
          if(event.snapshot.seq>=snapshotRef.current.seq){snapshotRef.current=event.snapshot;setSnapshot(event.snapshot);}
          setPreviews({});
          if(selectedRef.current&&!event.snapshot.objects[selectedRef.current])selection.current?.invalidate();
        }
        if(event.type==='locks'){
          setLocks(event.locks);
          setPreviews(current=>retainLeasedPreviews(current,event.locks));
          const id=selectedRef.current;
          if(id&&event.locks[id]?.owner!==t.identity.actor){selection.current?.invalidate();setNotice('선택 잠금이 해제되었어요.');}
        }
      });
      t.subscribePreview(event=>{if(t.locks[event.id]?.token===event.token)setPreviews(current=>({...current,[event.id]:event}));});
    }).catch(error=>{if(!cancelled){setStatus('연결 실패');setNotice(error instanceof Error?error.message:'서버를 확인해 주세요.');}});
    return()=>{cancelled=true;connection?.close();transport.current=null;};
  },[]);
  const send=async(ops:Op[])=>{
    const t=transport.current;if(!t){setNotice('서버에 연결한 뒤 다시 시도해 주세요.');return null;}
    const result=await t.submit({version:1,actor:t.identity.actor,source:t.identity.role==='teacher'?'teacher':'gizmo',requestId:crypto.randomUUID(),ops,lockTokens:Object.fromEntries(Object.entries(t.locks).filter(([,l])=>l.owner===t.identity.actor).map(([id,l])=>[id,l.token]))});
    if(!result.ok)setNotice(result.message);else setNotice('');
    return result;
  };
  if(!selection.current)selection.current=new SelectionQueue(
    async id=>Boolean((await send([{op:'lock',ids:[id]}]))?.ok),
    async id=>{await send([{op:'unlock',ids:[id]}]);},
    id=>{selectedRef.current=id;setSelected(id);},
  );
  if(!edits.current)edits.current=new TransformEditQueue(id=>snapshotRef.current.objects[id],send);
  const editTransform=(id:string,field:'position'|'rotation'|'scale',axis:number,value:number)=>edits.current!.edit(id,field,axis,value);
  const select=(id:string|null)=>selection.current!.select(id);
  const place=async(assetId:string,position:Vec3=[0,0,0])=>{
    if(!library[assetId])return;
    const id=crypto.randomUUID();
    const result=await send([{op:'place',id,assetId,position,rotation:[0,0,0],scale:[1,1,1]}]);
    if(result?.ok)await select(id);
  };
  const duplicate=async()=>{
    if(!selected)return;
    const newId=crypto.randomUUID();const result=await send([{op:'duplicate',id:selected,newId}]);
    if(result?.ok)await select(newId);
  };
  const preview=(event:PreviewEvent)=>transport.current?.preview(event);
  return {snapshot,library,locks,selected,status,notice,actor,role,storage,previews,send,editTransform,select,place,duplicate,preview,setNotice,chatTransport:transport.current,cameraCenter,restorationSeq};
}
