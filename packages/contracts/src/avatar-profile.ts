import {z} from 'zod';
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const blockAvatarSchema=z.object({kind:z.literal('block'),skin:color,hair:color,shirt:color,pants:color}).strict();
export type BlockAvatarProfile=z.infer<typeof blockAvatarSchema>;
export const DEFAULT_BLOCK_AVATAR:BlockAvatarProfile={kind:'block',skin:'#dba67b',hair:'#38291f',shirt:'#4488cc',pants:'#24395b'};
