#!/bin/sh
# Сжатие GLB для сайта: blender/export/*.glb → public/models/*.glb
# (EXT_meshopt_compression + квантование; drei useGLTF и GLTFLoader с MeshoptDecoder читают это сами).
set -e
cd "$(dirname "$0")/.."
mkdir -p public/models
for f in blender/export/*.glb; do
  name=$(basename "$f")
  npx -y @gltf-transform/cli@4.2.1 meshopt "$f" "public/models/$name" --level medium
  echo "public/models/$name: $(wc -c < "public/models/$name") байт"
done
