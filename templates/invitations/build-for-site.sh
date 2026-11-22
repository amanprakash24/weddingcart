#!/usr/bin/env bash
# Copies a finished invitation from this folder into the Shaadi Shopping site repo
# (weddingcart) as public/invitations/<slug>/, ready to commit.
#
#   ./build-for-site.sh <source-folder> <slug>
#   ./build-for-site.sh shreya-sudhanshu-engagement sudhanshu-shreya
#
# What it does:
#   - wraps the page in a full <!doctype html> document (claude.ai adds this itself; the site does not)
#   - rewrites every "assets/..." path to /invitations/<slug>/assets/... (the page is served
#     without a trailing slash, so relative paths would 404)
#   - makes og:image / canonical absolute on https://www.shaadishopping.com
#   - copies only the assets the page actually references
set -euo pipefail

SRC_DIR="${1:?source folder, e.g. shreya-sudhanshu-engagement}"
SLUG="${2:?slug, e.g. sudhanshu-shreya}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${REPO:-$HERE/../weddingcart}"
SITE="https://www.shaadishopping.com"
P="/invitations/$SLUG"
SRC="$HERE/$SRC_DIR/index.html"
OUT="$REPO/public/invitations/$SLUG"

[ -f "$SRC" ] || { echo "No $SRC" >&2; exit 1; }
mkdir -p "$OUT/assets"

{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  printf '<meta name="theme-color" content="#6d2c4c">\n'
  printf '<link rel="canonical" href="%s%s">\n<meta property="og:url" content="%s%s">\n' "$SITE" "$P" "$SITE" "$P"
  printf '<meta property="og:site_name" content="Shaadi Shopping">\n'
  printf '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'
  printf '<meta name="twitter:image" content="%s%s/assets/og.jpg">\n' "$SITE" "$P"
  printf '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style>\n'
  awk '/^<\/style>$/ && !d {print; print "</head>"; print "<body>"; d=1; next} {print}' "$SRC" \
    | sed "s|<meta property=\"og:image\" content=\"[^\"]*\">|<meta property=\"og:image\" content=\"$SITE$P/assets/og.jpg\">|" \
    | sed "s|\([\"'(]\)assets/|\1$P/assets/|g"
  printf '\n</body>\n</html>\n'
} > "$OUT/index.html"

# copy every asset the page references that exists locally (missing optional art just falls back in-page)
grep -o "$P/assets/[A-Za-z0-9._-]*" "$OUT/index.html" | sort -u | while read -r ref; do
  f="${ref##*/}"
  if [ -f "$HERE/$SRC_DIR/assets/$f" ]; then cp "$HERE/$SRC_DIR/assets/$f" "$OUT/assets/"; else echo "  (not found, page will fall back): $f"; fi
done
echo "Built $OUT"
