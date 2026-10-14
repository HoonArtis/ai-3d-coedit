import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {classLobbySchema} from '@coedit/contracts';
import type {AccountService} from './service';
import {credentialDigest} from './password';
const codeSchema=z.string().trim().min(10).max(40).regex(/^[a-zA-Z0-9]+$/).transform(s=>s.toUpperCase());
const resumeSchema=z.object({code:codeSchema,resumeKey:z.string().min(43).max(80).regex(/^[a-zA-Z0-9_-]+$/)}).strict();
const claimSchema=resumeSchema.extend({roomKey:z.string().uuid(),ordinal:z.number().int().min(1).max(5)}).strict();
export class ClassInvites{
 constructor(private accounts:AccountService){}
 async view(raw:unknown){
  const {code,roomKey,ordinal}=z.object({code:codeSchema,roomKey:z.string().uuid(),ordinal:z.number().int().min(1).max(5)}).strict().parse(raw);
  const client=await this.accounts.pool.connect();
  try{
   await client.query('BEGIN');
   const invite=await client.query('SELECT class_id,enabled FROM coedit_class_invites WHERE code=$1 FOR SHARE',[code]);
   if(!invite.rows.length||!invite.rows[0].enabled)throw Error('INVITE_CLOSED');
   const room=await client.query('SELECT id FROM coedit_class_rooms WHERE id=$1 AND class_id=$2',[roomKey,invite.rows[0].class_id]);if(!room.rows.length)throw Error('FORBIDDEN');
   const student=await client.query('SELECT id FROM coedit_students WHERE room_id=$1 AND ordinal=$2 AND NOT archived FOR SHARE',[roomKey,ordinal]);
   const token=randomBytes(32).toString('base64url'),actor=student.rows[0]?.id as string|undefined??randomUUID();
   await client.query("INSERT INTO coedit_account_sessions(token_hash,actor,role,expires_at,view_only,viewer_room_id) VALUES($1,$2,'student',now()+interval '8 hours',true,$3)",[credentialDigest(token),actor,roomKey]);
   await client.query('COMMIT');return {token,actor,roomKey,role:'student' as const,viewOnly:true};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async get(token:string,classId:string){
  await this.accounts.requireTeacherClass(token,classId);
  await this.accounts.pool.query('INSERT INTO coedit_class_invites(class_id,code) VALUES($1,$2) ON CONFLICT(class_id) DO NOTHING',[classId,randomBytes(6).toString('hex').toUpperCase()]);
  return (await this.accounts.pool.query('SELECT code,enabled FROM coedit_class_invites WHERE class_id=$1',[classId])).rows[0] as {code:string;enabled:boolean};
 }
 async setEnabled(token:string,classId:string,enabled:boolean){
  z.boolean().parse(enabled);await this.get(token,classId);
  return (await this.accounts.pool.query('UPDATE coedit_class_invites SET enabled=$2 WHERE class_id=$1 RETURNING code,enabled',[classId,enabled])).rows[0];
 }
 async lobby(raw:unknown){
  const {code}=z.object({code:codeSchema}).strict().parse(raw);
  const {rows}=await this.accounts.pool.query('SELECT c.id,c.name FROM coedit_class_invites i JOIN coedit_classes c ON c.id=i.class_id WHERE i.code=$1 AND i.enabled',[code]);
  if(!rows.length)throw Error('INVITE_CLOSED');
  const rooms=(await this.accounts.pool.query('SELECT r.id,r.name,ARRAY(SELECT s.ordinal FROM coedit_students s WHERE s.room_id=r.id AND NOT s.archived) AS occupied FROM coedit_class_rooms r WHERE r.class_id=$1 ORDER BY r.name,r.id',[rows[0].id])).rows;
  return classLobbySchema.parse({name:rows[0].name,rooms:rooms.map(r=>({id:r.id,name:r.name,seats:Array.from({length:5},(_,n)=>({ordinal:n+1,occupied:r.occupied.includes(n+1)}))}))});
 }
 async resume(raw:unknown){
  const {code,resumeKey}=resumeSchema.parse(raw);
  const {rows}=await this.accounts.pool.query('SELECT r.code FROM coedit_students s JOIN coedit_class_rooms r ON r.id=s.room_id JOIN coedit_class_invites i ON i.class_id=r.class_id WHERE i.code=$1 AND s.credential_hash=$2 AND NOT s.archived',[code,credentialDigest(resumeKey)]);
  if(!rows.length)throw Error('UNAUTHENTICATED');
  return this.accounts.joinStudent({roomCode:rows[0].code,issuedId:resumeKey});
 }
 async claim(raw:unknown){
  const {code,roomKey,ordinal,resumeKey}=claimSchema.parse(raw),client=await this.accounts.pool.connect();
  try{
   await client.query('BEGIN');
   // Share the class lock with batch issuance; locking the invite also serializes closing it.
   const {rows}=await client.query('SELECT c.id,i.enabled FROM coedit_class_invites i JOIN coedit_classes c ON c.id=i.class_id WHERE i.code=$1 FOR UPDATE OF c,i',[code]);
   if(!rows.length||!rows[0].enabled)throw Error('INVITE_CLOSED');
   const room=await client.query('SELECT id FROM coedit_class_rooms WHERE id=$1 AND class_id=$2',[roomKey,rows[0].id]);
   if(!room.rows.length)throw Error('FORBIDDEN');
   const digest=credentialDigest(resumeKey),existing=await client.query('SELECT credential_hash FROM coedit_students WHERE room_id=$1 AND ordinal=$2 AND NOT archived',[roomKey,ordinal]);
   if(existing.rows.length){if(existing.rows[0].credential_hash!==digest)throw Error('SEAT_TAKEN');}
   else{
    const previous=await client.query('SELECT id FROM coedit_students WHERE credential_hash=$1',[digest]);
    if(previous.rows.length)throw Error('ALREADY_SEATED');
    await client.query('INSERT INTO coedit_students(id,room_id,credential_hash,ordinal) VALUES($1,$2,$3,$4)',[randomUUID(),roomKey,digest,ordinal]);
   }
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  return this.resume({code,resumeKey});
 }
}
