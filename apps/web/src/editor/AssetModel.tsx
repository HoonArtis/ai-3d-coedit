import {useEffect,useMemo} from 'react';
import type {AssetDefinition} from '@coedit/contracts';
import {buildBuiltinModel,disposeBuiltinModel} from '@coedit/geometry';
import {GeneratedModel} from './GeneratedModel';
function BuiltinModel({asset}:{asset:AssetDefinition}){
  const model=useMemo(()=>buildBuiltinModel(asset),[asset.kind,asset.color]);
  useEffect(()=>()=>disposeBuiltinModel(model),[model]);
  return <primitive object={model}/>;
}
export function AssetModel({asset,token='',onError}:{asset:AssetDefinition;token?:string;onError?:(message:string)=>void}){
  return asset.kind==='generated'&&asset.artifactId?<GeneratedModel artifactId={asset.artifactId} token={token} onError={onError}/>:<BuiltinModel asset={asset}/>;
}
