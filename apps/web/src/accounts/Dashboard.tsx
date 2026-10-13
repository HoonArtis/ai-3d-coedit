import {useEffect,useRef,useState} from 'react';
import {accountApi,saveLogin,logout,type IssuedStudent,type LoginIdentity} from './api';
import {dashboardSchema,type DashboardClassroom} from '@coedit/contracts';
import './accounts.css';
import {ApprovalPanel} from './ApprovalPanel';
import {RoomThumbnail} from './RoomThumbnail';
import {GenerationSettings} from './GenerationSettings';
import {TeacherLogs} from './TeacherLogs';
export function Dashboard(){
  const [classes,setClasses]=useState<DashboardClassroom[]>([]),[name,setName]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[issued,setIssued]=useState<IssuedStudent[]>([]);
  const [logClass,setLogClass]=useState<string|null>(null);
  const [reviewClass,setReviewClass]=useState<string|null>(null);
  const loadSequence=useRef(0);
  const load=async()=>{const seq=++loadSequence.current,next=dashboardSchema.parse(await accountApi('/dashboard'));if(seq===loadSequence.current)setClasses(next);};
  useEffect(()=>{const refresh=()=>void load().catch(e=>setNotice(e.message));refresh();const timer=setInterval(refresh,5000);return()=>{clearInterval(timer);loadSequence.current++;};},[]);
  const run=async(work:()=>Promise<void>)=>{setBusy(true);setNotice('');try{await work();}catch(e){setNotice(e instanceof Error?e.message:'처리할 수 없어요.');}finally{setBusy(false);}};
  const enter=async(roomKey:string)=>{saveLogin(await accountApi<LoginIdentity>('/room-session',{roomKey}));location.assign('/');};
  const download=()=>{
    const quote=(value:string)=>'"'+(/^[=+@-]/.test(value)?"'":'')+value.replaceAll('"','""')+'"';
    const csv='\ufeff방 코드,번호,발급 ID\r\n'+issued.map(s=>[s.roomCode,String(s.ordinal),s.issuedId].map(quote).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='students-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <main className="dashboard account-page"><header><div><p className="eyebrow">SPACE STUDIO · TEACHER</p><h1>내 수업</h1></div><nav><a href="/">편집기로</a><button onClick={()=>{void run(logout);}}>로그아웃</button></nav></header>
    <section className="class-create"><div><h2>새로운 공간 수업</h2><p>6개 조를 만들고 학생 30명의 입장 ID를 발급하세요.</p></div><form onSubmit={e=>{e.preventDefault();void run(async()=>{await accountApi('/classes',{name,roomCount:6});setName('');await load();});}}><label>수업 이름<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80}/></label><button className="primary" disabled={busy}>수업 만들기</button></form></section>
    {notice&&<p role="alert" className="account-error">{notice}</p>}
    {logClass&&<TeacherLogs key={logClass} classId={logClass} onClose={()=>setLogClass(null)}/>}
    {reviewClass&&<ApprovalPanel key={reviewClass} classId={reviewClass} onClose={()=>setReviewClass(null)}/>}
    {classes.map(c=><section className="class-card" key={c.id}><div className="class-heading"><h2>{c.name}</h2><button onClick={()=>setLogClass(c.id)}>학생 대화 로그 열기</button><button onClick={()=>setReviewClass(c.id)}>생성물 승인함 열기</button><button disabled={busy||c.rooms.every(r=>r.students===5)} onClick={()=>{void run(async()=>{const count=c.rooms.reduce((n,r)=>n+5-r.students,0);setIssued(await accountApi<IssuedStudent[]>('/classes/'+c.id+'/students',{count}));await load();});}}>학생 {c.rooms.reduce((n,r)=>n+5-r.students,0)}명 발급</button></div><GenerationSettings classId={c.id} value={c.generation_limit} onSaved={load}/><div className="room-grid">{c.rooms.map(r=><button key={r.id} aria-label={r.name+' 편집'} className="room-card" onClick={()=>{void run(()=>enter(r.id));}}><div className="room-art"><RoomThumbnail snapshot={r.snapshot} library={c.library} error={r.thumbnailError}/></div><h3>{r.name}</h3><span>발급 학생 {r.students} / 5</span><span className="approval-badge">승인 대기 {r.pendingApproval}</span><code>{r.code}</code></button>)}</div></section>)}
    {issued.length>0&&<section className="issued"><div className="class-heading"><div><h2>발급한 학생 ID</h2><p>이 화면을 닫기 전에 내려받아 학생에게 전달해 주세요.</p></div><button onClick={download}>발급 ID 내려받기</button></div><div className="table-scroll"><table aria-label="발급 학생 목록"><thead><tr><th>방 코드</th><th>번호</th><th>발급 ID</th></tr></thead><tbody>{issued.map(s=><tr key={s.actor}><td>{s.roomCode}</td><td>{s.ordinal}</td><td><code>{s.issuedId}</code></td></tr>)}</tbody></table></div></section>}
  </main>;
}
