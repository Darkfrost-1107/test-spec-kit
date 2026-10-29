#!/usr/bin/env bash
# Ejecuta un comando PowerShell real, guarda su salida y la captura como PNG.
# Uso: run-and-capture.sh <salida.png> "<titulo>" "<comando powershell>" [inicio] [lineas]
set -u
export MSYS_NO_PATHCONV=1
OUT="$1"; TITLE="$2"; CMD="$3"; START="${4:-1}"; COUNT="${5:-100000}"
TMP="$(cygpath -m "$(mktemp)")"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$CMD" >"$TMP" 2>&1
echo "exit=$?" >&2
node "$(dirname "$0")/capture.mjs" "$OUT" "$TITLE" "$CMD" "$TMP" "$START" "$COUNT"
cp "$TMP" "${OUT%.png}.txt"
