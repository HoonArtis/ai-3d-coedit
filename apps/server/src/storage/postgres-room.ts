import {readFile} from 'node:fs/promises';
import type {Pool} from 'pg';
import {parseSnapshot,type Command,type CommandResult} from '@coedit/contracts';
import {historySchema} from '../rooms/history';
import type {RoomRepository,StoredRoom,StoredCommand} from './room-repository';
export class PostgresRoomRepository implements RoomRepository{
  constructor(readonly pool:Pool){}
  async migrate(){await this.pool.query(await readFile(new URL('../../../../infra/migrations/001-rooms.sql',import.meta.url),'utf8'));}
  async create(state:StoredRoom){
    const s=parseSnapshot(state.snapshot);
    await this.pool.query('INSERT INTO coedit_rooms(id,seq,state) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[s.roomId,s.seq,state]);
  }
  async load(roomId:string):Promise<StoredRoom|null>{
    const {rows}=await this.pool.query('SELECT r.state,r.seq,(SELECT count(*)::int FROM coedit_commands c WHERE c.room_id=r.id) AS count,(SELECT max(seq) FROM coedit_commands c WHERE c.room_id=r.id) AS last FROM coedit_rooms r WHERE r.id=$1',[roomId]);
    if(!rows.length)return null;
    const row=rows[0];const snapshot=parseSnapshot(row.state.snapshot);const history=historySchema.parse(row.state.history);
    if(snapshot.roomId!==roomId||snapshot.seq!==Number(row.seq)||Number(row.count)!==snapshot.seq||Number(row.last??0)!==snapshot.seq)throw Error('CORRUPT_ROOM_LOG');
    return {snapshot,history};
  }
  async lookup(roomId:string,actor:string,requestId:string):Promise<StoredCommand|null>{
    const {rows}=await this.pool.query('SELECT fingerprint,result FROM coedit_commands WHERE room_id=$1 AND actor=$2 AND request_id=$3',[roomId,actor,requestId]);
    if(!rows.length)return null;parseSnapshot(rows[0].result.snapshot);return rows[0];
  }
  async commit(expectedSeq:number,state:StoredRoom,command:Command,result:Extract<CommandResult,{ok:true}>){
    const s=parseSnapshot(state.snapshot);
    if(s.seq!==expectedSeq+1||JSON.stringify(result.snapshot)!==JSON.stringify(s))throw Error('INVALID_COMMIT');
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const current=await client.query('SELECT seq FROM coedit_rooms WHERE id=$1 FOR UPDATE',[s.roomId]);
      if(!current.rows.length||Number(current.rows[0].seq)!==expectedSeq)throw Error('SEQ_CONFLICT');
      await client.query('INSERT INTO coedit_commands(room_id,seq,actor,request_id,fingerprint,result) VALUES($1,$2,$3,$4,$5,$6)',[s.roomId,s.seq,command.actor,command.requestId,JSON.stringify(command),result]);
      await client.query('UPDATE coedit_rooms SET seq=$2,state=$3,updated_at=now() WHERE id=$1',[s.roomId,s.seq,state]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}
