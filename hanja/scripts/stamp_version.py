#!/usr/bin/env python3
"""배포 버전 도장: index.html(V · css/js 쿼리 · import map), js/data.js APP_VERSION, version.json 을 한 번에 갱신.
import map 은 모든 JS 모듈 URL 에 ?v=버전 을 붙여, 배포 직후 브라우저 캐시에 남은 이전 모듈이 섞이지 않게 한다.
사용: python3 scripts/stamp_version.py 2026.09.28-8"""
import json, os, re, sys
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = sys.argv[1]
js = sorted(os.path.relpath(os.path.join(r, f), APP).replace(os.sep, "/")
            for r, _d, fs in os.walk(os.path.join(APP, "js")) for f in fs if f.endswith(".js"))
p = os.path.join(APP, "index.html")
s = open(p, encoding="utf-8").read()
s = re.sub(r"var V = '[^']+';", "var V = '%s';" % v, s)
s = re.sub(r'(css/app\.css|js/app\.js)\?v=[^"]+"', lambda m: '%s?v=%s"' % (m.group(1), v), s)
imap = '<script type="importmap">%s</script>\n' % json.dumps({"imports": {"./" + f: "./%s?v=%s" % (f, v) for f in js}}, ensure_ascii=False)
s = re.sub(r'<script type="importmap">.*?</script>\n', "", s, flags=re.S)
s = s.replace('<script type="module" src="js/app.js', imap + '<script type="module" src="js/app.js', 1)
open(p, "w", encoding="utf-8").write(s)
p = os.path.join(APP, "js/data.js")
s = open(p, encoding="utf-8").read()
s = re.sub(r"export const APP_VERSION = '[^']+';", "export const APP_VERSION = '%s';" % v, s)
open(p, "w", encoding="utf-8").write(s)
json.dump({"v": v, "files": ["index.html", "css/app.css"] + js + ["js/app.js?v=%s" % v]}, open(os.path.join(APP, "version.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("stamped", v, len(js), "modules")
