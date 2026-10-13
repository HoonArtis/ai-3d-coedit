import {useEffect,useState} from 'react';
import {generationListSchema,type GenerationRecord} from '@coedit/contracts';
import type {useEditor} from '../editor/use-editor';
import {generationStatus} from './status';
import {serverEndpoint as endpoint} from '../server-endpoint';
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
 const base=endpoint+'/api/generation/'+identity?.roomKey;
 const api=async(path:string,options:RequestInit={})=>{
  const response=await fetch(base+path,{...options,headers:{Authorization:'Bearer '+identity?.token,...options.headers}});
  const value=await response.json();if(!response.ok)throw Error(value.message??'생성 요청을 처리하지 못했어요.');return value;
 };
 const refresh=async()=>setData(generationListSchema.parse(await api('')));
 useEffect(()=>{
  if(!enabled)return;let stopped=false;let timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{const next=generationListSchema.parse(await api(''));if(!stopped)setData(next);}catch{if(!stopped)setNotice('생성 상태를 읽지 못했어요. 잠시 뒤 다시 확인합니다.');}finally{if(!stopped)timer=setTimeout(()=>void poll(),1500);}};
  void poll();return()=>{stopped=true;clearTimeout(timer);};
 },[identity?.token,identity?.roomKey,enabled]);
 const act=async(work:()=>Promise<unknown>)=>{setBusy(true);setNotice('');try{await work();await refresh();}catch(error){setNotice(error instanceof Error?error.message:'요청을 처리하지 못했어요.');}finally{setBusy(false);}};
 const post=(path:string,body:unknown)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!enabled)return null;
 return <details className="generation-panel"><summary>새 에셋 만들기</summary>
  <p><output aria-label="생성 사용량">{data.usage.used} / {data.usage.limit}회 사용</output></p>
  <p className="generation-policy">그리기·업로드·다시 그리기·재질 변경은 각각 1회 사용합니다. 최종 처리 실패 시 돌려드려요. 텍스처 실패 후 재질 선택은 추가 횟수를 쓰지 않습니다.</p>
  <textarea aria-label="생성할 물건 설명" value={prompt} maxLength={2000} placeholder="예: 고래 모양의 파란 벤치" onChange={e=>setPrompt(e.target.value)}/>
  <button disabled={busy||!prompt.trim()||data.usage.used>=data.usage.limit} onClick={()=>void act(()=>editor.send([{op:'generate',prompt}]))}>이미지 그리기</button>
  <label>그림 업로드<input aria-label="그림 업로드" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy||data.usage.used>=data.usage.limit} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void act(()=>api('/upload/'+crypto.randomUUID(),{method:'POST',headers:{'Content-Type':file.type},body:file}));}}/></label>
  <label>캐릭터 업로드<input aria-label="캐릭터 업로드" type="file" accept=".fbx,.glb" disabled={busy||data.usage.used>=data.usage.limit} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;const format=file.name.toLowerCase().split('.').at(-1);if(!['fbx','glb'].includes(format??'')||file.size>64*1024*1024){setNotice('64MB 이하의 리깅된 FBX 또는 GLB 파일을 선택해 주세요.');return;}void act(()=>api('/characters/'+crypto.randomUUID()+'/'+format,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file}));}}/></label>
  <small>캐릭터는 뼈대와 포함된 대기 애니메이션을 유지해 변환해요. 강사 승인 후 배치할 수 있어요. 변환 실패 시 VR 기본 아바타를 사용해요.</small>
  {notice&&<p role="status" aria-label="생성 안내">{notice}</p>}
  {data.jobs.map(job=><article key={job.id} className="generation-job"><strong>{generationStatus(job).label}</strong>
   {job.source.kind==='character'&&<p>업로드한 캐릭터</p>}
   {job.target&&<p>기존 객체 재질 변경</p>}
   {job.target&&job.finishing?.phase==='approved'&&(editor.snapshot.generation!==job.target.generation||editor.snapshot.objects[job.target.objectId]?.revision!==job.target.revision?<p>요청 뒤 객체나 방이 바뀌었어요. 승인된 결과는 라이브러리에서 새로 배치하세요.</p>:<button disabled={busy} onClick={()=>void act(async()=>{const target=job.target!;await editor.select(target.objectId);await editor.send([{op:'replace_asset',id:target.objectId,assetId:'generated-'+job.finishing!.artifactId,expectedRevision:target.revision,expectedGeneration:target.generation}]);})}>원래 객체에 승인 재질 적용</button>)}
   {generationStatus(job).failure&&<p className="chat-error">{generationStatus(job).failure}</p>}{generationStatus(job).hint&&<p>{generationStatus(job).hint}</p>}
   {job.finishing?.staleScene&&<p>방 복원 전에 요청한 결과입니다. 승인 후 라이브러리에서 다시 선택하세요.</p>}
   {job.imageKey&&<Preview url={base+'/'+job.id+'/image'} token={identity!.token} version={job.version}/>}
   {job.state==='awaiting_confirmation'&&<><button disabled={busy} onClick={()=>void act(()=>post('/'+job.id+'/confirm',{version:job.version}))}>{job.target?'이 이미지로 재질 변경':'이 이미지로 3D 만들기'}</button><button disabled={busy||!prompt.trim()||data.usage.used>=data.usage.limit} onClick={()=>void act(()=>post('/'+job.id+'/redraw',{requestId:crypto.randomUUID(),version:job.version,prompt}))}>설명으로 다시 그리기</button></>}
   {job.state==='failed'&&job.source.kind!=='character'&&<button disabled={busy||!prompt.trim()||data.usage.used>=data.usage.limit} onClick={()=>void act(()=>post('/'+job.id+'/redraw',{requestId:crypto.randomUUID(),version:job.version,prompt}))}>설명으로 재시도</button>}
   {job.finishing?.phase==='material_choice'&&<div aria-label="실패 후 재질 선택">{([['wood','나무'],['metal','금속'],['fabric','천']] as const).map(([preset,name])=><button key={preset} disabled={busy} onClick={()=>void act(()=>post('/'+job.id+'/preset',{version:job.version,preset}))}>{name} 재질 사용</button>)}</div>}
  </article>)}
 </details>;
}
