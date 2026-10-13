import {test,expect} from 'vitest';
import {actorColor} from '../../apps/web/src/editor/actor-color';
test('each worker has a deterministic color independent of client selection and observer',()=>{
 const actors=['student-alice','student-bob','student-charlie','student-diana','teacher'];
 expect(new Set(actors.map(actorColor)).size).toBe(actors.length);
 for(const actor of actors)expect(actorColor(actor)).toBe(actorColor(actor));
 expect(actorColor('student-alice')).not.toBe(actorColor('student-bob'));
});
