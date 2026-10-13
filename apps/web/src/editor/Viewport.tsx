import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls,TransformControls,Grid} from '@react-three/drei';
import {Group,Vector2,Vector3,Plane,Raycaster,MOUSE,type Camera} from 'three';
import {BUILTIN_LIBRARY,type SceneObject,type Vec3} from '@coedit/contracts';
import {cameraCommand,reconcileCameraFocus,type CameraCommand} from './camera';
import {restoreTransform} from './interaction-state';
import {AssetModel} from './AssetModel';
import {GeneratedModelProvider} from './GeneratedModel';
import {actorColor} from './actor-color';
import type {useEditor} from './use-editor';
export type Mode='translate'|'rotate'|'scale';
type EditorState=ReturnType<typeof useEditor>;
function CameraRig({onDistance,request,editor}:{onDistance:(n:string)=>void;request:{seq:number;command:CameraCommand}|null;editor:EditorState}){
  const {camera}=useThree();
  const controls=useRef<{target:Vector3;update:()=>void;enableDamping:boolean}|null>(null),focusId=useRef<string|null>(null);
  useEffect(()=>{
    if(!controls.current||!request)return;
    try{
      const next=cameraCommand({position:camera.position.toArray() as Vec3,target:controls.current.target.toArray() as Vec3},request.command,editor.snapshot);
      if(request.command.op==='focus')focusId.current=request.command.id;
      controls.current.target.set(...next.target);camera.position.set(...next.position);controls.current.update();
      onDistance(camera.position.distanceTo(controls.current.target).toFixed(1));
    }catch{editor.setNotice('카메라로 볼 대상을 찾을 수 없어요.');}
  },[request?.seq]);
  useEffect(()=>{
    const control=controls.current;if(!control||!focusId.current)return;
    const next=reconcileCameraFocus({position:camera.position.toArray() as Vec3,target:control.target.toArray() as Vec3},focusId.current,editor.snapshot);
    if(next.focusId!==null)return;
    focusId.current=null;
    const damping=control.enableDamping;control.enableDamping=false;control.update();
    control.target.set(...next.camera.target);camera.position.set(...next.camera.position);control.update();control.enableDamping=damping;
  },[editor.restorationSeq]);
  return <OrbitControls ref={value=>{controls.current=value;}} makeDefault enableDamping minDistance={2} maxDistance={80} maxPolarAngle={Math.PI*.48} mouseButtons={{LEFT:undefined,MIDDLE:MOUSE.PAN,RIGHT:MOUSE.ROTATE}} onChange={()=>{if(controls.current){editor.cameraCenter.current=controls.current.target.toArray() as Vec3;onDistance(camera.position.distanceTo(controls.current.target).toFixed(1));}}}/>;
}
function SceneItem({object,editor,mode}:{object:SceneObject;editor:EditorState;mode:Mode}){
  const group=useRef<Group>(null),dragging=useRef(false),lastPreview=useRef(0);
  const asset=editor.library[object.assetId];
  const selected=editor.selected===object.id;
  const foreign=editor.locks[object.id]&&editor.locks[object.id].owner!==editor.actor;
  const live=editor.previews[object.id];
  const latest=useRef(object);latest.current=object;
  useLayoutEffect(()=>{
    dragging.current=false;
    if(group.current)restoreTransform(group.current,object);
  },[selected,editor.locks[object.id]?.token,object.revision]);
  useEffect(()=>{
    const cancel=()=>{if(!dragging.current)return;dragging.current=false;if(group.current)restoreTransform(group.current,latest.current);void editor.select(null);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')cancel();};
    window.addEventListener('blur',cancel);window.addEventListener('keydown',escape);
    return()=>{window.removeEventListener('blur',cancel);window.removeEventListener('keydown',escape);};
  },[]);
  if(!asset)return null;
  const content=<group ref={group} position={live?.position??object.position} rotation={live?.rotation??object.rotation} scale={live?.scale??object.scale} onPointerDown={event=>{event.stopPropagation();if(!dragging.current)void editor.select(object.id);}}>
    <AssetModel asset={asset} token={editor.chatTransport?.identity.token} onError={editor.setNotice}/>
    {(selected||foreign)&&<mesh position={[0,asset.dimensions[1]/2,0]}><boxGeometry args={asset.dimensions.map(n=>n+.06) as Vec3}/><meshBasicMaterial wireframe color={actorColor(editor.locks[object.id]?.owner??editor.actor)} transparent opacity={.65}/></mesh>}
  </group>;
  if(!selected)return content;
  const transform=()=>{
    const g=group.current;
    if(!g)return null;
    return {id:object.id,token:editor.locks[object.id]?.token??'',position:g.position.toArray() as Vec3,rotation:[g.rotation.x,g.rotation.y,g.rotation.z] as Vec3,scale:g.scale.toArray() as Vec3};
  };
  return <>{content}<TransformControls object={group as React.RefObject<Group>} mode={mode} size={.85}
    onMouseDown={()=>{dragging.current=true;}}
    onObjectChange={()=>{
      if(!dragging.current||performance.now()-lastPreview.current<50)return;
      lastPreview.current=performance.now();const event=transform();if(event)editor.preview(event);
    }}
    onMouseUp={()=>{
      if(!dragging.current)return;dragging.current=false;
      const event=transform();if(!event)return;
      const op=mode==='translate'?'move':mode==='rotate'?'rotate':'scale';
      const value=mode==='translate'?event.position:mode==='rotate'?event.rotation:event.scale;
      void editor.send([{op,id:object.id,value}]).then(result=>{
        const committed=result?.ok?result.snapshot.objects[object.id]:undefined;
        const authoritative=committed&&committed.revision>=latest.current.revision?committed:latest.current;
        if(group.current&&authoritative)restoreTransform(group.current,authoritative);
        if(!result?.ok&&authoritative)editor.preview({...event,position:authoritative.position,rotation:authoritative.rotation,scale:authoritative.scale});
      });
    }}/></>;
}
export function Viewport({editor,mode,cameraRequest,diagnostics}:{diagnostics?:ReactNode;editor:EditorState;mode:Mode;cameraRequest:{seq:number;command:CameraCommand}|null}){
  const camera=useRef<Camera|null>(null),frame=useRef<HTMLDivElement>(null);
  const [distance,setDistance]=useState('16.3');
  return <div className="viewport" ref={frame} onDragOver={e=>e.preventDefault()} onDrop={event=>{
    event.preventDefault();const assetId=event.dataTransfer.getData('coedit/asset');
    if(!camera.current||!frame.current||!editor.library[assetId])return;
    const bounds=frame.current.getBoundingClientRect();
    const ray=new Raycaster();ray.setFromCamera(new Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1),camera.current);
    const point=ray.ray.intersectPlane(new Plane(new Vector3(0,1,0),0),new Vector3());
    if(point)void editor.place(assetId,[Math.round(point.x*2)/2,0,Math.round(point.z*2)/2]);
  }}>
    <Canvas shadows="percentage" dpr={[1,1.5]} camera={{position:[9,8,11],fov:45,near:.1,far:150}} onCreated={state=>{camera.current=state.camera;}} onPointerMissed={()=>{void editor.select(null);}}>
      <color attach="background" args={['#eaf0ed']}/>
      <fog attach="fog" args={['#eaf0ed',30,75]}/>
      <ambientLight intensity={1.5}/><directionalLight position={[8,15,8]} intensity={2.3} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15}/>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.015,0]} receiveShadow><planeGeometry args={[100,100]}/><meshStandardMaterial color="#e8eeea" roughness={1}/></mesh>
      <Grid args={[80,80]} position={[0,.002,0]} cellSize={1} cellThickness={.5} cellColor="#c2cec6" sectionSize={5} sectionThickness={.8} sectionColor="#9cad9f" fadeDistance={40} infiniteGrid/>
      <GeneratedModelProvider>{Object.values(editor.snapshot.objects).map(object=><SceneItem key={object.id} object={object} editor={editor} mode={mode}/>)}</GeneratedModelProvider>
      {diagnostics}<CameraRig onDistance={setDistance} request={cameraRequest} editor={editor}/>
    </Canvas>
    <div className="view-label"><span className="live-dot"/> PERSPECTIVE <span>원근 보기</span></div>
    {!Object.keys(editor.snapshot.objects).length&&<div className="empty-scene"><div className="empty-glyph">＋</div><h2>상상한 공간을 펼쳐 보세요</h2><p>왼쪽에서 에셋을 끌어 놓거나<br/>카드를 두 번 눌러 시작하세요.</p></div>}
    <div className="axis-widget"><span className="axis-y">Y</span><span className="axis-x">X</span><span className="axis-z">Z</span></div>
    <div className="view-bottom"><span>휠 줌 · 우클릭 회전 · 휠클릭 이동</span><output aria-label="카메라 거리">{distance} m</output></div>
  </div>;
}
