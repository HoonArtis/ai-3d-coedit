import {expect,test} from 'vitest';
import {checkArtifactBudgets} from '@coedit/contracts';
const manifest={target:'vr' as const,assetCount:200,triangles:500000,drawCalls:150,assets:[{triangles:2500}],textures:[{width:1024,height:1024,format:'ktx2'}],avatars:[{triangles:10000}]};
test('accepts exact boundaries and reports each budget independently',()=>{
 expect(checkArtifactBudgets(manifest)).toEqual([]);
 expect(checkArtifactBudgets({...manifest,assetCount:201,triangles:500001,drawCalls:151,assets:[{triangles:2501}],textures:[{width:1025,height:1024,format:'png'}],avatars:[{triangles:10001}]}).map(x=>x.code)).toEqual(['ROOM_ASSET_LIMIT','ROOM_TRIANGLE_LIMIT','VR_DRAW_CALL_LIMIT','ASSET_TRIANGLE_LIMIT','TEXTURE_SIZE_LIMIT','TEXTURE_FORMAT','AVATAR_TRIANGLE_LIMIT']);
 expect(checkArtifactBudgets({...manifest,target:'desktop',triangles:1000001,assets:[{triangles:5001}]}).map(x=>x.code)).toEqual(['ROOM_TRIANGLE_LIMIT','ASSET_TRIANGLE_LIMIT']);
});
test('rejects malformed measurements instead of treating NaN or missing fields as within budget',()=>{
 expect(()=>checkArtifactBudgets({...manifest,triangles:NaN})).toThrow();
 expect(()=>checkArtifactBudgets({...manifest,triangles:-1})).toThrow();
 expect(()=>checkArtifactBudgets({target:'vr'})).toThrow();
});
