#!/usr/bin/env python3
"""產生六事動畫用的篆字子集字型 web/fonts/yao-seal.woff2。

來源字型：敬峰中山王篆 JFZSKSealScript（劉敬峰，SIL OFL 1.1）
  https://github.com/jeffi369/JFZSKSealScript （fonts/JFZSKSealScript_V3.ttf）
依 OFL，修改版（含子集）不得沿用保留字型名稱，所以子集改名為「YaoNomad Seal」。

用法：python3 scripts/build-seal-font.py <JFZSKSealScript_V3.ttf>
需要：pip install fonttools brotli
"""
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
ACTIVITIES = ROOT / 'web' / 'activities.js'
OUT = ROOT / 'web' / 'fonts' / 'yao-seal.woff2'
FAMILY = 'YaoNomad Seal'


def seal_chars():
    """從 activities.js 取出所有代表字，套用 SEAL_CODE 對應成字型裡的字碼"""
    src = ACTIVITIES.read_text(encoding='utf-8')
    glyphs = re.findall(r"glyph: '(.)'", src)
    block = re.search(r'export const SEAL_CODE = \{(.*?)\}', src, re.S).group(1)
    mapping = dict(re.findall(r"(\S): '(\S)'", block))
    return sorted({mapping.get(g, g) for g in glyphs})


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    chars = seal_chars()
    font = TTFont(sys.argv[1])
    cmap = font.getBestCmap()
    missing = [c for c in chars if ord(c) not in cmap]
    if missing:
        sys.exit(f'字型缺字：{"".join(missing)}（請在 activities.js 的 SEAL_CODE 補對應或換代表字）')

    options = subset.Options()
    options.flavor = 'woff2'
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.notdef_outline = True
    sub = subset.Subsetter(options)
    sub.populate(text=''.join(chars))
    sub.subset(font)

    for rec in font['name'].names:
        if rec.nameID in (1, 4, 16):
            rec.string = FAMILY
        elif rec.nameID == 3:
            rec.string = f'{FAMILY} subset'
        elif rec.nameID == 6:
            rec.string = FAMILY.replace(' ', '')
    font.flavor = 'woff2'
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(OUT)
    print(f'{OUT.relative_to(ROOT)}：{len(chars)} 字（{"".join(chars)}），{OUT.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()
