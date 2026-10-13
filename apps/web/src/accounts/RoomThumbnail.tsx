import {useMemo} from 'react';
import {Vector3,Matrix4,Quaternion,Euler,Color} from 'three';
import type {AssetDefinition,SceneSnapshot} from '@coedit/contracts';
export function RoomThumbnail({snapshot,library,error}:{snapshot:SceneSnapshot|null;library:Record<string,AssetDefinition>;error:boolean}){
 const faces=useMemo(()=>{
  const projected=Object.values(snapshot?.objects??{}).slice(0,200).sort((a,b)=>a.position[0]+a.position[2]-b.position[0]-b.position[2]).flatMap(o=>{
   const asset=library[o.assetId],size=asset?.dimensions??[1,1,1],matrix=new Matrix4().compose(new Vector3(...o.position),new Quaternion().setFromEuler(new Euler(...o.rotation)),new Vector3(...o.scale));
   const points=Array.from({length:8},(_,i)=>{const v=new Vector3((i&1?.5:-.5)*size[0],(i&2?1:0)*size[1],(i&4?.5:-.5)*size[2]).applyMatrix4(matrix);return [v.x-v.z,(v.x+v.z)*.5-v.y] as const;});
   return [[1,5,7,3],[4,6,7,5],[2,3,7,6]].map((indices,i)=>({id:o.id+'-'+i,color:'#'+new Color(asset?.color??'#78a7ac').offsetHSL(0,0,(i-1)*.09).getHexString(),points:indices.map(index=>points[index])}));
  });
  const all=projected.flatMap(f=>f.points).concat([[-2,-1],[2,1]]),minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1])),scale=Math.min(174/(maxX-minX),90/(maxY-minY));
  return projected.map(f=>({...f,points:f.points.map(([x,y])=>`${100+(x-(minX+maxX)/2)*scale},${60+(y-(minY+maxY)/2)*scale}`).join(' ')}));
 },[snapshot,library]);
 return <svg viewBox="0 0 200 120" role="img" aria-label={error?'배치 미리보기 읽기 실패':'방 배치 미리보기'} data-room-id={snapshot?.roomId} data-scene-seq={snapshot?.seq??0}><rect width="200" height="120" rx="8" fill="#e7eee1"/>{faces.map(f=><polygon key={f.id} points={f.points} fill={f.color} stroke="#456656" strokeWidth=".4"/>)}{!faces.length&&<text x="100" y="65" textAnchor="middle" fill="#849781" fontSize="12">{error?'읽기 실패':'빈 공간'}</text>}</svg>;
}
