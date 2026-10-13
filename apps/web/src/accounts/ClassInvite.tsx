import {useEffect,useState} from 'react';
import {classInviteSchema} from '@coedit/contracts';
import {accountApi} from './api';
export function ClassInvite({classId,name}:{classId:string;name:string}){
 const [invite,setInvite]=useState<{code:string;enabled:boolean}|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;void accountApi('/classes/'+classId+'/invite').then(value=>{if(active)setInvite(classInviteSchema.parse(value));}).catch(()=>{if(active)setNotice('초대 코드를 불러오지 못했어요.');});return()=>{active=false;};},[classId]);
 const copy=async()=>{if(!invite)return;try{await navigator.clipboard.writeText(invite.code);setNotice('초대 코드를 복사했어요. 학생에게 전달해 주세요.');}catch{setNotice('복사가 차단됐어요. 위 코드를 선택해서 복사해 주세요.');}};
 const toggle=async()=>{if(!invite)return;setBusy(true);try{setInvite(classInviteSchema.parse(await accountApi('/classes/'+classId+'/invite',{enabled:!invite.enabled})));setNotice('초대 설정을 저장했어요.');}catch{setNotice('초대 설정을 바꾸지 못했어요.');}finally{setBusy(false);}};
 return <section className="class-invite" aria-label={name+' 학생 초대'}><div><h3>학생 초대</h3><p>학생에게 접속 주소와 이 코드를 알려 주세요. 로비에서 빈 자리를 선택하면 입장해요.</p></div>{invite&&<><label>공통 수업 코드<input aria-label={name+' 초대 코드'} readOnly value={invite.code} onFocus={e=>e.currentTarget.select()}/></label><button onClick={()=>void copy()}>코드 복사</button><button disabled={busy} onClick={()=>void toggle()}>{invite.enabled?'새 학생 입장 닫기':'새 학생 입장 열기'}</button><span>{invite.enabled?'입장 가능':'새 학생 입장 닫힘'}</span></>}{notice&&<p role="status">{notice}</p>}</section>;
}
