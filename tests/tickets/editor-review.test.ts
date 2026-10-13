import {test,expect} from 'vitest';
import {Group} from 'three';
import {scene} from '../fixtures/scene';
import {LockService} from '../../apps/server/src/rooms/locks';
import {retainLeasedPreviews,SelectionQueue,restoreTransform,TransformEditQueue} from '../../apps/web/src/editor/interaction-state';

test('late heartbeat cannot revive an expired lease',()=>{
  let now=0;const locks=new LockService(()=>now);
  locks.acquire('client',{actor:'alice',role:'student'},['a'],scene());
  const old=locks.public.a.token;now=30001;locks.heartbeat('client');
  expect(locks.public).toEqual({});
  locks.acquire('client',{actor:'alice',role:'student'},['a'],scene());
  expect(locks.public.a.token).not.toBe(old);
});
test('previews disappear when leases are released or replaced',()=>{
  const p={id:'a',token:'old',position:[3,0,0] as [number,number,number]};
  const previews={a:{...p,rotation:[0,0,0] as [number,number,number],scale:[1,1,1] as [number,number,number]}};
  expect(retainLeasedPreviews(previews,{})).toEqual({});
  expect(retainLeasedPreviews(previews,{a:{owner:'alice',token:'new'}})).toEqual({});
  expect(retainLeasedPreviews(previews,{a:{owner:'alice',token:'old'}})).toEqual(previews);
});
test('overlapping selection releases stale acquisition and cancellation wins',async()=>{
  const held=new Set<string>();let finish!:()=>void;
  const gate=new Promise<void>(resolve=>{finish=resolve;});
  const selection=new SelectionQueue(async id=>{if(id==='a')await gate;held.add(id);return true;},async id=>{held.delete(id);},()=>{});
  const a=selection.select('a');await Promise.resolve();
  const b=selection.select('b');finish();await Promise.all([a,b]);
  expect([...held]).toEqual(['b']);
  await Promise.all([selection.select('a'),selection.select(null)]);
  expect([...held]).toEqual([]);
});
test('authoritative transform resets imperatively mutated objects',()=>{
  const group=new Group();group.position.set(9,8,7);group.scale.set(-1,0,3);group.rotation.set(1,2,3);
  restoreTransform(group,scene().objects.a);
  expect(group.position.toArray()).toEqual([0,0,0]);expect(group.scale.toArray()).toEqual([1,1,1]);
  expect([group.rotation.x,group.rotation.y,group.rotation.z]).toEqual([0,0,0]);
});
test('rapid edits to different axes merge with the last confirmed transform',async()=>{
  const state=scene();let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});let calls=0;
  const queue=new TransformEditQueue(id=>state.objects[id],async ops=>{
    if(++calls===1)await gate;
    const op=ops[0];if(op.op==='move')state.objects[op.id].position=op.value;
    return {ok:true,snapshot:state,changedIds:['a']};
  });
  const x=queue.edit('a','position',0,2),y=queue.edit('a','position',1,3);finish();await Promise.all([x,y]);
  expect(state.objects.a.position).toEqual([2,3,0]);
});
