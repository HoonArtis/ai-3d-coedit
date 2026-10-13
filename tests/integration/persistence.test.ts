import {test,expect,beforeAll,afterAll} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {context,command} from '../fixtures/scene';
import {RoomService} from '../../apps/server/src/rooms/room-service';
import {PostgresRoomRepository} from '../../apps/server/src/storage/postgres-room';
import {DurableRoom} from '../../apps/server/src/rooms/durable-room';
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'});
const repo=new PostgresRoomRepository(pool);const ids:string[]=[];
beforeAll(()=>repo.migrate());
afterAll(async()=>{for(const id of ids)await pool.query('DELETE FROM coedit_rooms WHERE id=$1',[id]);await pool.end();});
async function setup(repository=repo){
  const id=randomUUID();ids.push(id);const service=new RoomService(id,context.library);
  const durable=await DurableRoom.open(service,repository);service.join('a',{actor:'alice',role:'student'});
  return {id,service,durable};
}
const place=()=>command([{op:'place',id:'o',assetId:'chair',position:[0,0,0]}]);
test('durable command, state and history recover together and deduplicate after reload',async()=>{
  const {id,durable}=await setup();const first=await durable.submit('a',place());expect(first.ok).toBe(true);
  const restored=new RoomService(id,context.library);const restart=await DurableRoom.open(restored,repo);
  restored.join('a',{actor:'alice',role:'student'});
  expect(restored.snapshot.seq).toBe(1);expect(await restart.submit('a',place())).toEqual(first);
  expect((await pool.query('SELECT count(*)::int AS n FROM coedit_commands WHERE room_id=$1',[id])).rows[0].n).toBe(1);
  expect((await restart.submit('a',command([{op:'undo'}],{requestId:'undo'}))).ok).toBe(true);
  expect(restored.snapshot.objects).toEqual({});
});
test('failed persistence never publishes speculative state and retry succeeds',async()=>{
  let fail=true;
  const {service,durable}=await setup({
    load:repo.load.bind(repo),create:repo.create.bind(repo),lookup:repo.lookup.bind(repo),
    commit:async(...args:Parameters<typeof repo.commit>)=>{if(fail)throw Error('storage unavailable');return repo.commit(...args);},
  } as PostgresRoomRepository);
  expect((await durable.submit('a',place())).ok).toBe(false);expect(service.snapshot.seq).toBe(0);
  fail=false;expect((await durable.submit('a',place())).ok).toBe(true);expect(service.snapshot.seq).toBe(1);
});
test('database rejects duplicate seq, duplicate request and orphan commands',async()=>{
  const {id,durable}=await setup();await durable.submit('a',place());
  const row=(await pool.query('SELECT * FROM coedit_commands WHERE room_id=$1',[id])).rows[0];
  const insert=(room:string,seq:number,request:string)=>pool.query('INSERT INTO coedit_commands(room_id,seq,actor,request_id,fingerprint,result) VALUES($1,$2,$3,$4,$5,$6)',[room,seq,row.actor,request,row.fingerprint,row.result]);
  await expect(insert(id,1,'other')).rejects.toThrow();await expect(insert(id,2,'r1')).rejects.toThrow();
  await expect(insert('missing',1,'other')).rejects.toThrow();
});
test('missing command or damaged snapshot fails recovery instead of opening empty room',async()=>{
  const {id,durable}=await setup();await durable.submit('a',place());
  await pool.query('DELETE FROM coedit_commands WHERE room_id=$1',[id]);
  await expect(repo.load(id)).rejects.toThrow('CORRUPT');
  await pool.query("UPDATE coedit_rooms SET state=jsonb_set(state,'{snapshot,objects,o,scale}','[-1,1,1]') WHERE id=$1",[id]);
  await expect(repo.load(id)).rejects.toThrow();
});
test('optimistic seq conflict and concurrent submissions never lose updates',async()=>{
  const {id,service,durable}=await setup();
  const second=new RoomService(id,context.library);const contender=await DurableRoom.open(second,repo);second.join('b',{actor:'bob',role:'student'});
  const results=await Promise.all([durable.submit('a',place()),contender.submit('b',command([{op:'place',id:'p',assetId:'chair',position:[1,0,0]}],{actor:'bob'}))]);
  expect(results.filter(r=>r.ok)).toHaveLength(1);
  expect((await repo.load(id))?.snapshot.seq).toBe(1);
  expect([service.snapshot.seq,second.snapshot.seq].sort()).toEqual([0,1]);
});

test('live state stays committed while the database write is in flight',async()=>{
  let release!:()=>void;let reached!:()=>void;
  const entered=new Promise<void>(r=>{reached=r;});const gate=new Promise<void>(r=>{release=r;});
  const {service,durable}=await setup({
    load:repo.load.bind(repo),create:repo.create.bind(repo),lookup:repo.lookup.bind(repo),
    commit:async(...args:Parameters<typeof repo.commit>)=>{reached();await gate;return repo.commit(...args);},
  } as PostgresRoomRepository);
  const pending=durable.submit('a',place());await entered;
  expect(service.snapshot.seq).toBe(0);expect(service.snapshot.objects).toEqual({});
  release();expect((await pending).ok).toBe(true);expect(service.snapshot.seq).toBe(1);
});

test('process exits after commit without replying and replay remains exactly once',async()=>{
  const {spawn}=await import('node:child_process');const id=randomUUID();ids.push(id);
  const child=spawn(process.execPath,['--import','tsx','tests/fixtures/crash-after-commit.ts',id],{cwd:process.cwd(),stdio:'pipe'});
  let stderr='';child.stderr.on('data',data=>{stderr+=data;});
  const exit=await new Promise<number|null>((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  expect(exit,stderr).toBe(24);
  const service=new RoomService(id,context.library);const restarted=await DurableRoom.open(service,repo);service.join('a',{actor:'alice',role:'student'});
  expect((await restarted.submit('a',place())).ok).toBe(true);expect(service.snapshot.seq).toBe(1);
  expect((await pool.query('SELECT count(*)::int AS n FROM coedit_commands WHERE room_id=$1',[id])).rows[0].n).toBe(1);
},15000);
