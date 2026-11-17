"""Переэкспорт GLB из bliss_characters.blend после ручных правок в Blender.

    blender blender/bliss_characters.blend -b -P blender/export_glb.py
    sh blender/optimize.sh

Можно и из открытого Blender: вкладка Scripting → открыть этот файл → Run Script.
Экспортируются все арматуры со свойством bliss_category в blender/export/.
"""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bliss_export as bx  # noqa: E402

# Запуск через модуль bpy (python blender/export_glb.py): файл ещё не открыт.
if not bpy.data.filepath:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, "bliss_characters.blend"))

paths = bx.export_all(os.path.join(HERE, "export"))
for cat in sorted(paths):
    print("[bliss]", bx.summarize_glb(paths[cat]))
