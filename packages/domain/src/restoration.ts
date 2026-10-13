import {BUDGETS,parseSnapshot,objectSchema,type CommandContext,type SceneObject,type SceneSnapshot} from '@coedit/contracts';

/** Historical content is resolved by trusted storage, never supplied by the client. */
export type ResolvedRestoration={objects:Record<string,SceneObject|null>}|{snapshot:SceneSnapshot};
export function restoreScene(current:SceneSnapshot,restore:ResolvedRestoration,context:CommandContext){
  if(context.role!=='teacher')throw Error('FORBIDDEN');
  const next=structuredClone(parseSnapshot(current));
  let objects:Record<string,SceneObject|null>;
  if('snapshot' in restore){
    const historical=parseSnapshot(restore.snapshot);
    if(historical.roomId!==current.roomId)throw Error('WRONG_ROOM');
    objects=Object.fromEntries([...new Set([...Object.keys(current.objects),...Object.keys(historical.objects)])].map(id=>[id,historical.objects[id]??null]));
    next.generation++;
  }else objects=restore.objects;
  next.seq++;
  for(const [id,raw] of Object.entries(objects)){
    if(raw===null){delete next.objects[id];continue;}
    const object=objectSchema.parse(raw);
    if(id!==object.id)throw Error('INVALID_RESTORATION');
    if(!Object.hasOwn(context.library,object.assetId))throw Error('ASSET_UNAVAILABLE');
    next.objects[id]={...structuredClone(object),revision:next.seq,lastActor:context.actor};
  }
  if(Object.keys(next.objects).length>BUDGETS.roomAssets)throw Error('ASSET_LIMIT');
  return {snapshot:next,changedIds:Object.keys(objects)};
}
