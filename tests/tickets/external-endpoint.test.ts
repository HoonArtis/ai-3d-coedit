import {test,expect} from 'vitest';
import {resolveServerEndpoint} from '../../apps/web/src/server-endpoint';
test('production API and websocket address uses the public origin, dev keeps local backend',()=>{
 expect(resolveServerEndpoint(undefined,false,'https://example.trycloudflare.com')).toBe('https://example.trycloudflare.com');
 expect(resolveServerEndpoint(undefined,true,'http://localhost:4173')).toBe('http://127.0.0.1:2567');
 expect(resolveServerEndpoint('https://configured.example/',false,'https://page.example')).toBe('https://configured.example');
});
