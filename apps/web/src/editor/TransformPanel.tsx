import type {useEditor} from './use-editor';
import {RetexturePanel} from '../generation/RetexturePanel';
export function TransformPanel({editor}:{editor:ReturnType<typeof useEditor>}){
  const object=editor.selected?editor.snapshot.objects[editor.selected]:null;
  return <section className="properties"><div className="section-kicker">OBJECT INSPECTOR</div><h2>속성 <span className="tiny-tag">{object?'선택됨':'선택 없음'}</span></h2>
    {object?<><label className="name-field">이름<input aria-label="에셋 이름" key={object.id+'-'+object.name} defaultValue={object.name} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onBlur={e=>{if(e.target.value!==object.name){const input=e.currentTarget;void editor.send([{op:'rename',id:object.id,name:input.value}]).then(result=>{if(!result?.ok)input.value=object.name;});}}}/></label>
      {(['position','rotation','scale'] as const).map((field,index)=><fieldset key={field}><legend>{['위치','회전','크기'][index]} <small>{field==='rotation'?'°':field==='position'?'m':'배율'}</small></legend><div className="vector-inputs">{['X','Y','Z'].map((axis,i)=><label key={axis}><span className={'axis-'+axis.toLowerCase()}>{axis}</span><input aria-label={['위치','회전','크기'][index]+' '+axis} key={object.id+'-'+object.revision+'-'+field+'-'+i} type="number" step={field==='rotation'?5:.1} defaultValue={Number((field==='rotation'?object[field][i]*180/Math.PI:object[field][i]).toFixed(3))} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onBlur={e=>{
        const raw=e.target.value;if(!raw.trim()||!Number.isFinite(Number(raw))){e.target.value=String(field==='rotation'?object[field][i]*180/Math.PI:object[field][i]);return;}
        const value=field==='rotation'?Number(raw)*Math.PI/180:Number(raw);
        if(value!==object[field][i])void editor.editTransform(object.id,field,i,value).then(result=>{if(!result?.ok)e.target.value=String(field==='rotation'?object[field][i]*180/Math.PI:object[field][i]);});
      }}/></label>)}</div></fieldset>)}
      <button className="snap-button" onClick={()=>{void editor.send([{op:'snap_to_ground',id:object.id}]);}}>바닥에 붙이기</button><div className="property-actions"><button onClick={()=>{void editor.duplicate();}}>복제</button><button className="danger" onClick={()=>{void editor.send([{op:'delete',id:object.id}]);}}>삭제</button></div>
      <RetexturePanel key={object.id} editor={editor}/>
    </>:<div className="no-selection"><span>⌖</span><p>공간의 에셋을 선택하면<br/>위치와 크기를 바꿀 수 있어요.</p></div>}
  </section>;
}
