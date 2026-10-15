#!/usr/bin/env bash
# 숨바꼭질 기획 예시 화면의 3D 장면을 GPT로 생성(구도는 ref/<id>.png 참고). 결과 ./<id>.png
cd "$(dirname "$0")"
STYLE="High-quality stylized 3D game render, polished and premium (soft global illumination, gentle shadows, subtle bevels, realistic materials but friendly look). Setting: a bright indoor design studio with large windows and a light oak wooden floor, daylight. Furniture with real detail (not boxes): a blue fabric three-seat sofa with cushions, a wooden table with two wooden chairs, a round terracotta rug, a tall wooden bookshelf filled with books, a large monstera plant in a terracotta pot, a floor lamp with a cream shade, and two stacked wooden storage crates. The hiding players are smooth faceless grey art mannequins (like wooden drawing mannequins with ball joints), body-painted to camouflage. Keep the same camera angle, framing and object placement as the attached reference image (the reference is a crude block-out). No text, no UI, no watermark, no logos."
g(){
 id="$1"; d="$2"; t0=$(date +%s)
 timeout 1200 codex exec --skip-git-repo-check -s workspace-write -i "ref/$id.png" - > "logs/$id.log" 2>&1 <<P
Use your built-in image generation tool to create ONE landscape image (3:2, e.g. 1536x1024), using the attached image only as a composition reference. Then save it as ./$id.png in the current directory (create nothing else, write no code).
$STYLE
This shot: $d
P
 if [ ! -s "$id.png" ]; then f=$(find /c/Users/ACE/.codex/generated_images -name '*.png' -newermt "@$t0" 2>/dev/null | head -1); [ -n "$f" ] && cp "$f" "$id.png"; fi
 [ -s "$id.png" ] && echo "OK $id" || echo "FAIL $id"
}
mkdir -p logs
g prep "high-angle three-quarter overview of the whole room. One mannequin crouches on the sofa, painted the same blue as the sofa, with a thin glowing yellow selection outline. Three teammate mannequins are semi-transparent (ghostly, about 45% opacity): one painted green and terracotta beside the plant, one painted beige crouching between the crates, one painted cream standing next to the floor lamp." &
g seek "first-person view at eye height. A sleek stylized sci-fi pistol held in the right hand at the bottom-right of the frame with a small muzzle flash. A mannequin painted dark brown stands against the bookshelf (well camouflaged), one painted blue crouches on the sofa, one painted green stands behind the plant. One mannequin standing on the blue ottoman on the left has been found: tinted red and slightly translucent, with a glowing red ring on the floor under it." &
g ghost "high-angle overview of the whole room seen by a spectator ghost: the scene is slightly desaturated with a cool blue-violet tint and a faint dreamy glow. Every hidden mannequin has a bright glowing yellow outline (on the sofa, by the bookshelf, by the plant, by the floor lamp, between the crates). One found mannequin on the ottoman is tinted red with a red ring." &
g result "calm high-angle overview of the whole room after the round, a few camouflaged mannequins still hidden (on the sofa, by the bookshelf), one found mannequin tinted red with a red ring." &
g gun "first-person view of a small shooting practice corner in the same studio: a sleek stylized sci-fi pistol held in the right hand at the bottom-right, two plain grey mannequin targets standing on the wooden floor ahead, the further one just got hit and is tinted red; a few wooden crates and the bookshelf in the background." &
wait
