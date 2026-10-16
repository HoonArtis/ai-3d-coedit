"""guide_content.py + media/ → guide.html (이미지·영상 base64 내장 단일 파일)."""
import base64, html, io, json, pathlib, re, sys
from PIL import Image
ROOT = pathlib.Path(__file__).parent
sys.path.insert(0, str(ROOT))
import guide_content as G
MEDIA = ROOT / 'media'
missing, used = [], []

def img_uri(name):
    p = MEDIA / name
    if not p.exists():
        missing.append(name); return None
    im = Image.open(p).convert('RGB')
    zoomish = any(k in name for k in ('zoom', 'props', 'chat'))
    cap = 1100 if zoomish else (2000 if im.width > 2000 else 1600)
    if im.width > cap:
        im = im.resize((cap, round(im.height * cap / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=80 if zoomish else 72, method=6)
    used.append((name, buf.tell()))
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(), im.width, im.height

def vid_uri(name):
    p = MEDIA / name
    if not p.exists():
        missing.append(name); return None
    data = p.read_bytes(); used.append((name, len(data)))
    return 'data:video/mp4;base64,' + base64.b64encode(data).decode()

esc = html.escape
# **…** = 핵심 강조(색 형광). 그 외 텍스트는 그대로 이스케이프
def hl(s): return re.sub(r'\*\*(.+?)\*\*', r'<em class="hl">\1</em>', esc(s))
STATUS = {'촬영': 'ok', '코드 근거': 'code', '미발생': 'none', '개선 필요': 'warn', '기획': 'plan'}
LABEL = {'촬영': '화면 촬영', '코드 근거': '코드 근거', '미발생': '미발생', '개선 필요': '개선 필요', '기획': '기획·미구현'}
VCAP = {'M3-01-place-sync.mp4': '영상 · 왼쪽 학생 1, 오른쪽 학생 2 (배치 동기화)', 'M3-02-move-sync.mp4': '영상 · 왼쪽 학생 1, 오른쪽 학생 2 (이동 동기화)', 'M2-04-drag-drop.mp4': '영상 · 카드 끌어놓기', 'M2-06-move-gizmo.mp4': '영상 · 화살표 끌기 이동', 'M2-14-undo-redo.mp4': '영상 · 되돌리기와 다시하기', 'M4-04-around.mp4': '영상 · 요청부터 원형 배치까지', 'M4-11-cafe.mp4': '영상 · 테마 배치', 'M4-25-cancel.mp4': '영상 · 방금 거 취소'}

def media_html(files, title):
    out = []
    for i, f in enumerate(files):
        role = 'zoom' if any(k in f for k in ('zoom', 'props', 'chat')) else 'shot'
        cap = '확대' if role == 'zoom' else ('영상' if f.endswith('.mp4') else ('전' if f.endswith('before.png') else ('후' if f.endswith('after.png') else '화면')))
        if f.endswith('.mp4'):
            u = vid_uri(f)
            if u: out.append(f'<figure class="m video"><video src="{u}" autoplay muted loop playsinline controls preload="metadata" aria-label="{esc(title)} 영상"></video><figcaption>{esc(VCAP.get(f, cap))}</figcaption></figure>')
        else:
            r = img_uri(f)
            if r:
                u, w, h = r
                out.append(f'<figure class="m {role}{" wide" if "-sync." in f else ""}"><button class="zoomable" type="button" aria-label="{esc(title)} {cap} 크게 보기"><img src="{u}" width="{w}" height="{h}" alt="{esc(title)} {cap}"></button><figcaption>{cap}</figcaption></figure>')
    return ''.join(out)

FLOW = '''<figure class="flow" aria-label="AI 도우미 배치·편집 요청 처리 흐름">
<svg viewBox="0 0 1040 190" role="img"><title>배치·편집 요청 처리 흐름</title>
<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="var(--muted)"/></marker></defs>
<g class="fl">
<rect x="8" y="58" width="150" height="74" rx="10"/><text x="83" y="90">학생 요청</text><text class="s" x="83" y="112">자연어 한 문장</text>
<rect x="210" y="58" width="170" height="74" rx="10"/><text x="295" y="90">요청 내용 파악</text><text class="s" x="295" y="112">요청 종류 구분</text>
<rect x="432" y="58" width="180" height="74" rx="10"/><text x="522" y="90">작업 선택</text><text class="s" x="522" y="112">할 작업과 대상 지정</text>
<rect x="664" y="58" width="170" height="74" rx="10"/><text x="749" y="90">대상·권한 확인</text><text class="s" x="749" y="112">본인 에셋 여부 확인</text>
<rect class="hi" x="886" y="58" width="146" height="74" rx="10"/><text x="959" y="90">장면 반영</text><text class="s" x="959" y="112">조원 화면 동시 반영</text>
<path d="M158 95H206M380 95H428M612 95H660M834 95H882" marker-end="url(#ar)"/>
<text class="t" x="295" y="34">배치 · 편집 · 생성 · 추천</text><text class="t" x="295" y="172">조회 · 되돌리기 · 기타</text>
<text class="t" x="749" y="172">위치·겹침 계산은 배치 알고리즘 담당</text>
</g></svg><figcaption class="flow-cap">배치·편집 요청 기준 흐름. 조회는 답변만 표시(장면 변경 없음), 추천은 카드로 제시 후 "놓기"로 배치, 생성은 생성 작업 시작 후 History 등록.</figcaption></figure>'''

def thumb_uri(name):
    p = MEDIA / name
    if not p.exists():
        missing.append(name); return None
    im = Image.open(p).convert('RGB')
    if im.width > 720: im = im.resize((720, round(im.height * 720 / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=74, method=6); used.append((name, buf.tell()))
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

def view_uri(name):
    p = MEDIA / name
    if not p.exists():
        missing.append(name); return None
    im = Image.open(p).convert('RGB')
    if im.width > 1400: im = im.resize((1400, round(im.height * 1400 / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=76, method=6); used.append((name, buf.tell()))
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

def main_flow_html():
    n, phases = 0, []
    for phase, always, steps in G.MAIN_FLOW:
        lis = []
        for who, title, desc, img, tid, more in steps:
            u = thumb_uri(img)
            if not always: n += 1
            no = '상시' if always else f'{n:02d}'
            fit = ' fit' if 'zoom' in img else ''
            pic = f'<span class="pic{fit}"><img src="{u}" alt="{esc(title)} 화면"></span>' if u else ''
            extra = ''.join(f'<a href="#{t}">{esc(l)}</a>' for t, l in more)
            lis.append(f'<li><div class="step"><span class="no">{no}</span><span class="who">{esc(who)}</span><b>{esc(title)}</b><span class="d">{hl(desc)}</span>{pic}'
                       f'<span class="links"><a class="go" href="#{tid}">{tid} 자세히</a>{extra}</span></div></li>')
        phases.append(f'<div class="phase{" always" if always else ""}"><h3>{esc(phase)}</h3><ol>{"".join(lis)}</ol></div>')
    nxt = ' · '.join(f'<a href="{i}">{esc(t)}</a>' for i, t in G.MAIN_FLOW_NEXT)
    return (f'<section class="sec mainflow" id="main-flow"><div class="sec-head"><span class="kind">한눈에 보기</span><h2>메인 기능 흐름</h2>'
            f'<p>수업 개설부터 공간 편집까지 기본 사용 순서 {n}단계와 편집 중 상시 적용 기능. 링크 클릭 시 해당 기능 설명으로 이동.</p></div>'
            f'<div class="phases">{"".join(phases)}</div><p class="next">이후 선택 기능: {nxt}</p></section>')

NL = chr(10)
DOC_HEAD = NL.join(['<!doctype html>', '<html lang="ko">', '<head>', '<meta charset="utf-8">',
                    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">', ''])
GUIDE_FILE, OVERVIEW_FILE = '기능설명서.html', '한눈에보기.html'

def build_overview():
    lanes, total, views = [], 0, []
    cards = {c[0]: c for sec in G.SECTIONS for c in sec['cards']}
    pcat, psumm, psteps = G.OVERVIEW_PLAN
    for ci, (cat, summ, always, steps) in enumerate(G.OVERVIEW + [(pcat, psumm, 'plan', psteps)], 1):
        plan = always == 'plan'; always = always is True
        lis, k, prev_seq = [], 0, False
        for who, title, desc, img, tid, opt in steps:
            total += 1; u = thumb_uri(img) if img else ''
            fit = ' class="fit"' if img and 'zoom' in img else ''
            pic = f'<img src="{u}"{fit} alt="{esc(title)} 화면">' if u else ''
            seq = not always and not opt
            if seq: k += 1
            n = '상시' if always else ('필요 시' if opt else f'{ci}-{k}')
            cls = ' class="arrow"' if seq and prev_seq else (' class="opt"' if opt else '')
            prev_seq = seq
            badge = f'<span class="n{"" if seq else " soft"}">{k if seq else n}</span>'
            body = f'<span class="txt"><span class="top">{badge}<span class="who {esc(who)}">{esc(who)}</span></span><b>{esc(title)}</b><span class="d">{hl(desc)}</span></span>'
            card = cards.get(tid)
            media = []
            for f in (card[3] if card else [img]):
                if f.endswith('.mp4'):
                    vu = vid_uri(f)
                    if vu: media.append({'t': 'v', 'u': vu, 'c': VCAP.get(f, '영상')})
                else:
                    iu = view_uri(f)
                    if iu: media.append({'t': 'i', 'u': iu, 'c': '확대' if 'zoom' in f else '화면'})
            views.append({'lane': ci, 'cat': cat, 'badge': str(k) if seq else n, 'seq': seq, 'who': who, 'title': title, 'desc': desc, 'tid': tid,
                          'lines': card[2] if card else [], 'plan': bool(card and card[4] == '기획'), 'media': media})
            lis.append(f'<li{cls}><a class="tile{"" if pic else " plan"}" href="{GUIDE_FILE}#{tid}" data-i="{len(views) - 1}" title="크게 보기">{pic}{body}</a></li>')
        nopt = sum(1 for st in steps if st[5])
        order = f'{k}단계 순서{f" + 필요 시 {nopt}" if nopt else ""}'
        tag = '<span class="tag">편집 중 상시 적용</span>' if always else f'<span class="tag">{"기획 · " if plan else ""}{order}</span>'
        lid = ' id="hide"' if plan else ''
        lanes.append(f'<section class="lane{" always" if always else ""}{" plan" if plan else ""}"{lid}><div class="head"><span class="num">{ci:02d}</span><h2>{esc(cat)}</h2><p>{hl(summ)}</p>{tag}</div><ol class="steps">{"".join(lis)}</ol></section>')
    other = ''.join(f'<a href="{GUIDE_FILE}#{i}">{esc(n)}<span>{esc(k)}</span></a>' for i, k, n in G.OVERVIEW_OTHER)
    tpl = (ROOT / 'overview_template.html').read_text(encoding='utf-8')
    data = json.dumps(views, ensure_ascii=False).replace('</', r'<\/')
    return tpl.replace('{{STEPS}}', data).replace('{{LANES}}', ''.join(lanes)).replace('{{OTHER}}', other).replace('{{COUNT}}', str(total)).replace('{{GUIDE}}', GUIDE_FILE)

def write_dist(guide_page):
    dist = ROOT / 'dist'; dist.mkdir(exist_ok=True)
    link = f'<p class="next"><a href="{OVERVIEW_FILE}">한 페이지로 보기: 메인 기능 한눈에 보기 →</a></p></section>'
    g = guide_page.replace('</section><section class="sec" id="entry"', link.replace('</section>', '') + '</section><section class="sec" id="entry"', 1)
    (dist / GUIDE_FILE).write_text(DOC_HEAD + g + NL + '</html>' + NL, encoding='utf-8')
    (dist / OVERVIEW_FILE).write_text(DOC_HEAD + build_overview() + NL + '</html>' + NL, encoding='utf-8')
    for f in (GUIDE_FILE, OVERVIEW_FILE): print(f'dist/{f} {(dist / f).stat().st_size/1e6:.2f}MB')

def build():
    sec_html, nav = [main_flow_html()], ['<a href="#main-flow"><span>한눈에 보기</span>메인 기능 흐름</a>']
    counts = {}
    for sec in G.SECTIONS:
        cards = []
        for tid, title, lines, files, st in sec['cards']:
            counts[st] = counts.get(st, 0) + 1
            lis = ''.join(f'<li>{hl(l)}</li>' for l in lines)
            m = media_html(files, title)
            many = ' many' if len(files) > 1 else ''
            cards.append(f'<article class="card{many}" id="{tid}" data-st="{STATUS[st]}"><header><span class="tid">{tid}</span><h3>{esc(title)}</h3><span class="st {STATUS[st]}">{LABEL[st]}</span></header><ul>{lis}</ul><div class="media">{m}</div></article>')
        flow = FLOW if sec.get('flow') else ''
        sec_html.append(f'<section class="sec" id="{sec["id"]}"><div class="sec-head"><span class="kind">{esc(sec["kind"])}</span><h2>{esc(sec["name"])}</h2><p>{hl(sec["summary"])}</p><span class="n">{len(sec["cards"])}개 기능</span></div>{flow}<div class="cards">{"".join(cards)}</div></section>')
        nav.append(f'<a href="#{sec["id"]}"><span>{esc(sec["kind"])}</span>{esc(sec["name"])}</a>')
    fnd = ''.join(f'<li><a class="tid" href="#{t}">{t}</a><b>{esc(n)}</b><p>{esc(d)}</p></li>' for t, n, d in G.FINDINGS)
    nav.append('<a href="#findings"><span>점검</span>개선 필요 사항</a>')
    facts = ''.join(f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>' for k, v in G.INTRO['facts'])
    total = sum(v for k, v in counts.items() if k != '기획')
    tpl = (ROOT / 'guide_template.html').read_text(encoding='utf-8')
    page = (tpl.replace('{{TITLE}}', esc(G.INTRO['title'])).replace('{{LEAD}}', esc(G.INTRO['lead'])).replace('{{FACTS}}', facts)
            .replace('{{NAV}}', ''.join(nav)).replace('{{SECTIONS}}', ''.join(sec_html)).replace('{{FINDINGS}}', fnd)
            .replace('{{TOTAL}}', str(total)).replace('{{SHOT}}', str(counts.get('촬영', 0))).replace('{{WARN}}', str(len(G.FINDINGS))).replace('{{CODE}}', str(counts.get('코드 근거', 0) + counts.get('미발생', 0))))
    out = ROOT / 'guide.html'; out.write_text(page, encoding='utf-8')
    write_dist(page)
    size = out.stat().st_size
    print(f'guide.html {size/1e6:.2f}MB, media {len(used)}개, 누락 {len(missing)}개')
    for m in missing: print('  누락:', m)
    big = sorted(used, key=lambda x: -x[1])[:5]
    print('  큰 항목:', ', '.join(f'{n} {s/1e3:.0f}KB' for n, s in big))
    return size, missing

if __name__ == '__main__':
    size, miss = build()
    sys.exit(1 if size > 16e6 else 0)
