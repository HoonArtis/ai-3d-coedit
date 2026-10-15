import {applyExpandedCommand,mutationTargets} from '../../apps/server/src/rooms/expand-command';
import {boundsOf,overlaps} from '../../packages/placement/src/geometry';
import {BUILTIN_LIBRARY,type Command,type SceneSnapshot,type SceneObject,type AssetDefinition} from '../../packages/contracts/src/index';
import type {ModelDecision} from '../../apps/llm/src/tools';
import type {ModelContext} from '../../apps/llm/src/model-port';
/** 서버가 채팅 명령에 하는 것과 같게 씬 복사본에 시험 적용한다(연습장). 생성·기록·잠금 op는 다른 서비스 담당이라 시뮬레이션하지 않는다. */
const NOT_SIMULATED=new Set(['generate','retexture','upload_character','replace_asset','undo','redo','lock','unlock']);
export type Simulation={skipped:true}|{skipped:false;ok:true;before:SceneSnapshot;after:SceneSnapshot;library:Record<string,AssetDefinition>}|{skipped:false;ok:false;code:string};
export function simulate(ctx:ModelContext,d:ModelDecision):Simulation{
 if(d.ops.some(o=>NOT_SIMULATED.has(o.op)))return {skipped:true};
 const library=ctx.library??BUILTIN_LIBRARY;
 // 서버(room-service)처럼 기존 내 물체와, 같은 명령에서 새로 만들어 바로 다루는 물체에 잠금을 준다.
 const mine=[...new Set([...Object.values(ctx.scene.objects).filter(o=>o.owner===ctx.actor).map(o=>o.id),...mutationTargets(d.ops).filter(id=>!ctx.scene.objects[id])])];
 const command={version:1,actor:ctx.actor,source:'chat',requestId:'eval',ops:d.ops,lockTokens:Object.fromEntries(mine.map(id=>[id,'eval']))} as Command;
 const result=applyExpandedCommand(ctx.scene,command,{actor:ctx.actor,role:'student',library,locks:Object.fromEntries(mine.map(id=>[id,{owner:ctx.actor,token:'eval'}]))});
 return result.ok?{skipped:false,ok:true,before:ctx.scene,after:result.snapshot,library}:{skipped:false,ok:false,code:result.code};
}
/** 서로 파고드는 물체 쌍의 수. 위에 올려놓은 것(면 접촉)은 겹침이 아니다. */
export function overlapPairs(scene:SceneSnapshot,library:Record<string,AssetDefinition>){
 const boxes=Object.values(scene.objects).map(o=>boundsOf(o,library[o.assetId]));let n=0;
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(overlaps(boxes[i],boxes[j]))n++;
 return n;
}
const ON_FLOOR=50;
/** 스냅샷을 다시 읽으면 필드 순서가 바뀌므로 보이는 속성만 비교한다(revision 등 기록 필드 제외). */
export const sameObject=(a:SceneObject|undefined,b:SceneObject|undefined)=>!!a&&!!b&&(['assetId','name','owner','position','rotation','scale'] as const).every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]));
/** "이쁘게/정리/꾸며" 같은 정답 좌표 없는 요청의 공통 합격 조건. */
export function decoratesWell(ctx:ModelContext,d:ModelDecision,extra?:(after:SceneSnapshot,before:SceneSnapshot)=>boolean){
 const sim=simulate(ctx,d);
 if(sim.skipped||!sim.ok||!d.ops.length)return false;
 const {before,after,library}=sim;
 const foreign=Object.values(before.objects).filter(o=>o.owner!==ctx.actor);
 if(foreign.some(o=>!sameObject(after.objects[o.id],o)))return false;
 if(Object.keys(before.objects).some(id=>!after.objects[id]))return false;
 if(overlapPairs(after,library)>overlapPairs(before,library))return false;
 if(Object.values(after.objects).some(o=>Math.abs(o.position[0])>ON_FLOOR||Math.abs(o.position[2])>ON_FLOOR))return false;
 if(Object.keys(after.objects).length===Object.keys(before.objects).length&&Object.values(before.objects).every(o=>sameObject(after.objects[o.id],o)))return false;
 return !extra||extra(after,before);
}
