import type {AssetDefinition,SceneObject,Vec3} from '@coedit/contracts';
export type Bounds={min:Vec3;max:Vec3};
export const EPSILON=1e-6;
/** Asset origins are bottom-centre; Euler order matches the editor's XYZ order. */
export function boundsOf(object:SceneObject,asset:AssetDefinition):Bounds{
  if(!asset||asset.dimensions.some(n=>!Number.isFinite(n)||n<=0))throw Error('INVALID_BOUNDS');
  const [rx,ry,rz]=object.rotation,cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
  const bounds:Bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const x of [-.5,.5])for(const y of [0,1])for(const z of [-.5,.5]){
    const scaled=[x,y,z].map((n,i)=>n*asset.dimensions[i]*object.scale[i]);
    const zx=cz*scaled[0]-sz*scaled[1],zy=sz*scaled[0]+cz*scaled[1];
    const yx=cy*zx+sy*scaled[2],yz=-sy*zx+cy*scaled[2];
    const point=[yx,cx*zy-sx*yz,sx*zy+cx*yz];
    for(let i=0;i<3;i++){const value=point[i]+object.position[i];bounds.min[i]=Math.min(bounds.min[i],value);bounds.max[i]=Math.max(bounds.max[i],value);}
  }
  return bounds;
}
export function overlaps(a:Bounds,b:Bounds){return [0,1,2].every(i=>Math.min(a.max[i],b.max[i])-Math.max(a.min[i],b.min[i])>EPSILON);}
export function groundPosition(object:SceneObject,asset:AssetDefinition,ground:number|null=0):Vec3{
  if(ground===null||!Number.isFinite(ground))throw Error('NO_GROUND');
  return [object.position[0],object.position[1]+ground-boundsOf(object,asset).min[1],object.position[2]];
}
