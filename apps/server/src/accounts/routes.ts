import {Router,json,type Request,type ErrorRequestHandler} from 'express';
import {z} from 'zod';
import type {AccountService} from './service';
import type {DashboardService} from './dashboard';
export const bearer=(req:Request)=>req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
export function accountRoutes(accounts:AccountService,dashboard?:DashboardService){
  const router=Router();router.use(json({limit:'32kb'}));
  const attempts=new Map<string,{count:number;until:number}>();
  router.use((req,res,next)=>{
    if(!req.path.endsWith('/login')&&!req.path.endsWith('/register')){next();return;}
    const now=Date.now(),key=req.ip??'unknown';let slot=attempts.get(key);
    if(!slot||slot.until<=now){slot={count:0,until:now+60000};attempts.set(key,slot);}
    if(++slot.count>120){res.status(429).json({error:'잠시 뒤 다시 시도해 주세요.'});return;}
    for(const [ip,entry] of attempts)if(entry.until<=now)attempts.delete(ip);
    next();
  });
  router.post('/teachers/register',async(req,res)=>{res.status(201).json({...await accounts.registerTeacher(req.body),storage:'postgres'});});
  router.post('/teachers/login',async(req,res)=>{res.json({...await accounts.loginTeacher(req.body),storage:'postgres'});});
  router.post('/students/login',async(req,res)=>{res.json({...await accounts.joinStudent(req.body),storage:'postgres'});});
  router.get('/me',async(req,res)=>{res.json(await accounts.session(bearer(req)));});
  router.post('/logout',async(req,res)=>{await accounts.logout(bearer(req));res.status(204).end();});
  router.get('/classes',async(req,res)=>{res.json(await accounts.listClasses(bearer(req)));});
  router.get('/dashboard',async(req,res)=>{if(!dashboard)throw Error('DASHBOARD_UNAVAILABLE');res.json(await dashboard.overview(bearer(req)));});
  router.post('/classes',async(req,res)=>{res.status(201).json(await accounts.createClass(bearer(req),req.body));});
  router.post('/classes/:classId/settings',async(req,res)=>{const {generationLimit}=z.object({generationLimit:z.number()}).strict().parse(req.body);res.json(await accounts.setGenerationLimit(bearer(req),String(req.params.classId),generationLimit));});
  router.post('/classes/:classId/rooms',async(req,res)=>{const {name}=z.object({name:z.string()}).strict().parse(req.body);res.status(201).json(await accounts.addRoom(bearer(req),String(req.params.classId),name));});
  router.post('/classes/:classId/students',async(req,res)=>{const {count}=z.object({count:z.number()}).strict().parse(req.body);res.status(201).json(await accounts.issueStudents(bearer(req),String(req.params.classId),count));});
  router.post('/room-session',async(req,res)=>{
    const {roomKey}=z.object({roomKey:z.string()}).strict().parse(req.body);const token=bearer(req);
    res.json({...await accounts.resolveRoomToken(token,roomKey),token,storage:'postgres'});
  });
  const errors:ErrorRequestHandler=(error,_req,res,_next)=>{
    const code=error instanceof Error?error.message:'UNKNOWN';
    const status=code==='UNAUTHENTICATED'?401:code==='FORBIDDEN'?403:code==='CAPACITY'?409:(error as {code?:string}).code==='23505'?409:400;
    res.status(status).json({error:status===401?'로그인 정보를 확인해 주세요.':status===403?'이 수업에 접근할 수 없어요.':status===409?'이미 등록되었거나 방 정원을 초과했어요.':'입력 또는 요청을 처리할 수 없어요.'});
  };router.use(errors);return router;
}
