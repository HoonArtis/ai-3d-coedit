import {Router,type ErrorRequestHandler} from 'express';
import {idSchema} from '@coedit/contracts';
import {bearer} from './routes';
import type {TeacherLogService} from './teacher-logs';
export function logRoutes(logs:TeacherLogService){
  const router=Router();
  router.get('/classes/:classId/students',async(req,res)=>res.json(await logs.students(bearer(req),idSchema.parse(req.params.classId))));
  router.get('/classes/:classId/students/:studentId/logs',async(req,res)=>res.json(await logs.list(bearer(req),idSchema.parse(req.params.classId),idSchema.parse(req.params.studentId),{...(req.query.before===undefined?{}:{before:req.query.before}),...(req.query.limit===undefined?{}:{limit:Number(req.query.limit)})})));
  const errors:ErrorRequestHandler=(error,_req,res,_next)=>{const code=error instanceof Error?error.message:'LOGS_FAILED';res.status(code==='UNAUTHENTICATED'?401:code==='FORBIDDEN'?403:400).json({code,error:code==='FORBIDDEN'?'이 학생의 대화를 열람할 수 없어요.':'대화 기록을 읽지 못했어요.'});};router.use(errors);return router;
}
