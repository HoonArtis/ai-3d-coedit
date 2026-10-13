import {BUDGETS,objectSchema,type SceneSnapshot,type SceneObject,type Session} from '@coedit/contracts';
import {z} from 'zod';
const entrySchema=z.object({before:z.record(z.string(),objectSchema.nullable()),after:z.record(z.string(),objectSchema.nullable()),expectedSeq:z.number().int().nonnegative()});
export const historySchema=z.object({undo:z.array(z.tuple([z.string(),z.array(entrySchema)])),redo:z.array(z.tuple([z.string(),z.array(entrySchema)])),changes:z.array(z.tuple([z.string(),z.object({actor:z.string(),seq:z.number().int().nonnegative()})]))});
type Entry=z.infer<typeof entrySchema>;
const content=(object:SceneObject|undefined|null)=>object?JSON.stringify([object.id,object.assetId,object.owner,object.name,object.position,object.rotation,object.scale]):'absent';
export class HistoryService {
  private undoStacks=new Map<string,Entry[]>();private redoStacks=new Map<string,Entry[]>();
  private changes=new Map<string,{actor:string;seq:number}>();
  invalidate(ids:string[],actor:string,seq:number,whole=false){
    const affected=new Set(ids);
    for(const stacks of [this.undoStacks,this.redoStacks]){
      if(whole){stacks.clear();continue;}
      for(const [owner,entries] of stacks)stacks.set(owner,entries.filter(entry=>!Object.keys(entry.before).some(id=>affected.has(id))));
    }
    if(whole)this.changes.clear();
    for(const id of ids)this.changes.set(id,{actor,seq});
  }
  exportState(){return structuredClone({undo:[...this.undoStacks],redo:[...this.redoStacks],changes:[...this.changes]});}
  importState(raw:unknown){const state=historySchema.parse(raw);this.undoStacks=new Map(state.undo);this.redoStacks=new Map(state.redo);this.changes=new Map(state.changes);}
  private stack(map:Map<string,Entry[]>,actor:string){if(!map.has(actor))map.set(actor,[]);return map.get(actor)!;}
  record(before:SceneSnapshot,after:SceneSnapshot,ids:string[],actor:string){
    const capture=(s:SceneSnapshot)=>Object.fromEntries(ids.map(id=>[id,structuredClone(s.objects[id]??null)]));
    const stack=this.stack(this.undoStacks,actor);
    stack.push({before:capture(before),after:capture(after),expectedSeq:after.seq});
    if(stack.length>500)stack.shift();
    this.redoStacks.delete(actor);
    for(const id of ids)this.changes.set(id,{actor,seq:after.seq});
  }
  peek(actor:string,redo:boolean){return this.stack(redo?this.redoStacks:this.undoStacks,actor).at(-1);}
  apply(snapshot:SceneSnapshot,session:Session,redo:boolean):{snapshot:SceneSnapshot;changedIds:string[]}{
    const from=this.stack(redo?this.redoStacks:this.undoStacks,session.actor);
    const to=this.stack(redo?this.undoStacks:this.redoStacks,session.actor);
    const entry=from.at(-1);if(!entry)throw Error('HISTORY_EMPTY');
    const ids=Object.keys(entry.before);
    for(const id of ids){
      const last=this.changes.get(id);
      const expected=redo?entry.before[id]:entry.after[id];
      if(last?.actor!==session.actor||content(snapshot.objects[id])!==content(expected))throw Error('HISTORY_CONFLICT');
    }
    const next=structuredClone(snapshot);next.seq++;
    const restore=redo?entry.after:entry.before;
    for(const id of ids){
      const object=restore[id];
      if(object)next.objects[id]={...structuredClone(object),revision:next.seq,lastActor:session.actor};
      else delete next.objects[id];
    }
    if(Object.keys(next.objects).length>BUDGETS.roomAssets)throw Error('ASSET_LIMIT');
    from.pop();entry.expectedSeq=next.seq;to.push(entry);
    for(const id of ids)this.changes.set(id,{actor:session.actor,seq:next.seq});
    return {snapshot:next,changedIds:ids};
  }
}
