export class FrameMeasurement {
 private readyAt:number|null=null;private start:number|null=null;private last=0;private samples:number[]=[];private render:Record<string,number>={};private finished=false;
 constructor(private warmupMs=10000,private durationMs=60000){}
 frame(now:number,ready:boolean,render:Record<string,number>){
  if(this.finished)return true;
  if(!ready){this.readyAt=null;this.start=null;this.samples=[];return false;}
  this.readyAt??=now;if(now-this.readyAt<this.warmupMs)return false;
  if(this.start===null){this.start=now;this.last=now;return false;}
  this.samples.push(now-this.last);this.last=now;this.render=render;
  this.finished=now-this.start>=this.durationMs;return this.finished;
 }
 result(){if(!this.finished||this.start===null)throw Error('INCOMPLETE');const sorted=[...this.samples].sort((a,b)=>a-b),percentile=(p:number)=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]!;return {frames:this.samples.length,durationMs:this.last-this.start,fps:this.samples.length*1000/(this.last-this.start),p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),maxMs:sorted.at(-1),over33Ms:this.samples.filter(n=>n>1000/30).length,render:this.render,samplesMs:this.samples};}
}
