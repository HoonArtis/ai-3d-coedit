import {z} from 'zod';
import {idSchema,vec3Schema,type Vec3} from './primitives';
import {opSchema,type Op} from './ops';
import type {SceneSnapshot,CommandResult,AssetDefinition} from './scene';
import {snapshotSchema,objectSchema} from './scene';
export const TEACHER_ONLY_OPS=new Set<Op['op']>(['force_unlock','approve_asset','restore_object','restore_snapshot','read_logs']);
export const modelDecisionSchema=z.object({summary:z.string().trim().min(1).max(500),clarification:z.string().trim().min(1).max(300).nullable(),ops:z.array(opSchema).max(200)}).strict();
export type ModelDecision=z.infer<typeof modelDecisionSchema>;
export type ChatMessage={role:'user'|'assistant';content:string};
export type ModelContext={actor:string;selectedId:string|null;cameraCenter:Vec3;scene:SceneSnapshot;clarified?:boolean;library?:Record<string,AssetDefinition>};
export interface ModelPort{chooseTools(messages:ChatMessage[],context:ModelContext):Promise<ModelDecision>}
export const chatRequestSchema=z.object({requestId:idSchema,message:z.string().trim().min(1).max(4000),selectedId:idSchema.nullable(),cameraCenter:vec3Schema}).strict();
export type ChatRequest=z.infer<typeof chatRequestSchema>;
export type ChatReply={requestId:string;summary:string;clarification:string|null;ops?:Op[];result?:CommandResult;error?:string};
export type ChatRecord=ChatReply&{message:string};
export type ChatUpdate={type:'queued';requestId:string;position:number}|{type:'summary';requestId:string;text:string}|{type:'reply';reply:ChatReply}|{type:'history';records:ChatRecord[]}|{type:'resume';request:ChatRequest};
export const resultSchema=z.discriminatedUnion('ok',[z.object({ok:z.literal(true),snapshot:snapshotSchema,changedIds:z.array(idSchema),query:z.array(objectSchema).optional()}),z.object({ok:z.literal(false),code:z.string(),message:z.string()})]);
export const replySchema=z.object({requestId:idSchema,summary:z.string(),clarification:z.string().nullable(),ops:z.array(opSchema).optional(),result:resultSchema.optional(),error:z.string().optional()});
export const chatUpdateSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('queued'),requestId:idSchema,position:z.number().int().nonnegative()}),
 z.object({type:z.literal('summary'),requestId:idSchema,text:z.string()}),
 z.object({type:z.literal('reply'),reply:replySchema}),
 z.object({type:z.literal('history'),records:z.array(replySchema.extend({message:z.string()}))}),
 z.object({type:z.literal('resume'),request:chatRequestSchema}),
]);
export function parseStudentDecision(value:unknown){
 const d=modelDecisionSchema.parse(value);
 if(d.ops.some(o=>TEACHER_ONLY_OPS.has(o.op)))throw Error('TEACHER_TOOL_FORBIDDEN');
 if(d.clarification&&d.ops.length)throw Error('AMBIGUOUS_EXECUTION');
 return d;
}
