import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {convertCharacter} from '../apps/workers/src/characters/convert';
await mkdir('.cache/character-results',{recursive:true});const report:Record<string,unknown>={date:new Date().toISOString()};
for(const format of ['fbx','glb'] as const){const result=await convertCharacter(await readFile('tests/fixtures/characters/rigged.'+format),format);for(const [name,value] of Object.entries(result)){await writeFile('.cache/character-results/'+format+'-'+name+'.glb',value.bytes);report[format+'-'+name]=value.stats;console.log(format,name,value.stats);}}

await writeFile('docs/evidence/character-conversion.json',JSON.stringify(report,null,2));
