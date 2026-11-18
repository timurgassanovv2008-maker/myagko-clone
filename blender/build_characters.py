"""BLISS — процедурная сборка 3D-персонажей мебели в Blender.

Пять персонажей, по одному на категорию каталога: диван, кресло, матрас,
стул и «Другое» (пуф). У каждого простое дружелюбное лицо, руки-варежки
с пальцами, скелет и три клипа: Idle (дыхание), Blink (моргание) и
Wave (приветствие рукой). Клипы задевают разные кости, поэтому их можно
проигрывать одновременно.

Запуск (Blender 4.4+ или 5.x):

    blender -b -P blender/build_characters.py              # без интерфейса
    blender -b -P blender/build_characters.py -- --no-render
    blender -b -P blender/build_characters.py -- --draft   # быстрый черновой рендер

или из Python с модулем bpy:  python blender/build_characters.py
После сборки сожмите модели для сайта:  sh blender/optimize.sh

Результат:
    blender/bliss_characters.blend   — исходник со всеми персонажами
    blender/export/<категория>.glb   — несжатые GLB (в git не попадают)
    public/models/<категория>.glb    — сжатые GLB для сайта (после optimize.sh)
    public/posters/<категория>.webp  — постеры (если нет WebGL)
    docs/img/characters.webp         — общий кадр для документации

Вся геометрия создаётся этим скриптом, сторонних моделей и текстур нет.
"""

import math
import os
import sys

import bpy  # до bmesh: в модуле bpy bmesh появляется после импорта bpy
import bmesh  # noqa: E402
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import bliss_export as bx  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
RENDER = "--no-render" not in ARGS
DRAFT = "--draft" in ARGS

FPS = 30
UP = Vector((0.0, 0.0, 1.0))
Y_AXIS = Vector((0.0, 1.0, 0.0))

OUT_BLEND = os.path.join(HERE, "bliss_characters.blend")
OUT_MODELS = os.path.join(HERE, "export")
OUT_POSTERS = os.path.join(ROOT, "public", "posters")
OUT_DOCS = os.path.join(ROOT, "docs", "img")


# --------------------------------------------------------------------------
# Цвета и материалы
# --------------------------------------------------------------------------


def lin(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


_MATS = {}


def material(name, color, rough=0.8, sheen=0.0, coat=0.0, emission=0.0, spec=0.5):
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    if m.node_tree is None:
        m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    c = lin(color)
    b.inputs["Base Color"].default_value = c
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = spec
    if sheen:
        b.inputs["Sheen Weight"].default_value = sheen
        b.inputs["Sheen Roughness"].default_value = 0.45
        b.inputs["Sheen Tint"].default_value = (1.0, 1.0, 1.0, 1.0)
    if coat:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.12
    if emission:
        b.inputs["Emission Color"].default_value = c
        b.inputs["Emission Strength"].default_value = emission
    m.diffuse_color = c
    m.roughness = rough
    _MATS[name] = m
    return m


def fabric(name, color):
    return material(name, color, rough=0.88, sheen=0.35, spec=0.3)


def face_materials():
    return dict(
        eye=material("eye", "#1f1c1a", rough=0.16, spec=0.7, coat=0.6),
        glint=material("eye_glint", "#ffffff", rough=0.3, emission=0.5),
        mouth=material("mouth", "#4a2a26", rough=0.55),
        tongue=material("tongue", "#e98a7f", rough=0.6),
        cheek=material("cheek", "#f3a99f", rough=0.95, spec=0.2),
    )


def wood():
    return material("wood_oak", "#b98a5e", rough=0.5, coat=0.25, spec=0.4)


# --------------------------------------------------------------------------
# Геометрия
# --------------------------------------------------------------------------


def faces_of(verts):
    return list({f for v in verts for f in v.link_faces})


def set_mat(verts, idx):
    for f in faces_of(verts):
        f.material_index = idx


def mesh_object(name, bm, mats, coll, smooth=True, location=(0, 0, 0)):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    me.polygons.foreach_set("use_smooth", [smooth] * len(me.polygons))
    me.update()
    ob = bpy.data.objects.new(name, me)
    ob.location = location
    coll.objects.link(ob)
    return ob


def frame(x_axis, y_axis, z_axis):
    """3×3 матрица с заданными столбцами."""
    return Matrix((x_axis, y_axis, z_axis)).transposed()


def add_ellipsoid(bm, center, radii, rot=None, mi=0, segs=16, rings=10):
    res = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    m = Matrix.Translation(Vector(center))
    if rot is not None:
        m = m @ rot.to_4x4()
    m = m @ Matrix.Diagonal((*radii, 1.0))
    bmesh.ops.transform(bm, matrix=m, verts=res["verts"])
    set_mat(res["verts"], mi)
    return res["verts"]


def add_capsule(bm, a, b, r1, r2=None, mi=0, segs=14):
    r2 = r1 if r2 is None else r2
    a, b = Vector(a), Vector(b)
    axis = b - a
    res = bmesh.ops.create_cone(
        bm, cap_ends=False, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=axis.length
    )
    rot = UP.rotation_difference(axis.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=res["verts"])
    set_mat(res["verts"], mi)
    add_ellipsoid(bm, a, (r1, r1, r1), mi=mi, segs=segs, rings=8)
    add_ellipsoid(bm, b, (r2, r2, r2), mi=mi, segs=segs, rings=8)


def bake_modifiers(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)
    return me


def _smooth01(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def pillow(name, size, center, mat, coll, radius=0.05, puff=(0, 0, 0), tilt=0.0, live_subsurf=1):
    """Мягкая подушка: скруглённый брусок с выпуклыми гранями."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    bev = ob.modifiers.new("bevel", "BEVEL")
    bev.width = radius
    bev.segments = 3
    bev.limit_method = "NONE"
    bev.use_clamp_overlap = True
    sub = ob.modifiers.new("subsurf", "SUBSURF")
    sub.levels = 1
    me = bake_modifiers(ob)

    h = [s / 2 for s in size]
    for v in me.vertices:
        p = v.co.copy()
        n = [p[i] / h[i] for i in range(3)]
        off = Vector()
        for k in range(3):
            if not puff[k]:
                continue
            i, j = [a for a in range(3) if a != k]
            w = _smooth01((abs(n[k]) - 0.5) / 0.45)
            lat = max(0.0, 1 - n[i] ** 2) * max(0.0, 1 - n[j] ** 2)
            off[k] = math.copysign(puff[k] * w * lat, p[k])
        v.co = p + off
    me.update()

    me.materials.append(mat)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    if live_subsurf:
        s2 = ob.modifiers.new("subsurf", "SUBSURF")
        s2.levels = live_subsurf
        s2.render_levels = live_subsurf + 1
    ob.location = center
    ob.rotation_euler = (tilt, 0.0, 0.0)
    return ob


def lathe(name, profile, mat, coll, segs=40, live_subsurf=1):
    """Тело вращения вокруг Z по профилю [(радиус, высота), ...] снизу вверх."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0.0, 0.0, z))])
        else:
            rings.append(
                [
                    bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z))
                    for i in range(segs)
                ]
            )
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            if len(a) == 1:
                bm.faces.new((a[0], b[i], b[j]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[j], b[0]))
            else:
                bm.faces.new((a[i], a[j], b[j], b[i]))
    ob = mesh_object(name, bm, [mat], coll)
    if live_subsurf:
        s = ob.modifiers.new("subsurf", "SUBSURF")
        s.levels = live_subsurf
        s.render_levels = live_subsurf + 1
    return ob


def tube(name, pts, radius, mat, coll, closed=True, res=3):
    """Кант/шнур по ломаной."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, xyz in zip(sp.points, pts):
        p.co = (*xyz, 1.0)
    sp.use_cyclic_u = closed
    tmp = bpy.data.objects.new(name + "_tmp", cu)
    coll.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    me.materials.append(mat)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def rounded_rect(w, d, r, n=8):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, d / 2 - r, 0), (-(w / 2 - r), d / 2 - r, 90),
                       (-(w / 2 - r), -(d / 2 - r), 180), (w / 2 - r, -(d / 2 - r), 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def leg(name, a, b, r1, r2, mat, coll):
    bm = bmesh.new()
    add_capsule(bm, a, b, r1, r2, segs=16)
    return mesh_object(name, bm, [mat], coll)


# --------------------------------------------------------------------------
# Мебель
# --------------------------------------------------------------------------


def build_sofa(coll):
    main = fabric("sofa_fabric", "#86a596")
    dark = fabric("sofa_fabric_dark", "#6e8d7f")
    w = wood()
    parts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(leg(f"sofa_leg_{sx}{sy}", (sx * 0.82, sy * 0.33, 0.1), (sx * 0.83, sy * 0.34, 0.012),
                             0.026, 0.017, w, coll))
    parts.append(pillow("sofa_base", (1.5, 0.86, 0.22), (0, 0, 0.2), dark, coll, radius=0.05, puff=(0, 0.01, 0)))
    for sx in (-1, 1):
        parts.append(pillow(f"sofa_armrest_{'L' if sx > 0 else 'R'}", (0.22, 0.86, 0.56), (sx * 0.84, 0, 0.37),
                            main, coll, radius=0.08, puff=(0.012, 0, 0.02)))
    parts.append(pillow("sofa_back_frame", (1.48, 0.2, 0.72), (0, 0.33, 0.45), dark, coll, radius=0.06,
                        puff=(0, 0.01, 0.01)))
    for sx in (-1, 1):
        parts.append(pillow(f"sofa_seat_{'L' if sx > 0 else 'R'}", (0.72, 0.64, 0.17), (sx * 0.366, -0.08, 0.395),
                            main, coll, radius=0.06, puff=(0, 0.01, 0.025)))
    back = pillow("sofa_back_cushion", (1.44, 0.22, 0.44), (0, 0.17, 0.69), main, coll, radius=0.08,
                  puff=(0, 0.03, 0.01), tilt=math.radians(-10))
    parts.append(back)
    return parts, back


def build_armchair(coll):
    main = fabric("armchair_fabric", "#cf8662")
    dark = fabric("armchair_fabric_dark", "#b8714f")
    w = wood()
    parts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(leg(f"armchair_leg_{sx}{sy}", (sx * 0.36, sy * 0.32, 0.11), (sx * 0.375, sy * 0.335, 0.012),
                             0.024, 0.016, w, coll))
    parts.append(pillow("armchair_base", (0.56, 0.84, 0.22), (0, 0, 0.21), dark, coll, radius=0.05,
                        puff=(0.008, 0.01, 0)))
    for sx in (-1, 1):
        parts.append(pillow(f"armchair_armrest_{'L' if sx > 0 else 'R'}", (0.2, 0.84, 0.58), (sx * 0.36, 0, 0.39),
                            main, coll, radius=0.085, puff=(0.012, 0, 0.022)))
    parts.append(pillow("armchair_back_frame", (0.54, 0.18, 0.74), (0, 0.33, 0.47), dark, coll, radius=0.06,
                        puff=(0, 0.01, 0.01)))
    parts.append(pillow("armchair_seat", (0.53, 0.62, 0.17), (0, -0.08, 0.405), main, coll, radius=0.06,
                        puff=(0, 0.01, 0.028)))
    back = pillow("armchair_back_cushion", (0.52, 0.22, 0.46), (0, 0.17, 0.71), main, coll, radius=0.08,
                  puff=(0, 0.03, 0.01), tilt=math.radians(-10))
    parts.append(back)
    return parts, back


MATTRESS_W, MATTRESS_D, MATTRESS_Z0, MATTRESS_Z1 = 1.9, 1.35, 0.016, 0.33


def build_mattress(coll):
    top_m = fabric("mattress_top", "#eee7da")
    band_m = fabric("mattress_band", "#93a9b9")
    pipe_m = material("mattress_piping", "#6f8698", rough=0.7, sheen=0.2)
    W, D, Z0, Z1 = MATTRESS_W, MATTRESS_D, MATTRESS_Z0, MATTRESS_Z1
    r = 0.07
    parts = []

    # Боковая лента: стенки со скруглёнными углами и лёгкой выпуклостью.
    bm = bmesh.new()
    levels = 9
    rings = []
    for k in range(levels):
        t = k / (levels - 1)
        z = Z0 + (Z1 - Z0) * t
        bulge = 0.014 * math.sin(math.pi * t)
        pts = rounded_rect(W + 2 * bulge, D + 2 * bulge, r + bulge)
        rings.append([bm.verts.new((x, y, z)) for x, y in pts])
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bottom_c = bm.verts.new((0, 0, Z0))
    for i in range(n):
        bm.faces.new((rings[0][(i + 1) % n], rings[0][i], bottom_c))
    band = mesh_object("mattress_band", bm, [band_m], coll)
    parts.append(band)

    # Верх: стёганая панель «ромбом» с ровной каймой по краю.
    bm = bmesh.new()
    nx, ny = 76, 54
    cell = 0.19
    grid = []
    for iy in range(ny + 1):
        row = []
        for ix in range(nx + 1):
            x = -W / 2 + W * ix / nx
            y = -D / 2 + D * iy / ny
            cx = math.copysign(W / 2 - r, x)
            cy = math.copysign(D / 2 - r, y)
            dx, dy = x - cx, y - cy
            if abs(x) > W / 2 - r and abs(y) > D / 2 - r:
                ln = math.hypot(dx, dy)
                k = max(abs(dx), abs(dy)) / ln if ln > 1e-9 else 0
                x, y = cx + dx * k, cy + dy * k
            edge = min(W / 2 - abs(x), D / 2 - abs(y))
            if abs(x) > W / 2 - r and abs(y) > D / 2 - r:
                edge = r - math.hypot(x - cx, y - cy)
            s = (x + y) / cell
            t = (x - y) / cell
            q = abs(math.sin(math.pi * s) * math.sin(math.pi * t)) ** 0.4
            z = Z1 + 0.006 * _smooth01(edge / 0.03) + 0.034 * q * _smooth01((edge - 0.06) / 0.05)
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for iy in range(ny):
        for ix in range(nx):
            bm.faces.new((grid[iy][ix], grid[iy][ix + 1], grid[iy + 1][ix + 1], grid[iy + 1][ix]))
    parts.append(mesh_object("mattress_top", bm, [top_m], coll))

    # Канты по верхнему и нижнему краю.
    for name, z in (("mattress_piping_top", Z1 + 0.002), ("mattress_piping_bottom", Z0 + 0.002)):
        pts = [(x, y, z) for x, y in rounded_rect(W + 0.004, D + 0.004, r + 0.002)]
        parts.append(tube(name, pts, 0.012, pipe_m, coll))

    # Ручки-петли на торцах.
    for sx in (-1, 1):
        parts.append(pillow(f"mattress_handle_{'L' if sx > 0 else 'R'}", (0.026, 0.17, 0.045),
                            (sx * (W / 2 + 0.018), 0.3, 0.2), pipe_m, coll, radius=0.012, live_subsurf=1))
    return parts, band


def build_chair(coll):
    main = fabric("chair_fabric", "#d7a74f")
    w = wood()
    parts = []
    for sx in (-1, 1):
        parts.append(leg(f"chair_leg_front_{sx}", (sx * 0.19, -0.19, 0.38), (sx * 0.195, -0.2, 0.012), 0.02, 0.015,
                         w, coll))
        parts.append(leg(f"chair_post_{sx}", (sx * 0.19, 0.25, 0.86), (sx * 0.195, 0.2, 0.012), 0.019, 0.015, w,
                         coll))
    parts.append(pillow("chair_apron", (0.44, 0.44, 0.05), (0, 0, 0.38), w, coll, radius=0.015, live_subsurf=1))
    parts.append(pillow("chair_seat", (0.47, 0.47, 0.085), (0, -0.005, 0.445), main, coll, radius=0.035,
                        puff=(0, 0, 0.016)))
    back = pillow("chair_back", (0.37, 0.065, 0.29), (0, 0.222, 0.69), main, coll, radius=0.03,
                  puff=(0, 0.014, 0), tilt=math.radians(-8))
    parts.append(back)
    return parts, back


def build_pouf(coll):
    main = fabric("pouf_fabric", "#9d92bd")
    accent = material("pouf_trim", "#857aa8", rough=0.7, sheen=0.25)
    profile = [
        (0.0, 0.006), (0.2, 0.006), (0.245, 0.014), (0.272, 0.04), (0.29, 0.09), (0.3, 0.16), (0.302, 0.22),
        (0.298, 0.29), (0.285, 0.345), (0.262, 0.385), (0.225, 0.41), (0.17, 0.423), (0.1, 0.42), (0.045, 0.408),
        (0.0, 0.398),
    ]
    body = lathe("pouf_body", profile, main, coll)
    parts = [body]
    ring = [(0.267 * math.cos(a), 0.267 * math.sin(a), 0.386) for a in
            (2 * math.pi * i / 72 for i in range(72))]
    parts.append(tube("pouf_piping_top", ring, 0.011, accent, coll))
    bm = bmesh.new()
    add_ellipsoid(bm, (0, 0, 0.402), (0.026, 0.026, 0.012))
    parts.append(mesh_object("pouf_button", bm, [accent], coll))
    return parts, body


# --------------------------------------------------------------------------
# Персонажи: лицо, руки, скелет
# --------------------------------------------------------------------------

#  s — масштаб черт лица и рук; face — центр лица на поверхности;
#  shoulder — точка крепления левой (+X) руки, правая зеркальна;
#  alpha — отклонение висящей руки от вертикали наружу, градусы;
#  raise_out — наклон поднятой руки наружу от вертикали при приветствии.
SPECS = {
    "sofa": dict(title="Диван", build=build_sofa, s=1.0, face=(0.71, 0.135), mouth_z=0.615,
                 shoulder=(0.946, -0.12, 0.52), alpha=34, line_x=-2.6),
    "armchair": dict(title="Кресло", build=build_armchair, s=0.85, face=(0.735, 0.105), mouth_z=0.655,
                     shoulder=(0.456, -0.12, 0.54), alpha=34, line_x=-0.9),
    "mattress": dict(title="Матрас", build=build_mattress, s=0.72, face=(0.205, 0.105), mouth_z=0.125,
                     shoulder=(0.949, -0.5, 0.2), alpha=60, raise_out=50, line_x=0.75),
    "chair": dict(title="Стул", build=build_chair, s=0.55, face=(0.715, 0.068), mouth_z=0.655,
                  shoulder=(0.207, 0.232, 0.72), alpha=34, raise_out=44, line_x=2.25),
    "other": dict(title="Другое", build=build_pouf, s=0.6, face=(0.25, 0.08), mouth_z=0.188,
                  shoulder=(0.293, -0.04, 0.28), alpha=36, line_x=3.15),
}


def surface_hit(ob, x, z):
    """Точка на передней поверхности объекта (луч вдоль +Y) и нормаль в мировых координатах."""
    dg = bpy.context.evaluated_depsgraph_get()
    mw = ob.matrix_world
    mi = mw.inverted()
    o = mi @ Vector((x, -5.0, z))
    d = (mi.to_3x3() @ Y_AXIS).normalized()
    ok, loc, nor, _ = ob.ray_cast(o, d, depsgraph=dg)
    if not ok:
        raise RuntimeError(f"Луч не попал в {ob.name} в точке x={x}, z={z}")
    n = (mw.inverted().transposed().to_3x3() @ nor).normalized()
    return mw @ loc, n


def surface_frame(n):
    up = (UP - n * UP.dot(n)).normalized()
    inward = -n
    x_axis = inward.cross(up).normalized()
    return frame(x_axis, inward, up), up


def build_face(cat, coll, surf, s, face_z, eye_dx, mouth_z, mats):
    out = {}
    rx, ry = 0.05 * s, 0.064 * s
    depth = 0.55 * rx
    for side, sx in (("L", 1), ("R", -1)):
        loc, n = surface_hit(surf, sx * eye_dx, face_z)
        rot, up = surface_frame(n)
        center = loc - n * (depth * 0.42)
        bm = bmesh.new()
        add_ellipsoid(bm, (0, 0, 0), (rx, depth, ry), rot=rot, mi=0, segs=24, rings=14)
        add_ellipsoid(bm, rot @ Vector((-0.34 * rx, -0.8 * depth, 0.36 * ry)), (0.27 * rx, 0.12 * rx, 0.27 * rx),
                      rot=rot, mi=1, segs=12, rings=8)
        add_ellipsoid(bm, rot @ Vector((0.3 * rx, -0.84 * depth, -0.32 * ry)), (0.12 * rx, 0.06 * rx, 0.12 * rx),
                      rot=rot, mi=1, segs=10, rings=6)
        ob = mesh_object(f"{cat}_eye_{side}", bm, [mats["eye"], mats["glint"]], coll, location=center)
        out[f"eye_{side}"] = (ob, center, up)

    loc, n = surface_hit(surf, 0.0, mouth_z)
    rot, up = surface_frame(n)
    mw, mh, md = 0.05 * s, 0.035 * s, 0.015 * s
    center = loc - n * (md * 0.45)
    bm = bmesh.new()
    verts = add_ellipsoid(bm, (0, 0, 0), (mw, md, mh), mi=0, segs=24, rings=14)
    for v in verts:
        if v.co.z > 0:
            v.co.z *= 0.18
        v.co = rot @ v.co
    add_ellipsoid(bm, rot @ Vector((0.0, -0.45 * md, -0.52 * mh)), (0.55 * mw, 0.55 * md, 0.34 * mh), rot=rot,
                  mi=1, segs=16, rings=8)
    ob = mesh_object(f"{cat}_mouth", bm, [mats["mouth"], mats["tongue"]], coll, location=center)
    out["mouth"] = (ob, center, up)

    bm = bmesh.new()
    for sx in (1, -1):
        loc, n = surface_hit(surf, sx * (eye_dx + 0.045 * s), face_z - 0.068 * s)
        rot, _ = surface_frame(n)
        add_ellipsoid(bm, loc - n * 0.002, (0.03 * s, 0.004, 0.019 * s), rot=rot, segs=16, rings=8)
    cheeks = mesh_object(f"{cat}_cheeks", bm, [mats["cheek"]], coll)
    out["cheeks"] = cheeks
    return out


def build_arm(cat, coll, side, shoulder, alpha_deg, s, mat):
    sx = 1 if side == "L" else -1
    p = Vector((sx * shoulder[0], shoulder[1], shoulder[2]))
    a = math.radians(alpha_deg)
    d = Vector((sx * math.sin(a), 0.0, -math.cos(a)))
    length, radius, h = 0.19 * s, 0.03 * s, 0.13 * s
    wrist = p + d * length

    bm = bmesh.new()
    add_capsule(bm, Vector(), d * length, radius * 1.08, radius * 0.86)
    arm = mesh_object(f"{cat}_arm_{side}", bm, [mat], coll, location=p)

    # Кисть: ладонь к зрителю, три пальца и большой палец наружу.
    lateral = Vector((sx, 0, 0))
    lateral = (lateral - d * lateral.dot(d)).normalized()
    thin = lateral.cross(d).normalized()
    rot = frame(lateral, d, thin)
    bm = bmesh.new()
    add_ellipsoid(bm, d * (0.4 * h), (0.4 * h, 0.44 * h, 0.2 * h), rot=rot, segs=18, rings=12)
    for off, ln, ang in ((-0.25, 0.32, -9), (0.0, 0.37, 0), (0.24, 0.33, 8)):
        base = d * (0.62 * h) + lateral * (off * h)
        direction = (Quaternion(thin, math.radians(-ang * sx)) @ d).normalized()
        add_capsule(bm, base, base + direction * (ln * h), 0.105 * h, 0.1 * h, segs=12)
    t_base = d * (0.36 * h) + lateral * (0.28 * h)
    t_dir = (lateral * 0.85 + d * 0.45).normalized()
    add_capsule(bm, t_base, t_base + t_dir * (0.27 * h), 0.112 * h, 0.1 * h, segs=12)
    hand = mesh_object(f"{cat}_hand_{side}", bm, [mat], coll, location=wrist)
    return dict(arm=arm, hand=hand, shoulder=p, wrist=wrist, dir=d, h=h, radius=radius, length=length)


def build_rig(cat, coll, face, arms, height):
    data = bpy.data.armatures.new(f"{cat}_rig")
    rig = bpy.data.objects.new(f"BLISS_{cat}", data)
    coll.objects.link(rig)
    rig["bliss_category"] = cat
    rig["bliss_clips"] = "Idle,Blink,Wave"
    data.display_type = "STICK"
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    eb = data.edit_bones

    def bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        b.roll = 0.0
        b.use_deform = False
        if parent:
            b.parent = eb[parent]
        return b

    bone("body", (0, 0, 0), (0, 0, height * 0.5))
    for key in ("eye_L", "eye_R", "mouth"):
        _, c, up = face[key]
        bone(key, c, c + up * 0.04, "body")
    for side, arm in arms.items():
        bone(f"arm_{side}", arm["shoulder"], arm["wrist"], "body")
        bone(f"hand_{side}", arm["wrist"], arm["wrist"] + arm["dir"] * arm["h"] * 0.8, f"arm_{side}")
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def parent_to_bone(ob, rig, bone):
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = "BONE"
    ob.parent_bone = bone
    bpy.context.view_layer.update()
    ob.matrix_world = mw


def add_anchor(name, rig, coll, location):
    e = bpy.data.objects.new(name, None)
    e["bliss_node"] = name
    e.empty_display_type = "SPHERE"
    e.empty_display_size = 0.03
    coll.objects.link(e)
    e.parent = rig
    e.location = location
    return e


# --------------------------------------------------------------------------
# Анимация
# --------------------------------------------------------------------------


def local_rot(rig, bone, q_world):
    r = rig.data.bones[bone].matrix_local.to_3x3()
    return (r.inverted() @ q_world.to_matrix() @ r).to_quaternion()


def new_action(rig, name):
    # Имя действия уникально в .blend (sofa_Wave), имя клипа в GLB — по NLA-дорожке (Wave).
    act = bpy.data.actions.new(f"{rig['bliss_category']}_{name}")
    act["bliss_clip"] = name
    act.use_fake_user = True
    ad = rig.animation_data or rig.animation_data_create()
    ad.action = act
    if hasattr(act, "slots") and ad.action_slot is None:
        slot = act.slots.new(id_type="OBJECT", name=rig.name)
        ad.action_slot = slot
    return act


def key(rig, bone, frame_no, rot=None, scale=None):
    pb = rig.pose.bones[bone]
    if rot is not None:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = rot
        pb.keyframe_insert("rotation_quaternion", frame=frame_no, group=bone)
    if scale is not None:
        pb.scale = scale
        pb.keyframe_insert("scale", frame=frame_no, group=bone)


def reset_pose(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
        pb.scale = (1, 1, 1)
        pb.location = (0, 0, 0)


def stash(rig, act):
    ad = rig.animation_data
    track = ad.nla_tracks.new()
    track.name = act["bliss_clip"]
    track.strips.new(act["bliss_clip"], 0, act)
    track.mute = True
    ad.action = None


def ry(deg):
    return Quaternion(Y_AXIS, math.radians(deg))


def make_actions(rig, alpha, raise_out):
    acts = {}

    reset_pose(rig)
    act = new_action(rig, "Idle")
    for f, sxz, sy in ((0, 1.0, 1.0), (60, 0.996, 1.014), (120, 1.0, 1.0)):
        key(rig, "body", f, scale=(sxz, sy, sxz))
    acts["Idle"] = act
    stash(rig, act)

    reset_pose(rig)
    act = new_action(rig, "Blink")
    for f, sy, sx in ((0, 1.0, 1.0), (3, 0.08, 1.05), (5, 0.08, 1.05), (9, 1.0, 1.0)):
        for b in ("eye_L", "eye_R"):
            key(rig, b, f, scale=(sx, sy, sx))
    acts["Blink"] = act
    stash(rig, act)

    # Приветствие левой (+X, справа на экране) рукой: поднять, помахать, опустить.
    # Поднятая рука смотрит вверх с наклоном наружу raise_out°, чтобы не заходить за корпус.
    reset_pose(rig)
    act = new_action(rig, "Wave")
    up = -(180 - raise_out - alpha)
    shoulder = [(0, 0), (10, up - 6), (14, up), (20, up - 4), (26, up + 5), (32, up - 4), (38, up + 4),
                (44, up), (56, -2), (60, 0)]
    hand = [(0, 0), (10, 0), (14, 18), (20, -20), (26, 20), (32, -20), (38, 18), (44, 0), (60, 0)]
    for f, deg in shoulder:
        key(rig, "arm_L", f, rot=local_rot(rig, "arm_L", ry(deg)))
    for f, deg in hand:
        key(rig, "hand_L", f, rot=local_rot(rig, "hand_L", ry(deg)))
    for f, sc in ((0, 1.0), (8, 1.16), (46, 1.16), (58, 1.0)):
        key(rig, "mouth", f, scale=(sc, sc, 1.0))
    acts["Wave"] = act
    stash(rig, act)
    reset_pose(rig)
    return acts


def use_action(rig, act):
    ad = rig.animation_data
    ad.action = act
    if act is not None and hasattr(act, "slots") and len(act.slots):
        ad.action_slot = act.slots[0]


# --------------------------------------------------------------------------
# Проверка: руки не заходят в корпус и в пол
# --------------------------------------------------------------------------


def world_bvh(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    verts, polys = [], []
    for ob in objs:
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        off = len(verts)
        verts.extend(mw @ v.co for v in me.vertices)
        polys.extend([off + i for i in p.vertices] for p in me.polygons)
        ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys), verts


def signed_distance(bvh, p):
    loc, nor, _, dist = bvh.find_nearest(p)
    if loc is None:
        return 1e9
    return dist if (p - loc).dot(nor) >= 0 else -dist


def check_arms(cat, rig, body_objs, arms, acts):
    problems = []
    frames = [("rest", None, 0)] + [("Wave", acts["Wave"], f) for f in range(0, 61, 2)]
    worst = {}
    for label, act, f in frames:
        use_action(rig, act)
        bpy.context.scene.frame_set(f)
        bpy.context.view_layer.update()
        for side, arm in arms.items():
            others = [o for o in body_objs]
            for s2, a2 in arms.items():
                if s2 != side:
                    others += [a2["arm"], a2["hand"]]
            body_bvh, _ = world_bvh(others)
            hand_bvh, hand_verts = world_bvh([arm["hand"]])
            if hand_bvh.overlap(body_bvh):
                problems.append(f"{cat}: кисть {side} пересекает корпус ({label} кадр {f})")
            min_z = min(v.z for v in hand_verts)
            if min_z < 0.004:
                problems.append(f"{cat}: кисть {side} уходит в пол ({label} кадр {f}, z={min_z:.3f})")
            pb = rig.pose.bones[f"arm_{side}"]
            head = rig.matrix_world @ pb.head
            tail = rig.matrix_world @ pb.tail
            clear = min(signed_distance(body_bvh, head.lerp(tail, t)) for t in (0.5, 0.65, 0.8, 1.0))
            clear -= arm["radius"]
            hand_clear = min(signed_distance(body_bvh, v) for v in hand_verts[::7])
            worst.setdefault(side, [1e9, 1e9])
            worst[side][0] = min(worst[side][0], clear)
            worst[side][1] = min(worst[side][1], hand_clear)
            if clear < 0.003:
                problems.append(f"{cat}: рука {side} касается корпуса ({label} кадр {f}, зазор {clear:.3f})")
    use_action(rig, None)
    reset_pose(rig)
    bpy.context.scene.frame_set(0)
    for side, (c1, c2) in sorted(worst.items()):
        print(f"[bliss] {cat}: минимальный зазор руки {side} {c1 * 100:.1f} см, кисти {c2 * 100:.1f} см")
    return problems


# --------------------------------------------------------------------------
# Сборка персонажа
# --------------------------------------------------------------------------


def smart_uv(objs):
    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.01, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    for ob in objs:
        ob.select_set(False)


def build_character(cat, scene_coll):
    spec = SPECS[cat]
    coll = bpy.data.collections.new(f"BLISS_{cat}")
    scene_coll.children.link(coll)
    parts, surf = spec["build"](coll)
    bpy.context.view_layer.update()

    s = spec["s"]
    face_z, eye_dx = spec["face"]
    face = build_face(cat, coll, surf, s, face_z, eye_dx, spec["mouth_z"], face_materials())
    hand_mat = surf.data.materials[0]
    arms = {side: build_arm(cat, coll, side, spec["shoulder"], spec["alpha"], s, hand_mat) for side in ("L", "R")}

    fabric_objs = [o for o in parts if any("fabric" in m.name or "mattress_top" in m.name or "band" in m.name
                                           for m in o.data.materials)]
    smart_uv(fabric_objs)

    height = max((o.matrix_world @ Vector(c)).z for o in parts for c in o.bound_box)
    rig = build_rig(cat, coll, face, arms, height)
    for o in parts + [face["cheeks"]]:
        parent_to_bone(o, rig, "body")
    for key_ in ("eye_L", "eye_R", "mouth"):
        parent_to_bone(face[key_][0], rig, key_)
    for side, arm in arms.items():
        parent_to_bone(arm["arm"], rig, f"arm_{side}")
        parent_to_bone(arm["hand"], rig, f"hand_{side}")

    eye_c = face["eye_L"][1]
    add_anchor("anchor_face", rig, coll, (0.0, eye_c.y, (eye_c.z + face["mouth"][1].z) / 2))
    add_anchor("anchor_bubble", rig, coll, (0.0, eye_c.y, height + 0.12 * s + 0.05))

    acts = make_actions(rig, spec["alpha"], spec.get("raise_out", 32))
    body_objs = parts + [face["cheeks"], face["eye_L"][0], face["eye_R"][0], face["mouth"][0]]
    problems = check_arms(cat, rig, body_objs, arms, acts)
    return dict(rig=rig, coll=coll, problems=problems, height=height)


# --------------------------------------------------------------------------
# Сцена для просмотра и постеров
# --------------------------------------------------------------------------


def setup_stage(scene_coll):
    coll = bpy.data.collections.new("Stage")
    scene_coll.children.link(coll)
    sc = bpy.context.scene

    me = bpy.data.meshes.new("floor")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12.0)
    bm.to_mesh(me)
    bm.free()
    floor = bpy.data.objects.new("floor", me)
    floor.data.materials.append(material("floor", "#f6f3ee", rough=0.9))
    floor.is_shadow_catcher = True
    coll.objects.link(floor)

    sun = bpy.data.lights.new("key", "SUN")
    sun.energy = 3.2
    sun.angle = math.radians(14)
    key_ob = bpy.data.objects.new("key", sun)
    key_ob.rotation_euler = (math.radians(42), 0, math.radians(-28))
    coll.objects.link(key_ob)

    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 220
    fill.size = 4
    fill_ob = bpy.data.objects.new("fill", fill)
    fill_ob.location = (3.5, -3.0, 2.2)
    fill_ob.rotation_euler = (Vector((0, 0, 0.5)) - fill_ob.location).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(fill_ob)

    rim = bpy.data.lights.new("rim", "AREA")
    rim.energy = 160
    rim.size = 3
    rim_ob = bpy.data.objects.new("rim", rim)
    rim_ob.location = (-2.5, 3.0, 2.6)
    rim_ob.rotation_euler = (Vector((0, 0, 0.5)) - rim_ob.location).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(rim_ob)

    world = bpy.data.worlds.new("bliss_world")
    if world.node_tree is None:
        world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = lin("#e9e3da")
    bg.inputs["Strength"].default_value = 0.75
    sc.world = world

    cam_data = bpy.data.cameras.new("camera")
    cam_data.lens = 60
    cam = bpy.data.objects.new("camera", cam_data)
    coll.objects.link(cam)
    sc.camera = cam

    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 24 if DRAFT else 96
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.quality = 88
    return cam


def frame_camera(cam, objs, direction=(0.3, -1.0, 0.45), margin=1.12):
    """Камера смотрит вдоль −direction и отодвигается так, чтобы все углы рамок влезли в кадр."""
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    center = (lo + hi) / 2
    sc = bpy.context.scene
    aspect = sc.render.resolution_x / sc.render.resolution_y
    t = cam.data.sensor_width / 2 / cam.data.lens  # тангенс половины угла по широкой стороне
    tan_h, tan_v = (t, t / aspect) if aspect >= 1 else (t * aspect, t)
    d = Vector(direction).normalized()
    fwd = -d
    right = fwd.cross(UP).normalized()
    up = right.cross(fwd)
    dist = 0.0
    for p in pts:
        q = p - center
        dist = max(dist, abs(q.dot(right)) / tan_h - q.dot(fwd), abs(q.dot(up)) / tan_v - q.dot(fwd))
    cam.location = center + d * dist * margin
    cam.rotation_euler = fwd.to_track_quat("-Z", "Y").to_euler()


def render_to(path, res):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        bpy.ops.render.render(write_still=True)
    except RuntimeError as e:
        if sc.cycles.use_denoising:
            print("[bliss] шумоподавление недоступно, рендер без него:", e)
            sc.cycles.use_denoising = False
            sc.cycles.samples *= 2
            bpy.ops.render.render(write_still=True)
        else:
            raise


def render_posters(chars, cam):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = 900, 900
    for cat, info in chars.items():
        for other, oi in chars.items():
            for ob in bx.objects_of(oi["rig"]):
                ob.hide_render = other != cat
        rig = info["rig"]
        saved = rig.location.copy()
        rig.location = (0, 0, 0)
        bpy.context.view_layer.update()
        frame_camera(cam, bx.objects_of(rig))
        render_to(os.path.join(OUT_POSTERS, f"{cat}.webp"), (900, 900))
        rig.location = saved
    for info in chars.values():
        for ob in bx.objects_of(info["rig"]):
            ob.hide_render = False
    bpy.context.view_layer.update()
    sc.render.resolution_x, sc.render.resolution_y = 2000, 800
    all_objs = [o for info in chars.values() for o in bx.objects_of(info["rig"])]
    frame_camera(cam, all_objs, direction=(0.12, -1.0, 0.36), margin=1.04)
    render_to(os.path.join(OUT_DOCS, "characters.webp"), (2000, 800))


# --------------------------------------------------------------------------


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 0, 120
    scene_coll = sc.collection

    chars = {}
    problems = []
    for cat in bx.CATEGORIES:
        info = build_character(cat, scene_coll)
        chars[cat] = info
        problems += info["problems"]

    paths = bx.export_all(OUT_MODELS)
    for cat in bx.CATEGORIES:
        print("[bliss]", bx.summarize_glb(paths[cat]))

    # В .blend персонажи стоят в ряд, чтобы их было видно сразу.
    for cat, info in chars.items():
        info["rig"].location.x = SPECS[cat]["line_x"]
    cam = setup_stage(scene_coll)
    frame_camera(cam, [o for i in chars.values() for o in bx.objects_of(i["rig"])], direction=(0.12, -1.0, 0.36))
    if RENDER:
        render_posters(chars, cam)

    sc.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, compress=True)
    print("[bliss] сохранено:", OUT_BLEND)
    if problems:
        print("[bliss] ПРОБЛЕМЫ:")
        for p in problems:
            print("  -", p)
    else:
        print("[bliss] проверка рук: пересечений с корпусом и полом нет")


if __name__ == "__main__":
    main()
