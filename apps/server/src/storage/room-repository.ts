import type {Command,CommandResult} from '@coedit/contracts';
import type {RoomService} from '../rooms/room-service';
export type StoredRoom=ReturnType<RoomService['exportState']>;
export type StoredCommand={fingerprint:string;result:Extract<CommandResult,{ok:true}>};
export interface RoomRepository{
  create(state:StoredRoom):Promise<void>;
  load(roomId:string):Promise<StoredRoom|null>;
  lookup(roomId:string,actor:string,requestId:string):Promise<StoredCommand|null>;
  commit(expectedSeq:number,state:StoredRoom,command:Command,result:Extract<CommandResult,{ok:true}>):Promise<void>;
}
