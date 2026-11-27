# -*- coding: utf-8 -*-
"""吉他實驗室 — 押韻資料產生器
重新產生 js/data/rhyme-data.js。用法：
    python scripts/build-rhyme-data.py [tmpdir]

資料來源（下載至 <tmpdir>，預設本腳本所在目錄）：
  1. mozillazg/pinyin-data  pinyin.txt        (CC BY 4.0) 字→帶調拼音
  2. Jun Da (MTSU) Modern Chinese Character Frequency List  (GB 碼) 高頻字排序
  3. BYVoid/OpenCC          STCharacters.txt  簡→繁對映

輸出格式（省空間的音節分組）：
  GLRhymeData.groups = { 韻基: "字字字..." }
  字元在字串內依使用頻率排序；載入時 buildIndex() 展開為 字→韻基 反查表。
"""
import os
import re
import sys
import unicodedata
import urllib.request

TMP = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'data', 'rhyme-data.js')

SOURCES = {
    'pinyin.txt': ('https://raw.githubusercontent.com/mozillazg/pinyin-data/master/pinyin.txt', 'utf-8'),
    'stchars.txt': ('https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/STCharacters.txt', 'utf-8'),
    'junda.txt': ('https://lingua.mtsu.edu/chinese-computing/statistics/char/download.php?Which=MO&Code=GB', 'gb18030'),
}


def fetch(name):
    path = os.path.join(TMP, name)
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return open(path, encoding='utf-8').read()
    req = urllib.request.Request(SOURCES[name][0], headers={'User-Agent': 'Mozilla/5.0'})
    raw = urllib.request.urlopen(req, timeout=90).read()
    text = raw.decode(SOURCES[name][1])
    open(path, 'w', encoding='utf-8').write(text)
    return text


def tonal_to_plain(s):
    d = unicodedata.normalize('NFD', s)
    return ''.join(c for c in d if not unicodedata.combining(c))


def final_of(py):
    py = tonal_to_plain(py).lower().replace('ü', 'v')
    initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h',
                'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']
    rest = py
    ini_used = ''
    for ini in sorted(initials, key=len, reverse=True):
        if rest.startswith(ini) and len(rest) > len(ini):
            ini_used = ini
            rest = rest[len(ini):]
            break
    if ini_used == 'y':
        if rest.startswith('u'):
            rest = 'v' + rest[1:]          # yu→ü, yue→üe, yuan→üan, yun→ün
        elif not rest.startswith('i'):
            rest = 'i' + rest              # ya→ia, yao→iao, ye→ie, yong→iong, you→iou
    elif ini_used == 'w':
        if not rest.startswith('u'):
            rest = 'u' + rest              # wa→ua, wei→uei, wen→uen, wang→uang
    elif ini_used in ('j', 'q', 'x') and rest.startswith('u'):
        rest = 'v' + rest[1:]              # ju→jü, xue→üe, xuan→üan, jun→ün
    return rest.replace('iu', 'iou').replace('ui', 'uei').replace('un', 'uen')


SHIRSAN = {
    '發花': ('a', 'ia', 'ua'),
    '梭波': ('e', 'o', 'uo', 'io'),
    '乜斜': ('ie', 've'),
    '一七': ('i', 'v', 'er'),
    '姑蘇': ('u',),
    '懷來': ('ai', 'uai'),
    '灰堆': ('ei', 'uei'),
    '遙條': ('ao', 'iao'),
    '由求': ('ou', 'iou'),
    '言前': 'AN',
    '人辰': ('en', 'in', 'uen', 'vn'),
    '江陽': ('ang', 'iang', 'uang'),
    '中東': ('eng', 'ing', 'ong', 'iong', 'ueng'),
}


def rhyme_class(final):
    for name, members in SHIRSAN.items():
        if members == 'AN':
            if final.endswith('an'):
                return name
        elif final in members:
            return name
    return None


def main():
    # 1. 拼音表
    char2pinyins = {}
    for l in fetch('pinyin.txt').splitlines():
        l = l.strip()
        if not l or l.startswith('#'):
            continue
        m = re.match(r'^U\+([0-9A-Fa-f]+):\s*(.+?)\s*(?:#.*)?$', l)
        if not m:
            continue
        ch = chr(int(m.group(1), 16))
        char2pinyins[ch] = [p.strip() for p in m.group(2).split(',') if p.strip()]

    # 2. 頻率序
    freq_rank = []
    for l in fetch('junda.txt').splitlines():
        parts = l.split('\t')
        if len(parts) >= 2 and re.match(r'^\d+$', parts[0]):
            freq_rank.append(parts[1])

    # 3. 簡→繁（OpenCC STCharacters）
    st2t = {}
    for l in fetch('stchars.txt').splitlines():
        l = l.strip()
        if not l or l.startswith('#'):
            continue
        parts = l.split('\t')
        if len(parts) >= 2:
            st2t[parts[0]] = parts[1].split(' ')[0]

    # char→final：繁體為主鍵，簡體並收
    def char_final_map():
        cf = {}
        for s, pys in char2pinyins.items():
            t = st2t.get(s, s)
            f_ = final_of(pys[0])
            if not f_ or not rhyme_class(f_):
                continue
            if t and t not in cf:
                cf[t] = f_
            if s not in cf:
                cf[s] = f_
        return cf

    char_final = char_final_map()

    # 5. 頻率序排列（高頻在前），其餘依碼位
    ordered = {}
    for ch in freq_rank:
        t = st2t.get(ch, ch)
        for c in ([t, ch] if ch != t else [ch]):
            if c in char_final and c not in ordered:
                ordered[c] = char_final[c]
    rest = sorted((c for c in char_final if c not in ordered), key=ord)
    for c in rest:
        ordered[c] = char_final[c]

    # 6. 音節分組輸出
    groups = {}
    for ch, fin in ordered.items():
        groups.setdefault(fin, []).append(ch)
    lines = []
    for fin in sorted(groups, key=lambda f: (-len(groups[f]), f)):
        lines.append('"%s":"%s"' % (fin, ''.join(groups[fin])))
    body = ',\n  '.join(lines)
    js = (
        "/* 吉他實驗室 — 押韻資料（自動產生，勿手改）\n"
        "   格式：韻基 → 字串（字元依使用頻率排序，高頻在前）\n"
        "   來源：mozillazg/pinyin-data (CC BY 4.0) + Jun Da 頻率表 + OpenCC STCharacters 簡→繁\n"
        "   查法：GLRhymeData.groups[韻基].indexOf(字) >= 0；反查用 GLrhyme.charToFinal\n"
        "   重新產生：python scripts/build-rhyme-data.py */\n"
        "window.GLRhymeData = {\n"
        "  version: 'm13',\n"
        "  groups: {\n"
        "  " + body + "\n"
        "  },\n"
        "  /* 建立反查索引（字 → 韻基），在 rhyme.js 載入後呼叫 */\n"
        "  buildIndex: function () {\n"
        "    var idx = {};\n"
        "    var g = this.groups;\n"
        "    for (var fin in g) {\n"
        "      // Array.from 依碼位迭代，正確處理擴展區漢字（代理對）\n"
        "      var charsArr = Array.from(g[fin]);\n"
        "      for (var i = 0; i < charsArr.length; i++) idx[charsArr[i]] = fin;\n"
        "    }\n"
        "    return idx;\n"
        "  }\n"
        "};\n"
    )
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print('written', os.path.abspath(OUT), len(js), 'bytes,', len(groups), 'groups,', len(ordered), 'chars')


if __name__ == '__main__':
    main()
