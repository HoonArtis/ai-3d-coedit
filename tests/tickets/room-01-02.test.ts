import {test,expect} from 'vitest';
import {Client} from '@colyseus/sdk';
import {startServer} from '../../apps/server/src/server';
test('real sockets enforce five students, extra teacher and authenticated reconnect',async()=>{
  const server=await startServer(0,false);
  const client=new Client(server.url);const rooms:Awaited<ReturnType<typeof client.joinOrCreate>>[]=[];
  try{
    for(let i=0;i<5;i++){
      const token=server.sessions.issue({actor:'student'+i,role:'student',roomKey:'experiment'});
      const room=await client.joinOrCreate('studio',{token,roomKey:'experiment'});
      room.onMessage('*',()=>{});rooms.push(room);
    }
    const sixth=server.sessions.issue({actor:'sixth',role:'student',roomKey:'experiment'});
    await expect(client.joinById(rooms[0].roomId,{token:sixth,roomKey:'experiment'})).rejects.toThrow();
    const teacher=server.sessions.issue({actor:'teacher',role:'teacher',roomKey:'experiment'});
    const t=await client.joinById(rooms[0].roomId,{token:teacher,roomKey:'experiment'});t.onMessage('*',()=>{});rooms.push(t);
    await expect(client.joinById(rooms[0].roomId,{token:'forged',roomKey:'experiment'})).rejects.toThrow();
    await expect(client.reconnect(rooms[0].roomId+':invalid-token')).rejects.toThrow();
    const wrongRoom=server.sessions.issue({actor:'intruder',role:'student',roomKey:'different'});
    await expect(client.joinById(rooms[0].roomId,{token:wrongRoom,roomKey:'experiment'})).rejects.toThrow();
    const created=new Promise<any>(resolve=>t.onMessage('result',resolve));
    t.send('command',{actor:'teacher',source:'teacher',requestId:'beforeDrop',ops:[{op:'place',id:'live',assetId:'chair',position:[3,0,0]}]});
    expect((await created).result.ok).toBe(true);
    const reconnectToken=rooms[0].reconnectionToken;
    await rooms[0].leave(false);
    const reconnected=await client.reconnect(reconnectToken);reconnected.onMessage('*',()=>{});rooms[0]=reconnected;
    expect(reconnected.roomId).toBe(t.roomId);
    const fresh=new Promise<any>(resolve=>reconnected.onMessage('event',e=>{if(e.type==='snapshot')resolve(e.snapshot);}));
    reconnected.send('sync');expect((await fresh).objects.live.position).toEqual([3,0,0]);
  }finally{
    await Promise.allSettled(rooms.map(r=>r.leave()));await server.close();
  }
},20000);

test('six simultaneous student attempts cannot overfill one room',async()=>{
  const server=await startServer(0,false);const client=new Client(server.url);
  const teacher=server.sessions.issue({actor:'t',role:'teacher',roomKey:'race'});
  const host=await client.joinOrCreate('studio',{token:teacher,roomKey:'race'});host.onMessage('*',()=>{});
  const attempts=await Promise.allSettled(Array.from({length:6},(_,i)=>{
    const token=server.sessions.issue({actor:'s'+i,role:i===5?'viewer':'student',roomKey:'race'});
    return client.joinById(host.roomId,{token,roomKey:'race'});
  }));
  const joined=attempts.filter(x=>x.status==='fulfilled').map(x=>x.value);
  joined.forEach(r=>r.onMessage('*',()=>{}));
  try{expect(joined).toHaveLength(5);}finally{await Promise.allSettled([...joined,host].map(r=>r.leave()));await server.close();}
});

test('socket server persists confirmed state across a full server restart',async()=>{
  const {Pool}=await import('pg');const {randomUUID}=await import('node:crypto');
  const {PostgresRoomRepository}=await import('../../apps/server/src/storage/postgres-room');
  const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'});
  const repository=new PostgresRoomRepository(pool);await repository.migrate();const roomKey=randomUUID();
  let server=await startServer(0,false,{repository});
  const connect=async()=>{
    const token=server.sessions.issue({actor:'alice',role:'student',roomKey});
    const room=await new Client(server.url).joinOrCreate('studio',{token,roomKey});room.onMessage('*',()=>{});return room;
  };
  let room=await connect();
  try{
    const result=new Promise<any>(resolve=>room.onMessage('result',resolve));
    room.send('command',{actor:'alice',source:'gizmo',requestId:'persist',ops:[{op:'place',id:'chair1',assetId:'chair',position:[2,0,0]}]});
    expect((await result).result.ok).toBe(true);
    await room.leave();await server.close();
    server=await startServer(0,false,{repository});room=await connect();
    const snapshot=new Promise<any>(resolve=>room.onMessage('event',e=>{if(e.type==='snapshot')resolve(e.snapshot);}));
    room.send('sync');const recovered=await snapshot;
    expect(recovered.seq).toBe(1);expect(recovered.objects.chair1.position).toEqual([2,0,0]);
  }finally{await room.leave();await server.close();await pool.query('DELETE FROM coedit_rooms WHERE id=$1',[roomKey]);await pool.end();}
},20000);
