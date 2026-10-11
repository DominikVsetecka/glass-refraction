#!/bin/zsh
# Start a local server for the demos and open the browser.
# ES modules don't load from file://, so the pages need a server.
cd "$(dirname "$0")" || exit 1

# macOS ships a /usr/bin/python3 stub even without Python, so check that it
# actually runs instead of only checking that the command exists.
if ! python3 -c 'pass' >/dev/null 2>&1; then
  echo "Python 3 is needed to serve the demos locally."
  echo "Install it with: xcode-select --install   (Apple Command Line Tools)"
  echo "or from https://www.python.org/downloads/ and try again."
  exit 1
fi

port=8000
while lsof -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; do port=$((port + 1)); done

python3 -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' INT TERM EXIT

for _ in {1..50}; do
  curl -s -o /dev/null "http://127.0.0.1:$port/" && break
  sleep 0.1
done

echo "Glass Refraction demos: http://127.0.0.1:$port/"
open "http://127.0.0.1:$port/"
wait $server
