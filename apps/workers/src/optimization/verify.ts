import {BUDGETS} from '@coedit/contracts';
import {inspectGlb,readGlb} from './mesh';
import {inspectKtx2} from './texture';
export async function verifyArtifact(bytes:Uint8Array,target:'desktop'|'vr'|'avatar'){
 const stats=await inspectGlb(bytes),limit=target==='desktop'?BUDGETS.desktopAssetTriangles:target==='avatar'?BUDGETS.avatarTriangles:BUDGETS.vrAssetTriangles;
 if(stats.triangles>limit)throw Error('TRIANGLE_BUDGET_EXCEEDED');
 const doc=await readGlb(bytes);
 for(const texture of doc.getRoot().listTextures()){
  if(texture.getMimeType()!=='image/ktx2')throw Error('KTX2_REQUIRED');
  const image=texture.getImage();if(!image)throw Error('MISSING_TEXTURE');inspectKtx2(image);
 }
 return stats;
}
