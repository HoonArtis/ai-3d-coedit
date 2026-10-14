import {ClassLobby} from './ClassLobby';
import {useState,type FormEvent} from 'react';
import {accountApi,saveLogin,type LoginIdentity} from './api';
import './accounts.css';
export function Login({registrationEnabled=true,localPreview=true}:{registrationEnabled?:boolean;localPreview?:boolean}){
  const [role,setRole]=useState<'student'|'teacher'>('student'),[username,setUsername]=useState(''),[password,setPassword]=useState('');
  const [roomCode,setRoomCode]=useState(''),[issuedId,setIssuedId]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [classCode,setClassCode]=useState(''),[lobbyCode,setLobbyCode]=useState('');
  const [mode,setMode]=useState<'edit'|'vr'>('edit');
  const submit=async(register=false)=>{
    setBusy(true);setError('');
    try{
      const identity=await accountApi<LoginIdentity>(role==='student'?'/students/login':register?'/teachers/register':'/teachers/login',role==='student'?{roomCode,issuedId}:{username,password});
      saveLogin(identity);location.assign(role==='teacher'?'/?teacher=1':'/');
    }catch(e){setError(e instanceof Error?e.message:'로그인할 수 없어요.');}finally{setBusy(false);}
  };
  if(lobbyCode)return <main className="account-page"><ClassLobby key={lobbyCode} code={lobbyCode} initialMode={mode} onBack={()=>setLobbyCode('')}/></main>;
  return <main className="account-page">{localPreview&&<a className="account-back" href="/">← 로컬 체험으로</a>}<section className="login-card"><div className="account-symbol">◈</div><p className="eyebrow">SPACE STUDIO</p><h1>함께 꾸미는 우리 공간</h1><p>수업에 입장하고 이어서 만들어 보세요.</p>
    <div className="role-tabs">{(['student','teacher'] as const).map(r=><button key={r} type="button" aria-pressed={role===r} onClick={()=>{setRole(r);setError('');}}>{r==='student'?'학생':'강사'}</button>)}</div>
    {role==='student'&&<div className="role-tabs"><button type="button" aria-pressed={mode==='edit'} onClick={()=>setMode('edit')}>작품 만들기</button><button type="button" aria-pressed={mode==='vr'} onClick={()=>setMode('vr')}>VR 감상으로 입장</button></div>}
    {role==='student'&&<form className="class-code-form" onSubmit={e=>{e.preventDefault();setLobbyCode(classCode.trim().toUpperCase());}}><label>수업 초대 코드<input value={classCode} onChange={e=>setClassCode(e.target.value)} minLength={10} maxLength={40} autoComplete="off" required/></label><button type="submit" className="primary">자리 선택하기</button><p>강사가 알려 준 공통 코드로 클래스룸에 입장해요.</p></form>}
    {role==='student'&&<h2 className="legacy-login-title">발급 ID로 입장</h2>}
    <form onSubmit={(e:FormEvent)=>{e.preventDefault();void submit();}}>{role==='student'?<><label>방 코드<input autoComplete="off" value={roomCode} onChange={e=>setRoomCode(e.target.value)} required/></label><label>발급 ID<input autoComplete="off" value={issuedId} onChange={e=>setIssuedId(e.target.value)} required/></label></>:<><label>강사 아이디<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} minLength={3} required/></label><label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} required/></label><small>비밀번호는 12자 이상으로 입력해 주세요.</small></>}
      {error&&<p role="alert" className="account-error">{error}</p>}<button className="primary" disabled={busy} type="submit">{busy?'연결 중…':'입장하기'}</button>
      {role==='teacher'&&registrationEnabled&&<button type="button" disabled={busy||username.length<3||password.length<12} onClick={()=>{void submit(true);}}>강사 계정 만들기</button>}
    </form><p className="account-note">학생은 공통 수업 코드로 자리를 선택하거나, 발급 ID로 입장해요.</p>
  </section></main>;
}
