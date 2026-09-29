#!/usr/bin/env bash
# 테스트를 실행하고 FAIL 줄·예외를 GitHub Actions 주석(::error::)으로 남긴다 → 로그 권한 없이도 API/모바일 앱에서 원인 확인 가능
set -o pipefail
out=$(mktemp)
"$@" 2>&1 | tee "$out"
rc=${PIPESTATUS[0]}
name="$(basename "${@: -2:1}" 2>/dev/null || echo test)"
fails=$(grep -aE '^FAIL|Traceback|Error:|TimeoutError' "$out" | grep -v '^::' | head -12 | sed 's/%/%25/g' | tr '\n' '\r' | sed 's/\r/%0A/g')
if [ "$rc" != "0" ]; then
  echo "::error title=$name::exit $rc%0A${fails}$(tail -n 3 "$out" | tr '\n' ' ' | sed 's/%/%25/g')"
else
  echo "::notice title=$name::$(grep -a 'SUMMARY\|ALL PASS\|/.* PASS' "$out" | tail -n 1)"
fi
exit $rc
