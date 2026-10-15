import {generationSourceSchema} from '@coedit/contracts';
/** A bounded, auditable input rule, not a claim of comprehensive image moderation. */
export function validateGenerationPrompt(value:unknown):string{
 const source=generationSourceSchema.parse({kind:'text',prompt:value});if(source.kind!=='text')throw Error('INVALID_PROMPT');const {prompt}=source;
 const normalized=prompt.normalize('NFKC').replace(/[\p{Cf}\p{M}]/gu,'').toLowerCase();
 // 고등학생 수업 기준으로 선정·유혈·자해 표현을 막는다(2026-10-15 "야한 그림", "피 흘리는 좀비 시체" 통과 사례).
 if(/\b(nude|nudity|naked|porn|pornographic|gore|sexy|nsfw|corpse|bloody)\b|성착취|음란|포르노|알몸|나체|야한|선정적|잔혹한\s*살해|시체|시신|피\s*(흘리|범벅|투성)|유혈|자해|자살/u.test(normalized))throw Error('PROMPT_BLOCKED');
 return prompt;
}
