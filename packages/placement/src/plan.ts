import {BUDGETS,opSchema,type Op,type SceneObject,type SceneSnapshot,type AssetDefinition,type Vec3} from '@coedit/contracts';
import {boundsOf,overlaps,groundPosition,EPSILON} from './geometry';
import {arrangeNicely} from './arrange';
export const placementOps=new Set(['arrange_around','align_row','distribute','scatter','place_on','face_toward','snap_to_ground','arrange_nicely']);
type Result={ok:true;ops:Op[]}|{ok:false;code:string};
export function planPlacement(raw:unknown,scene:SceneSnapshot,library:Record<string,AssetDefinition>):Result{
  try{
    const op=opSchema.parse(raw),ops:Op[]=[],candidates:SceneObject[]=[];
    const get=(id:string)=>{if(!Object.hasOwn(scene.objects,id))throw Error('NOT_FOUND');return scene.objects[id];};
    const asset=(id:string)=>{if(!Object.hasOwn(library,id))throw Error('ASSET_UNAVAILABLE');return library[id];};
    const make=(id:string,assetId:string,position:Vec3,rotation:Vec3=[0,0,0]):SceneObject=>({id,assetId,position,rotation,scale:[1,1,1],name:asset(assetId).name,owner:'planner',lastActor:'planner',revision:0});
    const place=(object:SceneObject)=>{if(Object.hasOwn(scene.objects,object.id))throw Error('ID_CONFLICT');candidates.push(object);ops.push({op:'place',id:object.id,assetId:object.assetId,position:object.position,rotation:object.rotation,scale:object.scale});};
    const move=(object:SceneObject,position:Vec3)=>{const candidate={...object,position};candidates.push(candidate);ops.push({op:'move',id:object.id,value:position});};
    if(op.op==='arrange_around'){
      const target=get(op.targetId);asset(op.assetId);
      op.ids.forEach((id,i)=>{
        const angle=2*Math.PI*i/op.ids.length;
        const clean=(n:number)=>Math.abs(n)<EPSILON?0:n;
        const position:Vec3=[clean(target.position[0]+Math.cos(angle)*op.radius),0,clean(target.position[2]+Math.sin(angle)*op.radius)];
        place(make(id,op.assetId,position,[0,Math.atan2(target.position[0]-position[0],target.position[2]-position[2]),0]));
      });
    }else if(op.op==='align_row'||op.op==='distribute'){
      const axis={x:0,y:1,z:2}[op.axis];const objects=op.ids.map(get);
      if(op.op==='distribute')objects.sort((a,b)=>a.position[axis]-b.position[axis]||(a.id<b.id?-1:a.id>b.id?1:0));
      if(objects.length===1)return {ok:true,ops:[]};
      const start=objects[0].position[axis],spacing=op.op==='align_row'?op.spacing:(objects.at(-1)!.position[axis]-start)/(objects.length-1);
      objects.forEach((object,i)=>{const position=[...(op.op==='align_row'?objects[0].position:object.position)] as Vec3;position[axis]=start+spacing*i;move(object,position);});
    }else if(op.op==='scatter'){
      if(op.min.some((n,i)=>n>op.max[i]))throw Error('INVALID_REGION');
      const definition=asset(op.assetId);let seed=op.seed;
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const xMin=op.min[0]+definition.dimensions[0]/2,xMax=op.max[0]-definition.dimensions[0]/2;
      const zMin=op.min[2]+definition.dimensions[2]/2,zMax=op.max[2]-definition.dimensions[2]/2;
      if(xMin>xMax||zMin>zMax)throw Error('NO_SPACE');
      for(const id of op.ids){
        let found:SceneObject|undefined;
        for(let attempt=0;attempt<128;attempt++){
          const object=make(id,op.assetId,[xMin+random()*(xMax-xMin),op.min[1]+random()*(op.max[1]-op.min[1]),zMin+random()*(zMax-zMin)]);
          const bounds=boundsOf(object,definition);
          if(bounds.min[1]<-EPSILON)throw Error('BELOW_GROUND');
          if(![...Object.values(scene.objects),...candidates].some(other=>overlaps(bounds,boundsOf(other,asset(other.assetId))))){found=object;break;}
        }
        if(!found)throw Error('NO_SPACE');place(found);
      }
    }else if(op.op==='snap_to_ground'){
      const object=get(op.id);move(object,groundPosition(object,asset(object.assetId)));
    }else if(op.op==='place_on'){
      const object=get(op.id),target=get(op.targetId);if(object.id===target.id)throw Error('INVALID_TARGET');
      const support=boundsOf(target,asset(target.assetId));
      const candidate={...object,position:[(support.min[0]+support.max[0])/2,0,(support.min[2]+support.max[2])/2] as Vec3};
      candidate.position=groundPosition(candidate,asset(object.assetId),support.max[1]);
      const bounds=boundsOf(candidate,asset(object.assetId));
      if([0,2].some(i=>bounds.min[i]<support.min[i]-EPSILON||bounds.max[i]>support.max[i]+EPSILON))throw Error('NO_SUPPORT');
      move(object,candidate.position);
    }else if(op.op==='face_toward'){
      const object=get(op.id),target=get(op.targetId),dx=target.position[0]-object.position[0],dz=target.position[2]-object.position[2];
      if(Math.hypot(dx,dz)<EPSILON)return {ok:true,ops:[]};
      const rotation:Vec3=[object.rotation[0],Math.atan2(dx,dz),object.rotation[2]];
      candidates.push({...object,rotation});ops.push({op:'rotate',id:object.id,value:rotation});
    }else if(op.op==='arrange_nicely'){
      for(const object of arrangeNicely(op.ids,scene,library)){
        const before=get(object.id);candidates.push(object);
        if(object.position.some((v,i)=>v!==before.position[i]))ops.push({op:'move',id:object.id,value:object.position});
        if(object.rotation.some((v,i)=>v!==before.rotation[i]))ops.push({op:'rotate',id:object.id,value:object.rotation});
      }
    }else throw Error('UNSUPPORTED_PLACEMENT');
    const ids=new Set(candidates.map(o=>o.id));
    const existing=Object.values(scene.objects).filter(o=>!ids.has(o.id));
    if(existing.length+candidates.length>BUDGETS.roomAssets)throw Error('ASSET_LIMIT');
    for(const object of candidates){
      const bounds=boundsOf(object,asset(object.assetId));if(bounds.min[1]<-EPSILON)throw Error('BELOW_GROUND');
      if(existing.some(other=>overlaps(bounds,boundsOf(other,asset(other.assetId)))))throw Error('NO_SPACE');existing.push(object);
    }
    return {ok:true,ops:ops.map(op=>opSchema.parse(op))};
  }catch(error){return {ok:false,code:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'INVALID_PLACEMENT'};}
}
