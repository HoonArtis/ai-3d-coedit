import {applyCommand} from '@coedit/domain';
import {placementOps,planPlacement} from '@coedit/placement';
import type {Command,CommandContext,CommandResult,SceneSnapshot,Op} from '@coedit/contracts';
export function mutationTargets(ops:Op[]){
  return [...new Set(ops.flatMap(op=>
    op.op==='align_row'||op.op==='distribute'?op.ids:
    ['move','rotate','scale','delete','rename','duplicate','snap_to_ground','place_on','face_toward','retexture','replace_asset','restore_object'].includes(op.op)&&'id' in op?[op.id]:[]))];
}
export function applyExpandedCommand(snapshot:SceneSnapshot,command:Command,context:CommandContext):CommandResult{
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
