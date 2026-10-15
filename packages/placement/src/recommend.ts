import type {AssetDefinition,SceneObject,SceneSnapshot,Suggestion} from '@coedit/contracts';
import {boundsOf} from './geometry';
import {roleOf,footprint,distanceXZ,GENERATE_IDEAS,type Role} from './relations';
/**
 * "어울리는 에셋 추천": relations.ts 규칙으로 빠진 짝을 찾아 라이브러리 에셋을 먼저, 모자라면 생성 아이디어를 채워 3개를 돌려준다.
 * focusId가 있으면 그 물체와 어울리는 것만 본다. library는 씬을 읽는 데 쓰고, 권하는 에셋은 usable을 통과한 것만 고른다. 씬을 바꾸지 않는다.
 */
export function recommendAssets(scene:SceneSnapshot,library:Record<string,AssetDefinition>,focusId?:string,usable:(asset:AssetDefinition)=>boolean=()=>true,limit=3):Suggestion[]{
  if(focusId&&!Object.hasOwn(scene.objects,focusId))throw Error('NOT_FOUND');
  const role=(o:SceneObject)=>roleOf(library[o.assetId]);
  const objects=Object.values(scene.objects).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const focus=focusId?scene.objects[focusId]:undefined;
  const near=(o:SceneObject,r:Role,within:number)=>objects.filter(x=>x.id!==o.id&&role(x)===r&&distanceXZ(x.position,o.position)<=within);
  // 같은 역할이면 학생이 만든 생성 에셋을 기본 에셋보다 먼저 권한다. 캐릭터는 추천하지 않는다.
  const assetFor=(r:Role)=>Object.values(library).filter(a=>roleOf(a)===r&&!a.character&&usable(a)).sort((a,b)=>Number(b.kind==='generated')-Number(a.kind==='generated')||(a.id<b.id?-1:1))[0];
  const out:Suggestion[]=[],seen=new Set<string>();
  const add=(r:Role,reason:string,nearId?:string)=>{
    const a=assetFor(r);if(!a||seen.has(a.id)||out.length>=limit)return;
    seen.add(a.id);out.push({kind:'place',assetId:a.id,name:a.name,reason,...(nearId?{nearId}:{})});
  };
  const scope=focus?[focus]:objects;
  for(const o of scope){
    const r=role(o),reach=footprint(o,library[o.assetId])+2;
    if(r==='table'){
      if(near(o,'chair',reach).length<2)add('chair','탁자에 둘러앉을 의자가 있으면 좋아요',o.id);
      const top=boundsOf(o,library[o.assetId]).max[1];
      if(!objects.some(x=>role(x)==='plant'&&Math.abs(x.position[1]-top)<.05&&distanceXZ(x.position,o.position)<=footprint(o,library[o.assetId])))add('plant','탁자 위에 화분 하나가 잘 어울려요',o.id);
    }
    if(r==='tree'&&!near(o,'bench',reach+1).length)add('bench','나무 앞에 앉아 쉴 벤치를 두면 어울려요',o.id);
    if(r==='bench'&&!near(o,'tree',4).length)add('tree','벤치 곁에 그늘이 될 나무가 어울려요',o.id);
    if(r==='chair'&&!near(o,'table',3).length)add('table','의자 앞에 탁자가 있으면 모여 앉기 좋아요',o.id);
  }
  if(!focus&&objects.filter(o=>role(o)==='plant').length<2)add('plant','화분 몇 개로 빈 곳을 채우면 생기가 돌아요');
  // 짝이 다 갖춰졌으면 새로 만들 거리를 권한다. 가장 많은 역할을 기준으로 고른다.
  if(out.length<limit){
    const counts=new Map<Role,number>();for(const o of scope)counts.set(role(o),(counts.get(role(o))??0)+1);
    const top=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];
    const ideas=[top?GENERATE_IDEAS[top]:GENERATE_IDEAS.empty,...(top?[]:[GENERATE_IDEAS.plant])];
    for(const idea of ideas)if(out.length<limit&&!out.some(s=>s.kind==='generate'))out.push({kind:'generate',...idea});
  }
  return out;
}
