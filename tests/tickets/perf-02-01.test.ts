import {expect,test} from 'vitest';
import {FrameMeasurement} from '../performance/measurement';
test('test_perf_02_01_success excludes load and warmup, records frame distribution',()=>{
 const m=new FrameMeasurement(100,200);m.frame(0,false,{});m.frame(1000,true,{});m.frame(1050,true,{});m.frame(1100,true,{});
 for(let t=1120;t<=1300;t+=20)m.frame(t,true,{triangles:1000000,calls:202,textures:200,geometries:202});
 const r=m.result();expect(r.frames).toBe(10);expect(r.fps).toBe(50);expect(r.p95Ms).toBe(20);expect(r.render.triangles).toBe(1000000);
});
test('test_perf_02_01_failure rejects incomplete runs and restarts warmup when loading resumes',()=>{
 const m=new FrameMeasurement(100,200);m.frame(0,true,{});m.frame(100,true,{});m.frame(120,true,{});m.frame(140,false,{});expect(()=>m.result()).toThrow('INCOMPLETE');m.frame(200,true,{});m.frame(300,true,{});m.frame(320,true,{});expect(()=>m.result()).toThrow('INCOMPLETE');
});
