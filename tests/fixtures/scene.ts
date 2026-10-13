import { emptyScene, type CommandContext, type SceneSnapshot } from '../../packages/contracts/src/index';
export const context:CommandContext={
  actor:'alice',role:'student',
  library:{chair:{id:'chair',name:'의자',kind:'chair',color:'#ffffff',dimensions:[1,1,1]}},
  locks:{a:{owner:'alice',token:'lease1'}},
};
export const command=(ops:unknown[], overrides:Record<string,unknown>={})=>({actor:'alice',source:'gizmo',requestId:'r1',ops,lockTokens:{a:'lease1'},...overrides});
export const scene=():SceneSnapshot=>({...emptyScene(),objects:{a:{id:'a',assetId:'chair',owner:'alice',name:'의자',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],revision:1,lastActor:'alice'}}});
