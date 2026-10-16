import type {useEditor} from './use-editor';
import {RetexturePanel} from '../generation/RetexturePanel';
type Field='position'|'rotation'|'scale';
/* 화면 표시는 언리얼 방식: X 앞뒤·Y 좌우·Z 위, 위치는 cm. 저장값은 three 기준(m, Y가 위) 그대로.
   두 축을 맞바꾸면 좌표계 손잡이가 바뀌므로 회전 방향은 부호를 뒤집는다(언리얼처럼 위에서 볼 때 Z+는 시계 방향). */
const AXES=[['X',0],['Y',2],['Z',1]] as const;
const toView=(field:Field,v:number)=>field==='position'?v*100:field==='rotation'?-v*180/Math.PI:v;
const fromView=(field:Field,v:number)=>field==='position'?v/100:field==='rotation'?-v*Math.PI/180:v;
const shown=(field:Field,v:number)=>String(Number(toView(field,v).toFixed(3))+0);
export function TransformPanel({editor}:{editor:ReturnType<typeof useEditor>}){
  const object=editor.selected?editor.snapshot.objects[editor.selected]:null;
  return <section className="properties"><div className="section-kicker">OBJECT INSPECTOR</div><h2>속성 <span className="tiny-tag">{object?'선택됨':'선택 없음'}</span></h2>
    {object?<><label className="name-field">이름<input aria-label="에셋 이름" key={object.id+'-'+object.name} defaultValue={object.name} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onBlur={e=>{if(e.target.value!==object.name){const input=e.currentTarget;void editor.send([{op:'rename',id:object.id,name:input.value}]).then(result=>{if(!result?.ok)input.value=object.name;});}}}/></label>
      {(['position','rotation','scale'] as const).map((field,index)=><fieldset key={field}><legend>{['위치','회전','크기'][index]} <small>{field==='rotation'?'°':field==='position'?'cm':'배율'}</small></legend><div className="vector-inputs">{AXES.map(([axis,i])=><label key={axis}><span className={'axis-'+axis.toLowerCase()}>{axis}</span><input aria-label={['위치','회전','크기'][index]+' '+axis} key={object.id+'-'+object.revision+'-'+field+'-'+i} type="number" step={field==='rotation'?5:field==='position'?10:.1} defaultValue={shown(field,object[field][i])} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onBlur={e=>{
        const raw=e.target.value;if(!raw.trim()||!Number.isFinite(Number(raw))){e.target.value=shown(field,object[field][i]);return;}
        const value=fromView(field,Number(raw));
        if(value!==object[field][i])void editor.editTransform(object.id,field,i,value).then(result=>{if(!result?.ok)e.target.value=shown(field,object[field][i]);});
      }}/></label>)}</div></fieldset>)}
      <button className="snap-button" onClick={()=>{void editor.send([{op:'snap_to_ground',id:object.id}]);}}>바닥에 붙이기</button><div className="property-actions"><button onClick={()=>{void editor.duplicate();}}>복제</button><button className="danger" onClick={()=>{void editor.send([{op:'delete',id:object.id}]);}}>삭제</button></div>
      <RetexturePanel key={object.id} editor={editor}/>
    </>:<div className="no-selection"><span>⌖</span><p>공간의 에셋을 선택하면<br/>위치와 크기를 바꿀 수 있어요.</p></div>}
  </section>;
}
