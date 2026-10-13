import {z} from 'zod';import {idSchema} from './primitives';import {snapshotSchema,librarySchema} from './scene';import {generationLimitSchema} from './accounts';
const room=z.object({id:idSchema,name:z.string(),code:z.string(),students:z.number().int().nonnegative(),pendingApproval:z.number().int().nonnegative(),snapshot:snapshotSchema.nullable(),thumbnailError:z.boolean()}).strict().refine(r=>!r.snapshot||r.snapshot.roomId===r.id,'Thumbnail room mismatch');
export const dashboardSchema=z.array(z.object({id:idSchema,name:z.string(),generation_limit:generationLimitSchema,library:librarySchema,rooms:z.array(room)}).strict());
export type DashboardClassroom=z.infer<typeof dashboardSchema>[number];
