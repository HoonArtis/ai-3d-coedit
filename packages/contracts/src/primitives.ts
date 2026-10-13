import { z } from 'zod';
export const objectKeySchema=z.string().regex(/^[a-f0-9]{64}$/);
export const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
export const finiteSchema = z.number().finite().min(-100000).max(100000);
export const vec3Schema = z.tuple([finiteSchema, finiteSchema, finiteSchema]);
export const scaleSchema = z.tuple([z.number().min(0.01).max(100), z.number().min(0.01).max(100), z.number().min(0.01).max(100)]);
export const idsSchema = z.array(idSchema).min(1).max(200).refine(ids => new Set(ids).size === ids.length, 'Duplicate IDs');
export type Vec3 = z.infer<typeof vec3Schema>;
export type Session = { actor: string; role: 'student' | 'teacher' | 'viewer' };
