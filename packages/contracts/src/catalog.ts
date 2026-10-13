import type {AssetDefinition} from './scene';
export const BUILTIN_LIBRARY:Record<string,AssetDefinition>={
  chair:{id:'chair',name:'라운지 의자',kind:'chair',color:'#d69c64',dimensions:[0.8,1.05,0.85]},
  table:{id:'table',name:'둥근 테이블',kind:'table',color:'#e7d5bb',dimensions:[1.8,0.85,1.8]},
  tree:{id:'tree',name:'둥근 나무',kind:'tree',color:'#719978',dimensions:[1.9,2.8,1.9]},
  bench:{id:'bench',name:'공원 벤치',kind:'bench',color:'#b98a62',dimensions:[2,0.95,0.7]},
  plant:{id:'plant',name:'화분',kind:'plant',color:'#789e88',dimensions:[0.7,1.08,0.7]},
  cube:{id:'cube',name:'컬러 블록',kind:'cube',color:'#e6b773',dimensions:[1,1,1]},
};
