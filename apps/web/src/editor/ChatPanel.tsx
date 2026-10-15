import {useEffect,useRef,useState,useReducer} from 'react';
import type {Vec3,CommandResult,ChatRecord,Suggestion} from '@coedit/contracts';
import type {RoomTransport} from './room-transport';
import {updateChat,emptyChat} from './chat-state';
const QUEUED=new Set(['generate','retexture','upload_character']);
/** 결과 한 줄. 생성 요청은 큐에 들어갔을 뿐이라 "완료"라고 하지 않는다. 추천은 아래 목록이 결과다. */
function resultText(r:ChatRecord){
 if(!r.result)return null;if(!r.result.ok)return r.result.message;
 if(r.ops?.some(op=>QUEUED.has(op.op)))return '생성을 시작했어요. 생성 패널에서 확인해 주세요.';
 if(r.ops?.some(op=>op.op==='recommend'))return null;
 return '완료했어요.';
}
export function ChatPanel({transport,selected,connected,cameraCenter,undo,capacityMessage,placeSuggested,generate}:{placeSuggested:(assetId:string,nearId?:string)=>Promise<CommandResult|null|undefined>;generate:(prompt:string)=>Promise<CommandResult|null>;capacityMessage:string|null;undo:(expectedSeq:number)=>Promise<CommandResult|null>;transport:RoomTransport|null;selected:string|null;connected:boolean;cameraCenter:React.RefObject<Vec3>}){
 const [text,setText]=useState(''),[error,setError]=useState('');
 const [{records,pending,status},dispatch]=useReducer(updateChat,undefined,emptyChat);
 const log=useRef<HTMLDivElement>(null),undoing=useRef(false);
 const [undoBusy,setUndoBusy]=useState(false),[undone,setUndone]=useState<string[]>([]);
 const [used,setUsed]=useState<string[]>([]),[suggesting,setSuggesting]=useState(false);
 const applySuggestion=async(key:string,s:Suggestion)=>{
  if(suggesting||used.includes(key))return;setSuggesting(true);setError('');
  try{const result=s.kind==='place'?await placeSuggested(s.assetId,s.nearId):await generate(s.prompt);if(result?.ok)setUsed(keys=>[...keys,key]);else setError(result&&!result.ok?result.message:'서버 연결을 확인해 주세요.');}
  finally{setSuggesting(false);}
 };
 const latest=records.findLast(r=>r.result?.ok&&r.result.changedIds.length&&!r.ops?.some(op=>op.op==='undo'||op.op==='redo'));
 const cancelApplied=async()=>{if(!latest?.result?.ok||undoing.current)return;undoing.current=true;setUndoBusy(true);setError('');try{const result=await undo(latest.result.snapshot.seq);if(result?.ok)setUndone(ids=>[...ids,latest.requestId]);else setError(result&&!result.ok?result.message:'서버 연결을 확인해 주세요.');}finally{undoing.current=false;setUndoBusy(false);}};
 useEffect(()=>{
  dispatch({type:'reset'});if(!transport)return;
  return transport.subscribeChat(event=>{
   dispatch(event);if(event.type==='resume')transport.chat(event.request);
  });
 },[transport]);
 useEffect(()=>{if(!connected&&pending){dispatch({type:'disconnect'});setError('연결이 끊겼어요. 다시 입장하면 대화 기록을 읽을 수 있어요.');}},[connected,pending]);
 useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight});},[records,status]);
 const send=()=>{
  const message=text.trim();if(!message||pending||!transport||!connected)return;
  const requestId=crypto.randomUUID();dispatch({type:'start',requestId,message});setText('');setError('');
  try{transport.chat({requestId,message,selectedId:selected,cameraCenter:cameraCenter.current});}catch(e){dispatch({type:'disconnect'});setError(e instanceof Error?e.message:'요청 전송 실패');}
 };
 return <section className="assistant-panel"><div className="assistant-title"><div className="ai-symbol">✧</div><div><h2>AI 도우미</h2><span>함께 상상을 펼쳐요</span></div><i>{connected?'연결됨':'연결 대기'}</i></div>
  <div className="chat-log" role="log" aria-label="내 AI 대화" ref={log}>
   {!records.length&&<div className="assistant-intro"><span>✦</span><h3>어떤 공간을 만들까요?</h3><p>에셋을 선택하고 원하는 작업을 말해 주세요.</p></div>}
   {records.map(r=><article key={r.requestId}><p className="chat-user">{r.message}</p>{r.summary&&(!r.result||r.result.ok)&&<p>{r.summary}</p>}{r.clarification&&<p>{r.clarification}</p>}{resultText(r)&&<p className={r.result?.ok?'chat-success':'chat-error'}>{resultText(r)}</p>}{r.result?.ok&&r.result.suggestions&&<ul className="chat-suggestions" aria-label="추천 에셋">{r.result.suggestions.length?r.result.suggestions.map((s,i)=>{const key=r.requestId+':'+i;return <li key={key}><div><b>{s.kind==='place'?s.name:s.prompt}</b><span>{s.reason}</span></div><button type="button" disabled={!connected||suggesting||used.includes(key)} onClick={()=>void applySuggestion(key,s)}>{used.includes(key)?(s.kind==='place'?'놓았어요':'요청했어요'):s.kind==='place'?'놓기':'만들기'}</button></li>;}):<li>지금은 추천할 에셋이 없어요.</li>}</ul>}{r.result?.ok&&r.result.query&&<ul aria-label="조회 결과">{r.result.query.length?r.result.query.map(object=><li key={object.id}>{object.name} · 위치 {object.position.map(n=>Math.round(n*100)/100).join(', ')}</li>):<li>조건에 맞는 에셋이 없어요.</li>}</ul>}{r.error&&<p className="chat-error">처리하지 못했어요. {r.error}</p>}</article>)}
  </div>
  {capacityMessage&&<p role="status" aria-label="공간 한도 안내" className="chat-status">{capacityMessage}</p>}
  {latest&&<button className="chat-status" disabled={!connected||undoBusy||undone.includes(latest.requestId)} onClick={()=>void cancelApplied()}>{undone.includes(latest.requestId)?'취소했어요':'방금 거 취소'}</button>}
  {status&&<p role="status" className="chat-status">{status}</p>}{pending&&<button className="chat-status" onClick={()=>transport?.cancelChat(pending)}>적용 취소</button>}{error&&<p role="alert" className="chat-error">{error}</p>}
  <form className="chat-input" onSubmit={event=>{event.preventDefault();send();}}><textarea aria-label="AI에게 요청" maxLength={4000} value={text} onChange={event=>setText(event.target.value)} placeholder="탁자 주위에 의자 4개 놔줘" disabled={!connected} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send();}}}/><button aria-label="AI 요청 보내기" disabled={!connected||!text.trim()||!!pending}>↑</button></form>
  <p className="chat-caption">내 대화는 강사가 확인할 수 있어요.</p></section>;
}
