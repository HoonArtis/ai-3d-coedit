import type {SceneSnapshot,Vec3} from '@coedit/contracts';
export type CameraState={position:Vec3;target:Vec3};
export function reconcileCameraFocus(camera:CameraState,focusId:string|null,snapshot:SceneSnapshot){
  if(focusId&&!Object.hasOwn(snapshot.objects,focusId))return {camera:{position:[9,8,11] as Vec3,target:[0,0,0] as Vec3},focusId:null};
  return {camera,focusId};
}
export type CameraCommand={op:'focus';id:string}|{op:'orbit';azimuth:number;polar:number}|{op:'zoom';factor:number};
export function cameraCommand(current:CameraState,command:CameraCommand,snapshot:SceneSnapshot):CameraState{
  if(command.op==='focus'){
    const object=snapshot.objects[command.id];if(!object)throw Error('NOT_FOUND');
    const target=[...object.position] as Vec3;return {target,position:[target[0]+9,target[1]+8,target[2]+11]};
  }
  const offset=current.position.map((n,i)=>n-current.target[i]) as Vec3;
  const distance=Math.hypot(...offset);if(!distance)throw Error('INVALID_CAMERA');
  if(command.op==='zoom'){
    if(!Number.isFinite(command.factor)||command.factor<=0)throw Error('INVALID_ZOOM');
    const radius=Math.max(2,Math.min(80,distance*command.factor));
    return {target:[...current.target],position:offset.map((n,i)=>current.target[i]+n/distance*radius) as Vec3};
  }
  if(!Number.isFinite(command.azimuth)||!Number.isFinite(command.polar))throw Error('INVALID_ORBIT');
  const theta=Math.atan2(offset[0],offset[2])+command.azimuth;
  const phi=Math.max(.05,Math.min(Math.PI*.48,Math.acos(offset[1]/distance)+command.polar));
  return {target:[...current.target],position:[current.target[0]+distance*Math.sin(phi)*Math.sin(theta),current.target[1]+distance*Math.cos(phi),current.target[2]+distance*Math.sin(phi)*Math.cos(theta)]};
}
