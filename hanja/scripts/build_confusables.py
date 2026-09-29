#!/usr/bin/env python3
"""모양이 비슷한 한자(헷갈리는 한자) 목록 생성.
공개 획순 데이터(Make Me a Hanzi 중앙선, data/strokes/*.json)를 48x48로 래스터화해 모양 유사도(코사인)를 계산한다.
외부 문제·해설을 쓰지 않는 순수 계산 결과. 출력: data/dictionary/confusables.json"""
import json, os, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = 48
chars = set()
for f in glob.glob(os.path.join(APP, 'data/providers/*/hanja-mapping.json')):
    chars |= {x['c'] for x in json.load(open(f, encoding='utf-8'))['items']}
dic = json.load(open(os.path.join(APP, 'data/dictionary/hanja.json'), encoding='utf-8'))['chars']
keys, vecs = [], []
for ch in sorted(chars):
    p = os.path.join(APP, 'data/strokes/%04X.json' % ord(ch))
    if not os.path.exists(p):
        continue
    m = json.load(open(p, encoding='utf-8'))['m']
    im = Image.new('L', (R, R), 0)
    dr = ImageDraw.Draw(im)
    for line in m:
        pts = [(x * R / 1024, (900 - y) * R / 1024) for x, y in line]
        if len(pts) > 1:
            dr.line(pts, fill=255, width=3)
    im = im.filter(ImageFilter.GaussianBlur(1.6))
    v = np.asarray(im, dtype=np.float32).ravel()
    v -= v.mean()
    n = np.linalg.norm(v)
    if n == 0:
        continue
    keys.append(ch); vecs.append(v / n)
V = np.stack(vecs)
sim = V @ V.T
np.fill_diagonal(sim, -1)
out = {}
for i, ch in enumerate(keys):
    idx = np.argsort(-sim[i])[:4]
    lst = [keys[j] for j in idx if sim[i, j] >= 0.62]
    if lst:
        out[ch] = lst
json.dump({'meta': {'method': '획순 중앙선 래스터(48x48) 코사인 유사도 ≥ 0.62, 상위 4자', 'source': 'Make Me a Hanzi 획순 데이터(공개 라이선스)에서 계산', 'count': len(out)}, 'map': out},
          open(os.path.join(APP, 'data/dictionary/confusables.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(keys), 'chars,', len(out), 'with confusables')
for t in '議義儀未末土士己已巳日曰大太犬人入八':
    print(t, out.get(t))
