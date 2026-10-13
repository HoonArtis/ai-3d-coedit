import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Pool} from 'pg';
import {parseSnapshot,idSchema,submissionSchema} from '@coedit/contracts';
import type {RoomRepository} from './room-repository';
import type {ObjectStore} from './object-store';
export class SubmissionService{
  constructor(private pool:Pool,private rooms:RoomRepository,private objects:ObjectStore){}
  async migrate(){await this.pool.query(await readFile(new URL('../../../../infra/migrations/006-submission-requests.sql',import.meta.url),'utf8'));}
  private descriptor(row:Record<string,unknown>){return submissionSchema.parse({id:row.id,roomId:row.room_id,seq:Number(row.seq),generation:Number(row.generation),objectKey:row.object_key});}
  async submit(roomId:string,identity?:{actor:string;requestId:string}){
    if(identity){
      idSchema.parse(identity.actor);idSchema.parse(identity.requestId);
      const previous=(await this.pool.query('SELECT * FROM coedit_submissions WHERE room_id=$1 AND actor=$2 AND request_id=$3',[roomId,identity.actor,identity.requestId])).rows[0];
      if(previous)return this.descriptor(previous);
    }
    const state=await this.rooms.load(roomId);if(!state)throw Error('NOT_FOUND');
    const snapshot=state.snapshot;
    const objectKey=await this.objects.put(Buffer.from(JSON.stringify(snapshot),'utf8'));
    const id=randomUUID();
    if(identity){
      const {rows}=await this.pool.query('INSERT INTO coedit_submissions(id,room_id,seq,generation,object_key,actor,request_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(room_id,actor,request_id) DO UPDATE SET id=coedit_submissions.id RETURNING *',[id,roomId,snapshot.seq,snapshot.generation,objectKey,identity.actor,identity.requestId]);
      return this.descriptor(rows[0]);
    }
    await this.pool.query('INSERT INTO coedit_submissions(id,room_id,seq,generation,object_key) VALUES($1,$2,$3,$4,$5)',[id,roomId,snapshot.seq,snapshot.generation,objectKey]);
    return {id,roomId,seq:snapshot.seq,generation:snapshot.generation,objectKey};
  }
  async read(roomId:string,id:string){
    const {rows}=await this.pool.query('SELECT * FROM coedit_submissions WHERE id=$1 AND room_id=$2',[id,roomId]);
    if(!rows.length)throw Error('NOT_FOUND');const row=rows[0];
    const snapshot=parseSnapshot(JSON.parse(Buffer.from(await this.objects.get(row.object_key)).toString('utf8')));
    if(snapshot.roomId!==roomId||snapshot.seq!==Number(row.seq)||snapshot.generation!==Number(row.generation))throw Error('CORRUPT_SUBMISSION');
    return snapshot;
  }
}
