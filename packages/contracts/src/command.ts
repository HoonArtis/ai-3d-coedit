import { z } from 'zod';
import { idSchema, type Session } from './primitives';
import { opSchema } from './ops';
export const commandSchema = z.object({
  version:z.literal(1).default(1),
  actor:idSchema, source:z.enum(['gizmo','chat','teacher']), requestId:idSchema,
  expectedGeneration:z.number().int().nonnegative().optional(),
  ops:z.array(opSchema).min(1).max(200),
  lockTokens:z.record(idSchema,idSchema).default({}),
}).strict();
export type Command = z.infer<typeof commandSchema>;
export function parseCommand(value: unknown, session: Session): Command {
  const command = commandSchema.parse(value);
  if(command.actor !== session.actor) throw new Error('FORBIDDEN: actor mismatch');
  if(command.source === 'teacher' && session.role !== 'teacher') throw new Error('FORBIDDEN: teacher source');
  return command;
}
