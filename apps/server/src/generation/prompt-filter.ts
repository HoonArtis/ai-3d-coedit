import {generationSourceSchema} from '@coedit/contracts';
/** A bounded, auditable input rule, not a claim of comprehensive image moderation. */
export function validateGenerationPrompt(value:unknown):string{
 const source=generationSourceSchema.parse({kind:'text',prompt:value});if(source.kind!=='text')throw Error('INVALID_PROMPT');const {prompt}=source;
 const normalized=prompt.normalize('NFKC').replace(/[\p{Cf}\p{M}]/gu,'').toLowerCase();
 if(/\b(nude|nudity|porn|pornographic|gore)\b|성착취|음란|포르노|알몸|잔혹한\s*살해/u.test(normalized))throw Error('PROMPT_BLOCKED');
 return prompt;
}
