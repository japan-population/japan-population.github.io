#!/bin/bash
# Finderからダブルクリックすると、本番用ビルドをローカルで表示します。
set -e
cd "$(dirname "$0")"

on_exit() {
  local result=$?
  if [ "$result" -ne 0 ]; then
    printf '\n起動できませんでした。上のエラーをご確認ください。\n'
    read -r -p 'Enterキーで終了します。' unused
  fi
  exit "$result"
}
trap on_exit EXIT

NODE_BIN=""
for candidate in "$(command -v node || true)" /opt/homebrew/bin/node /usr/local/bin/node \
  "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" \
  "$HOME"/.nvm/versions/node/*/bin/node; do
  if [ -x "$candidate" ] && "$candidate" -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22||(major===22&&minor>=12)?0:1)' 2>/dev/null; then
    NODE_BIN="$candidate"
    break
  fi
done
if [ -z "$NODE_BIN" ]; then
  printf 'Node.js 22.12以降が必要です。https://nodejs.org/ からLTS版をインストールしてください。\n'
  exit 1
fi
export PATH="$(dirname "$NODE_BIN"):$PATH"

if [ ! -f node_modules/vite/bin/vite.js ] || [ ! -f node_modules/typescript/bin/tsc ]; then
  if command -v npm >/dev/null 2>&1; then
    printf '初回起動に必要なライブラリをインストールしています…\n'
    npm ci
  else
    printf '依存ライブラリがありません。Node.js LTS版をインストールし、このフォルダーで npm ci を実行してください。\n'
    exit 1
  fi
fi

printf '\n日本人口観測所 — ローカル確認\n'
printf '保存済みのソースと統計JSONから、本番用の画面をビルドします。\n'
printf 'デプロイや政府APIへのアクセスは行いません。\n\n'
"$NODE_BIN" node_modules/typescript/bin/tsc --noEmit
"$NODE_BIN" node_modules/vite/bin/vite.js build
printf '\nブラウザーを開きます。URLは下に表示されます。\n'
printf '終了するには、このターミナルで Control + C を押してください。\n'
printf 'ソースを変更した場合は終了してから、このファイルを再度開いてください。\n\n'
exec "$NODE_BIN" node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --open
