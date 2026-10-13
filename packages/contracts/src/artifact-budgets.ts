import {z} from 'zod';
import {BUDGETS} from './budgets';
const count=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const artifactBudgetManifestSchema=z.object({
 target:z.enum(['desktop','vr']),assetCount:count,triangles:count,drawCalls:count,
 assets:z.array(z.object({triangles:count}).strict()).max(10000),
 textures:z.array(z.object({width:count.positive(),height:count.positive(),format:z.string().max(32)}).strict()).max(10000),
 avatars:z.array(z.object({triangles:count}).strict()).max(10000),
}).strict();
export type ArtifactBudgetManifest=z.infer<typeof artifactBudgetManifestSchema>;
export type BudgetViolation={code:string;path:string;actual:number|string;limit:number|string};
/** Validate measured export statistics. Runtime asset ingestion additionally inspects GLB bytes. */
export function checkArtifactBudgets(raw:unknown):BudgetViolation[]{
 const m=artifactBudgetManifestSchema.parse(raw),issues:BudgetViolation[]=[];
 const check=(code:string,path:string,actual:number,limit:number)=>{if(actual>limit)issues.push({code,path,actual,limit});};
 check('ROOM_ASSET_LIMIT','assetCount',m.assetCount,BUDGETS.roomAssets);
 check('ROOM_TRIANGLE_LIMIT','triangles',m.triangles,m.target==='vr'?BUDGETS.vrRoomTriangles:BUDGETS.desktopRoomTriangles);
 if(m.target==='vr')check('VR_DRAW_CALL_LIMIT','drawCalls',m.drawCalls,BUDGETS.vrDrawCalls);
 m.assets.forEach((a,i)=>check('ASSET_TRIANGLE_LIMIT',`assets.${i}.triangles`,a.triangles,m.target==='vr'?BUDGETS.vrAssetTriangles:BUDGETS.desktopAssetTriangles));
 m.textures.forEach((t,i)=>{
  check('TEXTURE_SIZE_LIMIT',`textures.${i}`,Math.max(t.width,t.height),BUDGETS.textureSize);
  if(t.format!=='ktx2')issues.push({code:'TEXTURE_FORMAT',path:`textures.${i}.format`,actual:t.format,limit:'ktx2'});
 });
 m.avatars.forEach((a,i)=>check('AVATAR_TRIANGLE_LIMIT',`avatars.${i}.triangles`,a.triangles,BUDGETS.avatarTriangles));
 return issues;
}
