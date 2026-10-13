import {test,expect} from 'vitest';
import {Group,Bone,SkinnedMesh,BufferGeometry,Float32BufferAttribute,Uint16BufferAttribute,Skeleton,MeshBasicMaterial,AnimationClip,NumberKeyframeTrack} from 'three';
import {instantiateModel} from '../../apps/web/src/editor/model-instance';
test('each placed character owns its skeleton and idle mixer; a missing clip remains a stable pose',()=>{
 const scene=new Group(),hip=new Bone();hip.name='Hips';const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));geo.setAttribute('skinIndex',new Uint16BufferAttribute(new Array(12).fill(0),4));geo.setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
 const mesh=new SkinnedMesh(geo,new MeshBasicMaterial());scene.add(mesh);mesh.add(hip);mesh.bind(new Skeleton([hip]));
 const idle=new AnimationClip('Idle',1,[new NumberKeyframeTrack('Hips.position[y]',[0,1],[0,1])]);
 const first=instantiateModel(scene,[idle]),second=instantiateModel(scene,[idle]),staticPose=instantiateModel(scene,[]);
 first.mixer?.update(.5);expect(first.scene.getObjectByName('Hips')!.position.y).toBeCloseTo(.5);expect(second.scene.getObjectByName('Hips')!.position.y).toBe(0);expect(hip.position.y).toBe(0);expect(staticPose.mixer).toBeNull();
 expect((first.scene.children[0] as SkinnedMesh).skeleton).not.toBe(mesh.skeleton);first.dispose();second.dispose();staticPose.dispose();geo.dispose();(mesh.material as MeshBasicMaterial).dispose();
});
