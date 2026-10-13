"""Runs inside the isolated character container; only /input, /output and this script are mounted."""
import bpy, bmesh, sys, math
from pathlib import Path
from mathutils import Vector
source=Path(sys.argv[sys.argv.index('--')+1])

def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.suffix=='.fbx':bpy.ops.wm.fbx_import(filepath=str(source),use_anim=True,validate_meshes=True)
    else:bpy.ops.import_scene.gltf(filepath=str(source),disable_bone_shape=True)
    # glTF importer creates hidden mesh objects for bone display; those are not character geometry.
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and o.hide_render:bpy.data.objects.remove(o,do_unlink=True)
    bpy.context.view_layer.update()
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    if not meshes or not rigs:raise ValueError('CHARACTER_RIG_REQUIRED')
    if len(rigs)>4 or sum(len(o.data.bones) for o in rigs)>128:raise ValueError('CHARACTER_RIG_LIMIT')
    if sum(len(o.data.vertices) for o in meshes)>300000:raise ValueError('CHARACTER_VERTEX_LIMIT')
    if any(o.data.shape_keys for o in meshes):raise ValueError('CHARACTER_MORPH_UNSUPPORTED')
    if any(not any(m.type=='ARMATURE' and m.object in rigs for m in o.modifiers) for o in meshes):raise ValueError('CHARACTER_UNBOUND_MESH')
    bpy.context.scene.frame_set(bpy.context.scene.frame_start)
    points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
    lower=Vector([min(p[i] for p in points) for i in range(3)]);upper=Vector([max(p[i] for p in points) for i in range(3)])
    if not all(math.isfinite(v) for v in [*lower,*upper]) or upper.z-lower.z<.0001:raise ValueError('CHARACTER_BOUNDS')
    root=bpy.data.objects.new('CharacterRoot',None);bpy.context.collection.objects.link(root)
    for o in list(bpy.context.scene.objects):
        if o!=root and o.parent is None:o.parent=root
    scale=1.7/(upper.z-lower.z);root.scale=(scale,)*3;root.location=(-.5*(lower.x+upper.x)*scale,-.5*(lower.y+upper.y)*scale,-lower.z*scale)
    return meshes,rigs

def triangles(meshes):
    for o in meshes:o.data.calc_loop_triangles()
    return sum(len(o.data.loop_triangles) for o in meshes)

for name,limit in [('desktop',5000),('avatar',10000),('vr',2450)]:
    meshes,rigs=load()
    # glTF splits flat normals/UVs into disconnected vertices. Weld only identical
    # bind-position AND joint-weight tuples, preserving per-loop UV attributes.
    for o in meshes:
        bm=bmesh.new();bm.from_mesh(o.data);deform=bm.verts.layers.deform.active;seen={};mapping={}
        for v in bm.verts:
            key=(tuple(v.co),tuple(sorted(v[deform].items())) if deform else ())
            if key in seen:mapping[v]=seen[key]
            else:seen[key]=v
        if mapping:bmesh.ops.weld_verts(bm,targetmap=mapping)
        bm.to_mesh(o.data);bm.free();o.data.update()
    before=triangles(meshes)
    for attempt in range(3):
        count=triangles(meshes)
        if count<=limit:break
        for o in meshes:
            bpy.context.view_layer.objects.active=o;o.select_set(True)
            mod=o.modifiers.new('DeliveryBudget','DECIMATE');mod.ratio=min(1,limit*.96/count);mod.use_collapse_triangulate=True
            # Simplify bind-pose vertices before armature deformation.
            while o.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
            bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
    if triangles(meshes)>limit:raise ValueError('CHARACTER_TRIANGLE_LIMIT')
    if name=='vr':
        for o in meshes:
            bpy.context.view_layer.objects.active=o
            for mod in list(o.modifiers):
                if mod.type=='ARMATURE':bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.export_scene.gltf(filepath='/output/'+name+'.glb',export_format='GLB',export_skins=name!='vr',export_animations=name!='vr',export_rest_position_armature=False,export_morph=False,export_cameras=False,export_lights=False,export_extras=False)
