import {useEffect,useRef,useState} from 'react';
import {assetHistorySchema,type AssetHistoryRecord,type AssetDefinition} from '@coedit/contracts';
import {accountApi} from '../accounts/api';
import {AssetPreview} from './AssetPreview';

export function AssetHistory({roomId,actor,role,token,library,place,onClose}:{token:string;roomId?:string;actor?:string;role?:'student'|'teacher';library:Record<string,AssetDefinition>;place:(id:string)=>Promise<void>;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),lifetime=useRef<AbortController|null>(null),busyRef=useRef(false),mutation=useRef(0);
 const [rows,setRows]=useState<AssetHistoryRecord[]>([]),[tab,setTab]=useState<'own'|'shared'>('own'),[selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
 useEffect(()=>{
  const controller=new AbortController();lifetime.current=controller;let timer:ReturnType<typeof setTimeout>;
  setRows([]);setSelected(null);setError('');setLoading(true);
  const refresh=async()=>{
   const version=mutation.current;
   try{if(roomId){const result=assetHistorySchema.parse(await accountApi('/rooms/'+encodeURIComponent(roomId)+'/asset-history',undefined,controller.signal,token));if(!controller.signal.aborted&&version===mutation.current&&!busyRef.current){setRows(result);setError('');}}}
   catch{if(!controller.signal.aborted)setError('만든 에셋 목록을 불러오지 못했어요. 연결을 확인해 주세요. 잠시 후 다시 불러옵니다.');}
   finally{if(!controller.signal.aborted){setLoading(false);if(roomId)timer=setTimeout(()=>void refresh(),3000);}}
  };void refresh();return()=>{controller.abort();clearTimeout(timer);};
 },[roomId,token]);
 const visible=rows.filter(row=>tab==='own'?(role==='teacher'||row.actor===actor):row.shared),active=visible.find(row=>row.asset.id===selected);
 const share=async(row:AssetHistoryRecord)=>{
  const controller=lifetime.current;if(!roomId||!controller||busyRef.current)return;busyRef.current=true;mutation.current++;setBusy(true);setNotice('');
  try{await accountApi('/rooms/'+encodeURIComponent(roomId)+'/assets/'+row.asset.artifactId+'/share',{},controller.signal,token);if(!controller.signal.aborted){setRows(current=>current.map(item=>item.asset.id===row.asset.id?{...item,shared:true}:item));setNotice('수업에 공유했어요. 다른 조도 History의 수업 공유에서 배치할 수 있어요.');}}
  catch{if(!controller.signal.aborted)setNotice('공유하지 못했어요. 연결과 공유 권한을 확인한 뒤 다시 시도해 주세요.');}
  finally{mutation.current++;busyRef.current=false;if(!controller.signal.aborted)setBusy(false);}
 };
 const placeAsset=async(row:AssetHistoryRecord)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);try{await place(row.asset.id);onClose();}catch{setNotice('배치하지 못했어요. 편집기 연결을 확인해 주세요.');}finally{busyRef.current=false;if(!lifetime.current?.signal.aborted)setBusy(false);}};
 return <dialog ref={dialog} className="asset-history-dialog" aria-labelledby="asset-history-title" onCancel={event=>{event.preventDefault();onClose();}}>
  <header><div><span className="section-kicker">MADE BY OUR CLASS</span><h2 id="asset-history-title">History · 만든 에셋</h2></div><button onClick={onClose} aria-label="History 닫기">닫기 ×</button></header>
  <p>완성된 에셋은 만든 사람과 강사만 사용할 수 있어요. 수업에 공유하면 같은 수업의 모든 조가 사용할 수 있어요.</p>
  <div className="tabs" role="tablist" aria-label="에셋 History 분류">{([['own',role==='teacher'?'학생 에셋':'내 에셋'],['shared','수업 공유']] as const).map(([value,label])=><button key={value} role="tab" aria-selected={tab===value} className={tab===value?'active':''} onClick={()=>{setTab(value);setSelected(null);}}>{label}</button>)}</div>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!roomId?<p>수업에 입장하면 만든 에셋을 보관하고 공유할 수 있어요.</p>:loading?<p role="status">만든 에셋을 불러오는 중…</p>:!visible.length&&<p>{tab==='own'?'아직 완성된 에셋이 없어요. 새 에셋 만들기에서 시작해 보세요.':'아직 수업에 공유된 에셋이 없어요.'}</p>}
  <div className="asset-history-layout"><div className="asset-history-list">{visible.map(row=><article key={row.asset.id} className={'asset-history-card '+(selected===row.asset.id?'selected':'')}>
   <button className="asset-history-select" aria-label={row.asset.name+' 미리보기'} aria-pressed={selected===row.asset.id} onClick={()=>setSelected(row.asset.id)}><strong>{row.asset.name}</strong><span>{row.roomName} · {new Date(row.createdAt).toLocaleDateString('ko-KR')}</span></button>
   <small>{row.shared?'수업에 공유됨':'공유 전 · 만든 사람과 강사만 사용'}</small>
   <div className="asset-history-actions"><button disabled={busy||!library[row.asset.id]} onClick={()=>void placeAsset(row)}>배치</button>{row.canShare&&!row.shared&&<button disabled={busy} onClick={()=>void share(row)}>수업에 공유</button>}</div>
   {!library[row.asset.id]&&<small>라이브러리에 연결 중… 잠시 후 배치할 수 있어요.</small>}
  </article>)}</div><div>{active?<><h3>{active.asset.name}</h3><AssetPreview key={active.asset.id} asset={active.asset} token={token}/><p className="muted">드래그해서 돌리고, 휠로 확대해 보세요.</p></>:visible.length>0&&<div className="asset-history-placeholder">에셋을 선택해 3D로 확인하세요.</div>}</div></div>
 </dialog>;
}
