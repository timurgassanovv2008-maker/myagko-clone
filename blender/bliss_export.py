"""BLISS — экспорт персонажей из .blend в GLB и проверка результата.

Используется сборочным скриптом build_characters.py и отдельно — для
переэкспорта после ручных правок в Blender:

    blender blender/bliss_characters.blend -b -P blender/export_glb.py
"""

import json
import os
import struct

import bpy

CATEGORIES = ["sofa", "armchair", "mattress", "chair", "other"]


def character_rigs():
    """Скелеты персонажей: {категория: объект-арматура}."""
    out = {}
    for ob in bpy.data.objects:
        if ob.type == "ARMATURE" and "bliss_category" in ob:
            out[ob["bliss_category"]] = ob
    return out


def objects_of(rig):
    return [rig, *rig.children_recursive]


def _gltf_kwargs(path):
    wanted = dict(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_animations=True,
        # Клипы берутся из NLA-дорожек этого персонажа: Idle, Blink, Wave.
        export_animation_mode="NLA_TRACKS",
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=False,
        export_def_bones=False,
        export_reset_pose_bones=True,
        export_skins=False,
        export_morph=False,
    )
    known = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    skipped = sorted(k for k in wanted if k not in known)
    if skipped:
        print("[bliss] экспортёр не знает параметры:", ", ".join(skipped))
    return {k: v for k, v in wanted.items() if k in known}


def _rename_nodes_for(rig):
    """Узлам с свойством bliss_node на время экспорта даём точное имя (anchor_bubble…).

    В .blend имена объектов уникальны, поэтому у второго персонажа якорь
    называется «anchor_bubble.001». Сайт ищет узлы по точному имени.
    """
    restore = []
    mine = set(objects_of(rig))
    tagged = [ob for ob in bpy.data.objects if "bliss_node" in ob]
    for ob in tagged:
        restore.append((ob, ob.name))
        ob.name = f"__tmp_{ob.name}"
    for ob in tagged:
        if ob in mine:
            ob.name = ob["bliss_node"]
    return restore


def _restore_names(restore):
    for ob, _ in restore:
        ob.name = f"__tmp2_{id(ob)}"
    for ob, name in restore:
        ob.name = name


def export_glb(rig, path):
    """Экспорт одного персонажа. Персонаж временно ставится в начало координат."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    restore = _rename_nodes_for(rig)
    saved_loc = rig.location.copy()
    ad = rig.animation_data
    saved_action = ad.action if ad else None
    if ad:
        ad.action = None
    rig.location = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    for ob in objects_of(rig):
        ob.hide_set(False)
        ob.select_set(True)
    bpy.context.view_layer.objects.active = rig

    try:
        bpy.ops.export_scene.gltf(**_gltf_kwargs(path))
    finally:
        _restore_names(restore)

    rig.location = saved_loc
    if ad:
        ad.action = saved_action
    bpy.context.view_layer.update()
    return path


def export_all(out_dir):
    paths = {}
    for cat, rig in sorted(character_rigs().items()):
        paths[cat] = export_glb(rig, os.path.join(out_dir, f"{cat}.glb"))
    return paths


def read_glb_json(path):
    with open(path, "rb") as f:
        magic, _version, _length = struct.unpack("<4sII", f.read(12))
        assert magic == b"glTF", "не GLB"
        chunk_len, chunk_type = struct.unpack("<I4s", f.read(8))
        assert chunk_type == b"JSON"
        return json.loads(f.read(chunk_len))


def summarize_glb(path):
    """Короткая сводка: размер, треугольники, материалы, клипы и каналы."""
    g = read_glb_json(path)
    acc = g.get("accessors", [])
    tris = 0
    for mesh in g.get("meshes", []):
        for prim in mesh["primitives"]:
            if "indices" in prim:
                tris += acc[prim["indices"]]["count"] // 3
    nodes = g.get("nodes", [])
    anims = {}
    for a in g.get("animations", []):
        targets = sorted(
            {f"{nodes[c['target']['node']].get('name')}.{c['target']['path']}" for c in a["channels"]}
        )
        dur = 0.0
        for s in a["samplers"]:
            dur = max(dur, acc[s["input"]].get("max", [0])[0])
        anims[a["name"]] = {"duration": round(dur, 3), "targets": targets}
    return {
        "file": os.path.basename(path),
        "kb": round(os.path.getsize(path) / 1024, 1),
        "triangles": tris,
        "materials": [m["name"] for m in g.get("materials", [])],
        "animations": anims,
        "anchors": [n["name"] for n in nodes if n.get("name", "").startswith("anchor_")],
        "extensions": g.get("extensionsUsed", []),
    }
