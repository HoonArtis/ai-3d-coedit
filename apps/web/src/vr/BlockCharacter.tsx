import type {BlockAvatarProfile} from '@coedit/contracts';
import type {ThreeElements} from '@react-three/fiber';
function Part({size,color,...props}:{size:[number,number,number];color:string}&ThreeElements['mesh']){return <mesh {...props}><boxGeometry args={size}/><meshStandardMaterial color={color}/></mesh>;}
/** Original block figure. Feet at y=0, head center at y=1.6; faces -Z. */
export function BlockCharacter({profile,headRotation}:{profile:BlockAvatarProfile;headRotation?:[number,number,number,number]}){
 return <group>
  <group position={[0,1.6,0]} quaternion={headRotation}>
   <Part size={[.4,.4,.4]} color={profile.skin}/>
   <Part size={[.42,.12,.42]} color={profile.hair} position={[0,.18,.01]}/>
   <Part size={[.42,.25,.08]} color={profile.hair} position={[0,.035,.18]}/>
   {[-.1,.1].map(x=><group key={x} position={[x,.025,-.205]}><Part size={[.075,.075,.012]} color="#ffffff"/><Part size={[.035,.05,.016]} color="#202c36" position={[.008,0,-.009]}/></group>)}
   <Part size={[.10,.025,.012]} color="#8a4b3b" position={[0,-.105,-.208]}/>
  </group>
  <Part size={[.48,.62,.26]} color={profile.shirt} position={[0,1.07,0]}/>
  {[-1,1].map(side=><group key={side}>
   <Part size={[.19,.42,.24]} color={profile.shirt} position={[side*.35,1.13,0]}/>
   <Part size={[.18,.23,.23]} color={profile.skin} position={[side*.35,.81,0]}/>
   <Part size={[.21,.62,.25]} color={profile.pants} position={[side*.12,.43,0]}/>
   <Part size={[.22,.14,.32]} color="#29313a" position={[side*.12,.07,-.03]}/>
  </group>)}
 </group>;
}
