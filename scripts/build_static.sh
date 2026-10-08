#!/usr/bin/env bash
# GitHub Pages용 읽기 전용 데모(정적 HTML) 빌드
#
# - 빌드 시점에 Postgres의 공개 집계 뷰를 anon 권한으로 읽어 페이지를 미리 만듭니다
#   (DATA_BACKEND=postgres). 표본 5명 기준 필터는 DB 뷰에서 이미 적용된 값입니다.
# - 서버가 필요한 화면(로그인·등록·내 정보·관리자·인증 콜백·미들웨어)은 빌드 복사본에서 빼고
#   static/overrides의 "데모 안내" 화면으로 바꿉니다. 원본 소스는 건드리지 않습니다.
#
# 사용: DATABASE_URL=... BASE_PATH=/Becomap bash scripts/build_static.sh  → 결과: out-static/
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
BUILD="$ROOT/.static-build"
BASE_PATH="${BASE_PATH:-/Becomap}"
: "${DATABASE_URL:?DATABASE_URL이 필요합니다(로컬 DB: npm run db:local)}"

rm -rf "$BUILD" "$ROOT/out-static"
mkdir -p "$BUILD"
for f in src content public package.json tsconfig.json postcss.config.mjs next.config.ts; do
  [ -e "$f" ] && cp -r "$f" "$BUILD/"
done
ln -s "$ROOT/node_modules" "$BUILD/node_modules"

# 서버 전용 화면 제거 후 데모 안내 화면으로 교체
rm -rf "$BUILD/src/app/login" "$BUILD/src/app/me" "$BUILD/src/app/contribute" \
       "$BUILD/src/app/admin" "$BUILD/src/app/auth" "$BUILD/src/middleware.ts"
cp -r static/overrides/. "$BUILD/"

(
  cd "$BUILD"
  STATIC_EXPORT=1 NEXT_PUBLIC_STATIC_DEMO=1 NEXT_PUBLIC_BASE_PATH="$BASE_PATH" \
    DATA_BACKEND=postgres DATABASE_URL="$DATABASE_URL" npx next build
)
mv "$BUILD/out" "$ROOT/out-static"
touch "$ROOT/out-static/.nojekyll"
rm -rf "$BUILD"
echo "정적 데모 빌드 완료: out-static/ (basePath=$BASE_PATH)"
