import type {AssetDefinition,SceneObject,SceneSnapshot,Vec3} from '@coedit/contracts';
import {boundsOf,overlaps,groundPosition,EPSILON,type Bounds} from './geometry';
import {roleOf,footprint,distanceXZ,type Role} from './relations';
const FLOOR=49,GAP=.25;
/** 원하는 자리부터 바깥으로 0.3m씩 넓히며 빈 곳을 찾는다. 결정적이어야 하므로 난수를 쓰지 않는다. */
const SPIRAL:[number,number][]=[[0,0]];
for(let r=.3;r<=6.01;r+=.3)for(let i=0;i<16;i++){const a=i*Math.PI/8;SPIRAL.push([Math.cos(a)*r,Math.sin(a)*r]);}
const facing=(from:readonly number[],to:readonly number[])=>Math.atan2(to[0]-from[0],to[2]-from[2]);
const angleAround=(p:readonly number[],c:readonly number[])=>Math.atan2(p[2]-c[2],p[0]-c[0]);
const byId=(a:SceneObject,b:SceneObject)=>a.id<b.id?-1:a.id>b.id?1:0;
/**
 * "어울리게 배치": ids의 물체를 relations.ts 규칙에 따라 다시 놓는다.
 * 탁자·나무·장식은 제자리를 지키는 기준점, 의자는 가장 가까운 탁자를 둘러 탁자를 보고, 벤치는 가까운 나무 앞에서 나무를 보고,
 * 화분은 탁자 위에 하나씩 오른 뒤 남으면 기준점 곁에 놓는다. ids 밖의 물체(남의 것 포함)는 장애물로만 본다.
 * 바뀐 물체만 돌려준다. 자리를 못 찾으면 NO_SPACE로 전체 실패한다.
 */
export function arrangeNicely(ids:string[],scene:SceneSnapshot,library:Record<string,AssetDefinition>):SceneObject[]{
  const get=(id:string)=>{if(!Object.hasOwn(scene.objects,id))throw Error('NOT_FOUND');return scene.objects[id];};
  const asset=(id:string)=>{if(!Object.hasOwn(library,id))throw Error('ASSET_UNAVAILABLE');return library[id];};
  const moving=new Set(ids),movable=ids.map(get);
  const placed:Bounds[]=Object.values(scene.objects).filter(o=>!moving.has(o.id)).map(o=>boundsOf(o,asset(o.assetId)));
  const final=new Map<string,SceneObject>();
  const of=(role:Role)=>movable.filter(o=>roleOf(asset(o.assetId))===role&&!final.has(o.id)).sort(byId);
  const commit=(o:SceneObject,desired:Vec3,turn:{yaw?:number;face?:readonly number[]}={},ground=0,spiral=SPIRAL)=>{
    const definition=asset(o.assetId);
    for(const [dx,dz] of spiral){
      const x=desired[0]+dx,z=desired[2]+dz;if(Math.abs(x)>FLOOR||Math.abs(z)>FLOOR)continue;
      const yaw=turn.face?facing([x,0,z],turn.face):turn.yaw;
      const candidate:SceneObject={...o,position:[x,o.position[1],z],rotation:yaw===undefined?o.rotation:[o.rotation[0],yaw,o.rotation[2]]};
      candidate.position=groundPosition(candidate,definition,ground);
      const bounds=boundsOf(candidate,definition);
      if(placed.some(p=>overlaps(bounds,p)))continue;
      placed.push(bounds);final.set(o.id,candidate);return true;
    }
    return false;
  };
  const place=(o:SceneObject,desired:Vec3,turn?:{yaw?:number;face?:readonly number[]})=>{if(!commit(o,desired,turn))throw Error('NO_SPACE');};
  const where=(o:SceneObject)=>final.get(o.id)??o;
  // 1. 기준점: 탁자·나무·장식은 제자리. 서로 겹쳐 있으면 가까운 빈 곳으로 비킨다.
  for(const role of ['table','tree','decor'] as Role[])for(const o of of(role))place(o,o.position);
  const anchors=(role:Role)=>Object.values(scene.objects).filter(o=>roleOf(asset(o.assetId))===role).map(where);
  const tables=anchors('table'),trees=anchors('tree');
  // 2. 화분은 비어 있는 탁자 위에 하나씩. 탁자보다 크면 오르지 않는다.
  for(const table of tables){
    const plant=of('plant').filter(p=>footprint(p,asset(p.assetId))<=footprint(table,asset(table.assetId))*.8).sort((a,b)=>distanceXZ(a.position,table.position)-distanceXZ(b.position,table.position))[0];
    if(plant)commit(plant,[table.position[0],0,table.position[2]],{},boundsOf(table,asset(table.assetId)).max[1],[[0,0]]);
  }
  // 3. 의자는 가까운 탁자를 둘러앉는다. 지금 놓인 방향 순서를 지켜 덜 움직이게 한다.
  const ring=(anchor:SceneObject,members:SceneObject[],gap:number)=>{
    if(!members.length)return;
    const radius=footprint(anchor,asset(anchor.assetId))+Math.max(...members.map(m=>footprint(m,asset(m.assetId))))+gap;
    const sorted=[...members].sort((a,b)=>angleAround(a.position,anchor.position)-angleAround(b.position,anchor.position)||byId(a,b));
    const base=angleAround(sorted[0].position,anchor.position);
    sorted.forEach((m,i)=>{const a=base+2*Math.PI*i/sorted.length;place(m,[anchor.position[0]+Math.cos(a)*radius,0,anchor.position[2]+Math.sin(a)*radius],{face:anchor.position});});
  };
  const share=(members:SceneObject[],hosts:SceneObject[],seat:(host:SceneObject,member:SceneObject)=>number)=>{
    const groups=new Map<SceneObject,SceneObject[]>(),left:SceneObject[]=[];
    for(const m of members){
      const host=[...hosts].sort((a,b)=>distanceXZ(m.position,a.position)-distanceXZ(m.position,b.position)).find(h=>(groups.get(h)?.length??0)<seat(h,m));
      if(host)groups.set(host,[...(groups.get(host)??[]),m]);else left.push(m);
    }
    return {groups,left};
  };
  const chairs=share(of('chair'),tables,(table,chair)=>{
    const radius=footprint(table,asset(table.assetId))+footprint(chair,asset(chair.assetId))+GAP;
    return Math.max(2,Math.floor(2*Math.PI*radius/(asset(chair.assetId).dimensions[0]*chair.scale[0]+.3)));
  });
  for(const [table,members] of chairs.groups)ring(table,members,GAP);
  // 탁자가 없거나 자리가 모자란 의자는 모인 자리에서 한 줄로 나란히.
  if(chairs.left.length){
    const cx=chairs.left.reduce((n,o)=>n+o.position[0],0)/chairs.left.length,cz=chairs.left.reduce((n,o)=>n+o.position[2],0)/chairs.left.length;
    const step=Math.max(...chairs.left.map(o=>asset(o.assetId).dimensions[0]*o.scale[0]))+.4;
    chairs.left.forEach((o,i)=>place(o,[cx+(i-(chairs.left.length-1)/2)*step,0,cz],{yaw:0}));
  }
  // 4. 벤치는 가까운 나무 앞에서 나무를 본다. 나무가 없으면 제자리.
  const benches=share(of('bench'),trees,()=>4);
  for(const [tree,members] of benches.groups)ring(tree,members,.6);
  for(const o of benches.left)place(o,o.position);
  // 5. 남은 화분은 가장 가까운 기준점 곁, 지금 있는 방향 쪽에.
  const hosts=[...tables,...trees,...anchors('bench')];
  for(const o of of('plant')){
    const host=[...hosts].sort((a,b)=>distanceXZ(o.position,a.position)-distanceXZ(o.position,b.position))[0];
    if(!host){place(o,o.position);continue;}
    const a=distanceXZ(o.position,host.position)<EPSILON?0:angleAround(o.position,host.position);
    const r=footprint(host,asset(host.assetId))+footprint(o,asset(o.assetId))+1.2;
    place(o,[host.position[0]+Math.cos(a)*r,0,host.position[2]+Math.sin(a)*r]);
  }
  const same=(a:readonly number[],b:readonly number[])=>a.every((v,i)=>Math.abs(v-b[i])<1e-6);
  return movable.map(where).filter(o=>!same(o.position,scene.objects[o.id].position)||!same(o.rotation,scene.objects[o.id].rotation));
}
