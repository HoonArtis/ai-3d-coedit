import {JobQueues} from '@coedit/jobs';
import {parseSnapshot,type ChatMessage,type ModelContext} from '@coedit/contracts';
import {OllamaModel} from './ollama';
const queues=new JobQueues();await queues.ready();
const model=new OllamaModel({url:process.env.OLLAMA_URL,model:process.env.OLLAMA_MODEL});
const worker=queues.worker('llm',async input=>{
 const context=input.payload.context as unknown as ModelContext;
 context.scene=parseSnapshot(context.scene);
 if(context.actor!==input.actor||context.scene.roomId!==input.roomId)throw Error('MODEL_CONTEXT_MISMATCH');
 return model.chooseTools(input.payload.messages as unknown as ChatMessage[],context);
});
console.log('Local LLM worker ready');
let closing=false;const close=async()=>{if(closing)return;closing=true;await worker.close();await queues.close();};
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
