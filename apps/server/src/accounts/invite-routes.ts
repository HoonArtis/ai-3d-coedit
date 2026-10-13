import {Router,json,type ErrorRequestHandler} from 'express';
import {z} from 'zod';
import {ClassInvites} from './class-invites';
import type {AccountService} from './service';
import {bearer} from './routes';
export function inviteRoutes(accounts:AccountService){
 const router=Router(),service=new ClassInvites(accounts);router.use(json({limit:'4kb'}));
 // Refreshing seat availability must not consume the admission budget.
 let windowStart=Date.now(),reads=0,admissions=0;
 router.use('/lobby',(req,res,next)=>{if(Date.now()-windowStart>60000){windowStart=Date.now();reads=0;admissions=0;}const limited=req.path==='/'?++reads>600:++admissions>120;if(limited){res.status(429).json({error:'잠시 뒤 다시 입장해 주세요.'});return;}next();});
 router.get('/classes/:classId/invite',async(req,res)=>res.json(await service.get(bearer(req),String(req.params.classId))));
 router.post('/classes/:classId/invite',async(req,res)=>{const {enabled}=z.object({enabled:z.boolean()}).strict().parse(req.body);res.json(await service.setEnabled(bearer(req),String(req.params.classId),enabled));});
 router.post('/lobby',async(req,res)=>res.json(await service.lobby(req.body)));
 router.post('/lobby/claim',async(req,res)=>res.json(await service.claim(req.body)));
 router.post('/lobby/resume',async(req,res)=>res.json(await service.resume(req.body)));
 const errors:ErrorRequestHandler=(error,_req,res,_next)=>{const code=error instanceof Error?error.message:'UNKNOWN';const messages:Record<string,string>={SEAT_TAKEN:'다른 학생이 먼저 선택한 자리예요. 다른 자리를 골라 주세요.',ALREADY_SEATED:'이미 선택한 자리가 있어요. 내 자리로 돌아가기를 눌러 주세요.',INVITE_CLOSED:'초대 코드가 없거나 입장이 닫혀 있어요.',UNAUTHENTICATED:'저장된 자리를 찾을 수 없어요.',FORBIDDEN:'이 수업에 접근할 수 없어요.'};res.status(code==='UNAUTHENTICATED'?401:code==='FORBIDDEN'?403:code==='SEAT_TAKEN'||code==='ALREADY_SEATED'?409:400).json({error:messages[code]??'입장 정보를 확인해 주세요.'});};
 router.use(errors);return router;
}
