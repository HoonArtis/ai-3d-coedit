#!/usr/bin/env bash
# 편집·VR 배경용 360° 파노라마(GPT 이미지 생성). 결과: ./<id>.png
cd "$(dirname "$0")"
BASE="Seamless 360-degree equirectangular panorama, exactly 2:1 aspect ratio (wide), left and right edges must wrap seamlessly. Camera at human eye height (1.6 m) standing in the middle of an empty open floor area. The horizon is exactly at the vertical center. The lower half shows a flat, uncluttered, evenly lit ground with no objects near the center (students will place furniture there). Soft stylized semi-realistic 3D game look, gentle daylight, low contrast, calm pastel colors, no people, no text, no logos, no UI."
g(){
 id="$1"; d="$2"
 timeout 1200 codex exec --skip-git-repo-check -s workspace-write - > "logs/$id.log" 2>&1 <<P
Use your built-in image generation tool to create ONE image in landscape 2:1 format (as wide as possible, e.g. 1536x768 or larger), then save it as ./$id.png in the current directory (create nothing else, write no code).
$BASE
Scene: $d
P
 [ -s "$id.png" ] && echo "OK $id" || echo "FAIL $id"
}
g bg_park "a sunny park clearing: soft green lawn ground with a light stone plaza circle in the middle, distant trees and low hills all around, light blue sky with a few soft clouds" &
g bg_studio "a bright large indoor design studio / classroom: light warm wooden floor, white walls with tall windows letting in daylight, a few plants and shelves along the far walls only" &
g bg_space "a calm sci-fi space station deck: smooth light grey metal floor panels, large panoramic windows showing a starry sky and a blue planet, soft cool lighting" &
g bg_ocean "an underwater sea floor: soft pale sand ground, coral and seaweed only far away around the edges, light rays from the surface above, turquoise water" &
wait
