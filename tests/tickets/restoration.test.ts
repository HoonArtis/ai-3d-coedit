import {test,expect} from 'vitest';
import {RoomService} from '../../apps/server/src/rooms/room-service';
import {BUILTIN_LIBRARY,emptyScene} from '@coedit/contracts';
const setup=()=>{const room=new RoomService('room',BUILTIN_LIBRARY);room.join('s',{actor:'student',role:'student'});room.join('t',{actor:'teacher',role:'teacher'});let n=0;const send=(client:string,ops:unknown[],restore?:any)=>room.submit(client,{actor:client==='s'?'student':'teacher',source:client==='s'?'chat':'teacher',requestId:'r'+(++n),ops},restore);return {room,send};};
test('restoration checks leases and invalidates related undo and redo for every actor',()=>{
 const {room,send}=setup();send('s',[{op:'place',id:'a',assetId:'cube',position:[0,0,0]}]);const historical=structuredClone(room.snapshot.objects.a);
 send('s',[{op:'move',id:'a',value:[5,0,0]}]);send('s',[{op:'undo'}]);send('s',[{op:'lock',ids:['a']}]);
 const before=room.exportState();expect(send('t',[{op:'restore_object',id:'a',revision:1}],{objects:{a:historical}})).toMatchObject({ok:false,code:'LOCKED'});expect(room.exportState()).toEqual(before);
 send('t',[{op:'force_unlock',ids:['a']}]);expect(send('t',[{op:'restore_object',id:'a',revision:1}],{objects:{a:historical}}).ok).toBe(true);
 expect(room.snapshot.objects.a.owner).toBe('student');expect(room.snapshot.objects.a.lastActor).toBe('teacher');expect(room.locks).toEqual({});expect(send('s',[{op:'redo'}])).toMatchObject({ok:false,code:'HISTORY_EMPTY'});expect(send('s',[{op:'undo'}])).toMatchObject({ok:false,code:'HISTORY_EMPTY'});
});
test('whole snapshot restoration also removes redo entries for currently absent objects',()=>{
 const {room,send}=setup();send('s',[{op:'place',id:'a',assetId:'cube',position:[0,0,0]}]);send('s',[{op:'undo'}]);
 expect(send('t',[{op:'restore_snapshot',snapshotId:'seq-0'}],{snapshot:emptyScene('room')})).toMatchObject({ok:true,snapshot:{seq:3,generation:1}});expect(send('s',[{op:'redo'}])).toMatchObject({ok:false,code:'HISTORY_EMPTY'});
});
test('client cannot supply historical content, mix mutations, or restore as a student',()=>{
 const {room,send}=setup();expect(send('t',[{op:'restore_object',id:'a',revision:1}])).toMatchObject({ok:false,code:'RESTORATION_UNAVAILABLE'});
 expect(send('s',[{op:'restore_object',id:'a',revision:1}],{objects:{a:null}})).toMatchObject({ok:false,code:'FORBIDDEN'});
 expect(send('t',[{op:'restore_object',id:'a',revision:1},{op:'place',id:'b',assetId:'cube',position:[0,0,0]}],{objects:{a:null}}).ok).toBe(false);
 expect(send('t',[{op:'restore_object',id:'a',revision:1}],{objects:{b:null}}).ok).toBe(false);expect(room.snapshot.seq).toBe(0);
});

test('restoring the 201st asset preserves scene, generation, history and current leases',()=>{
 const {room,send}=setup();expect(send('s',Array.from({length:200},(_,i)=>({op:'place',id:'o'+i,assetId:'cube',position:[0,0,0]}))).ok).toBe(true);
 send('t',[{op:'lock',ids:['o0']}]);const before=room.exportState(),locks=structuredClone(room.locks),object={...room.snapshot.objects.o0,id:'overflow'};
 expect(send('t',[{op:'restore_object',id:'overflow',revision:1}],{objects:{overflow:object}})).toMatchObject({ok:false,code:'ASSET_LIMIT'});expect(room.exportState()).toEqual(before);expect(room.locks).toEqual(locks);
});

test('successful restoration keeps the restoring teacher selection lease when its object survives',()=>{
 const {room,send}=setup();send('s',[{op:'place',id:'a',assetId:'cube',position:[0,0,0]}]);send('t',[{op:'lock',ids:['a']}]);const lease=structuredClone(room.locks.a);
 expect(send('t',[{op:'restore_object',id:'a',revision:1}],{objects:{a:room.snapshot.objects.a}}).ok).toBe(true);expect(room.locks.a).toEqual(lease);
});
