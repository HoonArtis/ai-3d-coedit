import {test,expect} from 'vitest';
import {emptyScene,BUILTIN_LIBRARY,type SceneObject} from '@coedit/contracts';
import {restoreScene} from '@coedit/domain';
const object=(id:string):SceneObject=>({id,assetId:'cube',owner:'student',name:id,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],revision:1,lastActor:'student'});
const context={actor:'teacher',role:'teacher' as const,library:BUILTIN_LIBRARY,locks:{}};
test('object restore preserves original owner and assigns a new revision; room restore increments current generation',()=>{
 const current=emptyScene('room');current.seq=7;current.generation=3;current.objects.a=object('a');
 const result=restoreScene(current,{objects:{b:object('b')}},context);expect(result.snapshot.objects.b.owner).toBe('student');expect(result.snapshot.objects.b.revision).toBe(8);expect(result.snapshot.objects.b.lastActor).toBe('teacher');expect(result.snapshot.generation).toBe(3);expect(current.objects.b).toBeUndefined();
 const old=emptyScene('room');old.objects.b=object('b');const restored=restoreScene(current,{snapshot:old},context);expect(restored.snapshot.generation).toBe(4);expect(restored.snapshot.seq).toBe(8);expect(restored.changedIds.sort()).toEqual(['a','b']);expect(Object.keys(restored.snapshot.objects)).toEqual(['b']);
});
test('unauthorized, wrong-room, missing-library and 201-object restoration fail without mutation',()=>{
 const current=emptyScene('room');for(let i=0;i<200;i++)current.objects['a'+i]=object('a'+i);const original=structuredClone(current);
 expect(()=>restoreScene(current,{objects:{new:object('new')}},context)).toThrow('ASSET_LIMIT');
 expect(()=>restoreScene(current,{objects:{a0:null}},{...context,role:'student'})).toThrow('FORBIDDEN');
 expect(()=>restoreScene(current,{snapshot:emptyScene('foreign')},context)).toThrow('WRONG_ROOM');
 expect(()=>restoreScene(current,{objects:{a0:{...object('a0'),assetId:'unapproved'}}},context)).toThrow('ASSET_UNAVAILABLE');expect(current).toEqual(original);
});
