import {useEffect,useRef,useState} from 'react';
import {generationListSchema} from '@coedit/contracts';
import type {useEditor} from '../editor/use-editor';
import {generationStatus} from './status';
import {serverEndpoint as endpoint} from '../server-endpoint';
import './generation.css';
type Listed=ReturnType<typeof generationListSchema.parse>;
function Preview({url,token,version}:{url:string;token:string;version:number}){
 const [src,setSrc]=useState(''),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const abort=new AbortController();let objectUrl='';setSrc('');setError(false);
  void fetch(url,{headers:{Authorization:'Bearer '+token},signal:abort.signal}).then(async response=>{if(!response.ok)throw Error('IMAGE_FAILED');const blob=await response.blob();if(abort.signal.aborted)return;objectUrl=URL.createObjectURL(blob);setSrc(objectUrl);}).catch(()=>{if(!abort.signal.aborted)setError(true);});
  return()=>{abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[url,token,version,attempt]);
 if(error)return <div><p role="alert">이미지를 읽지 못했어요.</p><button onClick={()=>setAttempt(n=>n+1)}>미리보기 다시 읽기</button></div>;
 return src?<img src={src} alt="확인할 생성 이미지"/>:<span>이미지를 읽는 중…</span>;
}
export function GenerationPanel({editor}:{editor:ReturnType<typeof useEditor>}){
 const identity=editor.chatTransport?.identity,[data,setData]=useState<Listed>({jobs:[],usage:{used:0,limit:0}}),[prompt,setPrompt]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const enabled=identity?.storage==='postgres'&&identity.role==='student';
 const acting=useRef(false),loadSequence=useRef(0),[submitting,setSubmitting]=useState(false),[awaitingRefresh,setAwaitingRefresh]=useState(false),[showHidden,setShowHidden]=useState(false),[deleting,setDeleting]=useState<string|null>(null);
 const submissionPending=submitting||awaitingRefresh;
 const active=data.jobs.filter(job=>job.state==='image_queued'||job.state==='shape_queued');
 const quotaReached=data.usage.limit!==null&&data.usage.used>=data.usage.limit;
 const imageActive=active.some(job=>job.state==='image_queued');
 const hiddenCount=data.jobs.filter(job=>job.visibility==='hidden').length;
 const base=endpoint+'/api/generation/'+identity?.roomKey;
 const api=async(path:string,options:RequestInit={})=>{
  const response=await fetch(base+path,{...options,headers:{Authorization:'Bearer '+identity?.token,...options.headers}});
  const value=await response.json();if(!response.ok)throw Error(value.message??'생성 요청을 처리하지 못했어요.');return value;
 };
 const refresh=async(isStopped:()=>boolean=()=>false)=>{const sequence=++loadSequence.current;const next=generationListSchema.parse(await api(''));if(sequence===loadSequence.current&&!isStopped()){setData(next);setAwaitingRefresh(false);}};
 useEffect(()=>{
  if(!enabled)return;let stopped=false;let timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{if(!acting.current)await refresh(()=>stopped);}catch{if(!stopped&&!acting.current)setNotice('생성 상태를 읽지 못했어요. 잠시 뒤 다시 확인합니다.');}finally{if(!stopped)timer=setTimeout(()=>void poll(),1500);}};
  void poll();return()=>{stopped=true;++loadSequence.current;clearTimeout(timer);};
 },[identity?.token,identity?.roomKey,enabled]);
 const act=async(work:()=>Promise<unknown>,accepted?:string)=>{
  if(acting.current)return;acting.current=true;++loadSequence.current;setBusy(true);setNotice('');if(accepted)setSubmitting(true);
  try{const result=await work();if(result===null)throw Error('서버에 연결한 뒤 다시 시도해 주세요.');if(result&&typeof result==='object'&&'ok' in result&&result.ok===false)throw Error('message' in result?String(result.message):'요청을 처리하지 못했어요.');if(accepted){setNotice(accepted);setAwaitingRefresh(true);}await refresh();}
  catch(error){setNotice(error instanceof Error?error.message:'요청을 처리하지 못했어요.');}finally{acting.current=false;setBusy(false);setSubmitting(false);}
 };
 const post=(path:string,body:unknown)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!enabled)return null;
 return <details className="generation-panel"><summary><span>새 에셋 만들기</span>{(submissionPending||active.length>0)&&<span className="generation-badge"><span className="generation-spinner" aria-hidden="true"/>{submissionPending?'요청 확인 중':`${active.length}건 진행 중`}</span>}</summary>
  <p><output aria-label="생성 사용량">{data.usage.limit===null?`횟수 제한 없음 · ${data.usage.used}회 사용`:`${data.usage.used} / ${data.usage.limit}회 사용`}</output></p>
  <p className="generation-policy">그리기·업로드·다시 그리기·재질 변경은 각각 1회 사용합니다. 최종 처리 실패 시 돌려드려요. 텍스처 실패 후 재질 선택은 추가 횟수를 쓰지 않습니다.</p>
  <textarea aria-label="생성할 물건 설명" value={prompt} maxLength={2000} placeholder="예: 고래 모양의 파란 벤치" onChange={e=>setPrompt(e.target.value)}/>
  {(submissionPending||active.length>0)&&<div className="generation-progress" role="status" aria-label="생성 진행 상황"><span className="generation-spinner" aria-hidden="true"/><strong>{submitting?'요청을 보내고 있어요…':awaitingRefresh?'접수한 요청의 진행 상황을 확인하고 있어요…':`${active.length}건의 생성 작업이 진행 중이에요`}</strong><p>요청이 처리되는 동안 다시 누르지 않아도 돼요.</p>{active.map(job=><p key={job.id}>{generationStatus(job).label}</p>)}</div>}
  <button disabled={busy||submissionPending||imageActive||!prompt.trim()||quotaReached} onClick={()=>{if(!imageActive&&!submissionPending)void act(()=>editor.send([{op:'generate',prompt}]),'이미지 생성 요청을 접수했어요. 아래에서 진행 상황을 확인하세요.');}}>이미지 그리기</button>
  <label>그림 업로드<input aria-label="그림 업로드" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy||quotaReached} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void act(()=>api('/upload/'+crypto.randomUUID(),{method:'POST',headers:{'Content-Type':file.type},body:file}));}}/></label>
  <label>캐릭터 업로드<input aria-label="캐릭터 업로드" type="file" accept=".fbx,.glb" disabled={busy||quotaReached} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;const format=file.name.toLowerCase().split('.').at(-1);if(!['fbx','glb'].includes(format??'')||file.size>64*1024*1024){setNotice('64MB 이하의 리깅된 FBX 또는 GLB 파일을 선택해 주세요.');return;}void act(()=>api('/characters/'+crypto.randomUUID()+'/'+format,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file}));}}/></label>
  <small>캐릭터는 뼈대와 포함된 대기 애니메이션을 유지해 변환해요. 강사 승인 후 배치할 수 있어요. 변환 실패 시 VR 기본 아바타를 사용해요.</small>
  {notice&&<p role="status" aria-label="생성 안내">{notice}</p>}
  {hiddenCount>0&&<button aria-pressed={showHidden} onClick={()=>setShowHidden(value=>!value)}>{showHidden?'숨긴 항목 접기':`숨긴 항목 보기 (${hiddenCount})`}</button>}
  {data.jobs.filter(job=>job.visibility!=='deleted'&&(job.visibility!=='hidden'||showHidden)).map(job=><article key={job.id} className="generation-job" data-job-id={job.id}><strong>{generationStatus(job).label}</strong>
   <p className="generation-prompt">{job.source.kind==='text'?job.source.prompt:job.source.kind==='upload'?'업로드한 그림':'업로드한 캐릭터'}</p>
   {job.visibility==='hidden'?<><p>목록에서 숨긴 항목이에요.</p><button disabled={busy} onClick={()=>void act(()=>post('/'+job.id+'/visibility',{version:job.version,visibility:'visible'}))}>다시 표시</button></>:<>
   {job.source.kind==='character'&&<p>업로드한 캐릭터</p>}
   {job.target&&<p>기존 객체 재질 변경</p>}
   {job.target&&job.finishing?.phase==='approved'&&(editor.snapshot.generation!==job.target.generation||editor.snapshot.objects[job.target.objectId]?.revision!==job.target.revision?<p>요청 뒤 객체나 방이 바뀌었어요. 승인된 결과는 라이브러리에서 새로 배치하세요.</p>:<button disabled={busy} onClick={()=>void act(async()=>{const target=job.target!;await editor.select(target.objectId);return editor.send([{op:'replace_asset',id:target.objectId,assetId:'generated-'+job.finishing!.artifactId,expectedRevision:target.revision,expectedGeneration:target.generation}]);})}>원래 객체에 승인 재질 적용</button>)}
   {generationStatus(job).failure&&<p className="chat-error">{generationStatus(job).failure}</p>}{generationStatus(job).hint&&<p>{generationStatus(job).hint}</p>}
   {job.finishing?.staleScene&&<p>방 복원 전에 요청한 결과입니다. 승인 후 라이브러리에서 다시 선택하세요.</p>}
   {job.imageKey&&<Preview url={base+'/'+job.id+'/image'} token={identity!.token} version={job.version}/>}
   {job.state==='awaiting_confirmation'&&<><button disabled={busy} onClick={()=>void act(()=>post('/'+job.id+'/confirm',{version:job.version}))}>{job.target?'이 이미지로 재질 변경':'이 이미지로 3D 만들기'}</button><button disabled={busy||!prompt.trim()||quotaReached} onClick={()=>void act(()=>post('/'+job.id+'/redraw',{requestId:crypto.randomUUID(),version:job.version,prompt}))}>설명으로 다시 그리기</button></>}
   {job.state==='failed'&&job.source.kind!=='character'&&<button disabled={busy||!prompt.trim()||quotaReached} onClick={()=>void act(()=>post('/'+job.id+'/redraw',{requestId:crypto.randomUUID(),version:job.version,prompt}))}>설명으로 재시도</button>}
   {job.finishing?.phase==='material_choice'&&<div aria-label="실패 후 재질 선택">{([['wood','나무'],['metal','금속'],['fabric','천']] as const).map(([preset,name])=><button key={preset} disabled={busy} onClick={()=>void act(()=>post('/'+job.id+'/preset',{version:job.version,preset}))}>{name} 재질 사용</button>)}</div>}
   {(job.state==='image_queued'||job.state==='shape_queued')&&(job.running?<p>처리 중인 작업은 취소할 수 없어요.</p>:<button disabled={busy} onClick={()=>void act(()=>post('/'+job.id+'/cancel',{version:job.version}))}>대기 요청 취소</button>)}
   {['awaiting_confirmation','shape_ready','failed','cancelled'].includes(job.state)&&<button disabled={busy} onClick={()=>void act(()=>post('/'+job.id+'/visibility',{version:job.version,visibility:'hidden'}))}>목록에서 숨기기</button>}
   </>}
   {['awaiting_confirmation','failed','cancelled'].includes(job.state)&&(!deleting||deleting!==job.id?<button disabled={busy} onClick={()=>setDeleting(job.id)}>이미지 삭제</button>:<div className="generation-delete" role="group" aria-label="이미지 삭제 확인"><p>목록과 미리보기에서 삭제합니다. 이미 제작한 3D/배치물은 삭제하지 않습니다.</p><button disabled={busy} onClick={()=>void act(async()=>{const result=await post('/'+job.id+'/visibility',{version:job.version,visibility:'deleted'});setDeleting(null);return result;})}>삭제 확인</button><button disabled={busy} onClick={()=>setDeleting(null)}>삭제하지 않기</button></div>)}
  </article>)}
 </details>;
}
