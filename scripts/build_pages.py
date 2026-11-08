"""Cloudflare Pages（予備の公開場所）用に、公開してよいファイルだけを dist/ に集める。

GitHub Pages は _config.yml の exclude で開発用ファイルを外している。
Cloudflare Pages はリポジトリをそのまま載せてしまうので、ここで同じものを外す。
Cloudflare Pages の設定：ビルドコマンド `python3 scripts/build_pages.py`、出力先 `dist`
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist"

# _config.yml の exclude に加えて、どこにも載せないもの
ALWAYS_SKIP = {".git", ".github", ".claude", ".vscode", ".gitignore", "_config.yml",
               "CNAME", "dist", "node_modules", "__pycache__"}


def config_excludes() -> set[str]:
    text = (ROOT / "_config.yml").read_text(encoding="utf-8")
    return {m.strip().rstrip("/") for m in re.findall(r"^\s*-\s*(\S+)", text, re.M)}


def main() -> None:
    skip = ALWAYS_SKIP | config_excludes()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for item in ROOT.iterdir():
        if item.name in skip or item.name.startswith(".env"):
            continue
        if item.is_dir():
            shutil.copytree(item, OUT / item.name, ignore=shutil.ignore_patterns("__pycache__"))
        else:
            shutil.copy2(item, OUT / item.name)
    print("published:", sorted(p.name for p in OUT.iterdir()))


if __name__ == "__main__":
    main()
