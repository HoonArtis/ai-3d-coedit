import {test,expect} from 'vitest';
import {BUILTIN_LIBRARY} from '@coedit/contracts';
import {RoomService} from '../../apps/server/src/rooms/room-service';
import {command} from '../fixtures/scene';
const setup=()=>{const room=new RoomService('room',BUILTIN_LIBRARY);room.join('a',{actor:'alice',role:'student'});return room;};
test('four chairs become one atomic server command and one undo',()=>{
  const room=setup();room.submit('a',command([{op:'place',id:'table',assetId:'table',position:[0,0,0]}]));
  const result=room.submit('a',command([{op:'arrange_around',targetId:'table',assetId:'chair',ids:['a','b','c','d'],radius:2}],{source:'chat',requestId:'arrange'}));
  expect(result.ok).toBe(true);expect(room.snapshot.seq).toBe(2);expect(Object.keys(room.snapshot.objects)).toHaveLength(5);
  expect(room.submit('a',command([{op:'undo'}],{source:'chat',requestId:'undo'})).ok).toBe(true);
  expect(Object.keys(room.snapshot.objects)).toEqual(['table']);
});
test('chat obtains temporary locks atomically but cannot modify someone else or leave partial placement',()=>{
  const room=setup();room.join('b',{actor:'bob',role:'student'});
  room.submit('a',command([{op:'place',id:'a',assetId:'cube',position:[0,0,0]},{op:'place',id:'p',assetId:'cube',position:[3,0,0]}]));
  expect(room.submit('a',command([{op:'align_row',ids:['a','p'],axis:'x',spacing:2}],{source:'chat',requestId:'align'})).ok).toBe(true);
  expect(room.snapshot.objects.p.position).toEqual([2,0,0]);expect(room.locks).toEqual({});
  room.submit('b',command([{op:'place',id:'b',assetId:'cube',position:[7,0,0]}],{actor:'bob',requestId:'bob'}));
  const before=structuredClone(room.snapshot);
  expect(room.submit('a',command([{op:'place',id:'new',assetId:'cube',position:[10,0,0]},{op:'align_row',ids:['a','b'],axis:'x',spacing:2}],{source:'chat',requestId:'forbidden'})).ok).toBe(false);
  expect(room.snapshot).toEqual(before);expect(room.locks).toEqual({});
});

test('a chat request can create then transform its own new object atomically',()=>{
  const room=setup();
  const result=room.submit('a',command([{op:'place',id:'a',assetId:'cube',position:[0,0,0]},{op:'move',id:'a',value:[2,0,0]}],{source:'chat'}));
  expect(result.ok).toBe(true);expect(room.snapshot.seq).toBe(1);expect(room.snapshot.objects.a.position).toEqual([2,0,0]);expect(room.locks).toEqual({});
});
test('automatic placement cannot exceed the shared asset limit',()=>{
  const room=setup();
  const placed=room.submit('a',command(Array.from({length:200},(_,i)=>({op:'place',id:'o'+i,assetId:'cube',position:[i*2,0,0]}))));
  expect(placed.ok).toBe(true);const before=structuredClone(room.snapshot);
  const result=room.submit('a',command([{op:'arrange_around',targetId:'o0',assetId:'chair',ids:['new'],radius:3}],{source:'chat',requestId:'overflow'}));
  expect(result.ok).toBe(false);expect(room.snapshot).toEqual(before);
});
