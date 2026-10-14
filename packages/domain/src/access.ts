import type {Command,CommandContext,SceneObject} from '../../contracts/src/index';
export {canUseAsset} from '../../contracts/src/index';
export class CommandFailure extends Error {
  code:string;
  constructor(code:string,message:string){super(message);this.code=code;}
}
export function canWrite(object:SceneObject,command:Command,context:CommandContext){
  if(context.role==='viewer'||(context.role!=='teacher'&&object.owner!==context.actor))
    throw new CommandFailure('FORBIDDEN','다른 학생의 에셋은 수정할 수 없어요.');
  const lease=Object.hasOwn(context.locks,object.id)?context.locks[object.id]:undefined;
  if(!lease||lease.owner!==context.actor||command.lockTokens[object.id]!==lease.token)
    throw new CommandFailure('LOCK_REQUIRED','선택 잠금이 만료되었어요. 다시 선택해 주세요.');
}
