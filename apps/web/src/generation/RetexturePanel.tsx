import {useRef,useState} from 'react';
import type {useEditor} from '../editor/use-editor';
export function RetexturePanel({editor}:{editor:ReturnType<typeof useEditor>}){
 const [prompt,setPrompt]=useState(''),[busy,setBusy]=useState(false),pending=useRef(false);
 const object=editor.selected?editor.snapshot.objects[editor.selected]:null;
 if(!object||editor.library[object.assetId]?.character||object.owner!==editor.actor||editor.role!=='student'||editor.storage!=='postgres')return null;
 const request=async()=>{if(pending.current)return;pending.current=true;setBusy(true);try{const result=await editor.send([{op:'retexture',id:object.id,prompt}]);if(result?.ok){setPrompt('');editor.setNotice('재질 변경을 요청했어요. 새 에셋 만들기에서 처리 상태와 강사 승인 결과를 확인해 주세요.');}}finally{pending.current=false;setBusy(false);}};
 return <div className="retexture-panel"><label>재질 변경<textarea aria-label="변경할 재질 설명" value={prompt} maxLength={2000} placeholder="예: 붉은 나무 재질" onChange={event=>setPrompt(event.target.value)}/></label><button disabled={busy||!prompt.trim()} onClick={()=>void request()}>{busy?'요청 중…':'재질 변경 요청'}</button><small>1회 사용 · 강사 승인 후 원래 객체에 적용할 수 있어요.</small></div>;
}
