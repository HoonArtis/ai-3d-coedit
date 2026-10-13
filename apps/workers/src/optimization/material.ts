import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import {readGlb} from './mesh';
const presets={
 wood:{color:[.46,.25,.11,1],roughness:.8,metallic:0},
 metal:{color:[.58,.62,.67,1],roughness:.25,metallic:1},
 fabric:{color:[.21,.43,.56,1],roughness:1,metallic:0},
} as const;
export async function applyMaterialPreset(bytes:Uint8Array,selection:unknown){
 if(typeof selection!=='string'||!Object.hasOwn(presets,selection))throw Error('PRESET_REQUIRED');
 const preset=presets[selection as keyof typeof presets],doc=await readGlb(bytes);
 const material=doc.createMaterial('preset-'+selection).setBaseColorFactor([...preset.color]).setRoughnessFactor(preset.roughness).setMetallicFactor(preset.metallic);
 for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives())primitive.setMaterial(material);
 await doc.transform(prune());
 if(doc.getRoot().listMaterials().length!==1)throw Error('MATERIAL_BUDGET_EXCEEDED');
 return new NodeIO().registerExtensions(ALL_EXTENSIONS).writeBinary(doc);
}
