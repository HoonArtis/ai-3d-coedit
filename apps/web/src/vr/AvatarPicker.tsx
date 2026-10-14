import {useEffect,useRef,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {DEFAULT_BLOCK_AVATAR,blockAvatarSchema,type BlockAvatarProfile} from '@coedit/contracts';
import {accountApi} from '../accounts/api';
import {BlockCharacter} from './BlockCharacter';
import './avatar-picker.css';
const presets=[['바다','#4488cc','#24395b'],['숲','#4e9864','#334e43'],['노을','#ed8955','#59485f'],['보라','#9971c8','#354263']] as const;
export function AvatarPicker({roomId,token,onApplied,disabled=false}:{roomId:string;token:string;onApplied?:()=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),[profile,setProfile]=useState<BlockAvatarProfile>(DEFAULT_BLOCK_AVATAR),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[saved,setSaved]=useState(false),[loadFailed,setLoadFailed]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),lock=useRef(false),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;dialog.current?.showModal();const abort=new AbortController();setLoading(true);setLoadFailed(false);setMessage('');setSaved(false);
  void accountApi<unknown>('/rooms/'+encodeURIComponent(roomId)+'/avatar',undefined,abort.signal,token).then(raw=>{if(abort.signal.aborted)return;const data=blockAvatarSchema.nullable().parse(raw);setProfile(data??DEFAULT_BLOCK_AVATAR);setSaved(Boolean(data));}).catch(()=>{if(!abort.signal.aborted){setLoadFailed(true);setMessage('내 캐릭터를 읽지 못했어요. 닫았다가 다시 열어 주세요.');}}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();
 },[open,roomId,token]);
 const close=()=>{if(lock.current)return;setOpen(false);trigger.current?.focus();};
 const apply=async(value:BlockAvatarProfile|null)=>{if(lock.current||loading||loadFailed)return;lock.current=true;setBusy(true);setMessage('');try{await accountApi('/rooms/'+encodeURIComponent(roomId)+'/avatar',value,undefined,token);setSaved(value!==null);setMessage(value?'내 캐릭터로 적용됐어요. VR에서 친구들에게 이 모습으로 보여요.':'업로드한 캐릭터를 사용해요. 없으면 기본 블록 캐릭터가 보여요.');onApplied?.();}catch{setMessage('저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.');}finally{lock.current=false;setBusy(false);}};
 return <><button ref={trigger} disabled={disabled} className="avatar-picker-open" onClick={()=>setOpen(true)}>내 캐릭터</button>{open&&<dialog ref={dialog} className="avatar-picker" aria-labelledby="avatar-title" onCancel={e=>{e.preventDefault();close();}}>
  <header><h2 id="avatar-title">내 블록 캐릭터</h2><button aria-label="캐릭터 닫기" disabled={busy} onClick={close}>✕</button></header>
  <p>파일 없이 색만 고르면 끝! 현재 학생 자리에 저장돼요.</p>
  <div className="block-preview" aria-label="내 블록 캐릭터 3D 미리보기"><Canvas camera={{position:[2,1.9,-3.4],fov:37}}><color attach="background" args={['#e8eee9']}/><ambientLight intensity={2}/><directionalLight position={[3,5,-4]} intensity={2}/><BlockCharacter profile={profile}/><OrbitControls target={[0,.95,0]} minDistance={2} maxDistance={5} enablePan={false}/></Canvas></div>
  <fieldset disabled={loading||busy||loadFailed}><legend>캐릭터 꾸미기</legend><div className="avatar-presets">{presets.map(([name,shirt,pants])=><button key={name} onClick={()=>{setProfile(p=>({...p,shirt,pants}));setSaved(false);setMessage('');}}>{name}</button>)}</div>
  <div className="avatar-colors">{([['skin','피부'],['hair','머리'],['shirt','상의'],['pants','바지']] as const).map(([key,label])=><label key={key}>{label}<input type="color" aria-label={label+' 색'} value={profile[key]} onChange={e=>{setProfile(p=>({...p,[key]:e.target.value}));setSaved(false);setMessage('');}}/></label>)}</div>
  <button className="avatar-apply" onClick={()=>void apply(profile)}>{busy?'적용 중…':saved?'현재 내 캐릭터 · 다시 적용':'내 캐릭터 적용'}</button>
  <button className="avatar-upload-mode" onClick={()=>void apply(null)}>기존 업로드 캐릭터 사용</button></fieldset>
  <p role="status">{loading?'내 캐릭터를 불러오는 중…':message|| (saved?'현재 내 VR 캐릭터예요.':'색을 고른 뒤 적용해 주세요.')}</p>
 </dialog>}</>;
}
