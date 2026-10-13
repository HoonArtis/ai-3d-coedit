import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {hashPassword,verifyPassword,credentialDigest} from './password';
import type {IssuedSession} from './session-store';
import {generationLimitSchema} from '@coedit/contracts';
const credentials=z.object({username:z.string().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/),password:z.string().min(12).max(256)}).strict();
const classInput=z.object({name:z.string().trim().min(1).max(80),roomCount:z.number().int().min(1).max(30)}).strict();
type AccountSession={actor:string;role:'teacher'|'student'};
type ClassRoom={id:string;name:string;code:string};
export class AccountService{
  constructor(readonly pool:Pool,private studentCredential=()=>randomBytes(12).toString('base64url')){}
  async migrate(){
    const client=await this.pool.connect();
    try{await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtext(current_schema() || ':coedit-accounts'))");
      for(const file of ['002-accounts.sql','009-class-invites.sql','010-student-archive.sql'])await client.query(await readFile(new URL('../../../../infra/migrations/'+file,import.meta.url),'utf8'));
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  private async issue(actor:string,role:AccountSession['role']){
    const token=randomBytes(32).toString('base64url');
    await this.pool.query("INSERT INTO coedit_account_sessions(token_hash,actor,role,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",[credentialDigest(token),actor,role]);
    return {token,actor,role};
  }
  async registerTeacher(raw:unknown){
    const input=credentials.parse(raw),actor=randomUUID();
    await this.pool.query('INSERT INTO coedit_teachers(id,username,password_hash) VALUES($1,$2,$3)',[actor,input.username,await hashPassword(input.password)]);
    return this.issue(actor,'teacher');
  }
  async loginTeacher(raw:unknown){
    const input=credentials.parse(raw);const {rows}=await this.pool.query('SELECT id,password_hash FROM coedit_teachers WHERE username=$1',[input.username]);
    if(!rows.length||!await verifyPassword(input.password,rows[0].password_hash))throw Error('UNAUTHENTICATED');
    return this.issue(rows[0].id,'teacher');
  }
  async session(token:unknown):Promise<AccountSession>{
    if(typeof token!=='string'||token.length>256)throw Error('UNAUTHENTICATED');
    const {rows}=await this.pool.query(`SELECT actor,role FROM coedit_account_sessions s WHERE token_hash=$1 AND expires_at>now() AND
      ((role='teacher' AND EXISTS(SELECT 1 FROM coedit_teachers WHERE id=s.actor)) OR (role='student' AND EXISTS(SELECT 1 FROM coedit_students WHERE id=s.actor AND NOT archived)))`,[credentialDigest(token)]);
    if(!rows.length)throw Error('UNAUTHENTICATED');return rows[0];
  }
  async logout(token:string){await this.pool.query('DELETE FROM coedit_account_sessions WHERE token_hash=$1',[credentialDigest(token)]);}
  private async teacher(token:string){const session=await this.session(token);if(session.role!=='teacher')throw Error('FORBIDDEN');return session.actor;}
  private async ownClass(client:Pool|PoolClient,actor:string,classId:string,lock=false){
    const {rows}=await client.query('SELECT id,name,generation_limit FROM coedit_classes WHERE id=$1 AND teacher_id=$2'+(lock?' FOR UPDATE':''),[classId,actor]);
    if(!rows.length)throw Error('FORBIDDEN');return rows[0];
  }
  async requireTeacherClass(token:string,classId:string){const actor=await this.teacher(token);const classroom=await this.ownClass(this.pool,actor,classId);return {actor,classroom};}
  async setGenerationLimit(token:string,classId:string,raw:unknown){
    const limit=generationLimitSchema.parse(raw),{actor}=await this.requireTeacherClass(token,classId);
    await this.pool.query('UPDATE coedit_classes SET generation_limit=$3 WHERE id=$1 AND teacher_id=$2',[classId,actor,limit]);return {generation_limit:limit};
  }
  private async insertRoom(client:PoolClient,classId:string,name:string):Promise<ClassRoom>{
    const room={id:randomUUID(),name,code:randomBytes(5).toString('hex').toUpperCase()};
    await client.query('INSERT INTO coedit_class_rooms(id,class_id,name,code) VALUES($1,$2,$3,$4)',[room.id,classId,room.name,room.code]);return room;
  }
  async createClass(token:string,raw:unknown){
    const actor=await this.teacher(token),input=classInput.parse(raw),client=await this.pool.connect();
    try{
      await client.query('BEGIN');const id=randomUUID();
      await client.query('INSERT INTO coedit_classes(id,teacher_id,name) VALUES($1,$2,$3)',[id,actor,input.name]);
      const rooms:ClassRoom[]=[];for(let i=0;i<input.roomCount;i++)rooms.push(await this.insertRoom(client,id,(i+1)+'조'));
      await client.query('COMMIT');return {id,name:input.name,rooms};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async addRoom(token:string,classId:string,name:string){
    const actor=await this.teacher(token);name=z.string().trim().min(1).max(80).parse(name);const client=await this.pool.connect();
    try{await client.query('BEGIN');await this.ownClass(client,actor,classId,true);const room=await this.insertRoom(client,classId,name);await client.query('COMMIT');return room;}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async issueStudents(token:string,classId:string,count:number){
    const actor=await this.teacher(token);z.number().int().min(1).max(150).parse(count);const client=await this.pool.connect();
    try{
      await client.query('BEGIN');await this.ownClass(client,actor,classId,true);
      const {rows}=await client.query('SELECT r.id,r.code,(SELECT count(*)::int FROM coedit_students s WHERE s.room_id=r.id AND NOT s.archived) AS used,ARRAY(SELECT s.ordinal FROM coedit_students s WHERE s.room_id=r.id AND NOT s.archived) AS occupied FROM coedit_class_rooms r WHERE class_id=$1 ORDER BY name,id',[classId]);
      if(rows.reduce((n,r)=>n+5-r.used,0)<count)throw Error('CAPACITY');
      const issued:{actor:string;issuedId:string;roomKey:string;roomCode:string;ordinal:number}[]=[];
      for(const room of rows){
        for(let ordinal=1;ordinal<=5&&issued.length<count;ordinal++){
          if(room.occupied.includes(ordinal))continue;
          const student={actor:randomUUID(),issuedId:this.studentCredential(),roomKey:room.id,roomCode:room.code,ordinal};
          await client.query('INSERT INTO coedit_students(id,room_id,credential_hash,ordinal) VALUES($1,$2,$3,$4)',[student.actor,room.id,credentialDigest(student.issuedId),ordinal]);issued.push(student);
        }
      }
      await client.query('COMMIT');return issued;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async joinStudent(raw:unknown){
    const input=z.object({roomCode:z.string().min(1).max(40),issuedId:z.string().min(1).max(80)}).strict().parse(raw);
    const {rows}=await this.pool.query('SELECT s.id,s.room_id FROM coedit_students s JOIN coedit_class_rooms r ON r.id=s.room_id WHERE r.code=$1 AND s.credential_hash=$2 AND NOT s.archived',[input.roomCode.toUpperCase(),credentialDigest(input.issuedId)]);
    if(!rows.length)throw Error('UNAUTHENTICATED');return {...await this.issue(rows[0].id,'student'),roomKey:rows[0].room_id};
  }
  async resolveRoomToken(token:unknown,roomKey:unknown):Promise<IssuedSession>{
    const session=await this.session(token);if(typeof roomKey!=='string')throw Error('FORBIDDEN');
    const allowed=session.role==='teacher'
      ?await this.pool.query('SELECT r.id FROM coedit_class_rooms r JOIN coedit_classes c ON r.class_id=c.id WHERE r.id=$1 AND c.teacher_id=$2',[roomKey,session.actor])
      :await this.pool.query('SELECT id FROM coedit_students WHERE room_id=$1 AND id=$2 AND NOT archived',[roomKey,session.actor]);
    if(!allowed.rows.length)throw Error('FORBIDDEN');return {...session,roomKey};
  }
  async listClasses(token:string){
    const actor=await this.teacher(token);const {rows}=await this.pool.query('SELECT id,name,generation_limit FROM coedit_classes WHERE teacher_id=$1 ORDER BY name,id',[actor]);
    return Promise.all(rows.map(async c=>({...c,rooms:(await this.pool.query('SELECT r.id,r.name,r.code,(SELECT count(*)::int FROM coedit_students s WHERE s.room_id=r.id AND NOT s.archived) AS students FROM coedit_class_rooms r WHERE class_id=$1 ORDER BY name,id',[c.id])).rows})));
  }
}
