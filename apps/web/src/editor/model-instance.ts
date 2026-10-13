import {AnimationMixer,SkinnedMesh,type Object3D,type AnimationClip} from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
/** Cached geometry/materials are shared; bones, skeleton palettes and animation state are per placement. */
export function instantiateModel(source:Object3D,clips:AnimationClip[]){
 const scene=clone(source),clip=clips.find(c=>/idle|wait|대기/i.test(c.name))??clips[0],mixer=clip?new AnimationMixer(scene):null;
 if(clip)mixer!.clipAction(clip).play();
 return {scene,mixer,dispose(){mixer?.stopAllAction();mixer?.uncacheRoot(scene);scene.traverse(o=>{if(o instanceof SkinnedMesh)o.skeleton.dispose();});}};
}
