#!/bin/sh
# Downloads the GPSS Studio Student installer from the vendor's public link (Элина-Компьютер,
# https://elina-computer.ru) and unpacks its sample projects into vendor/gpss-studio-samples.
# The samples belong to their authors and are not part of this repository; they are used only to
# check the project import and the model generator (GPSS_STUDIO_SAMPLES for the backend tests).
#
# Requires: curl, python3, msiextract (msitools). Usage: scripts/fetch-gpss-studio-samples.sh
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
TARGET="$ROOT/vendor/gpss-studio-samples"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
PUBLIC_URL="https://disk.360.yandex.ru/d/eDb3t8rnLsCqHA"

echo "Запрос ссылки на дистрибутив..."
API="https://cloud-api.yandex.net/v1/disk/public/resources?limit=50&public_key=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$PUBLIC_URL")"
curl -fsS "$API" > "$WORK/meta.json"
python3 - "$WORK/meta.json" > "$WORK/file.txt" <<'PY'
import json, sys
meta = json.load(open(sys.argv[1]))
items = [meta] if meta.get('type') == 'file' else meta.get('_embedded', {}).get('items', [])
msi = [item for item in items if item.get('name', '').lower().endswith('.msi')]
if not msi:
    sys.exit('В публичной папке не найден установщик .msi')
print(msi[0]['file']); print(msi[0].get('sha256', '')); print(msi[0]['name'])
PY
URL=$(sed -n 1p "$WORK/file.txt"); SHA=$(sed -n 2p "$WORK/file.txt"); NAME=$(sed -n 3p "$WORK/file.txt")

echo "Загрузка $NAME..."
curl -fsSL --retry 4 -o "$WORK/studio.msi" "$URL"
if [ -n "$SHA" ]; then
  echo "$SHA  $WORK/studio.msi" | sha256sum -c -
fi

echo "Распаковка примеров..."
(cd "$WORK" && msiextract -C "$WORK/msi" studio.msi > /dev/null)
SAMPLES=$(find "$WORK/msi" -name SampleProjects.zip | head -n 1)
[ -n "$SAMPLES" ] || { echo "SampleProjects.zip не найден в дистрибутиве" >&2; exit 1; }
rm -rf "$TARGET"
mkdir -p "$TARGET"
python3 - "$SAMPLES" "$TARGET" <<'PY'
import os, sys, zipfile
# Entry names in the archive are stored in the DOS code page (CP866).
with zipfile.ZipFile(sys.argv[1]) as archive:
    for info in archive.infolist():
        name = info.filename if info.flag_bits & 0x800 else info.filename.encode('cp437').decode('cp866')
        path = os.path.normpath(os.path.join(sys.argv[2], name))
        if not path.startswith(os.path.abspath(sys.argv[2])):
            continue
        if name.endswith('/'):
            os.makedirs(path, exist_ok=True)
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with archive.open(info) as source, open(path, 'wb') as target:
            target.write(source.read())
PY
# Each sample is itself a zipped project folder: unpack them next to the archives.
for archive in "$TARGET"/*.zip; do
  [ -e "$archive" ] || continue
  python3 - "$archive" "${archive%.zip}" <<'PY'
import os, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    for info in archive.infolist():
        name = info.filename if info.flag_bits & 0x800 else info.filename.encode('cp437').decode('cp866')
        path = os.path.normpath(os.path.join(sys.argv[2], name))
        if name.endswith('/'):
            os.makedirs(path, exist_ok=True)
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with archive.open(info) as source, open(path, 'wb') as target:
            target.write(source.read())
PY
  rm "$archive"
done

echo "Готово: $TARGET"
echo "Запуск проверок: GPSS_STUDIO_SAMPLES=$TARGET dotnet test backend/GpssStudio.Projects.Tests"
