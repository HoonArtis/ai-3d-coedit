import type {ChatUpdate,ChatRecord} from '@coedit/contracts';
type State={records:ChatRecord[];pending:string|null;status:string;completed:string[]};
type Action=ChatUpdate|{type:'start';requestId:string;message:string}|{type:'reset'}|{type:'disconnect'};
export const emptyChat=():State=>({records:[],pending:null,status:'',completed:[]});
export function updateChat(state:State,action:Action):State{
 if(action.type==='reset')return emptyChat();
 if(action.type==='disconnect')return {...state,pending:null,status:''};
 if(action.type==='history')return {...state,records:[...action.records.filter(r=>!state.completed.includes(r.requestId)),...state.records.filter(r=>state.completed.includes(r.requestId)||!action.records.some(h=>h.requestId===r.requestId))],completed:[...new Set([...state.completed,...action.records.map(r=>r.requestId)])]};
 if(action.type==='start'||action.type==='resume'){
  const request=action.type==='start'?action:action.request;
  if(state.completed.includes(request.requestId))return state;
  return {...state,pending:request.requestId,status:'요청을 보내고 있어요',records:state.records.some(r=>r.requestId===request.requestId)?state.records:[...state.records,{requestId:request.requestId,message:request.message,summary:'',clarification:null}]};
 }
 if(action.type==='reply'){
  if(state.completed.includes(action.reply.requestId))return state;
  return {...state,records:state.records.map(r=>r.requestId===action.reply.requestId?{...r,...action.reply}:r),pending:state.pending===action.reply.requestId?null:state.pending,status:state.pending===action.reply.requestId?'':state.status,completed:[...state.completed,action.reply.requestId]};
 }
 if(action.requestId!==state.pending||state.completed.includes(action.requestId))return state;
 return {...state,status:action.type==='summary'?action.text:action.position?`대기 ${action.position}번째`:'요청을 처리하고 있어요'};
}
