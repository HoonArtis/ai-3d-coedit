import {test,expect,vi} from 'vitest';
vi.mock('@colyseus/core',()=>({Room:class{
 clients:{sessionId:string;send:(type:string,payload:unknown)=>void}[]=[];
 handlers=new Map<string,(client:unknown,payload?:unknown)=>unknown>();
 clock={setInterval:vi.fn()};
 onMessage(type:string,handler:(client:unknown,payload?:unknown)=>unknown){this.handlers.set(type,handler);}
 broadcast(type:string,payload:unknown){for(const client of this.clients)client.send(type,payload);}
}}));
import {createStudioRoom} from '../../apps/server/src/rooms/colyseus-room';
import {context,command} from '../fixtures/scene';

test('per-client library precedes new scene snapshots and sync never leaks unplaced private assets',async()=>{
 const privateAsset={...context.library.chair,id:'private',creator:'alice',shared:false};
 const hidden={...privateAsset,id:'hidden'};
 const assets={catalogForRoom:async()=>({private:privateAsset,hidden})};
 const Studio=createStudioRoom({read:vi.fn()},undefined,false,undefined,undefined,assets as unknown as NonNullable<Parameters<typeof createStudioRoom>[5]>);
 const room=new Studio();await room.onCreate({roomKey:'room'});
 const clients=['alice','bob','teacher'].map(actor=>({sessionId:actor,send:vi.fn()}));
 const harness=room as unknown as {clients:typeof clients;handlers:Map<string,(client:typeof clients[number],payload?:unknown)=>Promise<void>|void>};
 harness.clients.push(...clients);
 for(const client of clients)room.service.join(client.sessionId,{actor:client.sessionId,role:client.sessionId==='teacher'?'teacher':'student'});
 await harness.handlers.get('command')!(clients[0],command([{op:'place',id:'placed',assetId:'private',position:[0,0,0]}]));
 const bobEvents=clients[1].send.mock.calls.map(call=>call[1]);
 expect(bobEvents[0]).toMatchObject({type:'library',library:{private:privateAsset}});
 expect(bobEvents[0].library.hidden).toBeUndefined();
 expect(bobEvents[1]).toMatchObject({type:'snapshot',snapshot:{objects:{placed:{assetId:'private'}}}});
 expect(clients[2].send.mock.calls[0][1].library.hidden).toEqual(hidden);
 clients[1].send.mockClear();await harness.handlers.get('sync')!(clients[1]);
 expect(clients[1].send.mock.calls[0][1].library.hidden).toBeUndefined();
 expect(clients[1].send.mock.calls[0][1].library.private).toEqual(privateAsset);
});
