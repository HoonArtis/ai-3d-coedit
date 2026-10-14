import {z} from 'zod';
export const generationLimitSchema=z.number().int().min(0).max(1000);
export type LoginIdentity={token:string;actor:string;role:'student'|'teacher';roomKey?:string;storage:'postgres';viewOnly?:boolean};
export type Classroom={id:string;name:string;generation_limit:number;rooms:{id:string;name:string;code:string;students:number}[]};
export type IssuedStudent={actor:string;issuedId:string;roomKey:string;roomCode:string;ordinal:number};
