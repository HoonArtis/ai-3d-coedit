import {test,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {convertCharacter,inspectCharacterGlb,validateCharacterUpload} from '../../apps/workers/src/characters/convert';
test('character uploads reject oversized, unsupported and broken data before Blender',()=>{
 expect(()=>validateCharacterUpload(Buffer.alloc(64*1024*1024+1),'glb')).toThrow('CHARACTER_SIZE');
 expect(()=>validateCharacterUpload(Buffer.from('broken'),'fbx')).toThrow('CHARACTER_FORMAT');
 expect(()=>validateCharacterUpload(Buffer.from('Kaydara FBX Binary  \0\x1a\0'),'exe')).toThrow('CHARACTER_FORMAT');
});
test.each(['fbx','glb'] as const)('real %s conversion preserves rig and animated joints at desktop/avatar budgets',async format=>{
 const original=await readFile('tests/fixtures/characters/rigged.'+format),result=await convertCharacter(original,format);
 expect(result.desktop.stats.triangles).toBeLessThanOrEqual(5000);expect(result.avatar.stats.triangles).toBeLessThanOrEqual(10000);expect(result.vr.stats.triangles).toBeLessThanOrEqual(2500);
 for(const variant of [result.desktop,result.avatar]){expect(variant.stats.joints).toBeGreaterThanOrEqual(2);expect(variant.stats.clips.length).toBeGreaterThan(0);expect(variant.stats.dimensions[1]).toBeCloseTo(1.7,1);}
 const clipless=await new NodeIO().readBinary(result.desktop.bytes);for(const clip of clipless.getRoot().listAnimations())clip.dispose();expect((await inspectCharacterGlb(await new NodeIO().writeBinary(clipless),5000)).clips).toEqual([]);
 const brokenClip=await new NodeIO().readBinary(result.desktop.bytes),times=brokenClip.getRoot().listAnimations()[0].listSamplers()[0].getInput()!;times.setArray(new Float32Array(times.getCount()).fill(-1));await expect(inspectCharacterGlb(await new NodeIO().writeBinary(brokenClip),5000)).rejects.toThrow('CHARACTER_INVALID_ANIMATION');
 const doc=await new NodeIO().readBinary(result.desktop.bytes),skin=doc.getRoot().listSkins()[0];skin.removeJoint(skin.listJoints()[0]);
 await expect(inspectCharacterGlb(await new NodeIO().writeBinary(doc),5000)).rejects.toThrow();
},180000);
