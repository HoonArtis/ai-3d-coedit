# 메차카멜레온 1단계(게임 뼈대) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**상태:** 계획만 작성(2026-10-16). 사용자 지시 "구현보다는 이런 식으로 할 거다 먼저 하자, 구현 계획 문서만 적어 두고"에 따라 **아직 구현하지 않는다.** 착수 시 이 문서와 설계 문서를 다시 확인한다.

**Goal:** 회색 마네킹으로 숨기 → 상대 맵 찾기 → 결과 → 다음 판까지, PC 1인칭과 VR이 섞인 2조 순환 숨바꼭질 한 경기를 끝까지 진행한다.

**Architecture:** 편집 방·VR 감상 방은 그대로 두고 Colyseus `hide` 방과 `HideMatchService`를 새로 만든다. 판정·HP·단계 전환은 서버(순수 규칙은 `packages/domain`)가 하고, 이동 충돌·숨는 자리 검사 같은 기하 계산은 웹과 서버가 함께 쓰도록 `packages/placement`에 둔다. 맵은 경기 생성 시점의 조별 최신 VR 굽기 결과로 고정한다.

**Tech Stack:** TypeScript, zod, Colyseus 0.18, PostgreSQL, React Three Fiber 9, drei 10(PointerLockControls), @react-three/xr 6(useXRControllerLocomotion), vitest, Playwright.

**설계 원본:** `docs/superpowers/specs/2026-10-16-mecha-chameleon-design.md`

---

## 0. 착수 전 확인한 코드 사실

| 사실 | 위치 | 계획에 주는 영향 |
|---|---|---|
| 모듈 의존 방향 고정: `apps/web`은 `packages/domain`을 가져올 수 없음 | `tools/check-modules.ts` | 웹도 쓰는 기하 함수는 `packages/placement`, 서버 전용 규칙은 `packages/domain` |
| `packages/domain`·`placement`는 외부 라이브러리 import 금지 | 같은 파일 | 규칙 함수는 zod 없이 contracts 타입만 사용 |
| 학생 토큰은 자기 조 방에만 묶임(`resolveRoomToken`) | `apps/server/src/accounts/service.ts:94` | 상대 맵 GLB·환경은 새 경로에서 "경기 참가자" 권한으로 제공 |
| VR 감상 입장(viewOnly) 세션의 actor = 고른 자리의 학생 id | `014-vr-viewer-sessions.sql`, `class-invites.ts` | VR 술래도 같은 actor로 식별 → `resolveRoomToken(token,room,true)` 사용 |
| 제출본 환경에 장애물 AABB·시작 지점 포함 | `VrBakeService.environment` | 이동 충돌·숨는 자리 검사·자동 배치에 그대로 사용 |
| `canTeleport`(몸통 0.3m·높이 1.8m 스윕) 존재 | `packages/placement/src/navigation.ts` | 1인칭 이동 충돌을 이 함수로 구현 |
| 방 정원 5명은 `RoomCapacity`(편집+감상) | `apps/server/src/rooms/capacity.ts` | 숨바꼭질 방은 정원 집계 제외(상대 술래 5 + 고스트) |
| 포즈 계약 `vrPoseSchema`(머리·양손) | `packages/contracts/src/vr.ts` | PC 술래도 머리 포즈만 채워 같은 계약 재사용 |

## 1. 파일 구조

| 구분 | 파일 | 책임 |
|---|---|---|
| 계약 | `packages/contracts/src/hide-game.ts` (+ `index.ts` export) | 설정·배치·발사·상태·이벤트 스키마, 상수 `HIDE_LIMITS` |
| 규칙 | `packages/domain/src/hide-game.ts` (+ `index.ts` export) | 순환 대진, 발사 결과, 생존 집계, 승패 |
| 기하 | `packages/placement/src/hide.ts` (+ `index.ts` export) | 마네킹 경계, 노출 비율, 숨는 자리 허용, 충돌 이동, 발사 기하 검사 |
| DB | `infra/migrations/015-hide-game.sql` | 경기·이벤트 로그 테이블 |
| VR 서비스 보강 | `apps/server/src/vr/bake-service.ts` | 토큰 없는 내부용 `latestReady`·`artifactFor`·`environmentFor` 분리 |
| 경기 서비스 | `apps/server/src/hide-game/match-service.ts` | 경기 생성·진행 타이머·배치·발사·역할·로그 |
| 방 | `apps/server/src/hide-game/hide-room.ts` | 맵별 Colyseus 방: 포즈 중계, 발사 전달, 개인별 상태 방송 |
| HTTP | `apps/server/src/hide-game/routes.ts` | 강사 경기 API, 학생 배정·배치·맵 파일 |
| 연결 | `apps/server/src/server.ts`, `runtime.ts` | `hide` 방 등록, 서비스 생성·migrate·타이머 시작 |
| 웹 | `apps/web/src/hide-game/api.ts` | 배정 조회 훅, API 호출 |
| 웹 | `apps/web/src/hide-game/Mannequin.tsx` | 회색 마네킹(1단계는 기본 도형), 발견 표시 |
| 웹 | `apps/web/src/hide-game/HidePrepare.tsx` | 숨기 준비 화면(PC) |
| 웹 | `apps/web/src/hide-game/HideSeek.tsx` | 찾기·고스트 화면(PC+VR), HUD |
| 웹 | `apps/web/src/hide-game/PcControls.tsx`, `VrRig.tsx`, `Gun.tsx`, `fire.ts` | 이동·발사 |
| 웹 | `apps/web/src/hide-game/HideGameBanner.tsx` | 편집·VR 로비 상단 경기 안내 |
| 웹 | `apps/web/src/accounts/HideGamePanel.tsx` | 강사 경기 만들기·진행·로그 |
| 웹 | `apps/web/src/App.tsx`, `editor/Editor.tsx`, `vr/VrLobby.tsx`, `accounts/Dashboard.tsx` | 진입 경로·배너·패널 연결 |
| 시험 | `tests/contracts/hide-game.test.ts`, `tests/domain/hide-game.test.ts`, `tests/placement/hide.test.ts`, `tests/integration/hide-game.test.ts`, `tests/e2e/hide-game.spec.ts` | 단계별 검증 |

---

### Task 1: 경기 계약

**Files:**
- Create: `packages/contracts/src/hide-game.ts`
- Modify: `packages/contracts/src/index.ts` (끝에 `export * from './hide-game';`)
- Test: `tests/contracts/hide-game.test.ts`

- [ ] **Step 1: 실패하는 시험 작성**

```ts
import {test,expect} from 'vitest';
import {hideSettingsSchema,hidePlacementSchema,hideFireSchema,hideCreateSchema,HIDE_LIMITS} from '@coedit/contracts';
test('settings default to 7/5/2 minutes and HP 10, and reject out-of-range values',()=>{
 expect(hideSettingsSchema.parse({})).toEqual({prepareSec:420,battleSec:300,rehideSec:120,hp:10});
 expect(()=>hideSettingsSchema.parse({hp:0})).toThrow();expect(()=>hideSettingsSchema.parse({battleSec:5})).toThrow();
});
test('placement scale is limited to 0.8-1.2 and only the stand pose exists in phase 1',()=>{
 const base={pose:'stand',position:[1,0,2],rotationY:0,scale:1};
 expect(hidePlacementSchema.parse(base)).toEqual(base);
 expect(()=>hidePlacementSchema.parse({...base,scale:.5})).toThrow();expect(()=>hidePlacementSchema.parse({...base,pose:'crouch'})).toThrow();
 expect(HIDE_LIMITS).toMatchObject({range:10,originTolerance:1,fireIntervalMs:500});
});
test('fire requires a unit direction and create requires two distinct rooms',()=>{
 expect(hideFireSchema.safeParse({seq:1,origin:[0,1.6,0],direction:[0,0,-1],target:null,point:null}).success).toBe(true);
 expect(hideFireSchema.safeParse({seq:1,origin:[0,1.6,0],direction:[0,0,-3],target:null,point:null}).success).toBe(false);
 expect(hideCreateSchema.safeParse({roomIds:['a','a'],settings:{}}).success).toBe(false);
 expect(hideCreateSchema.safeParse({roomIds:['a'],settings:{}}).success).toBe(false);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/contracts/hide-game.test.ts` → FAIL(`hideSettingsSchema` 없음)

- [ ] **Step 3: 구현**

```ts
import {z} from 'zod';
import {idSchema} from './primitives';
import {vrEnvironmentSchema} from './vr';
const coord=z.number().finite().min(-50).max(50);
export const hidePointSchema=z.tuple([coord,z.number().finite().min(-2).max(10),coord]);
export const HIDE_LIMITS={range:10,originTolerance:1,fireIntervalMs:500,scaleMin:.8,scaleMax:1.2,minExposure:.5} as const;
export const hideSettingsSchema=z.object({
 prepareSec:z.number().int().min(30).max(1800).default(420),battleSec:z.number().int().min(30).max(1800).default(300),
 rehideSec:z.number().int().min(0).max(600).default(120),hp:z.number().int().min(1).max(30).default(10),
}).strict();
export const hidePoseSchema=z.enum(['stand']);
export const hidePlacementSchema=z.object({pose:hidePoseSchema,position:hidePointSchema,rotationY:z.number().finite().min(-7).max(7),scale:z.number().min(HIDE_LIMITS.scaleMin).max(HIDE_LIMITS.scaleMax)}).strict();
export const hideCreateSchema=z.object({roomIds:z.array(idSchema).min(2).max(30).refine(ids=>new Set(ids).size===ids.length,'Duplicate rooms'),settings:hideSettingsSchema}).strict();
export const hideControlSchema=z.object({action:z.enum(['pause','resume','next','end'])}).strict();
export const hideFireSchema=z.object({seq:z.number().int().nonnegative(),origin:hidePointSchema,direction:z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]).refine(d=>Math.abs(Math.hypot(...d)-1)<.01),target:idSchema.nullable(),point:hidePointSchema.nullable()}).strict();
export const hidePhaseSchema=z.enum(['prepare','battle','result','finished']);
export const hideRoundSchema=z.object({pairs:z.array(z.tuple([idSchema,idSchema])),bye:idSchema.nullable()}).strict();
export const hideTeamSchema=z.object({roomId:idSchema,name:z.string(),alive:z.number().int().nonnegative(),total:z.number().int().nonnegative(),wins:z.number().int().nonnegative()}).strict();
export const hideResultSchema=z.object({round:z.number().int().nonnegative(),pair:z.tuple([idSchema,idSchema]),winner:idSchema.nullable()}).strict();
export const hideStatusSchema=z.object({matchId:idSchema,round:z.number().int().nonnegative(),rounds:z.array(hideRoundSchema),phase:hidePhaseSchema,endsAt:z.number().nullable(),pausedMs:z.number().nullable(),settings:hideSettingsSchema,teams:z.array(hideTeamSchema),results:z.array(hideResultSchema)}).strict();
export const hideHiderSchema=z.object({actor:idSchema,roomId:idSchema,placement:hidePlacementSchema,found:z.boolean(),auto:z.boolean()}).strict();
export const hideMeSchema=z.object({actor:idSchema,roomId:idSchema,target:idSchema.nullable(),hp:z.number().int().nonnegative(),hidden:z.boolean(),seeking:z.boolean()}).strict();
export const hideAssignmentSchema=z.object({status:hideStatusSchema,me:hideMeSchema,team:z.array(hideHiderSchema.extend({placement:hidePlacementSchema.nullable()}))}).strict().nullable();
export const hideMapStateSchema=z.object({status:hideStatusSchema,mapRoom:idSchema,role:z.enum(['seeker','ghost']),hp:z.number().int().nonnegative(),hiders:z.array(hideHiderSchema)}).strict();
export const hideMapSchema=vrEnvironmentSchema;
export const hideShotSchema=z.discriminatedUnion('kind',[z.object({kind:z.literal('found'),target:idSchema,hp:z.number().int()}).strict(),z.object({kind:z.literal('miss'),hp:z.number().int()}).strict(),z.object({kind:z.literal('rejected'),code:z.string()}).strict()]);
export const hideEventTypeSchema=z.enum(['match-created','phase','placed','auto-placed','shot','found','hp-zero','round-end','match-end','paused','resumed','join','leave','aborted']);
export const hideEventSchema=z.object({id:z.number().int(),round:z.number().int(),at:z.string(),type:hideEventTypeSchema,actor:idSchema.nullable(),data:z.record(z.string(),z.unknown())}).strict();
export type HideSettings=z.infer<typeof hideSettingsSchema>;export type HidePlacement=z.infer<typeof hidePlacementSchema>;export type HideFire=z.infer<typeof hideFireSchema>;
export type HidePhase=z.infer<typeof hidePhaseSchema>;export type HideRound=z.infer<typeof hideRoundSchema>;export type HideStatus=z.infer<typeof hideStatusSchema>;
export type HideHider=z.infer<typeof hideHiderSchema>;export type HideAssignment=z.infer<typeof hideAssignmentSchema>;export type HideMapState=z.infer<typeof hideMapStateSchema>;
export type HideShot=z.infer<typeof hideShotSchema>;export type HideEvent=z.infer<typeof hideEventSchema>;export type HideEventType=z.infer<typeof hideEventTypeSchema>;
```

- [ ] **Step 4: 통과 확인** — 같은 명령 PASS, `npm run typecheck` PASS
- [ ] **Step 5: 커밋** — `git commit -m "숨바꼭질 경기 계약 추가"`

---

### Task 2: 경기 규칙(순수 함수)

**Files:**
- Create: `packages/domain/src/hide-game.ts`
- Modify: `packages/domain/src/index.ts` (`export * from './hide-game';`)
- Test: `tests/domain/hide-game.test.ts`

- [ ] **Step 1: 실패하는 시험 작성**

```ts
import {test,expect} from 'vitest';
import {roundRobin,resolveShot,teamAlive,pairWinner,type HidePlayer} from '@coedit/domain';
test('round robin meets every pair once; odd team counts rest one team per round',()=>{
 const four=roundRobin(['a','b','c','d']);expect(four).toHaveLength(3);
 const met=four.flatMap(r=>r.pairs.map(p=>[...p].sort().join('')));expect(new Set(met).size).toBe(6);expect(four.every(r=>r.bye===null)).toBe(true);
 const three=roundRobin(['a','b','c']);expect(three).toHaveLength(3);expect(three.map(r=>r.bye).sort()).toEqual(['a','b','c']);
 expect(()=>roundRobin(['a'])).toThrow('NEED_TWO_TEAMS');
});
const players=()=>new Map<string,HidePlayer>([['a1',{actor:'a1',roomId:'A',hp:2,hidden:true,seeking:true}],['b1',{actor:'b1',roomId:'B',hp:2,hidden:true,seeking:true}],['b2',{actor:'b2',roomId:'B',hp:2,hidden:true,seeking:true}]]);
const round={pairs:[['A','B']] as [string,string][],bye:null};
test('miss costs 1 HP, HP 0 stops seeking but keeps the hidden body alive',()=>{
 const p=players();expect(resolveShot(p,round,2,{shooter:'a1',mapRoom:'B',target:null})).toEqual({kind:'miss',hp:1});
 expect(resolveShot(p,round,2,{shooter:'a1',mapRoom:'B',target:null})).toEqual({kind:'miss',hp:0});
 expect(p.get('a1')).toMatchObject({hidden:true,seeking:false});expect(resolveShot(p,round,2,{shooter:'a1',mapRoom:'B',target:'b1'})).toEqual({kind:'rejected',code:'CANNOT_SEEK'});
});
test('finding eliminates the target even while seeking and resets shooter HP',()=>{
 const p=players();resolveShot(p,round,2,{shooter:'a1',mapRoom:'B',target:null});
 expect(resolveShot(p,round,2,{shooter:'a1',mapRoom:'B',target:'b1'})).toEqual({kind:'found',target:'b1',hp:2});
 expect(p.get('b1')).toMatchObject({hidden:false,seeking:false});expect(resolveShot(p,round,2,{shooter:'b1',mapRoom:'A',target:'a1'})).toEqual({kind:'rejected',code:'CANNOT_SEEK'});
 expect(resolveShot(p,round,2,{shooter:'a1',mapRoom:'B',target:'b1'})).toEqual({kind:'rejected',code:'ALREADY_FOUND'});
 expect(resolveShot(p,round,2,{shooter:'a1',mapRoom:'A',target:null})).toEqual({kind:'rejected',code:'WRONG_MAP'});
 expect(resolveShot(p,round,2,{shooter:'a1',mapRoom:'B',target:'a1'})).toEqual({kind:'miss',hp:1});
});
test('alive counts and winner: more survivors wins, equal is a draw',()=>{
 const p=players();expect(teamAlive(p,'B')).toBe(2);expect(pairWinner(p,['A','B'])).toBe('B');
 p.get('b1')!.hidden=false;expect(pairWinner(p,['A','B'])).toBeNull();
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/domain/hide-game.test.ts` → FAIL
- [ ] **Step 3: 구현**

```ts
import type {HideRound} from '@coedit/contracts';
export type HidePlayer={actor:string;roomId:string;hp:number;hidden:boolean;seeking:boolean};
export type ShotInput={shooter:string;mapRoom:string;target:string|null};
export type ShotOutcome={kind:'found';target:string;hp:number}|{kind:'miss';hp:number}|{kind:'rejected';code:string};
/** Circle method. '' marks the resting slot for an odd team count. */
export function roundRobin(rooms:string[]):HideRound[]{
 if(rooms.length<2)throw Error('NEED_TWO_TEAMS');const list=[...rooms];if(list.length%2)list.push('');
 const n=list.length,rounds:HideRound[]=[];
 for(let r=0;r<n-1;r++){
  const pairs:[string,string][]=[];let bye:string|null=null;
  for(let i=0;i<n/2;i++){const a=list[i],b=list[n-1-i];if(!a||!b)bye=a||b;else pairs.push([a,b]);}
  rounds.push({pairs,bye});list.splice(1,0,list.pop()!);
 }
 return rounds;
}
export function opponentOf(round:HideRound,roomId:string){for(const [a,b] of round.pairs){if(a===roomId)return b;if(b===roomId)return a;}return null;}
/** Mutates the shooter and target in place; the caller owns the live map. */
export function resolveShot(players:Map<string,HidePlayer>,round:HideRound,maxHp:number,input:ShotInput):ShotOutcome{
 const shooter=players.get(input.shooter);if(!shooter)return {kind:'rejected',code:'NOT_PLAYER'};
 if(!shooter.hidden||!shooter.seeking||shooter.hp<=0)return {kind:'rejected',code:'CANNOT_SEEK'};
 if(opponentOf(round,shooter.roomId)!==input.mapRoom)return {kind:'rejected',code:'WRONG_MAP'};
 const target=input.target===null?undefined:players.get(input.target);
 if(target&&target.roomId===input.mapRoom){
  if(!target.hidden)return {kind:'rejected',code:'ALREADY_FOUND'};
  target.hidden=false;target.seeking=false;shooter.hp=maxHp;return {kind:'found',target:target.actor,hp:shooter.hp};
 }
 shooter.hp=Math.max(0,shooter.hp-1);if(shooter.hp===0)shooter.seeking=false;return {kind:'miss',hp:shooter.hp};
}
export function teamAlive(players:Map<string,HidePlayer>,roomId:string){let n=0;for(const p of players.values())if(p.roomId===roomId&&p.hidden)n++;return n;}
export function pairOver(players:Map<string,HidePlayer>,[a,b]:[string,string]){return teamAlive(players,a)===0||teamAlive(players,b)===0;}
export function pairWinner(players:Map<string,HidePlayer>,[a,b]:[string,string]){const x=teamAlive(players,a),y=teamAlive(players,b);return x===y?null:x>y?a:b;}
```

- [ ] **Step 4: 통과 확인** — PASS, `npm run check:modules` PASS
- [ ] **Step 5: 커밋** — `git commit -m "숨바꼭질 순환 대진·발사 판정 규칙"`

---

### Task 3: 숨는 자리·이동·발사 기하

**Files:**
- Create: `packages/placement/src/hide.ts`
- Modify: `packages/placement/src/index.ts` (`export * from './hide';`)
- Test: `tests/placement/hide.test.ts`

- [ ] **Step 1: 실패하는 시험 작성**

```ts
import {test,expect} from 'vitest';
import {mannequinBounds,exposure,canHideAt,moveWithCollision,shotGeometryOk} from '@coedit/placement';
const box={min:[-1,0,-1] as [number,number,number],max:[1,2,1] as [number,number,number]};
const at=(x:number,z:number,scale=1)=>({pose:'stand' as const,position:[x,0,z] as [number,number,number],rotationY:0,scale});
test('mannequin bounds follow scale and position',()=>{const b=mannequinBounds(at(3,0,1.2));expect(b.min[1]).toBe(0);expect(b.max[1]).toBeCloseTo(1.7*1.2);expect(b.min[0]).toBeCloseTo(3-.3);});
test('a body more than half inside furniture cannot hide; half outside can',()=>{
 expect(exposure(at(0,0),[box])).toBe(0);expect(canHideAt(at(0,0),[box])).toBe(false);
 expect(exposure(at(5,5),[box])).toBe(1);expect(canHideAt(at(5,5),[box])).toBe(true);
 expect(canHideAt(at(1.1,0),[box])).toBe(true);expect(canHideAt(at(60,0),[])).toBe(false);
});
test('movement slides along walls and ghosts pass through',()=>{
 expect(moveWithCollision([-2,0,0],[1.5,0,0],[box],false)).toEqual([-2,0,0]);
 expect(moveWithCollision([-2,0,-2],[1.5,0,.5],[box],false)).toEqual([-2,0,-1.5]);
 expect(moveWithCollision([-2,0,0],[3,0,0],[box],true)).toEqual([1,0,0]);
});
test('shots must start near the shooter, stay in range and land on the target',()=>{
 const target=mannequinBounds(at(0,-5));
 expect(shotGeometryOk({origin:[0,1.6,0],head:[0,1.6,.2],point:[0,1,-5],target})).toBe(true);
 expect(shotGeometryOk({origin:[0,1.6,0],head:[3,1.6,0],point:[0,1,-5],target})).toBe(false);
 expect(shotGeometryOk({origin:[0,1.6,10],head:[0,1.6,10],point:[0,1,-5],target})).toBe(false);
 expect(shotGeometryOk({origin:[0,1.6,0],head:[0,1.6,0],point:[2,1,-5],target})).toBe(false);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/placement/hide.test.ts` → FAIL
- [ ] **Step 3: 구현**

```ts
import {HIDE_LIMITS,type HidePlacement,type Vec3} from '@coedit/contracts';
import type {Bounds} from './geometry';
import {canTeleport} from './navigation';
export const MANNEQUIN={width:.6,height:1.7,depth:.35} as const;
export function mannequinBounds(p:HidePlacement):Bounds{
 const s=p.scale,c=Math.abs(Math.cos(p.rotationY)),n=Math.abs(Math.sin(p.rotationY));
 const hx=(MANNEQUIN.width*c+MANNEQUIN.depth*n)*s/2,hz=(MANNEQUIN.width*n+MANNEQUIN.depth*c)*s/2,[x,y,z]=p.position;
 return {min:[x-hx,y,z-hz],max:[x+hx,y+MANNEQUIN.height*s,z+hz]};
}
const inside=(q:Vec3,b:Bounds)=>[0,1,2].every(i=>q[i]>=b.min[i]&&q[i]<=b.max[i]);
/** Fraction of 4x8x4 sample points of the body not covered by any obstacle. */
export function exposure(p:HidePlacement,obstacles:Bounds[]){
 const b=mannequinBounds(p);let open=0,total=0;
 for(let i=0;i<4;i++)for(let j=0;j<8;j++)for(let k=0;k<4;k++){
  const q:Vec3=[b.min[0]+(b.max[0]-b.min[0])*(i+.5)/4,b.min[1]+(b.max[1]-b.min[1])*(j+.5)/8,b.min[2]+(b.max[2]-b.min[2])*(k+.5)/4];
  total++;if(!obstacles.some(o=>inside(q,o)))open++;
 }
 return open/total;
}
export function canHideAt(p:HidePlacement,obstacles:Bounds[]){const [x,y,z]=p.position;return Math.abs(x)<=49.7&&Math.abs(z)<=49.7&&y>=0&&exposure(p,obstacles)>=HIDE_LIMITS.minExposure;}
/** Rig origin stays on the floor. Blocked full moves fall back to one axis so players slide along walls. */
export function moveWithCollision(from:Vec3,delta:Vec3,obstacles:Bounds[],ghost:boolean):Vec3{
 const clamp=(n:number)=>Math.max(-49.7,Math.min(49.7,n));
 if(ghost)return [clamp(from[0]+delta[0]),Math.max(0,Math.min(8,from[1]+delta[1])),clamp(from[2]+delta[2])];
 const floor:Vec3=[from[0],0,from[2]];
 for(const step of [[delta[0],delta[2]],[delta[0],0],[0,delta[2]]]){const to:Vec3=[clamp(floor[0]+step[0]),0,clamp(floor[2]+step[1])];if(canTeleport(floor,to,obstacles))return to;}
 return floor;
}
const dist=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function shotGeometryOk({origin,head,point,target}:{origin:Vec3;head:Vec3;point:Vec3;target:Bounds}){
 if(dist(origin,head)>HIDE_LIMITS.originTolerance)return false;
 if(dist(origin,point)>HIDE_LIMITS.range)return false;
 const pad=.3;return [0,1,2].every(i=>point[i]>=target.min[i]-pad&&point[i]<=target.max[i]+pad);
}
```

- [ ] **Step 4: 통과 확인** — PASS, `npm run check:modules` PASS
- [ ] **Step 5: 커밋** — `git commit -m "마네킹 숨는 자리·충돌 이동·발사 기하 검사"`

---

### Task 4: DB와 VR 서비스 내부 경로

**Files:**
- Create: `infra/migrations/015-hide-game.sql`
- Modify: `apps/server/src/vr/bake-service.ts` (`artifact`·`environment`에서 권한 확인 뒤 내부 함수 호출)
- Test: 기존 `tests/integration/vr-registration.test.ts`(회귀)

- [ ] **Step 1: 마이그레이션 작성**

```sql
CREATE TABLE IF NOT EXISTS coedit_hide_matches (
 id text PRIMARY KEY, class_id text NOT NULL REFERENCES coedit_classes(id) ON DELETE CASCADE, teacher_id text NOT NULL,
 settings jsonb NOT NULL, rooms jsonb NOT NULL, schedule jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS coedit_hide_matches_class ON coedit_hide_matches(class_id,created_at DESC);
CREATE TABLE IF NOT EXISTS coedit_hide_events (
 id bigserial PRIMARY KEY, match_id text NOT NULL REFERENCES coedit_hide_matches(id) ON DELETE CASCADE,
 round integer NOT NULL, at timestamptz NOT NULL DEFAULT now(), type text NOT NULL, actor text, data jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS coedit_hide_events_match ON coedit_hide_events(match_id,id);
```

- [ ] **Step 2: VR 서비스 분리** — 토큰 확인은 기존 공개 메서드에 남기고 아래 내부 메서드를 추가한다.

```ts
  async latestReady(roomId:string):Promise<string|null>{
    const {rows}=await this.accounts.pool.query("SELECT b.snapshot_id FROM coedit_vr_bakes b JOIN coedit_submissions s ON s.id=b.snapshot_id WHERE s.room_id=$1 AND b.state='ready' ORDER BY s.seq DESC,b.created_at DESC LIMIT 1",[roomId]);
    return rows[0]?.snapshot_id??null;
  }
  async artifactFor(roomId:string,snapshotId:string){
    const row=(await this.accounts.pool.query("SELECT b.manifest_id,b.source_key FROM coedit_vr_bakes b JOIN coedit_submissions s ON s.id=b.snapshot_id WHERE b.snapshot_id=$1 AND s.room_id=$2 AND b.state='ready'",[snapshotId,roomId])).rows[0];
    if(!row)throw Error('VR_NOT_READY');const manifest=await this.verifyManifest(row.manifest_id,snapshotId,row.source_key);return {manifest,bytes:await this.store.get(manifest.key)};
  }
  async environmentFor(roomId:string,snapshotId:string){
    const {manifest}=await this.artifactFor(roomId,snapshotId);
    const source=vrSourceSchema.parse(JSON.parse(new TextDecoder().decode(await this.store.get(manifest.sourceKey))));
    const obstacles=Object.values(source.snapshot.objects).map(object=>boundsOf(object,source.library[object.assetId]));
    return vrEnvironmentSchema.parse({manifest,obstacles,spawn:findSpawn(obstacles)});
  }
  async artifact(token:string,roomId:string,snapshotId:string){await this.accounts.resolveRoomToken(token,roomId,true);return this.artifactFor(roomId,snapshotId);}
  async environment(token:string,roomId:string,snapshotId:string){await this.accounts.resolveRoomToken(token,roomId,true);return this.environmentFor(roomId,snapshotId);}
```

- [ ] **Step 3: 회귀 확인** — `npx vitest run tests/integration/vr-registration.test.ts tests/integration/vr-seat-entry.test.ts` PASS(동작 변화 없음)
- [ ] **Step 4: 커밋** — `git commit -m "숨바꼭질 테이블과 VR 굽기 내부 조회 분리"`

---

### Task 5: 경기 서비스

**Files:**
- Create: `apps/server/src/hide-game/match-service.ts`
- Test: `tests/integration/hide-game.test.ts` (실제 Postgres 스키마 + 가짜 VR 서비스 + 가짜 시계)

**책임과 공개 메서드**

| 메서드 | 하는 일 | 오류 코드 |
|---|---|---|
| `migrate()` | 015 실행, 미종료 경기에 `aborted` 이벤트·`finished_at` 기록(재시작 시 진행 중 경기는 중단으로 처리) | |
| `create(token,classId,raw)` | 강사·수업 확인 → 방이 그 수업 소속인지 → 진행 중 경기 없음 → 방마다 `latestReady` 고정 → 환경 로드 → 학생 목록(`coedit_students`, archived 제외) → `roundRobin` → 1판 `prepare` 시작 | `FORBIDDEN`, `MATCH_ACTIVE`, `NO_SUBMISSION:<방이름>`, `NO_PLAYERS` |
| `current(token,classId)` | 강사용 진행 상태(`HideStatus`) 또는 null | |
| `control(token,matchId,action)` | `pause`/`resume`(남은 시간 보존), `next`(준비→대결 즉시, 대결→결과 즉시, 결과→다음 판 또는 종료), `end`(즉시 종료) | `BAD_PHASE` |
| `assignment(token,roomId)` | 학생·VR 자리: 진행 중 경기, 내 상태, 같은 조 배치 목록 | |
| `place(token,roomId,raw)` | `prepare` 중, `canHideAt` 통과 시 저장, `placed` 로그 | `BAD_PHASE`, `BAD_SPOT` |
| `mapAccess(token,homeRoom,matchId,mapRoom)` | 자기 맵은 항상, 다른 맵은 `battle` 이후 또는 강사 | `FORBIDDEN` |
| `roleOf(matchId,actor,teacher,homeRoom,mapRoom)` | `seeker`(대결 중·상대 맵·seeking) / `ghost`(발견됨: 모든 맵, HP 0: 자기 맵 제외, 휴식 조·강사: 모든 맵) / null | |
| `fire(matchId,actor,mapRoom,shot,head)` | 대결·일시정지 아님·0.5초 간격·`shotGeometryOk`·`resolveShot` → 로그 → 짝 종료 확인 | `rejected` 결과로 반환 |
| `tick()` | 일시정지 아니면 시간 만료 처리: 준비→대결(미배치 자동 배치), 대결→결과(승자·승수 기록) | |
| `subscribe(matchId,fn)` | 상태 변경 알림(방 방송용) | |
| `events(token,matchId)` | 강사용 로그(시간순) | |

**핵심 구현 규칙**
- 진행 상태는 서버 메모리(`Map<matchId,Live>`), 경기 정의와 이벤트만 DB 저장. 서버 1대 운영 전제이며 재시작 시 진행 중 경기는 `aborted`.
- 시계는 생성자 인자 `now=()=>Date.now()`로 주입, `start()`가 `setInterval(()=>this.tick(),250)` 등록, `stop()`으로 해제.
- 대결 시작 시 각 판의 대진 쌍마다 판 상태를 따로 판정한다. 한 쌍이 먼저 끝나도 다른 쌍은 계속되고, 모든 쌍이 끝나거나 시간이 다 되면 `result`.
- 다음 판 시작 시 모든 참가자를 `hidden:true, seeking:true, hp:settings.hp`로 되돌리고 배치는 유지한다. `rehideSec`가 0이면 바로 `battle`.
- 휴식 조 학생은 그 판에서 `seeking:false`, 고스트로만 입장.
- 자동 배치: 자기 맵 `spawn` 주변 0.8m 간격 나선 위치 중 `canHideAt` 첫 지점, 없으면 `spawn`. `auto-placed` 로그.
- 모든 상태 변화는 `log(type,actor,data)`로 DB에 쓰고 `subscribe` 알림을 보낸다.

- [ ] **Step 1: 실패하는 통합 시험 작성** — 아래 시나리오를 하나씩 `test`로 작성한다(Postgres 스키마 생성은 `tests/integration/vr-seat-entry.test.ts`와 같은 방식).
  1. 2개 방(학생 각 2명), 가짜 VR(`latestReady`는 고정 id, `environmentFor`는 장애물 1개·spawn `[0,0,0]`) → `create` → `phase:'prepare'`, `rounds.length===1`.
  2. 제출본 없는 방 포함 시 `NO_SUBMISSION:2조`.
  3. `place`: 장애물 속 → `BAD_SPOT`, 빈 곳 → 저장, `assignment.team`에 보임, 상대 조 `assignment`에는 안 보임.
  4. 시계를 7분 진행 후 `tick()` → `battle`, 미배치 학생은 `auto:true`로 배치, 이벤트 `auto-placed`.
  5. `fire` 헛발 2회(hp 10→8), 0.5초 안 연속 발사는 `rejected:TOO_FAST`, 원점 위조는 `rejected:BAD_GEOMETRY`.
  6. 상대 2명 모두 명중 → 그 쌍 종료 → `result`, 승자 기록, 이벤트 `found`×2·`round-end`.
  7. `roleOf`: 발견된 학생은 어느 맵이든 `ghost`, HP 0 학생은 자기 맵 null·상대 맵 `ghost`, 살아 있는 술래는 자기 맵 null.
  8. `control next` → `finished`, `match-end` 이벤트, 같은 수업 새 경기 생성 가능.
  9. `pause` 후 시계 진행해도 단계 유지, `resume` 시 남은 시간 복원.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/integration/hide-game.test.ts` → FAIL
- [ ] **Step 3: 서비스 구현** — 위 표·규칙대로 작성. 규칙 판단은 `@coedit/domain`, 기하는 `@coedit/placement` 함수만 호출하고 서비스 안에서 다시 계산하지 않는다(CLAUDE.md 중복 방지 항목).
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: 커밋** — `git commit -m "숨바꼭질 경기 서비스: 진행·배치·판정·로그"`

---

### Task 6: 숨바꼭질 방과 HTTP 경로

**Files:**
- Create: `apps/server/src/hide-game/hide-room.ts`, `apps/server/src/hide-game/routes.ts`
- Modify: `apps/server/src/server.ts` (옵션 `hide?:HideMatchService`, 라우트·방 등록), `apps/server/src/runtime.ts` (생성·migrate·start)
- Test: `tests/integration/hide-game.test.ts`에 방·HTTP 시험 추가

**HTTP 경로** (`vr/routes.ts`와 같은 오류 처리: UNAUTHENTICATED 401, FORBIDDEN 403, 그 외 400, 한국어 `error` 메시지)

| 메서드 | 경로 | 사용자 |
|---|---|---|
| POST | `/api/classes/:classId/hide-games` `{roomIds,settings}` | 강사 |
| GET | `/api/classes/:classId/hide-games/current` | 강사 |
| POST | `/api/hide-games/:matchId/control` `{action}` | 강사 |
| GET | `/api/hide-games/:matchId/events` | 강사 |
| GET | `/api/rooms/:roomId/hide-game` | 학생·VR 자리 |
| POST | `/api/rooms/:roomId/hide-game/placement` `{placement}` | 학생 |
| GET | `/api/rooms/:roomId/hide-game/maps/:mapRoom` | 학생·VR·강사 (환경 JSON) |
| GET | `/api/rooms/:roomId/hide-game/maps/:mapRoom/glb` | 같음 (`Cache-Control: private, no-store`) |

**방 `hide`** (`filterBy(['matchId','mapRoom'])`, `maxClients=64`, 정원 집계 제외)
- `onAuth({token,homeRoom,matchId,mapRoom})`: `accounts.resolveRoomToken(token,homeRoom,true)` → `roleOf`가 null이면 `FORBIDDEN`.
- `onJoin`: `StudentConnections.add`(학생 관리의 접속 종료가 이 방에도 적용), `join` 로그, 개인 상태 전송.
- `pose`: `vrPoseSchema` 검증, 90ms 간격 제한(감상 방과 동일), 최근 머리 위치 저장.
- `fire`: `hideFireSchema` 검증 → `fire(..., 최근 머리 위치)` → 보낸 사람에게 `shot`(`hideShotSchema`).
- 방송 100ms: 받는 사람별로 `poses` 구성(살아 있는 술래는 살아 있는 술래만, 고스트는 전부), 상태 변경 시 각자 `state`(`hideMapStateSchema`: 역할·HP 포함). 역할이 null로 바뀐 접속(예: 숨기 준비로 돌아감)은 `leave(4004)`.
- 재접속 15초 허용(감상 방과 동일).

- [ ] **Step 1: 실패하는 시험 추가** — `startServer(0,false,{accounts,vr:fakeVr,hide})`로 띄우고 Colyseus 클라이언트로:
  1. 준비 단계에 상대 맵 입장 → `FORBIDDEN`.
  2. 대결 단계: A조 2명 B맵 입장, 포즈 전송 → 서로 보임. B조 학생은 B맵 입장 불가.
  3. `fire` 메시지 → `shot` 응답, 명중 시 B맵 `state.hiders`의 `found:true`, 발견된 학생이 B맵 `ghost`로 입장 가능, 고스트 포즈는 살아 있는 술래에게 안 보임.
  4. HTTP: 대결 전 상대 맵 GLB 403, 대결 중 200, 다른 수업 강사 403.
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 방·경로·서버 연결 구현**
- [ ] **Step 4: 통과 확인** — 새 시험 PASS, `npm test` 전체 PASS(기존 회귀), `npm run check:modules` PASS
- [ ] **Step 5: 커밋** — `git commit -m "숨바꼭질 방과 경기 API 연결"`

---

### Task 7: 웹 공통(API 훅·마네킹·배너·진입 경로)

**Files:**
- Create: `apps/web/src/hide-game/api.ts`, `Mannequin.tsx`, `HideGameBanner.tsx`, `hide-game.css`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/editor/Editor.tsx`(상단 배너), `apps/web/src/vr/VrLobby.tsx`(상단 배너)

- **`api.ts`**: `useAssignment(roomId)` — `/rooms/:roomId/hide-game`을 1초마다 조회해 `hideAssignmentSchema`로 검증. `savePlacement(roomId,placement)`.
- **`Mannequin.tsx`**: 1단계는 회색(`#9a9f9c`) 기본 도형 사람(머리 구, 몸통·팔·다리 상자). 크기는 `MANNEQUIN`(placement 패키지)과 일치. 최상위 그룹 `userData.hider=actor`(발사 광선 판정용). `found`이면 빨간 반투명과 바닥 고리, `teammate`이면 반투명 테두리(drei `Edges`).
- **`HideGameBanner.tsx`**: 경기가 있으면 단계와 남은 시간, 버튼 표시.
  - `prepare`: "숨기 준비하기" → `/?hide-prepare=<matchId>`
  - `battle`·`result`: "찾으러 가기"/"구경하기" → `/?hide-seek=<matchId>`
  - 휴식 조: "이번 판은 쉬어요 · 구경하기"
- **`App.tsx`**: `hide-prepare`·`hide-seek` 쿼리를 VR 분기보다 먼저 처리. `roomKey`는 기존 `coedit-account-identity`에서 읽는다. VR 자리(viewOnly)는 `hide-seek`만 허용.

- [ ] **Step 1:** Playwright 시험 `tests/e2e/hide-game.spec.ts` 첫 단계 작성: 강사 API로 수업(2개 방)·학생·제출(VR 굽기 완료 대기, `vr.spec.ts`와 같은 방식)·경기 생성 → 학생 화면에 "숨기 준비하기" 배너 표시 확인.
- [ ] **Step 2:** 실패 확인 → **Step 3:** 구현 → **Step 4:** 통과 확인
- [ ] **Step 5:** 커밋 `git commit -m "숨바꼭질 배너와 진입 경로"`

---

### Task 8: 숨기 준비 화면(PC)

**Files:** Create `apps/web/src/hide-game/HidePrepare.tsx`

- 자기 맵 GLB(`/rooms/:room/hide-game/maps/:room/glb`)를 `GeneratedModelProvider`+`ProtectedModel`로 표시, `OrbitControls`.
- 조원 마네킹은 반투명 표시(`assignment.team`), 내 마네킹은 진하게.
- 맵을 클릭하면 맞은 지점에 내 마네킹 이동(물건 위에도 설 수 있음). 오른쪽 패널에 방향 슬라이더(0~360°), 크기 슬라이더(0.8~1.2), "이 자리에 숨기" 버튼.
- 화면에서도 `canHideAt`로 미리 검사해 불가하면 버튼 비활성 + "몸의 절반 이상이 물건 밖에 보여야 해요." 표시. 서버 `BAD_SPOT`도 같은 문구.
- 남은 시간 표시, `battle`로 바뀌면 "대결 시작! 찾으러 가기" 버튼으로 전환.

- [ ] **Step 1:** e2e에 단계 추가: 학생 1이 맵 클릭 → 저장 → 조원 학생 2 화면에 반투명 마네킹 1개(`aria-label="조원 마네킹 수"` 텍스트 "1") 확인.
- [ ] **Step 2~4:** 실패 확인 → 구현 → 통과
- [ ] **Step 5:** 커밋 `git commit -m "숨기 준비 화면"`

---

### Task 9: 찾기 화면(PC 1인칭·VR·고스트)

**Files:** Create `apps/web/src/hide-game/HideSeek.tsx`, `PcControls.tsx`, `VrRig.tsx`, `Gun.tsx`, `fire.ts`

- **접속**: `assignment.me.target` 맵의 `hide` 방에 입장(고스트는 맵 선택 버튼으로 다른 맵 방에 다시 입장). 맵 환경·GLB는 Task 6 경로.
- **`fire.ts`**: `castShot(scene,origin,direction)` — three `Raycaster`(far 10m)로 맵과 마네킹을 함께 검사해 첫 대상의 조상 `userData.hider`를 `target`으로, 맞은 점을 `point`로 만든다. 순서 번호를 붙여 `fire` 전송.
- **PC (`PcControls.tsx`)**: drei `PointerLockControls`. WASD 4m/s, 매 프레임 `moveWithCollision`. 고스트는 Space/Shift로 상하, 충돌 없음. 클릭으로 발사(조준점 화면 중앙). 머리 포즈를 100ms마다 `pose`로 전송(`left/right:null`).
- **VR (`VrRig.tsx`)**: `createXRStore`는 `VrLobby.tsx`와 같은 설정에 `controller:{teleportPointer:false}`. `useXRControllerLocomotion` 콜백에서 속도를 `moveWithCollision`으로 적용(왼쪽 스틱 이동), 회전은 `{type:'snap',degrees:30}`(오른쪽 스틱). `useXRInputSourceEvent('all','select',...)`에서 오른손일 때 `event.frame.getPose(inputSource.targetRaySpace,referenceSpace)`로 원점·방향을 구해 `castShot`. 포즈는 기존 `poseFromFrame` 재사용.
- **`Gun.tsx`**: 1단계는 기본 도형 권총(손잡이·총열 상자), PC는 카메라 오른쪽 아래, VR은 오른손. 발사 시 총구 빛 80ms, 맞은 자리 작은 구 300ms.
- **HUD**: PC는 HTML 겹침(남은 시간, HP 칸, 조별 생존 수, 최근 판정 "찾았다!/빗나감 −1", 결과 화면). VR은 drei `Text`를 왼손 위에 표시(남은 시간·HP·생존 수).
- **고스트**: 몸 반투명, 숨은 마네킹 전부 노란 테두리, "다른 맵 보기" 버튼. 살아 있는 술래 화면에는 고스트가 보이지 않음(서버가 포즈를 보내지 않음).
- **결과**: `result`에서 승패·생존·발견 기록 표시, 강사가 다음 판을 열면 배너 흐름으로 돌아감.

- [ ] **Step 1:** e2e에 단계 추가(헤드리스 PC 두 창): 강사 `control next`로 대결 시작 → A조 학생 화면 `?hide-seek` → 시험용 전역 훅 `window.__hideTest.fireAt(actor|null)`(개발 빌드에서만 노출)로 헛발 1회 → HP 표시 9 → 명중 → B조 학생 화면에 "발견됐어요 · 구경 모드" 표시 → 결과 화면에 승자 표시. 스크린숏 `docs/evidence/hide-game-*.png`.
- [ ] **Step 2:** VR은 `vr.spec.ts`처럼 가짜 `navigator.xr`로 "VR 입장" 버튼 1회 요청만 확인(실기기 이동·발사는 사용자 헤드셋 확인 항목).
- [ ] **Step 3~4:** 구현 → 통과
- [ ] **Step 5:** 커밋 `git commit -m "찾기 화면: PC 1인칭·VR·고스트·HUD"`

---

### Task 10: 강사 경기 패널

**Files:** Create `apps/web/src/accounts/HideGamePanel.tsx`; Modify `apps/web/src/accounts/Dashboard.tsx`(수업 카드에 "숨바꼭질" 버튼)

- **만들기**: 조 체크 상자(기본 전체), 숨기·대결·재숨기 시간(분), HP. "경기 시작" → POST. `NO_SUBMISSION:<방이름>`이면 "<방이름>에 제출본이 없어요. 먼저 VR 감상에서 작품을 제출해 주세요."
- **진행**: 현재 판/전체 판, 단계, 남은 시간, 대진표(판별 쌍·휴식 조), 조별 생존/전체·승수, 버튼 일시정지/재개/다음 단계/경기 끝내기(끝내기는 화면 안 확인 단계 포함).
- **로그**: 이벤트 표(시각, 판, 종류, 학생 자리 번호, 내용), 학생별 명중률(발견 수 ÷ 발사 수).

- [ ] **Step 1:** e2e 첫 단계를 API 대신 패널 조작으로 바꾸고 로그 표에 `found` 행 확인
- [ ] **Step 2~4:** 실패 확인 → 구현 → 통과
- [ ] **Step 5:** 커밋 `git commit -m "강사 숨바꼭질 패널"`

---

### Task 11: 마무리 검증과 기록

- [ ] `npm test`, `npm run typecheck`, `npm run check:modules`, `npm run build`, `npx playwright test tests/e2e/hide-game.spec.ts` 전부 PASS
- [ ] 모듈화 점검 5항목(CLAUDE.md) 결과를 `docs/evidence/hide-game.md`에 기록: 규칙(domain)·기하(placement)·진행(match-service)·통신(hide-room)·화면(web) 분리, 웹→domain 의존 없음, 장면 명령 경로 미사용 확인
- [ ] 2 PC 창 + VR 1창(사용자 헤드셋) 혼합 경기를 끝까지 진행. 헤드셋 결과는 사용자 확인 전까지 `미검증`
- [ ] `docs/licenses.md`: 1단계는 외부 에셋 없음 기록(권총 모델은 3단계)
- [ ] CLAUDE.md에 "숨바꼭질 1단계" 절 추가, `docs/work/PLAN.md`에 티켓 등록
- [ ] 커밋 `git commit -m "숨바꼭질 1단계 검증 기록"`

## 2. 이후 단계(별도 계획으로 작성)

- **2단계 마네킹 꾸미기**: 자세 10개(포즈 데이터 + 자세별 판정 경계), UV 512 마우스 색칠·스포이트, 색칠 이미지 저장 경로(오브젝트 스토리지) — `hidePoseSchema` 확장, `MANNEQUIN` 경계를 자세별 표로 교체.
- **3단계 블록 코딩 총**: Blockly, 블록→JS 코드 보기(숫자 양방향 편집), 미션 3~5단계, 시험 사격장, HideInAI `Sci-fi Pistol/anyma` GLB 변환·라이선스 기록. 블록 실행은 정해진 함수만 부르는 해석기(eval 금지), 서버 제한(`HIDE_LIMITS`) 유지.

## 3. 위험과 대응

| 위험 | 대응 |
|---|---|
| 서버 재시작 시 진행 중 경기 소실 | 1단계는 `aborted` 처리 후 강사가 새로 시작. 필요하면 판 상태 스냅숏 저장을 후속 티켓으로 |
| 학생 화면이 숨은 위치를 알고 있음(그려야 하므로) | 수업 용도로 수용. 판정은 서버가 하므로 점수 조작은 불가 |
| VR 실기기 조작감(스틱 속도·멀미) | 속도 2.5m/s·스냅 30°로 시작, 사용자 헤드셋 시험 후 조정 |
| 헤드리스 시험에서 포인터 잠금 불가 | 개발 빌드 전용 시험 훅으로 발사, 실제 조작은 수동 확인 |
| 조 수가 많을 때 판 수 증가(30조 = 29판) | 강사 패널에서 참가 조 선택으로 범위 조절 |
