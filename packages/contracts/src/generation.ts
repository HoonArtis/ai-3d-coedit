import {characterSourceSchema} from './character';
import {z} from 'zod';
import {idSchema,objectKeySchema} from './primitives';
import {finishingRecordSchema} from './finishing';
export {objectKeySchema} from './primitives';
export const generationSourceSchema=z.discriminatedUnion('kind',[characterSourceSchema,
 z.object({kind:z.literal('text'),prompt:z.string().trim().min(1).max(2000)}).strict(),
 z.object({kind:z.literal('upload'),imageKey:objectKeySchema}).strict(),
]);
export const generationRequestSchema=z.object({requestId:idSchema,source:generationSourceSchema,jobId:idSchema.optional(),expectedVersion:z.number().int().positive().optional()}).strict().refine(v=>(v.jobId===undefined)===(v.expectedVersion===undefined),'Regeneration requires job and version');
export type GenerationRequest=z.infer<typeof generationRequestSchema>;
export const retextureTargetSchema=z.object({objectId:idSchema,revision:z.number().int().nonnegative(),generation:z.number().int().nonnegative(),assetId:idSchema}).strict();
export const retexturePreparedSchema=z.object({shapeKey:objectKeySchema,imageKey:objectKeySchema.optional(),target:retextureTargetSchema}).strict();
export type RetexturePrepared=z.infer<typeof retexturePreparedSchema>;
export const generationStateSchema=z.enum(['image_queued','awaiting_confirmation','shape_queued','shape_ready','failed','cancelled']);
export const generationRecordSchema=z.object({id:idSchema,actor:idSchema,roomId:idSchema,generation:z.number().int().nonnegative(),version:z.number().int().positive(),state:generationStateSchema,visibility:z.enum(['visible','hidden','deleted']).optional(),source:generationSourceSchema,imageKey:objectKeySchema.nullable(),shapeKey:objectKeySchema.nullable(),error:z.string().nullable(),target:retextureTargetSchema.nullable().optional()});
export type GenerationRecord=z.infer<typeof generationRecordSchema>;
export const generationProgressSchema=generationRecordSchema.extend({position:z.number().int().nonnegative(),running:z.boolean(),finishing:finishingRecordSchema.nullable().optional()});
export const generationListSchema=z.object({jobs:z.array(generationProgressSchema),usage:z.object({used:z.number().int().nonnegative(),limit:z.number().int().nonnegative().nullable()})});
export const confirmImageSchema=z.object({version:z.number().int().positive()}).strict();
/**
 * 생성 금칙어. 서버 필터와 챗봇 후검사가 같은 규칙을 쓴다. 이미지 검열 전체를 주장하지 않는 제한된 입력 규칙이다.
 * 고등학생 수업 기준으로 선정·유혈·자해 표현을 막는다(2026-10-15 "야한 그림", "피 흘리는 좀비 시체" 통과 사례).
 */
export function isBlockedGenerationPrompt(prompt:string){
  const normalized=prompt.normalize('NFKC').replace(/[\p{Cf}\p{M}]/gu,'').toLowerCase();
  return /\b(nude|nudity|naked|porn|pornographic|gore|sexy|nsfw|corpse|bloody)\b|성착취|음란|포르노|알몸|나체|야한|선정적|잔혹한\s*살해|시체|시신|피\s*(흘리|범벅|투성)|유혈|자해|자살/u.test(normalized);
}
