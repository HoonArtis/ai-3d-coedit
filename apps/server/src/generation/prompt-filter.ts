import {generationSourceSchema,isBlockedGenerationPrompt} from '@coedit/contracts';
/** A bounded, auditable input rule, not a claim of comprehensive image moderation. 규칙 본문은 contracts에 있다. */
export function validateGenerationPrompt(value:unknown):string{
 const source=generationSourceSchema.parse({kind:'text',prompt:value});if(source.kind!=='text')throw Error('INVALID_PROMPT');const {prompt}=source;
 if(isBlockedGenerationPrompt(prompt))throw Error('PROMPT_BLOCKED');
 return prompt;
}
