import {parseCommand,type CommandResult} from '@coedit/contracts';
import type {RoomService} from '../rooms/room-service';
import type {ImageService} from './image-service';
import type {RetextureService} from './retexture-service';
/** Generation starts work; only an approved artifact's later place command mutates a scene. */
export async function generationCommand(room:RoomService,clientId:string,raw:unknown,images?:ImageService,retexture?:RetextureService):Promise<CommandResult|undefined>{
 try{
  const session=room.getSession(clientId),command=parseCommand(raw,session);
  if(command.expectedGeneration!==undefined&&command.expectedGeneration!==room.snapshot.generation)throw Error('SCENE_RESTORED');
  if(command.ops.some(op=>op.op==='retexture')){
   if(!retexture)throw Error('RETEXTURE_UNAVAILABLE');await retexture.request(room,clientId,command);
   return {ok:true,snapshot:structuredClone(room.snapshot),changedIds:[]};
  }
  if(!command.ops.some(op=>op.op==='generate'))return;
  if(command.ops.length!==1)throw Error('SINGLE_GENERATION_REQUIRED');
  if(!images)throw Error('GENERATION_UNAVAILABLE');
  const op=command.ops[0];if(op.op!=='generate')throw Error('INVALID_GENERATION');
  await images.text({...session,roomKey:room.snapshot.roomId},room.snapshot.generation,command.requestId,op.prompt);
  return {ok:true,snapshot:structuredClone(room.snapshot),changedIds:[]};
 }catch(error){const code=error instanceof Error?error.message:'GENERATION_FAILED';return {ok:false,code,message:generationMessage(code)};}
}
export function generationMessage(code:string){return ({JOB_PROCESSING:'이미 작업이 시작되어 대기 취소할 수 없어요. 완료 후 숨기거나 삭제해 주세요.',CANNOT_CANCEL:'대기 중인 작업만 취소할 수 있어요.',IMAGE_IN_USE:'3D 제작에 사용된 이미지는 숨기기만 할 수 있어요.',SCENE_RESTORED:'작품이 복원되어 이전 요청을 취소했어요. 새 작품에서 다시 요청해 주세요.',GENERATION_LIMIT:'이번 수업의 생성 횟수를 모두 사용했어요.',PROMPT_BLOCKED:'수업에 적합한 물건이나 공간을 설명해 주세요.',SINGLE_GENERATION_REQUIRED:'생성 요청은 다른 편집과 나눠서 보내 주세요.',STALE_IMAGE:'이미지가 바뀌었어요. 최신 이미지를 확인해 주세요.',IMAGE_NOT_READY:'이미지가 준비된 뒤 확인해 주세요.',ALREADY_CONFIRMED:'이미 확인한 이미지는 다시 그릴 수 없어요.',FORBIDDEN:'생성 작업에 접근할 수 없어요.'} as Record<string,string>)[code]??'생성 요청을 처리하지 못했어요.';}
