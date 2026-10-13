import {objectKeySchema,materialPresetSchema,type JobInput} from '@coedit/contracts';
import type {ObjectStore} from '@coedit/artifacts';
import {applyMaterialPreset} from './material';
import {publishArtifact} from './publish';
export async function optimizeJob(store:ObjectStore,input:JobInput){
 if(input.stage!=='optimize')throw Error('STAGE_UNAVAILABLE');
 const rawKey=objectKeySchema.parse(input.payload.rawKey);let raw=await store.get(rawKey);
 const texture=input.payload.texture;if(texture!=='preset'&&texture!=='mv-adapter')throw Error('INVALID_TEXTURE_MODE');
 const preset=texture==='preset'?materialPresetSchema.parse(input.payload.preset):undefined;
 if(preset)raw=await applyMaterialPreset(raw,preset);
 // These generated shapes currently use the research-only background adapter.
 if(input.payload.researchOnly!==true)throw Error('RESEARCH_PROVENANCE_REQUIRED');
 return publishArtifact(store,{jobId:input.jobId,version:input.inputVersion,generation:input.generation,raw,provenance:{texture,...(preset?{preset}:{}),researchOnly:true,sources:[{name:'RMBG-1.4 (generation pipeline)',revision:'2ceba5a5efaec153162aedea169f76caf9b46cf8',license:'BRIA noncommercial'},...(texture==='mv-adapter'?[{name:'nvdiffrast',revision:'253ac4fcea7de5f396371124af597e6cc957bfae',license:'NVIDIA research only'}]:[])]}});
}
