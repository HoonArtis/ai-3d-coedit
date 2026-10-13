/** Shared by editor and immutable VR rooms within this server process. */
export class RoomCapacity{
 private rooms=new Map<string,Set<string>>();
 join(roomId:string,connectionId:string,counted:boolean){
  if(!counted)return;
  const members=this.rooms.get(roomId)??new Set<string>();if(members.has(connectionId))return;
  if(members.size>=5)throw Error('ROOM_FULL');members.add(connectionId);this.rooms.set(roomId,members);
 }
 leave(roomId:string,connectionId:string){const members=this.rooms.get(roomId);members?.delete(connectionId);if(!members?.size)this.rooms.delete(roomId);}
}
