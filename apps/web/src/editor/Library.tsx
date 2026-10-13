import {useState} from 'react';
import {type AssetDefinition,type SceneObject} from '@coedit/contracts';
const symbols:Record<string,string>={chair:'▥',table:'⊤',tree:'♠',bench:'▰',plant:'♧',cube:'◈'};
export function Library({library,place,objects,select,selected}:{library:Record<string,AssetDefinition>;place:(id:string)=>Promise<void>;objects:SceneObject[];select:(id:string)=>Promise<void>;selected:string|null}){
  const [query,setQuery]=useState(''),[category,setCategory]=useState('전체');
  const assets=Object.values(library).filter(a=>a.name.includes(query)&&(category==='전체'||(category==='자연'?['tree','plant'].includes(a.kind):!['tree','plant'].includes(a.kind))));
  return <aside className="library panel">
    <div className="section-kicker">YOUR TOOLBOX</div><h2>에셋 라이브러리 <span className="count">{Object.keys(library).length}</span></h2>
    <label className="search"><span>⌕</span><input aria-label="에셋 검색" placeholder="어떤 에셋을 찾으세요?" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌕</kbd></label>
    <div className="tabs">{['전체','가구','자연'].map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <div className="asset-grid">{assets.map(asset=><button key={asset.id} className={'asset-card '+asset.kind} aria-label={asset.name+' 배치'} draggable onDragStart={e=>{e.dataTransfer.setData('coedit/asset',asset.id);e.dataTransfer.effectAllowed='copy';}} onDoubleClick={()=>{void place(asset.id);}}>
      <div className="asset-art"><span style={{color:asset.color}}>{symbols[asset.id]??'✧'}</span><i>＋</i></div><strong>{asset.name}</strong><small>{asset.kind==='generated'?'수업 공유 에셋':['tree','plant'].includes(asset.kind)?'자연':'가구 · 소품'}</small>
    </button>)}</div>
    {!assets.length&&<p className="muted">검색 결과가 없어요.</p>}
    {objects.length>0?<section className="scene-list"><h3>장면 개체 <span>{objects.length}</span></h3>{objects.map(o=><button key={o.id} aria-label={o.name+' 선택'} className={selected===o.id?'selected':''} onClick={()=>{void select(o.id);}}><span>◇</span>{o.name}</button>)}</section>:<div className="library-tip"><span>↗</span><div><strong>드래그로 간편하게</strong><p>마음에 드는 에셋을 공간으로<br/>끌어 놓아 보세요.</p></div></div>}
    <div className="library-bottom"><span>✧</span><div><strong>나만의 에셋</strong><p>강사 승인 후 여기에 표시됩니다</p></div></div>
  </aside>;
}
