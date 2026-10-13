import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import type {AccountService} from './service';
import type {StudentConnections} from './student-connections';
import {credentialDigest} from './password';
const actionSchema=z.object({action:z.enum(['disconnect','remove']),deleteObjects:z.boolean().default(false)}).strict().refine(x=>x.action==='remove'||!x.deleteObjects);
export class StudentManagement{
 constructor(private accounts:AccountService,private live:StudentConnections,private removeObjects:(token:string,roomId:string,actor:string)=>Promise<number>){}
 private async authorize(token:string,roomId:string){const s=await this.accounts.resolveRoomToken(token,roomId);if(s.role!=='teacher')throw Error('FORBIDDEN');return s;}
 async list(token:string,roomId:string){
  await this.authorize(token,roomId);const room=(await this.accounts.pool.query('SELECT name FROM coedit_class_rooms WHERE id=$1',[roomId])).rows[0];
  const students=(await this.accounts.pool.query('SELECT id,ordinal FROM coedit_students WHERE room_id=$1 AND NOT archived ORDER BY ordinal',[roomId])).rows;
  return {roomName:room.name,seats:Array.from({length:5},(_,i)=>{const s=students.find(s=>s.ordinal===i+1);return {ordinal:i+1,actor:s?.id??null,online:s?this.live.online(s.id):false};})};
 }
 async manage(token:string,roomId:string,actor:string,raw:unknown){
  const input=actionSchema.parse(raw),teacher=await this.authorize(token,roomId),db=await this.accounts.pool.connect();let resume:(()=>void)|undefined;
  try{
   await db.query('BEGIN');
   // Same lock order as code-based admission and manual issuance.
   const owned=await db.query('SELECT c.id FROM coedit_classes c JOIN coedit_class_rooms r ON r.class_id=c.id WHERE r.id=$1 AND c.teacher_id=$2 FOR UPDATE OF c',[roomId,teacher.actor]);if(!owned.rows.length)throw Error('FORBIDDEN');
   const target=await db.query('SELECT id FROM coedit_students WHERE id=$1 AND room_id=$2 AND NOT archived FOR UPDATE',[actor,roomId]);if(!target.rows.length)throw Error('STUDENT_NOT_FOUND');
   resume=this.live.suspend(actor);
   await db.query('DELETE FROM coedit_account_sessions WHERE actor=$1',[actor]);
   const removed=input.deleteObjects?await this.removeObjects(token,roomId,actor):0;
   if(input.action==='remove')await db.query('UPDATE coedit_students SET archived=true,credential_hash=$2 WHERE id=$1',[actor,credentialDigest(randomBytes(32).toString('base64url'))]);
   await db.query('COMMIT');return {action:input.action,removedObjects:removed};
  }catch(error){await db.query('ROLLBACK');throw error;}finally{resume?.();db.release();}
 }
}
