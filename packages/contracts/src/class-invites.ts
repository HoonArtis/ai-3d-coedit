import {z} from 'zod';
export const classInviteSchema=z.object({code:z.string().min(10).max(40),enabled:z.boolean()}).strict();
export const classLobbySchema=z.object({name:z.string(),rooms:z.array(z.object({id:z.string(),name:z.string(),seats:z.array(z.object({ordinal:z.number().int().min(1).max(5),occupied:z.boolean()}).strict())}).strict())}).strict();
export type ClassLobby=z.infer<typeof classLobbySchema>;
