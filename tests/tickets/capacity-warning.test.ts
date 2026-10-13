import {test,expect} from 'vitest';import {BUILTIN_LIBRARY,roomCapacityMessage} from '@coedit/contracts';import {RoomService} from '../../apps/server/src/rooms/room-service';
test('capacity warning starts at 90 percent and states remaining places',()=>{expect(roomCapacityMessage(179)).toBeNull();expect(roomCapacityMessage(180)).toContain('20개');expect(roomCapacityMessage(200)).toContain('가득');});
test('200 is accepted while manual placement, duplicate and AI batch cannot add the 201st',()=>{
 const room=new RoomService('room',BUILTIN_LIBRARY);room.join('s',{actor:'student',role:'student'});let n=0;const send=(ops:unknown[])=>room.submit('s',{actor:'student',source:'chat',requestId:'r'+(++n),ops});
 expect(send(Array.from({length:200},(_,i)=>({op:'place',id:'o'+i,assetId:'cube',position:[i*2,0,0]}))).ok).toBe(true);const before=room.exportState();
 for(const ops of [[{op:'place',id:'extra',assetId:'cube',position:[0,0,0]}],[{op:'duplicate',id:'o0',newId:'copy'}],[{op:'move',id:'o0',value:[0,3,0]},{op:'arrange_around',targetId:'o1',assetId:'chair',ids:['extra'],radius:2}]]){expect(send(ops)).toMatchObject({ok:false,code:'ASSET_LIMIT'});expect(room.exportState()).toEqual(before);}
});
