import {test,expect} from 'vitest';import {BUILTIN_LIBRARY} from '@coedit/contracts';import {exportBuiltinGlb} from '@coedit/geometry/export';import {inspectGlb} from '../../apps/workers/src/optimization/mesh';
test('builtin reference GLBs preserve floor pivot, dimensions, triangles and material groups',async()=>{
 for(const asset of Object.values(BUILTIN_LIBRARY)){const stats=await inspectGlb(await exportBuiltinGlb(asset));expect(stats.triangles).toBeGreaterThan(0);expect(stats.triangles).toBeLessThanOrEqual(2500);expect(stats.bounds.min[1]).toBeGreaterThanOrEqual(-.001);stats.dimensions.forEach((n,i)=>expect(n).toBeLessThanOrEqual(asset.dimensions[i]+.001));expect(stats.materials).toBeGreaterThan(0);}
});
