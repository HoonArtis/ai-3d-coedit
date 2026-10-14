import {useEffect,useState} from 'react';
import {classLobbySchema,type ClassLobby as Lobby,type LoginIdentity} from '@coedit/contracts';
import {accountApi,saveLogin} from './api';
function newResumeKey(){return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function ClassLobby({code,onBack,initialMode='edit'}:{code:string;onBack:()=>void;initialMode?:'edit'|'vr'}){
 const [mode,setMode]=useState(initialMode);
 const storageKey='coedit-seat-'+code,[resumeKey,setResumeKey]=useState(()=>localStorage.getItem(storageKey)??''),[lobby,setLobby]=useState<Lobby|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;const refresh=()=>void accountApi('/lobby',{code}).then(value=>{if(active)setLobby(classLobbySchema.parse(value));}).catch(e=>{if(active)setError(e instanceof Error?e.message:'로비에 연결할 수 없어요.');});refresh();const timer=setInterval(refresh,5000);return()=>{active=false;clearInterval(timer);};},[code]);
 const enter=async(roomKey?:string,ordinal?:number)=>{
  setBusy(true);setError('');
  try{
   if(mode==='vr'&&roomKey){const identity=await accountApi<LoginIdentity>('/lobby/vr',{code,roomKey,ordinal});saveLogin(identity);location.assign('/?vr='+encodeURIComponent(roomKey));return;}
   const key=resumeKey||newResumeKey();localStorage.setItem(storageKey,key);setResumeKey(key);
   const identity=await accountApi<LoginIdentity>(roomKey?'/lobby/claim':'/lobby/resume',{code,resumeKey:key,...(roomKey?{roomKey,ordinal}:{})});saveLogin(identity);location.assign('/');
  }catch(e){setError(e instanceof Error?e.message:'자리에 입장할 수 없어요.');}finally{setBusy(false);}
 };
 return <section className="classroom-lobby"><button onClick={onBack}>← 초대 코드 다시 입력</button><p className="eyebrow">CLASSROOM LOBBY</p><h1>{lobby?.name??'클래스룸 로비'}</h1>
 <div className="role-tabs"><button disabled={busy} aria-pressed={mode==='edit'} onClick={()=>{setMode('edit');setError('');}}>작품 만들기</button><button disabled={busy} aria-pressed={mode==='vr'} onClick={()=>{setMode('vr');setError('');}}>VR 감상</button></div>
 <p>{mode==='vr'?'사용 중인 학생 자리도 선택할 수 있어요. 그 자리의 캐릭터로 VR 작품을 감상해요.':'참여할 조와 빈 학생 자리를 선택하세요. 선택한 자리는 이 브라우저에 저장됩니다.'}</p>
 {mode==='edit'&&resumeKey&&<button className="primary" disabled={busy} onClick={()=>void enter()}>내 자리로 돌아가기</button>}{error&&<p role="alert" className="account-error">{error}</p>}<div className="lobby-room-grid">{lobby?.rooms.map(room=><section className="lobby-room" key={room.id}><h2>{room.name}</h2><p>{room.seats.filter(s=>s.occupied).length} / 5 자리 사용 중</p><div className="seat-grid">{room.seats.map(seat=><button key={seat.ordinal} disabled={busy||(mode==='edit'&&seat.occupied)} aria-label={room.name+' 학생 '+seat.ordinal+' 자리 선택'} onClick={()=>void enter(room.id,seat.ordinal)}><strong>학생 {seat.ordinal}</strong><span>{mode==='vr'?(seat.occupied?'VR로 입장':'기본 캐릭터로 입장'):(seat.occupied?'사용 중':'빈 자리')}</span></button>)}</div></section>)}</div>
 <p className="account-note">{mode==='vr'?'테스트용 자유 입장 · 자리 본인 확인 없이 감상할 수 있어요. 작품 편집과 캐릭터 변경은 PC의 원래 학생 화면에서 해 주세요.':'자리는 접속 여부와 관계없이 본인 작품을 위해 유지됩니다. 다른 기기에서 감상하려면 VR 감상 모드를 선택하세요.'}</p></section>;
}
