import {it,expect} from 'vitest';
import {updateChat,emptyChat} from '../../apps/web/src/editor/chat-state';
it('ignores queued/summary/duplicate replies after completion and keeps conversations scoped to the current request',()=>{
 let state=updateChat(emptyChat(),{type:'start',requestId:'a',message:'place'});
 state=updateChat(state,{type:'queued',requestId:'a',position:3});expect(state.status).toContain('3');
 state=updateChat(state,{type:'reply',reply:{requestId:'a',summary:'done',clarification:null}});expect(state.pending).toBeNull();
 const completed=state;
 for(const event of [{type:'queued' as const,requestId:'a',position:5},{type:'summary' as const,requestId:'a',text:'late'},{type:'reply' as const,reply:{requestId:'a',summary:'old',clarification:null}}])state=updateChat(state,event);
 expect(state).toEqual(completed);
 state=updateChat(state,{type:'start',requestId:'b',message:'new'});const current=state;
 expect(updateChat(state,{type:'queued',requestId:'a',position:2})).toEqual(current);
});
