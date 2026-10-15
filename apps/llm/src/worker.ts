import {JobQueues} from '@coedit/jobs';
import {parseSnapshot,type ChatMessage,type ModelContext} from '@coedit/contracts';
import {OllamaModel} from './ollama';
import {ChatAgent} from './agent';
const queues=new JobQueues();await queues.ready();
// LLM_ROUTING=single이면 분류 없이 도구 전체를 한 번에 본다(비교·장애 대비용).
const model=new ChatAgent(new OllamaModel({url:process.env.OLLAMA_URL,model:process.env.OLLAMA_MODEL}),{routing:process.env.LLM_ROUTING!=='single'});
const worker=queues.worker('llm',async input=>{
 const context=input.payload.context as unknown as ModelContext;
 context.scene=parseSnapshot(context.scene);
 if(context.actor!==input.actor||context.scene.roomId!==input.roomId)throw Error('MODEL_CONTEXT_MISMATCH');
 return model.chooseTools(input.payload.messages as unknown as ChatMessage[],context);
});
console.log('Local LLM worker ready');
let closing=false;const close=async()=>{if(closing)return;closing=true;await worker.close();await queues.close();};
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
