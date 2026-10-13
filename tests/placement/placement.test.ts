import {test,expect} from 'vitest';
import {BUILTIN_LIBRARY,emptyScene,type SceneObject,type SceneSnapshot} from '@coedit/contracts';
import {boundsOf,overlaps,groundPosition,planPlacement} from '../../packages/placement/src/index';
const object=(id:string,assetId='cube',position:[number,number,number]=[0,0,0]):SceneObject=>({id,assetId,position,rotation:[0,0,0],scale:[1,1,1],owner:'alice',lastActor:'alice',revision:1,name:id});
const scene=(objects:SceneObject[]):SceneSnapshot=>({...emptyScene(),objects:Object.fromEntries(objects.map(o=>[o.id,o]))});
test('bounds include scale and rotation; touching is not collision and absent ground is explicit',()=>{
  const cube=object('a');cube.scale=[2,1,1];cube.rotation=[0,Math.PI/2,0];
  const b=boundsOf(cube,BUILTIN_LIBRARY.cube);expect(b.max[0]).toBeCloseTo(.5);expect(b.max[2]).toBeCloseTo(1);
  expect(overlaps(b,{min:[.5,0,-1],max:[1,1,1]})).toBe(false);
  expect(overlaps(b,{min:[.4,0,-1],max:[1,1,1]})).toBe(true);
  cube.rotation=[Math.PI/2,0,0];expect(groundPosition(cube,BUILTIN_LIBRARY.cube,0)[1]).toBeCloseTo(.5);
  expect(()=>groundPosition(cube,BUILTIN_LIBRARY.cube,null)).toThrow('NO_GROUND');
});
test('four chairs around a table are deterministic, face the table and fail atomically when crowded',()=>{
  const input=scene([object('table','table')]);
  const op={op:'arrange_around' as const,targetId:'table',assetId:'chair',ids:['a','b','c','d'],radius:2};
  const result=planPlacement(op,input,BUILTIN_LIBRARY);expect(result).toEqual(planPlacement(op,input,BUILTIN_LIBRARY));
  expect(result.ok).toBe(true);if(result.ok){expect(result.ops).toHaveLength(4);expect(result.ops[0]).toMatchObject({op:'place',position:[2,0,0],rotation:[0,-Math.PI/2,0]});}
  expect(planPlacement({...op,radius:.1},input,BUILTIN_LIBRARY).ok).toBe(false);expect(Object.keys(input.objects)).toEqual(['table']);
});
test('alignment and distribution handle one item and reject overlapping rows without partial output',()=>{
  const input=scene([object('a'),object('b','cube',[3,0,0]),object('c','cube',[10,0,0])]);
  const aligned=planPlacement({op:'align_row',ids:['a','b','c'],axis:'x',spacing:2},input,BUILTIN_LIBRARY);
  expect(aligned).toMatchObject({ok:true,ops:[{value:[0,0,0]},{value:[2,0,0]},{value:[4,0,0]}]});
  const distributed=planPlacement({op:'distribute',ids:['a','b','c'],axis:'x'},input,BUILTIN_LIBRARY);
  expect(distributed).toMatchObject({ok:true,ops:[{value:[0,0,0]},{value:[5,0,0]},{value:[10,0,0]}]});
  expect(planPlacement({op:'distribute',ids:['a'],axis:'x'},input,BUILTIN_LIBRARY)).toEqual({ok:true,ops:[]});
  expect(planPlacement({op:'align_row',ids:['a','b'],axis:'x',spacing:.1},input,BUILTIN_LIBRARY).ok).toBe(false);
  expect(planPlacement({op:'distribute',ids:[],axis:'x'},input,BUILTIN_LIBRARY).ok).toBe(false);
});
test('seeded scatter stays inside footprint and has a bounded failure for tiny areas',()=>{
  const op={op:'scatter' as const,assetId:'cube',ids:['a','b','c'],min:[-5,0,-5] as [number,number,number],max:[5,0,5] as [number,number,number],seed:42};
  const result=planPlacement(op,emptyScene(),BUILTIN_LIBRARY);expect(result).toEqual(planPlacement(op,emptyScene(),BUILTIN_LIBRARY));
  expect(result.ok).toBe(true);if(result.ok)for(const p of result.ops)if(p.op==='place'){expect(Math.abs(p.position[0])).toBeLessThanOrEqual(4.5);expect(Math.abs(p.position[2])).toBeLessThanOrEqual(4.5);}
  expect(planPlacement({...op,min:[0,0,0],max:[.1,0,.1]},emptyScene(),BUILTIN_LIBRARY).ok).toBe(false);
});
test('place-on uses the support top; face-toward retains rotation for coincident positions',()=>{
  const input=scene([object('table','table'),object('p','plant',[3,0,0])]);
  expect(planPlacement({op:'place_on',id:'p',targetId:'table'},input,BUILTIN_LIBRARY)).toMatchObject({ok:true,ops:[{op:'move',value:[0,.85,0]}]});
  expect(planPlacement({op:'face_toward',id:'p',targetId:'missing'},input,BUILTIN_LIBRARY).ok).toBe(false);
  expect(planPlacement({op:'face_toward',id:'p',targetId:'p'},input,BUILTIN_LIBRARY)).toEqual({ok:true,ops:[]});
});
