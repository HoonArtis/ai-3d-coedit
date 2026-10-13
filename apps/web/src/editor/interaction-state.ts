import type {Lease,PreviewEvent,SceneObject,Op,CommandResult,Vec3} from '@coedit/contracts';
import type {Group} from 'three';

export function retainLeasedPreviews(previews:Record<string,PreviewEvent>,locks:Record<string,Lease>){
  return Object.fromEntries(Object.entries(previews).filter(([id,p])=>locks[id]?.token===p.token));
}
export function restoreTransform(group:Group,object:SceneObject){
  group.position.set(...object.position);group.rotation.set(...object.rotation);group.scale.set(...object.scale);
  group.updateMatrixWorld(true);
}
export class TransformEditQueue{
  private queue:Promise<unknown>=Promise.resolve();
  constructor(private read:(id:string)=>SceneObject|undefined,private submit:(ops:Op[])=>Promise<CommandResult|null>){}
  edit(id:string,field:'position'|'rotation'|'scale',axis:number,scalar:number){
    const execute=async():Promise<CommandResult|null>=>{
      const object=this.read(id);if(!object||axis<0||axis>2||!Number.isFinite(scalar))return null;
      const value=[...object[field]] as Vec3;value[axis]=scalar;
      return this.submit([{op:field==='position'?'move':field==='rotation'?'rotate':'scale',id,value}]);
    };
    const result=this.queue.then(execute,execute);this.queue=result;return result;
  }
}

/** Serialize lease transitions; only the latest request may publish a selection. */
export class SelectionQueue{
  private tail:Promise<void>=Promise.resolve();
  private version=0;
  private current:string|null=null;
  constructor(private acquire:(id:string)=>Promise<boolean>,private release:(id:string)=>Promise<void>,private publish:(id:string|null)=>void){}
  select(id:string|null){
    const version=++this.version;
    const transition=async()=>{
      if(version!==this.version)return;
      if(this.current===id)return;
      const previous=this.current;this.current=null;this.publish(null);
      if(previous)await this.release(previous);
      if(version!==this.version||!id)return;
      if(await this.acquire(id)){
        if(version!==this.version){await this.release(id);return;}
        this.current=id;this.publish(id);
      }
    };
    this.tail=this.tail.then(transition,transition);return this.tail;
  }
  invalidate(){++this.version;this.current=null;this.publish(null);}
}
