import {applyCommand} from '@coedit/domain';
import {placementOps,planPlacement,recommendAssets} from '@coedit/placement';
import {canUseAsset,type Command,type CommandContext,type CommandResult,type SceneSnapshot,type Op} from '@coedit/contracts';
export function mutationTargets(ops:Op[]){
  return [...new Set(ops.flatMap(op=>
    op.op==='align_row'||op.op==='distribute'||op.op==='arrange_nicely'?op.ids:
    ['move','rotate','scale','delete','rename','duplicate','snap_to_ground','place_on','face_toward','retexture','replace_asset','restore_object'].includes(op.op)&&'id' in op?[op.id]:[]))];
}
export function applyExpandedCommand(snapshot:SceneSnapshot,command:Command,context:CommandContext):CommandResult{
  const recommend=command.ops.find(op=>op.op==='recommend');
  if(recommend){
    // 추천은 씬을 바꾸지 않는 조회다. 학생이 쓸 수 있는 에셋만 권한다.
    if(command.ops.length!==1)return {ok:false,code:'SINGLE_RECOMMEND_REQUIRED',message:'추천은 다른 편집과 나눠서 요청해 주세요.'};
    try{return {ok:true,snapshot:structuredClone(snapshot),changedIds:[],suggestions:recommendAssets(snapshot,context.library,recommend.focusId,asset=>canUseAsset(asset,context))};}
    catch{return {ok:false,code:'NOT_FOUND',message:'추천 기준 에셋을 찾을 수 없어요.'};}
  }
  if(!command.ops.some(op=>placementOps.has(op.op)))return applyCommand(snapshot,command,context);
  let working=snapshot;const expanded:Op[]=[];
  for(const op of command.ops){
    let ops:Op[]=[op];
    if(placementOps.has(op.op)){
      const result=planPlacement(op,working,context.library);
      if(!result.ok)return {ok:false,code:result.code,message:'배치할 공간이나 대상을 확인해 주세요. '+result.code};
      ops=result.ops;
    }
    if(!ops.length)continue;
    const preview=applyCommand(working,{...command,ops},context);
    if(!preview.ok)return preview;working=preview.snapshot;expanded.push(...ops);
  }
  if(!expanded.length)return {ok:true,snapshot:structuredClone(snapshot),changedIds:[]};
  return applyCommand(snapshot,{...command,ops:expanded},context);
}
