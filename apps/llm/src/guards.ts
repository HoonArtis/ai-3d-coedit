import {isBlockedGenerationPrompt,type Op} from '../../../packages/contracts/src/index';
import type {ModelContext} from './model-port';
import type {ModelDecision} from './tools';
import type {Workflow} from './router';
/**
 * 모델 앞뒤의 결정적 규칙. 정답이 정해진 판단(선택 없음, 남의 것, 없는 대상, ID 충돌, 금칙어)은 4B 모델에 맡기지 않는다.
 * 서버가 권한·잠금을 다시 판정하므로 여기서는 학생에게 친절한 답을 주고, 고칠 수 있는 실수는 고친다.
 */
const reply=(summary:string,clarification:string|null=null):ModelDecision=>({summary,clarification,ops:[]});
const DEIXIS=/(^|[^가-힣])(이거|저거|요거|그거|이것|저것|요것|그것)|선택한/;
const TARGETED:Workflow[]=['arrange','edit','create','recommend'];
/** 2단계 전에 답이 정해지는 경우. 모델을 부르지 않는다. */
export function preflight(message:string,context:ModelContext,workflow:Workflow|null):ModelDecision|null{
 if(workflow&&TARGETED.includes(workflow)&&!context.selectedId&&DEIXIS.test(message))
  return context.clarified?reply('대상을 선택한 뒤 다시 요청해 주세요.'):reply('먼저 대상을 선택해 주세요.','어떤 에셋을 말하는지 화면에서 선택해 줄래요?');
 return null;
}
const created=(o:Op):string[]=>o.op==='place'?[o.id]:o.op==='duplicate'?[o.newId]:o.op==='arrange_around'||o.op==='scatter'?o.ids:[];
/** 바꾸는 대상. targetId·focusId는 기준일 뿐이라 남의 것이어도 된다. */
const written=(o:Op):string[]=>o.op==='place'||o.op==='arrange_around'||o.op==='scatter'?[]:'ids' in o?o.ids:'id' in o?[o.id]:[];
const referenced=(o:Op):string[]=>[...written(o),...('targetId' in o?[o.targetId]:[]),...('focusId' in o&&o.focusId?[o.focusId]:[])];
const KOREAN_COUNT:Record<string,number>={한:1,하나:1,두:2,둘:2,세:3,셋:3,네:4,넷:4,다섯:5,여섯:6,일곱:7,여덟:8,아홉:9,열:10};
/** "세 개", "6개", "두 그루"처럼 단위가 붙은 수만 읽는다. "두 배"는 개수가 아니다. */
export function requestedCount(message:string){
 const m=message.match(/(\d+|하나|한|두|둘|세|셋|네|넷|다섯|여섯|일곱|여덟|아홉|열)\s*(개|그루|대)/);
 if(!m)return null;const n=/^\d+$/.test(m[1])?Number(m[1]):KOREAN_COUNT[m[1]];return n>=1&&n<=20?n:null;
}
const PLACE_WORDS=/놔|놓|뿌려|심어|추가|더\s/;
const REDO=/다시\s*(해|하|실행)|살려|복구|되살|redo/i,UNDO=/취소|되돌|무르|undo/i,NEAR=/여기|근처|주변|이쪽/;
export function postcheck(decision:ModelDecision,message:string,context:ModelContext,workflow:Workflow|null):ModelDecision{
 const scene=context.scene.objects,known=new Set(Object.keys(scene)),rename=new Map<string,string>(),copyOf=new Map<string,string>();
 const fresh=(id:string)=>{let n=2;while(known.has(`${id}_${n}`))n++;return `${id}_${n}`;};
 const map=(id:string)=>rename.get(id)??id;
 const ops:Op[]=[],makesNew=requestedCount(message)!==null||PLACE_WORDS.test(message);
 for(const original of decision.ops){
  // op별 필드를 한 곳에서 고치므로 느슨한 타입으로 다룬 뒤 마지막에 parseDecision이 다시 검증한다.
  const o=structuredClone(original) as Op&Record<string,any>;
  // 새로 만드는 도구에 기존 물체 ID를 넣었고 문장에 새로 놓으라는 말(개수·놔·뿌려…)이 없으면 "기존 물체를 다시 놓기"로 읽는다.
  if((o.op==='arrange_around'||o.op==='scatter')&&!makesNew&&o.ids.every((id:string)=>scene[id])){ops.push({op:'arrange_nicely',ids:o.ids.map(map)});continue;}
  // 같은 요청 안에서 앞서 새로 만든 물체를 가리키면 바뀐 ID로 따라간다.
  if('id' in o&&o.op!=='place')o.id=map(o.id);
  if('targetId' in o)o.targetId=map(o.targetId);
  if('focusId' in o&&o.focusId)o.focusId=map(o.focusId);
  if('ids' in o&&o.op!=='arrange_around'&&o.op!=='scatter')o.ids=o.ids.map(map);
  // 복사본의 복사본은 원본의 복사본으로.
  if(o.op==='duplicate'&&copyOf.has(o.id))o.id=copyOf.get(o.id)!;
  // 새로 만드는 ID가 이미 있으면 새 ID를 준다.
  const remake=(id:string)=>{const next=known.has(id)?fresh(id):id;if(next!==id)rename.set(id,next);known.add(next);return next;};
  if(o.op==='place')o.id=remake(o.id);
  if(o.op==='duplicate'){o.newId=remake(o.newId);copyOf.set(o.newId,o.id);}
  if(o.op==='arrange_around'||o.op==='scatter')o.ids=o.ids.map(remake);
  if(o.op==='scatter'){
   o.min=[o.min[0],0,o.min[2]];o.max=[o.max[0],0,o.max[2]];
   const [cx,,cz]=context.cameraCenter;
   if(NEAR.test(message)&&!(o.min[0]<=cx&&cx<=o.max[0]&&o.min[2]<=cz&&cz<=o.max[2])){o.min=[cx-2,0,cz-2];o.max=[cx+2,0,cz+2];}
  }
  // 모델은 서버 순번을 모른다. 지어낸 순번은 서버가 거부하므로 지운다.
  if(o.op==='undo')delete o.expectedSeq;
  ops.push(o);
 }
 // 문장의 개수보다 적게 만들면 같은 도구로 채운다.
 const count=requestedCount(message),makers=ops.filter((o):o is Extract<Op,{op:'arrange_around'|'scatter'}>=>o.op==='arrange_around'||o.op==='scatter');
 if(count&&makers.length===1&&makers[0].ids.length<count){const base=makers[0].assetId;let k=1;while(makers[0].ids.length<count){const id=`${base}${k++}`;if(!known.has(id)){known.add(id);makers[0].ids.push(id);}}}
 const copies=ops.filter((o):o is Extract<Op,{op:'duplicate'}>=>o.op==='duplicate');
 if(count&&copies.length&&copies.length<count&&copies.every(o=>o.id===copies[0].id)){let k=1;while(copies.length<count){const id=`${copies[0].id}_copy${k++}`;if(known.has(id))continue;known.add(id);const extra={op:'duplicate' as const,id:copies[0].id,newId:id};copies.push(extra);ops.push(extra);}}
 // 되돌리기와 다시 하기는 낱말로 정해진다. "취소한 거 다시 살려"는 다시 하기다.
 if(ops.length===1&&(ops[0].op==='undo'||ops[0].op==='redo')){
  if(REDO.test(message))ops[0]={op:'redo'};else if(UNDO.test(message))ops[0]={op:'undo'};
 }
 if(ops.some(o=>(o.op==='generate'||o.op==='retexture')&&isBlockedGenerationPrompt(o.prompt))||(workflow==='create'&&isBlockedGenerationPrompt(message)))
  return reply('수업에 어울리는 물건이나 공간을 말해 주세요.');
 if(ops.some(o=>written(o).some(id=>scene[id]&&scene[id].owner!==context.actor)))
  return reply('다른 학생의 에셋은 바꿀 수 없어요. 내 에셋으로 다시 요청해 주세요.');
 const available=new Set(Object.keys(scene));
 for(const o of ops){
  if(referenced(o).some(id=>!available.has(id)))return reply('말한 대상을 찾지 못했어요. 화면에서 선택하거나 이름을 알려 주세요.');
  for(const id of created(o))available.add(id);
 }
 return {...decision,ops};
}
