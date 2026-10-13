"""Original procedural rig/animation fixture; no third-party model asset."""
import bpy, sys
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--')+1]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.object.armature_add(location=(0,0,0));rig=bpy.context.object;rig.name='FixtureRig'
bpy.ops.object.mode_set(mode='EDIT');root=rig.data.edit_bones[0];root.name='Hips';root.head=(0,0,0);root.tail=(0,0,1)
head=rig.data.edit_bones.new('Head');head.head=(0,0,1);head.tail=(0,0,2);head.parent=root
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.mesh.primitive_uv_sphere_add(segments=128,ring_count=64,location=(0,0,1));mesh=bpy.context.object;mesh.name='FixtureBody';mesh.scale=(.35,.25,1)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for name in ['Hips','Head']:mesh.vertex_groups.new(name=name)
for v in mesh.data.vertices:
    w=max(0,min(1,(v.co.z+0.2)/0.4));mesh.vertex_groups['Hips'].add([v.index],1-w,'REPLACE');mesh.vertex_groups['Head'].add([v.index],w,'REPLACE')
mod=mesh.modifiers.new('Rig','ARMATURE');mod.object=rig;mesh.parent=rig
mat=bpy.data.materials.new('FixtureBlue');mat.diffuse_color=(.08,.4,.7,1);mesh.data.materials.append(mat)
head=rig.pose.bones['Head'];head.rotation_mode='XYZ'
for frame,angle in [(1,0),(15,.25),(30,0)]:head.rotation_euler[1]=angle;head.keyframe_insert(data_path='rotation_euler',frame=frame)
rig.animation_data.action.name='Idle';bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=30;bpy.context.scene.frame_set(1)
bpy.ops.export_scene.fbx(filepath=str(out/'rigged.fbx'),use_selection=False,add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=True,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(out/'rigged.glb'),export_format='GLB',export_skins=True,export_animations=True)
