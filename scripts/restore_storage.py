"""Upload files from a decrypted backup back into Supabase Storage.

Usage (inside the extracted backup folder's parent):
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
        python restore_storage.py /tmp/restore/backup/storage
"""
import json
import mimetypes
import os
import pathlib
import sys
from urllib.parse import quote

import requests

url = os.environ["SUPABASE_URL"].rstrip("/")
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "backup/storage")

session = requests.Session()
session.headers.update({"apikey": key, "Authorization": f"Bearer {key}"})

manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))

existing = {
    b["id"]
    for b in session.get(f"{url}/storage/v1/bucket", timeout=60).json()
}

failed = 0
for bucket in sorted({item["bucket"] for item in manifest}):
    if bucket not in existing:
        # Bucket rows normally come back with the database restore.
        # If not, create it as private; change it in the dashboard if needed.
        r = session.post(
            f"{url}/storage/v1/bucket",
            json={"id": bucket, "name": bucket, "public": False},
            timeout=60,
        )
        r.raise_for_status()
        print(f"Created bucket (private): {bucket}")

for item in manifest:
    bucket, path = item["bucket"], item["path"]
    source = root / bucket / path
    content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with source.open("rb") as f:
        r = session.post(
            f"{url}/storage/v1/object/{quote(bucket, safe='')}/{quote(path, safe='/')}",
            data=f,
            headers={"Content-Type": content_type, "x-upsert": "true"},
            timeout=300,
        )
    if r.ok:
        print(f"OK   {bucket}/{path}")
    else:
        failed += 1
        print(f"FAIL {bucket}/{path}: {r.status_code} {r.text[:200]}")

print(f"Storage restore finished: {len(manifest) - failed} ok, {failed} failed")
sys.exit(1 if failed else 0)
