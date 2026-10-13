import {useEffect,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {approvalListSchema,type ApprovalRecord} from '@coedit/contracts';
import {GeneratedModel,GeneratedModelProvider} from '../editor/GeneratedModel';
import {accountApi} from './api';
function Preview({row}:{row:ApprovalRecord}){
 const [error,setError]=useState(''),size=row.asset.dimensions,scale=2/Math.max(...size,.01),token=localStorage.getItem('coedit-account-token')??'';
 return <div className="approval-preview" aria-label="생성물 3D 미리보기">{error?<p role="alert">{error}</p>:<Canvas camera={{position:[2,1.3,2.5],fov:45}}><color attach="background" args={['#e9eeea']}/><ambientLight intensity={2}/><directionalLight position={[3,5,2]} intensity={3}/><GeneratedModelProvider><group scale={scale} position={[0,-size[1]*scale/2,0]}><GeneratedModel artifactId={row.asset.artifactId!} token={token} preview onError={setError}/></group></GeneratedModelProvider><OrbitControls makeDefault/></Canvas>}</div>;
}
export function ApprovalPanel({classId,onClose}:{classId:string;onClose:()=>void}){
 const [rows,setRows]=useState<ApprovalRecord[]>([]),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>setRows(approvalListSchema.parse(await accountApi('/classes/'+classId+'/approvals')));
 useEffect(()=>{let cancelled=false;setRows([]);setSelected(null);void accountApi('/classes/'+classId+'/approvals').then(value=>{if(!cancelled)setRows(approvalListSchema.parse(value));}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};},[classId]);
 const decide=async(row:ApprovalRecord,decision:'approved'|'rejected')=>{setBusy(true);setError('');try{await accountApi('/classes/'+classId+'/approvals/'+row.jobId,{version:row.version,decision});await load();}catch(e){setError(e instanceof Error?e.message:'판정을 저장하지 못했어요.');}finally{setBusy(false);}};
 const active=rows.find(r=>r.jobId===selected);
 return <section className="approval-panel"><div className="class-heading"><h2>생성물 승인함</h2><button onClick={onClose}>승인함 닫기</button></div><p>결과를 돌려 보며 확인하세요. 승인하면 수업 라이브러리에 공개되며, 배치는 편집기에서 직접 합니다.</p>{error&&<p role="alert">{error}</p>}
  {!rows.length&&<p>확인할 생성물이 없어요.</p>}
  <div className="approval-layout"><div>{rows.map(row=><article key={row.jobId} className="approval-item"><button onClick={()=>setSelected(row.jobId)}>{row.asset.name} 미리보기</button><span>{row.phase==='pending_approval'?'승인 대기':row.phase==='approved'?'승인됨':'거절됨'}</span>{row.phase==='pending_approval'&&<div><button disabled={busy} onClick={()=>void decide(row,'approved')}>승인</button><button disabled={busy} onClick={()=>void decide(row,'rejected')}>거절</button></div>}</article>)}</div>{active&&<Preview key={active.jobId} row={active}/>}</div>
 </section>;
}
