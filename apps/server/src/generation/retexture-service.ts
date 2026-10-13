import {parseCommand,type Session} from '@coedit/contracts';
import type {RoomService} from '../rooms/room-service';
import type {GenerationRepository} from './repository';
type SourceProvider={retextureSource(scope:Session&{roomKey:string},assetId:string):Promise<{shapeKey:string;imageKey?:string}>};
export class RetextureService{
 constructor(private repository:GenerationRepository,private assets:SourceProvider){}
 async request(room:RoomService,clientId:string,raw:unknown){
  const session=room.getSession(clientId),command=parseCommand(raw,session),op=command.ops[0];
  if(command.ops.length!==1||op.op!=='retexture')throw Error('SINGLE_RETEXTURE_REQUIRED');
  if(session.role!=='student')throw Error('FORBIDDEN');
  const {object,generation}=room.inspectMutation(clientId,command,op.id),scope={...session,roomKey:room.snapshot.roomId};
  const source=await this.assets.retextureSource(scope,object.assetId);
  // TG2MV conditions on the existing geometry and new material description; no old colour reference.
  return this.repository.reserveRetexture(scope,generation,{requestId:command.requestId,source:{kind:'text',prompt:op.prompt}},{shapeKey:source.shapeKey,target:{objectId:object.id,revision:object.revision,generation,assetId:object.assetId}});
 }
}
