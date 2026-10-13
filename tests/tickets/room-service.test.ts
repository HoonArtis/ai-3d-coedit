import {test,expect} from 'vitest';
import {RoomService} from '../../apps/server/src/rooms/room-service';
import {context, command} from '../fixtures/scene';
const setup=()=>{
  let now=1000;const room=new RoomService('room',context.library,()=>now);
  room.join('a',{actor:'alice',role:'student'});room.join('t',{actor:'teacher',role:'teacher'});
  const send=(ops:unknown[],id='request',client='a',tokens:Record<string,string>={})=>room.submit(client,command(ops,{requestId:id,actor:client==='t'?'teacher':'alice',source:client==='t'?'teacher':'gizmo',lockTokens:tokens}));
  return {room,send,advance:()=>{now+=31000;room.expireLocks();}};
};
test('counts students and VR viewers together but exempts teachers',()=>{
  const {room}=setup();for(let i=0;i<4;i++)room.join('s'+i,{actor:'s'+i,role:i===3?'viewer':'student'});
  expect(()=>room.join('extra',{actor:'extra',role:'student'})).toThrow('ROOM_FULL');
  expect(()=>room.join('t2',{actor:'t2',role:'teacher'})).not.toThrow();
});
test('duplicate request returns original result and different payload conflicts',()=>{
  const {room,send}=setup();const op={op:'place',id:'o',assetId:'chair',position:[0,0,0]};
  expect(send([op])).toEqual(send([op]));expect(room.snapshot.seq).toBe(1);
  expect(send([{...op,id:'different'}]).ok).toBe(false);
  expect(room.submit('a',command([{op:'list'}],{actor:'teacher'})).ok).toBe(false);
});
test('locks are atomic and force unlock invalidates old token',()=>{
  const {room,send}=setup();send([{op:'place',id:'o',assetId:'chair',position:[0,0,0]}]);
  send([{op:'lock',ids:['o']}],'lock');const token=room.locks.o.token;
  expect(send([{op:'lock',ids:['o','missing']}],'badlock','t').ok).toBe(false);
  expect(room.locks.o.owner).toBe('alice');
  send([{op:'force_unlock',ids:['o']}],'force','t');
  send([{op:'lock',ids:['o']}],'lock2');
  expect(room.locks.o.token).not.toBe(token);
  expect(send([{op:'move',id:'o',value:[2,0,0]}],'late','a',{o:token}).ok).toBe(false);
});
test('disconnect and heartbeat timeout release only session-owned locks',()=>{
  const {room,send,advance}=setup();send([{op:'place',id:'o',assetId:'chair',position:[0,0,0]}]);
  send([{op:'lock',ids:['o']}],'lock');advance();expect(room.locks).toEqual({});
  send([{op:'lock',ids:['o']}],'lock2');room.leave('a');expect(room.locks).toEqual({});
});
test('undo and redo restore one request and do not overwrite teacher changes',()=>{
  const {room,send}=setup();
  send([{op:'place',id:'o',assetId:'chair',position:[0,0,0]},{op:'place',id:'p',assetId:'chair',position:[2,0,0]}]);
  expect(send([{op:'undo'}],'undo').ok).toBe(true);expect(Object.keys(room.snapshot.objects)).toHaveLength(0);
  expect(send([{op:'redo'}],'redo').ok).toBe(true);expect(Object.keys(room.snapshot.objects)).toHaveLength(2);
  send([{op:'lock',ids:['o']}],'teacherLock','t');const token=room.locks.o.token;
  send([{op:'move',id:'o',value:[5,0,0]}],'teacherMove','t',{o:token});
  expect(send([{op:'undo'}],'undo2').ok).toBe(false);
  expect(room.snapshot.objects.o.position).toEqual([5,0,0]);
});
test('preview validates current lease but never records a command',()=>{
  const {room,send}=setup();send([{op:'place',id:'o',assetId:'chair',position:[0,0,0]}]);send([{op:'lock',ids:['o']}],'lock');
  const preview={id:'o',token:room.locks.o.token,position:[3,0,0],rotation:[0,0,0],scale:[1,1,1]};
  expect(room.preview('a',preview)).toBeTruthy();expect(room.snapshot.seq).toBe(1);expect(room.snapshot.objects.o.position).toEqual([0,0,0]);
  room.leave('a');expect(room.preview('a',preview)).toBeNull();
});
test('consecutive undo and redo on the same object preserve the whole chain',()=>{
  const {room,send}=setup();
  send([{op:'place',id:'o',assetId:'chair',position:[0,0,0]}],'create');
  send([{op:'lock',ids:['o']}],'lock');
  send([{op:'move',id:'o',value:[2,0,0]}],'move','a',{o:room.locks.o.token});
  expect(send([{op:'undo'}],'undoMove').ok).toBe(true);
  expect(send([{op:'redo'}],'redoMove').ok).toBe(true);
  expect(room.snapshot.objects.o.position).toEqual([2,0,0]);
  expect(send([{op:'undo'}],'undoAgain').ok).toBe(true);
  expect(send([{op:'undo'}],'undoCreate').ok).toBe(true);
  expect(room.snapshot.objects).toEqual({});
  expect(send([{op:'redo'}],'redoCreate').ok).toBe(true);
  expect(send([{op:'redo'}],'redoAgain').ok).toBe(true);
  expect(room.snapshot.objects.o.position).toEqual([2,0,0]);
});

test('lock contention is session scoped, batch acquisition and failed ops leave no partial state',()=>{
  const {room,send}=setup();
  send([{op:'place',id:'o',assetId:'chair',position:[0,0,0]},{op:'place',id:'p',assetId:'chair',position:[2,0,0]}]);
  room.join('b',{actor:'alice',role:'student'});
  send([{op:'lock',ids:['o']}],'lock');
  expect(room.submit('b',command([{op:'lock',ids:['p','o']}],{requestId:'bLock'})).ok).toBe(false);
  expect(room.locks.p).toBeUndefined();
  room.submit('b',command([{op:'unlock',ids:['o']}],{requestId:'bUnlock'}));
  expect(room.locks.o).toBeDefined();
  const before=structuredClone(room.snapshot);
  const failed=send([{op:'move',id:'o',value:[4,0,0]},{op:'delete',id:'missing'}],'failed','a',{o:room.locks.o.token});
  expect(failed.ok).toBe(false);expect(room.snapshot).toEqual(before);
  expect(send([{op:'undo'}],'undo').ok).toBe(true);expect(room.snapshot.objects).toEqual({});
});
test('old session cleanup cannot release a new session lease',()=>{
  const {room,send}=setup();send([{op:'place',id:'o',assetId:'chair',position:[0,0,0]}]);
  send([{op:'lock',ids:['o']}],'lock');room.drop('a');
  room.join('b',{actor:'alice',role:'student'});
  room.submit('b',command([{op:'lock',ids:['o']}],{requestId:'bLock'}));
  const token=room.locks.o.token;room.leave('a');expect(room.locks.o.token).toBe(token);
});
test('new edits invalidate own redo and repeated previews do not add undo entries',()=>{
  const {room,send}=setup();send([{op:'place',id:'o',assetId:'chair',position:[0,0,0]}]);
  send([{op:'lock',ids:['o']}],'lock');
  for(let i=0;i<100;i++)room.preview('a',{id:'o',token:room.locks.o.token,position:[i,0,0],rotation:[0,0,0],scale:[1,1,1]});
  expect(room.snapshot.seq).toBe(1);
  send([{op:'undo'}],'undo');expect(room.snapshot.objects).toEqual({});
  send([{op:'place',id:'new',assetId:'chair',position:[0,0,0]}],'new');
  expect(send([{op:'redo'}],'redo').ok).toBe(false);
});

test('redo cannot overwrite a teacher edit after undo',()=>{
  const {room,send}=setup();send([{op:'place',id:'o',assetId:'chair',position:[0,0,0]}]);
  send([{op:'lock',ids:['o']}],'lock');
  send([{op:'move',id:'o',value:[1,0,0]}],'move','a',{o:room.locks.o.token});
  send([{op:'undo'}],'undo');
  send([{op:'force_unlock',ids:['o']}],'force','t');send([{op:'lock',ids:['o']}],'teacherLock','t');
  send([{op:'move',id:'o',value:[4,0,0]}],'teacherMove','t',{o:room.locks.o.token});
  send([{op:'unlock',ids:['o']}],'teacherUnlock','t');
  expect(send([{op:'redo'}],'redo').ok).toBe(false);
  expect(room.snapshot.objects.o.position).toEqual([4,0,0]);
});

test('chat undo is guarded by its original seq and cannot undo a newer gizmo action',()=>{
 const {room,send}=setup();send([{op:'place',id:'a',assetId:'chair',position:[0,0,0]}],'chat');send([{op:'place',id:'b',assetId:'chair',position:[1,0,0]}],'gizmo');
 const before=room.exportState();expect(send([{op:'undo',expectedSeq:1}],'oldChat')).toMatchObject({ok:false,code:'HISTORY_NOT_LATEST'});expect(room.exportState()).toEqual(before);
 expect(send([{op:'undo',expectedSeq:2}],'latest')).toMatchObject({ok:true});expect(Object.keys(room.snapshot.objects)).toEqual(['a']);expect(send([{op:'undo',expectedSeq:1}],'chatNow')).toMatchObject({ok:true});expect(room.snapshot.objects).toEqual({});
});
