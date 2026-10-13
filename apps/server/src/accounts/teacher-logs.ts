import {studentRosterSchema,teacherLogQuerySchema,teacherLogPageSchema} from '@coedit/contracts';
import type {AccountService} from './service';
export class TeacherLogService{
  constructor(private accounts:AccountService){}
  async students(token:string,classId:string){
    await this.accounts.requireTeacherClass(token,classId);
    const {rows}=await this.accounts.pool.query('SELECT s.id AS actor,s.room_id AS "roomId",s.ordinal,r.name AS "roomName" FROM coedit_students s JOIN coedit_class_rooms r ON r.id=s.room_id WHERE r.class_id=$1 ORDER BY r.name,r.id,s.ordinal',[classId]);
    return studentRosterSchema.parse(rows);
  }
  async list(token:string,classId:string,studentId:string,raw:unknown){
    await this.accounts.requireTeacherClass(token,classId);
    const query=teacherLogQuerySchema.parse(raw),{rows:students}=await this.accounts.pool.query('SELECT s.room_id FROM coedit_students s JOIN coedit_class_rooms r ON r.id=s.room_id WHERE s.id=$1 AND r.class_id=$2',[studentId,classId]);
    if(!students.length)throw Error('FORBIDDEN');
    const {rows}=await this.accounts.pool.query(`SELECT h.*,c.fingerprint,c.result AS committed_result
      FROM coedit_chat_requests h LEFT JOIN coedit_commands c ON c.room_id=h.room_id AND c.actor=h.actor AND c.request_id=h.request_id
      WHERE h.room_id=$1 AND h.actor=$2 AND ($3::bigint IS NULL OR h.ordinal<$3)
      ORDER BY h.ordinal DESC LIMIT $4`,[students[0].room_id,studentId,query.before??null,query.limit+1]);
    const entries=rows.slice(0,query.limit).map(row=>({cursor:String(row.ordinal),roomId:row.room_id,actor:row.actor,status:row.status,request:row.input,response:row.response??null,modelOutput:row.model_output??null,command:row.fingerprint?JSON.parse(row.fingerprint):null,committedResult:row.committed_result??null}));
    return teacherLogPageSchema.parse({entries,nextCursor:rows.length>query.limit?entries.at(-1)!.cursor:null});
  }
}
