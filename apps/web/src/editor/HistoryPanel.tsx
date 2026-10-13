import {useEffect,useRef,useState} from 'react';
import {roomHistorySchema,type RoomHistoryPage} from '@coedit/contracts';
import {accountApi} from '../accounts/api';
import type {useEditor} from './use-editor';
export function HistoryPanel({editor}:{editor:ReturnType<typeof useEditor>}){
  const [open,setOpen]=useState(false),[objectMode,setObjectMode]=useState(false),[page,setPage]=useState<RoomHistoryPage>({entries:[],nextCursor:null}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const request=useRef(0),objectId=objectMode?editor.selected:null;
  const load=async(before?:number)=>{
    const serial=++request.current;setBusy(true);setError('');
    try{
      const query=new URLSearchParams({...objectId?{objectId}:{},...before?{before:String(before)}:{}});
      const result=roomHistorySchema.parse(await accountApi('/rooms/'+editor.snapshot.roomId+'/history?'+query));
      if(serial===request.current)setPage(previous=>({entries:before?[...previous.entries,...result.entries]:result.entries,nextCursor:result.nextCursor}));
    }catch(e){if(serial===request.current)setError(e instanceof Error?e.message:'이력을 읽지 못했어요.');}
    finally{if(serial===request.current)setBusy(false);}
  };
  useEffect(()=>{
    setPage({entries:[],nextCursor:null});
    if(open&&(!objectMode||objectId))void load();
    return()=>{request.current++;};
  },[open,objectMode,objectId,editor.snapshot.roomId,editor.snapshot.seq]);
  return <section className="history-panel"><button aria-expanded={open} onClick={()=>setOpen(!open)}>이력 · 복원</button>{open&&<>
    <div className="history-mode"><button aria-pressed={!objectMode} onClick={()=>setObjectMode(false)}>방 이력</button><button aria-pressed={objectMode} onClick={()=>setObjectMode(true)}>선택 에셋 이력</button></div>
    <p className="generation-policy">복원은 새 변경으로 저장돼요. 관련 되돌리기 기록은 초기화되고 원래 소유자는 유지돼요.</p>
    {objectMode&&!objectId?<p>에셋을 선택해 주세요.</p>:<div className="history-list">{page.entries.map(entry=><article key={entry.seq}>
      <strong>seq {entry.seq} · {entry.changedIds.length}개 변경</strong><small>{entry.actor} · {entry.source}</small>
      {objectMode&&<p>{entry.before?.name??'없음'} → {entry.after?.name??'삭제됨'}<br/>위치 {entry.before?.position.join(', ')??'없음'} → {entry.after?.position.join(', ')??'없음'}</p>}
      <button disabled={busy} aria-label={(objectMode?'에셋을':'방을')+' seq '+entry.seq+'로 복원'} onClick={()=>{
        setBusy(true);void editor.send(objectMode&&objectId?[{op:'restore_object',id:objectId,revision:entry.seq}]:[{op:'restore_snapshot',snapshotId:entry.snapshotId}]).finally(()=>setBusy(false));
      }}>{objectMode?'이 에셋 복원':'이 시점의 방 복원'}</button>
    </article>)}</div>}
    {error&&<p role="alert">{error}</p>}{busy&&<p role="status">처리 중…</p>}
    {page.nextCursor&&<button disabled={busy} onClick={()=>void load(page.nextCursor!)}>이전 이력 더 보기</button>}
  </>}</section>;
}
