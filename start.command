#!/bin/bash
# Запуск аквариума на Mac: двойной щелчок в Finder. Закрыть окно — остановить.
# Подробности и что делать, если macOS не даёт открыть файл, — в MAC.md.

cd "$(dirname "$0")" || exit 1

# Finder открывает .command в Терминале с коротким PATH: node от Homebrew
# (/opt/homebrew/bin на Apple Silicon, /usr/local/bin на Intel) может не найтись.
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не найден. Установи версию LTS с https://nodejs.org/ и запусти снова."
  read -n 1 -s -r -p "Нажми любую клавишу, чтобы закрыть окно…"
  exit 1
fi

export PORT="${PORT:-8000}"

# Браузер — через пару секунд, когда сервер уже слушает.
( sleep 2; open "http://localhost:$PORT/" ) &

node server.js

echo
read -n 1 -s -r -p "Сервер остановлен. Нажми любую клавишу, чтобы закрыть окно…"
