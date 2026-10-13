import type {Vec3} from '@coedit/contracts';
import type {Bounds} from './geometry';
const RADIUS=.3,HEIGHT=1.8,HALF_FLOOR=50;
function onFloor(point:Vec3){return point.every(Number.isFinite)&&Math.abs(point[1])<.001&&Math.abs(point[0])<=HALF_FLOOR-RADIUS&&Math.abs(point[2])<=HALF_FLOOR-RADIUS;}
/** Conservative swept body AABB prevents crossing walls as well as ending inside them. */
export function canTeleport(from:Vec3,to:Vec3,obstacles:Bounds[]):boolean{
 if(!onFloor(from)||!onFloor(to))return false;
 return !obstacles.some(box=>{
  if(box.max[1]<=0||box.min[1]>=HEIGHT)return false;
  let near=0,far=1;
  for(const axis of [0,2]){
   const low=box.min[axis]-RADIUS,high=box.max[axis]+RADIUS,delta=to[axis]-from[axis];
   if(Math.abs(delta)<1e-9){if(from[axis]<low||from[axis]>high)return false;continue;}
   const a=(low-from[axis])/delta,b=(high-from[axis])/delta;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return false;
  }
  return true;
 });
}
export function findSpawn(obstacles:Bounds[]):Vec3|null{
 for(let radius=0;radius<HALF_FLOOR;radius++)for(let x=-radius;x<=radius;x++)for(let z=-radius;z<=radius;z++){
  if(Math.max(Math.abs(x),Math.abs(z))!==radius)continue;
  const point:Vec3=[x,0,z];if(canTeleport(point,point,obstacles))return point;
 }
 return null;
}
