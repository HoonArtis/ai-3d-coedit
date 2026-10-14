import {parseCommand,parseSnapshot,BUDGETS,type CommandContext,type CommandResult,type SceneSnapshot,type SceneObject} from '../../contracts/src/index';
import {canWrite,canUseAsset,CommandFailure} from './access';
export function applyCommand(input:SceneSnapshot,raw:unknown,context:CommandContext):CommandResult {
  try{
    const command=parseCommand(raw,context);
    const snapshot=structuredClone(parseSnapshot(input));
    const changed=new Set<string>();let query:SceneObject[]|undefined;
    const get=(id:string)=>{
      if(!Object.hasOwn(snapshot.objects,id))throw new CommandFailure('NOT_FOUND','에셋을 찾을 수 없어요.');
      return snapshot.objects[id];
    };
    const reserve=(id:string)=>{
      if(Object.hasOwn(snapshot.objects,id))throw new CommandFailure('ID_CONFLICT','이미 사용 중인 에셋 ID예요.');
      if(Object.keys(snapshot.objects).length>=BUDGETS.roomAssets)throw new CommandFailure('ASSET_LIMIT','방에는 에셋을 200개까지 놓을 수 있어요.');
    };
    const touch=(object:SceneObject)=>{object.revision=snapshot.seq+1;object.lastActor=context.actor;changed.add(object.id);};
    const usableAsset=(id:string)=>{
      if(!Object.hasOwn(context.library,id)||!canUseAsset(context.library[id],context))throw new CommandFailure('ASSET_UNAVAILABLE','사용할 수 없는 라이브러리 에셋이에요.');
      return context.library[id];
    };
    for(const op of command.ops){
      if(op.op==='list'||op.op==='describe_scene'||op.op==='find'){
        query=Object.values(snapshot.objects).filter(o=>op.op!=='find'||o.name.includes(op.query));continue;
      }
      if(context.role==='viewer')throw new CommandFailure('READ_ONLY','감상 모드에서는 수정할 수 없어요.');
      if(op.op==='place'){
        reserve(op.id);
        const asset=usableAsset(op.assetId);
        const object:SceneObject={id:op.id,assetId:op.assetId,owner:context.actor,name:asset.name,position:op.position,rotation:op.rotation,scale:op.scale,revision:0,lastActor:context.actor};
        snapshot.objects[op.id]=object;touch(object);continue;
      }
      if(!['move','rotate','scale','delete','duplicate','rename','replace_asset'].includes(op.op))
        throw new CommandFailure('UNSUPPORTED_OPERATION','이 명령은 담당 서비스에서 처리해야 해요.');
      if(!('id' in op))throw new CommandFailure('INVALID_COMMAND','대상 ID가 필요해요.');
      const object=get(op.id);canWrite(object,command,context);
      switch(op.op){
        case 'replace_asset':
          if(object.revision!==op.expectedRevision||snapshot.generation!==op.expectedGeneration)throw new CommandFailure('STALE_RETEXTURE','재질 요청 후 에셋이나 방이 바뀌었어요. 결과는 라이브러리에서 새로 배치할 수 있어요.');
          usableAsset(op.assetId);
          object.assetId=op.assetId;touch(object);break;
        case 'move':object.position=op.value;touch(object);break;
        case 'rotate':object.rotation=op.value;touch(object);break;
        case 'scale':object.scale=op.value;touch(object);break;
        case 'rename':object.name=op.name;touch(object);break;
        case 'delete':delete snapshot.objects[op.id];changed.add(op.id);break;
        case 'duplicate':{
          usableAsset(object.assetId);
          reserve(op.newId);
          const copy:SceneObject={...structuredClone(object),id:op.newId,owner:context.actor,name:object.name+' 복사본'};
          copy.name=copy.name.slice(0,80);
          snapshot.objects[op.newId]=copy;touch(copy);break;
        }
      }
    }
    if(changed.size)snapshot.seq++;
    return {ok:true,snapshot,changedIds:[...changed],...(query?{query}:{})};
  }catch(error){
    return {ok:false,code:error instanceof CommandFailure?error.code:'INVALID_COMMAND',message:error instanceof CommandFailure?error.message:'명령 형식 또는 인증 정보를 확인해 주세요.'};
  }
}
