import {readFileSync} from 'node:fs';
import type {Op} from '../../../packages/contracts/src/index';
import type {ChatMessage,ModelContext} from './model-port';
/**
 * 1단계 분류. 문장을 워크플로우 하나로 보낸다. 2단계는 그 워크플로우의 프롬프트(prompts/workflows/<id>.md)와
 * 아래 도구만 보고 도구·인자를 고른다. replace_asset은 화면에서만 쓰므로 어느 워크플로우에도 넣지 않는다.
 */
export const WORKFLOWS={
 arrange:['arrange_nicely','place','arrange_around','align_row','distribute','scatter','place_on','face_toward','snap_to_ground'],
 edit:['move','rotate','face_toward','scale','duplicate','delete','rename','snap_to_ground'],
 create:['generate','retexture','upload_character'],
 recommend:['recommend'],
 query:['list','find','describe_scene'],
 history:['undo','redo','lock','unlock'],
 other:[],
} as const satisfies Record<string,readonly Op['op'][]>;
export type Workflow=keyof typeof WORKFLOWS;
export const workflowNames=Object.keys(WORKFLOWS) as Workflow[];
export const routeJSONSchema={type:'object',properties:{category:{type:'string',enum:workflowNames}},required:['category'],additionalProperties:false};
const prompt=readFileSync(new URL('../prompts/router.md',import.meta.url),'utf8');
/** 분류에는 씬 전체가 필요 없다. 선택 여부와 최근 대화 몇 턴만 준다. */
export function routerMessages(messages:ChatMessage[],context:ModelContext){
 const selected=context.selectedId?context.scene.objects[context.selectedId]:undefined;
 return [{role:'system',content:prompt+`\n# 상태\n현재 선택: ${selected?JSON.stringify(selected.name):'없음'}`},...messages.slice(-5)];
}
export function parseRoute(value:unknown):Workflow|null{
 const category=(value as {category?:unknown}|null)?.category;
 return typeof category==='string'&&(workflowNames as string[]).includes(category)?category as Workflow:null;
}
