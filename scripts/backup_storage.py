import os
import json
import pathlib
import requests
from urllib.parse import quote

url = os.environ["SUPABASE_URL"].rstrip("/")
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
root = pathlib.Path("backup/storage")
root.mkdir(parents=True, exist_ok=True)

session = requests.Session()
session.headers.update({
    "apikey": key,
    "Authorization": f"Bearer {key}",
})

def request(method, path, **kwargs):
    response = session.request(
        method, f"{url}/storage/v1{path}",
        timeout=120, **kwargs
    )
    response.raise_for_status()
    return response

buckets = request("GET", "/bucket").json()
manifest = []
count = 0

def walk(bucket, prefix=""):
    global count
    offset = 0

    while True:
        items = request(
            "POST",
            f"/object/list/{quote(bucket, safe='')}",
            json={
                "prefix": prefix,
                "limit": 100,
                "offset": offset,
                "sortBy": {
                    "column": "name",
                    "order": "asc"
                }
            }
        ).json()

        if not isinstance(items, list):
            raise RuntimeError("Unexpected Storage response")

        for item in items:
            name = item["name"]
            path = f"{prefix}/{name}" if prefix else name

            if item.get("id") is None:
                walk(bucket, path)
                continue

            destination = root / bucket / path
            destination.parent.mkdir(
                parents=True, exist_ok=True
            )

            encoded_bucket = quote(bucket, safe="")
            encoded_path = quote(path, safe="/")

            with request(
                "GET",
                f"/object/authenticated/{encoded_bucket}/{encoded_path}",
                stream=True
            ) as response:
                with destination.open("wb") as f:
                    for chunk in response.iter_content(
                        chunk_size=1024 * 1024
                    ):
                        if chunk:
                            f.write(chunk)

            manifest.append({
                "bucket": bucket,
                "path": path,
                "size": destination.stat().st_size
            })
            count += 1

        if len(items) < 100:
            break
        offset += len(items)

for bucket in buckets:
    walk(bucket["id"])

(root / "manifest.json").write_text(
    json.dumps(
        manifest,
        ensure_ascii=False,
        indent=2
    ),
    encoding="utf-8"
)

print(f"Storage backup completed: {count} objects")
