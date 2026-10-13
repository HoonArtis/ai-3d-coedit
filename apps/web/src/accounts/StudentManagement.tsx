import {useEffect,useRef,useState} from 'react';
import {accountApi} from './api';
type Seat={ordinal:number;actor:string|null;online:boolean};
export function StudentManagement({roomId,roomName,onClose,onChanged}:{roomId:string;roomName:string;onClose:()=>void;onChanged:()=>Promise<void>}){
 const [seats,setSeats]=useState<Seat[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[target,setTarget]=useState<Seat|null>(null),[deleteObjects,setDeleteObjects]=useState(false);
 const sequence=useRef(0),mounted=useRef(true);
 const load=async()=>{const id=++sequence.current;const result=await accountApi<{seats:Seat[]}>('/rooms/'+roomId+'/students');if(mounted.current&&id===sequence.current)setSeats(result.seats);};
 useEffect(()=>{mounted.current=true;const refresh=()=>void load().catch(e=>{if(mounted.current)setNotice(e.message);});refresh();const timer=setInterval(refresh,5000);return()=>{mounted.current=false;sequence.current++;clearInterval(timer);};},[roomId]);
 const manage=async(seat:Seat,action:'disconnect'|'remove')=>{
  setBusy(true);setNotice('');
  try{await accountApi('/rooms/'+roomId+'/students/'+seat.actor+'/manage',{action,deleteObjects:action==='remove'&&deleteObjects});if(mounted.current){setTarget(null);setNotice(action==='remove'?'학생을 삭제하고 자리를 비웠어요.':'접속을 종료했어요. 학생은 다시 입장할 수 있어요.');}await load();await onChanged();}
  catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:'학생 관리에 실패했어요.');await load().catch(()=>{});}
  finally{if(mounted.current)setBusy(false);}
 };
 return <section className="student-management" aria-label={roomName+' 학생 관리'}>
  <div className="class-heading"><h2>{roomName} 학생 관리</h2><button disabled={busy} onClick={onClose}>학생 관리 닫기</button></div>
  <p>학생은 선택한 자리 번호로 구분해요. 접속 종료는 자리와 작품을 유지합니다.</p>
  {notice&&<p role="status">{notice}</p>}
  {!seats.length&&<p>학생 목록을 불러오는 중…</p>}
  <ul className="student-list">{seats.map(seat=><li key={seat.ordinal} aria-label={'학생 '+seat.ordinal}>
   <strong>학생 {seat.ordinal}</strong><span>{seat.actor?(seat.online?'접속 중':'접속 안 함'):'빈 자리'}</span>
   {seat.actor&&<><button disabled={busy||!seat.online} onClick={()=>void manage(seat,'disconnect')}>접속 종료</button><button disabled={busy} onClick={()=>{setTarget(seat);setDeleteObjects(false);}}>학생 삭제</button></>}
  </li>)}</ul>
  {target&&<div className="student-removal" role="group" aria-label="학생 삭제 확인"><h3>학생 {target.ordinal} 삭제</h3>
   <p>현재 접속을 종료하고 기존 입장 정보를 무효화합니다. 빈 자리는 다른 학생이 선택할 수 있어요. 기본적으로 장면의 물건은 유지하며 강사가 관리할 수 있습니다.</p>
   <label><input type="checkbox" checked={deleteObjects} disabled={busy} onChange={e=>setDeleteObjects(e.target.checked)}/>학생이 배치한 물건도 장면에서 삭제</label>
   <p>생성 파일과 복원 이력은 보존됩니다. 공통 수업 코드를 알면 새 학생으로 입장할 수 있으므로 입장을 막으려면 초대를 닫아 주세요.</p>
   <button disabled={busy} onClick={()=>void manage(target,'remove')}>학생 삭제·자리 비우기</button><button disabled={busy} onClick={()=>setTarget(null)}>취소</button>
  </div>}
 </section>;
}
