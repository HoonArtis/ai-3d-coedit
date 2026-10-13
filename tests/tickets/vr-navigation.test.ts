import {test,expect} from 'vitest';
import {canTeleport,findSpawn} from '@coedit/placement';
const wall={min:[1,0,-2] as [number,number,number],max:[2,3,2] as [number,number,number]};
test('teleport admits clear floor only and blocks body overlap, crossing walls and invalid coordinates',()=>{
 expect(canTeleport([0,0,0],[-3,0,0],[wall])).toBe(true);
 for(const target of [[1.5,0,0],[3,0,0],[50,0,0],[0,1,0],[NaN,0,0]] as [number,number,number][])expect(canTeleport([0,0,0],target,[wall])).toBe(false);
 expect(canTeleport([0,0,0],[0,0,3],[{min:[-1,3,-1],max:[1,4,4]}])).toBe(true);
 expect(canTeleport([0,0,0],[.8,0,0],[wall])).toBe(false);
});
test('spawn starts outside occupied space and rejects a completely blocked floor',()=>{
 const block={min:[-1,0,-1] as [number,number,number],max:[1,2,1] as [number,number,number]};
 const spawn=findSpawn([block]);expect(spawn).not.toBeNull();expect(Math.max(Math.abs(spawn![0]),Math.abs(spawn![2]))).toBeGreaterThan(1.3);
 expect(findSpawn([{min:[-50,0,-50],max:[50,5,50]}])).toBeNull();
});
