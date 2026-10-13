import {useState,type FormEvent} from 'react';
import {accountApi,saveLogin,type LoginIdentity} from './api';
import './accounts.css';
export function Login(){
  const [role,setRole]=useState<'student'|'teacher'>('student'),[username,setUsername]=useState(''),[password,setPassword]=useState('');
  const [roomCode,setRoomCode]=useState(''),[issuedId,setIssuedId]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const submit=async(register=false)=>{
    setBusy(true);setError('');
    try{
      const identity=await accountApi<LoginIdentity>(role==='student'?'/students/login':register?'/teachers/register':'/teachers/login',role==='student'?{roomCode,issuedId}:{username,password});
      saveLogin(identity);location.assign(role==='teacher'?'/?teacher=1':'/');
    }catch(e){setError(e instanceof Error?e.message:'로그인할 수 없어요.');}finally{setBusy(false);}
  };
  return <main className="account-page"><a className="account-back" href="/">← 로컬 체험으로</a><section className="login-card"><div className="account-symbol">◈</div><p className="eyebrow">SPACE STUDIO</p><h1>함께 꾸미는 우리 공간</h1><p>수업에 입장하고 이어서 만들어 보세요.</p>
    <div className="role-tabs">{(['student','teacher'] as const).map(r=><button key={r} type="button" aria-pressed={role===r} onClick={()=>{setRole(r);setError('');}}>{r==='student'?'학생':'강사'}</button>)}</div>
    <form onSubmit={(e:FormEvent)=>{e.preventDefault();void submit();}}>{role==='student'?<><label>방 코드<input autoComplete="off" value={roomCode} onChange={e=>setRoomCode(e.target.value)} required/></label><label>발급 ID<input autoComplete="off" value={issuedId} onChange={e=>setIssuedId(e.target.value)} required/></label></>:<><label>강사 아이디<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} minLength={3} required/></label><label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} required/></label><small>비밀번호는 12자 이상으로 입력해 주세요.</small></>}
      {error&&<p role="alert" className="account-error">{error}</p>}<button className="primary" disabled={busy} type="submit">{busy?'연결 중…':'입장하기'}</button>
      {role==='teacher'&&<button type="button" disabled={busy||username.length<3||password.length<12} onClick={()=>{void submit(true);}}>강사 계정 만들기</button>}
    </form><p className="account-note">학생은 이메일이나 이름 없이 발급 ID로 입장해요.</p>
  </section></main>;
}
