import {mkdir,copyFile} from 'node:fs/promises';
const target='apps/web/public/basis';await mkdir(target,{recursive:true});
for(const name of ['basis_transcoder.js','basis_transcoder.wasm','README.md'])await copyFile('node_modules/three/examples/jsm/libs/basis/'+name,target+'/'+name);

await copyFile('docs/licenses/basis-Apache-2.0.txt',target+'/LICENSE.txt');
