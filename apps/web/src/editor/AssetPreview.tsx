import {useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import type {AssetDefinition} from '@coedit/contracts';
import {GeneratedModel,GeneratedModelProvider} from './GeneratedModel';

/** Finished assets use the same access-controlled model endpoint as the editor. */
export function AssetPreview({asset,token}:{asset:AssetDefinition;token:string}){
 const [error,setError]=useState(''),size=asset.dimensions,scale=2/Math.max(...size,.01);
 return <div className="asset-history-preview" aria-label={asset.name+' 3D 미리보기'}>{error?<p role="alert">{error}</p>:<Canvas camera={{position:[2,1.3,2.5],fov:45}}><color attach="background" args={['#e9eeea']}/><ambientLight intensity={2}/><directionalLight position={[3,5,2]} intensity={3}/><GeneratedModelProvider><group scale={scale} position={[0,-size[1]*scale/2,0]}><GeneratedModel artifactId={asset.artifactId!} token={token} onError={setError}/></group></GeneratedModelProvider><OrbitControls makeDefault/></Canvas>}</div>;
}
