"""アプリのアイコン（ホーム画面・通知・タブに出る絵）を作り直す。

使い方：  python scripts/make_icons.py
出てくるもの：icon-512.png / icon-192.png / apple-touch-icon.png（いちばん上の階層）

絵は左上のロゴと同じ「ふたりの輪」＋きらめき。色も css/insta.css の .logo と同じ。
追加のライブラリは使わない（Python だけで PNG を書き出す）。
ホーム画面では端末が角を丸く切り取るので、四角いっぱいに色を塗り、
マークはまん中の安全な範囲（直径 80% の円の中）に収めてある。
"""
import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 背景：ローズ → マゼンタ → すみれ色（左上 → 右下）
STOPS = [(0.0, (0xFF, 0x6F, 0xAE)), (0.48, (0xE1, 0x57, 0xC9)), (1.0, (0x8A, 0x63, 0xFF))]
GLOW = (0xFF, 0xC2, 0xA8)  # 左下のあたたかい光

# マーク（ロゴの SVG と同じ座標。48×48 のマス目）
RINGS = [(18.0, 27.0), (30.0, 27.0)]
RING_R = 10.5
RING_HALF = 1.6            # 線の太さの半分
SPARK = (36.0, 9.5, 5.0)   # きらめきの中心と大きさ
SPARK_P = 0.6
CENTER = (24.25, 22.5)     # マークの見た目のまん中（輪が下に寄って見えないよう、少し上げてある）
UNIT = 0.0165              # マス目 1 つぶん ＝ アイコンの幅の何倍か
SS = 4                     # ふちをなめらかにするための細かさ


def background(x, y):
    t = (x + y) / 2
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        if t <= t1:
            k = (t - t0) / (t1 - t0)
            col = [c0[i] + (c1[i] - c0[i]) * k for i in range(3)]
            break
    d = math.hypot((x - 0.16) / 0.95, (y - 1.08) / 0.95)
    a = max(0.0, 1 - d / 0.58)
    return [col[i] + (GLOW[i] - col[i]) * a for i in range(3)]


def in_mark(u, v):
    for cx, cy in RINGS:
        if abs(math.hypot(u - cx, v - cy) - RING_R) <= RING_HALF:
            return True
    sx, sy, sr = SPARK
    dx, dy = abs(u - sx), abs(v - sy)
    if dx <= sr and dy <= sr and dx ** SPARK_P + dy ** SPARK_P <= sr ** SPARK_P:
        return True
    return False


def render(size):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            x, y = (px + 0.5) / size, (py + 0.5) / size
            col = background(x, y)
            u0 = CENTER[0] + (x - 0.5) / UNIT
            v0 = CENTER[1] + (y - 0.5) / UNIT
            cover = 0.0
            if 4 < u0 < 44 and 2 < v0 < 41:
                hit = 0
                for j in range(SS):
                    for i in range(SS):
                        u = CENTER[0] + ((px + (i + 0.5) / SS) / size - 0.5) / UNIT
                        v = CENTER[1] + ((py + (j + 0.5) / SS) / size - 0.5) / UNIT
                        if in_mark(u, v):
                            hit += 1
                cover = hit / (SS * SS)
            for i in range(3):
                row.append(int(round(col[i] + (255 - col[i]) * cover)))
        rows.append(bytes(row))
    return b"".join(rows)


def chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def save(name, size):
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(render(size), 9))
           + chunk(b"IEND", b""))
    with open(os.path.join(ROOT, name), "wb") as f:
        f.write(png)
    print(name, size, len(png))


if __name__ == "__main__":
    save("icon-512.png", 512)
    save("icon-192.png", 192)
    save("apple-touch-icon.png", 180)
