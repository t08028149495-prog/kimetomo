"""index.html が読み込む css/ と js/ のファイルに、中身に合わせた ?v=番号 を付け直す。

使い方（プロジェクトのフォルダで）:  python scripts/bump_version.py

- 中身が変わったファイルだけ番号が変わる。
- 番号が変わると index.html も変わるので、開きっぱなしのアプリに「更新する」が出る。
  また、ブラウザが古いファイルを使い回すのも防げる。
- css/ や js/ を直したら、commit の前に必ず実行する。
"""
import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# dm.html も js/report.js などを読み込むので、一緒に番号を付け直す
PAGES = [os.path.join(ROOT, 'index.html'), os.path.join(ROOT, 'dm.html')]


def file_hash(rel):
    with open(os.path.join(ROOT, rel), 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def main():
    changed = []

    def repl(m):
        rel, old = m.group(2), m.group(3)
        new = file_hash(rel)
        if new != old and rel not in changed:
            changed.append(rel)
        return f'{m.group(1)}{rel}?v={new}'

    for page in PAGES:
        with open(page, encoding='utf-8', newline='') as f:
            html = f.read()
        out = re.sub(r'((?:href|src)="\./)((?:css|js)/[\w.-]+\.(?:css|js))\?v=(\w*)', repl, html)
        if out != html:
            with open(page, 'w', encoding='utf-8', newline='') as f:
                f.write(out)
    print('更新した番号:', ', '.join(changed) if changed else 'なし')


if __name__ == '__main__':
    main()
