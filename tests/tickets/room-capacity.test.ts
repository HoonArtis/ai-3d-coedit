import {test,expect} from 'vitest';
import {RoomCapacity} from '../../apps/server/src/rooms/capacity';
test('editor and viewing seats share five slots per logical room with idempotent releases',()=>{
 const capacity=new RoomCapacity();for(let i=0;i<4;i++)capacity.join('room','editor-'+i,true);capacity.join('room','teacher',false);capacity.join('room','viewer',true);
 expect(()=>capacity.join('room','extra',true)).toThrow('ROOM_FULL');capacity.join('room','viewer',true);capacity.leave('room','editor-0');capacity.leave('room','editor-0');capacity.join('room','extra',true);
 expect(()=>capacity.join('room','extra2',true)).toThrow('ROOM_FULL');expect(()=>capacity.join('other','extra2',true)).not.toThrow();
});
