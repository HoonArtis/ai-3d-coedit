import {useEffect,useRef,useState} from 'react';
import {studentRosterSchema,teacherLogPageSchema,type StudentRoster,type TeacherLogPage} from '@coedit/contracts';
import {accountApi} from './api';
export function TeacherLogs({classId,onClose}:{classId:string;onClose:()=>void}){
  const [students,setStudents]=useState<StudentRoster>([]),[selected,setSelected]=useState(''),[page,setPage]=useState<TeacherLogPage>({entries:[],nextCursor:null}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const sequence=useRef(0);
  useEffect(()=>{
    let cancelled=false;
    void accountApi('/classes/'+classId+'/students').then(value=>{if(cancelled)return;const rows=studentRosterSchema.parse(value);setStudents(rows);setSelected(rows[0]?.actor??'');}).catch(e=>{if(!cancelled)setError(e.message);});
    return()=>{cancelled=true;sequence.current++;};
  },[classId]);
  const load=async(before?:string)=>{
    const serial=++sequence.current;setBusy(true);setError('');
    try{
      const result=teacherLogPageSchema.parse(await accountApi('/classes/'+classId+'/students/'+selected+'/logs'+(before?'?before='+before:'')));
      if(serial===sequence.current)setPage(previous=>({entries:before?[...previous.entries,...result.entries]:result.entries,nextCursor:result.nextCursor}));
    }catch(e){if(serial===sequence.current)setError(e instanceof Error?e.message:'로그를 읽지 못했어요.');}
    finally{if(serial===sequence.current)setBusy(false);}
  };
  useEffect(()=>{setPage({entries:[],nextCursor:null});if(selected)void load();return()=>{sequence.current++;};},[selected,classId]);
  return <section className="teacher-logs"><div className="class-heading"><h2>학생 대화 로그</h2><button onClick={onClose}>대화 로그 닫기</button></div>
    <label>학생<select aria-label="로그 학생 선택" value={selected} onChange={event=>{sequence.current++;setPage({entries:[],nextCursor:null});setSelected(event.target.value);}}>{students.map(s=><option value={s.actor} key={s.actor}>{s.roomName} · 학생 {s.ordinal}</option>)}</select></label>
    {error&&<p role="alert">{error}</p>}{busy&&<p role="status">기록을 읽고 있어요…</p>}
    {!busy&&!page.entries.length&&<p>저장된 대화가 없어요.</p>}
    <div className="teacher-log-list">{page.entries.map(entry=>{
      const result=entry.response?.result??entry.committedResult;
      return <article className="teacher-log-entry" key={entry.cursor}><small>대화 {entry.cursor} · {entry.status==='pending'?'대기':entry.status==='applying'?'적용 중':entry.status==='cancelled'?'취소':'응답 완료'}</small>
        <p className="teacher-log-message">{entry.request.message}</p>
        {entry.response&&<><p>{entry.response.summary}</p>{entry.response.clarification&&<p>{entry.response.clarification}</p>}{entry.response.error&&<p className="chat-error">{entry.response.error}</p>}</>}
        {result&&<p className={result.ok?'chat-success':'chat-error'}>{result.ok?'서버 적용 완료 · seq '+result.snapshot.seq:result.code+' · '+result.message}</p>}
        <details><summary>호출 명령과 원본 응답</summary><pre>{JSON.stringify({request:entry.request,ops:entry.response?.ops??null,modelOutput:entry.modelOutput,response:entry.response,command:entry.command,committedResult:entry.committedResult},null,2)}</pre></details>
      </article>;
    })}</div>
    {page.nextCursor&&<button disabled={busy} onClick={()=>void load(page.nextCursor!)}>이전 대화 더 보기</button>}
  </section>;
}
