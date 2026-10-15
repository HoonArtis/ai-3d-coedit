import type {AssetDefinition,SceneObject} from '@coedit/contracts';
/** "어울림" 규칙의 단일 출처. arrange_nicely(배치)와 recommend(추천)가 함께 쓴다. */
export type Role='table'|'chair'|'tree'|'bench'|'plant'|'decor';
const KEYWORDS:[Role,RegExp][]=[
  ['chair',/의자|chair|스툴|소파/i],['table',/탁자|테이블|책상|table|desk/i],['bench',/벤치|bench/i],
  ['tree',/나무|tree/i],['plant',/화분|꽃|plant|flower|선인장/i],
];
/** 생성 에셋은 kind가 generated라 이름으로 역할을 짐작한다. 모르면 decor(제자리 유지). */
export function roleOf(asset:AssetDefinition|undefined):Role{
  if(!asset)return 'decor';
  if(asset.kind==='cube')return 'decor';
  if(asset.kind!=='generated')return asset.kind;
  return KEYWORDS.find(([,re])=>re.test(asset.name))?.[0]??'decor';
}
/** 누가 누구 곁에 놓이는가. 의자는 탁자를 둘러 탁자를 보고, 벤치는 나무 앞에서 나무를 보고, 화분은 탁자 위에 먼저 놓는다. */
export const PARTNER:Partial<Record<Role,Role>>={chair:'table',bench:'tree',plant:'table'};
/** 추천에서 쓰는 생성 아이디어. 어울리는 짝이 다 갖춰졌을 때 새로 만들 거리. */
export const GENERATE_IDEAS:Record<Role|'empty',{prompt:string;reason:string}>={
  table:{prompt:'따뜻한 빛의 탁상 스탠드 조명',reason:'탁자 위 분위기를 더해요'},
  chair:{prompt:'푹신한 원형 쿠션',reason:'의자에 포인트가 돼요'},
  tree:{prompt:'나무에 걸 작은 나무 새집',reason:'나무 곁 이야깃거리가 돼요'},
  bench:{prompt:'옛날 느낌의 가로등',reason:'벤치 옆을 밝혀 줘요'},
  plant:{prompt:'알록달록한 꽃 화단',reason:'화분과 어울리는 정원이 돼요'},
  decor:{prompt:'공간을 대표할 작은 조형물',reason:'공간의 주인공이 돼요'},
  empty:{prompt:'공간의 중심이 될 분수',reason:'빈 공간에 중심을 잡아 줘요'},
};
export const footprint=(object:SceneObject,asset:AssetDefinition)=>Math.max(asset.dimensions[0]*object.scale[0],asset.dimensions[2]*object.scale[2])/2;
export const distanceXZ=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[2]-b[2]);
