import { z } from 'zod';
import { idSchema, vec3Schema, scaleSchema } from './primitives';
import { snapshotSchema,librarySchema, type CommandResult } from './scene';
import { type Command } from './command';
export const serverEventSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('snapshot'),snapshot:snapshotSchema}).strict(),
  z.object({type:z.literal('library'),library:librarySchema}).strict(),
  z.object({type:z.literal('restored'),requestId:idSchema,actor:idSchema,seq:z.number().int().positive(),generation:z.number().int().nonnegative(),count:z.number().int().min(0).max(400)}).strict(),
  z.object({type:z.literal('error'),code:z.string(),message:z.string()}).strict(),
  z.object({type:z.literal('locks'), locks:z.record(idSchema,z.object({owner:idSchema,token:idSchema}).strict())}).strict(),
]);
export type ServerEvent = z.infer<typeof serverEventSchema>;
export const parseServerEvent = (value:unknown):ServerEvent => serverEventSchema.parse(value);
export const previewSchema = z.object({id:idSchema,token:idSchema,position:vec3Schema,rotation:vec3Schema,scale:scaleSchema}).strict();
export type PreviewEvent = z.infer<typeof previewSchema>;
export interface CommandTransport {
  submit(command:Command):Promise<CommandResult>;
  subscribe(listener:(event:ServerEvent)=>void):()=>void;
  preview(event:PreviewEvent):void;
}
export type ChatEvent =
  | {type:'queued';requestId:string;position:number}
  | {type:'summary';requestId:string;text:string}
  | {type:'result';requestId:string;result:CommandResult}
  | {type:'error';requestId:string;message:string};
export type JobProgress = {jobId:string;stage:'image'|'confirm'|'shape'|'texture'|'optimize'|'approval';position:number;status:'queued'|'running'|'completed'|'failed'};
