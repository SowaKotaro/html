#!/usr/bin/env python3
"""ブクログCSV + openBD + Google Books をまとめて、一覧表示用のデータを書き出す。

  python3 build_list.py        -> data/books.js

表示側は index.html / assets/style.css / assets/app.js（いずれも手書きの静的ファイル）。
このスクリプトはデータだけを書き出すので、デザインを触っても上書きされない。

書影は bookimg/<ISBN13 または ASIN>.jpg（ブクログCSVの ISBN13、空ならASINがファイル名）
を参照する。無ければ NO IMAGE のプレースホルダが表示される。
"""
import csv, json, re, unicodedata
from datetime import date, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
COL = dict(item_id=1, isbn13=2, status=5, registered=9, finished=10,
           title=11, author=12, publisher=13, pubyear=14, type=15, pages=16)

# 一覧に載せない本（キーは ISBN13、無ければ ASIN）
EXCLUDE = {
    '9784150314545',   # 万博聖戦（ハヤカワ文庫JA）
}

# ブクログ側の記録を上書きする本
OVERRIDES = {
    # ステータスの更新漏れ。読了扱いにする（読了日は登録日を充当）
    '9784040723471': {'status': '読み終わった', 'finished': '2022-07-04'},
}


# 書名末尾の括弧からレーベルを拾う（「残穢 (新潮文庫)」→「新潮文庫」）
LABEL_RE = re.compile(
    r'[（(]([^（()）]*(?:文庫|新書|ブックス|BOOKS|e-?book|単行本|文芸|コミックス|選書|学術)[^（()）]*)[)）]')

def label_of(title):
    hits = LABEL_RE.findall(title)
    return hits[-1].strip() if hits else ''



# TLdata.txt の書名は略記が多いので、機械的に寄せられない分だけ手当てする
TL_ALIAS = {
    '1984年': '一九八四年',
    '殺戮にいたる病': '新装版　殺戮にいたる病',
    '浜村渚の計算ノート': '浜村渚の計算ノ-ト',
    '三体Ⅲ上': '三体3 死神永生 上',
    '三体Ⅲ 下': '三体3 死神永生 下',
    '「全世界史」講義 I': '「全世界史」講義 教養に効く!人類5000年史 古代・中世編 (I)',
    '濁唾濔蓏': 'ダクダデイラ',
    'サラバ！': 'サラバ　上・中・下巻　合本版 (小学館文庫)',
}


def _norm(s):
    s = unicodedata.normalize('NFKC', s).lower()
    s = re.sub(r'[\s\u3000]+', '', s)
    return re.sub(r'[（）()〈〉「」｢｣『』\[\]【】〔〕・,.,\.\-–—~〜!!??"\'“”:：;；/／＆&]', '', s)


def build_timeline(books):
    """TLdata.txt を読んで「いつ買っていつ読んだか」の一覧にする。"""
    f = HERE / 'TLdata.txt'
    if not f.is_file():
        return None

    month = mode = None
    months, buys, reads = [], {}, {}
    for line in f.read_text(encoding='utf-8').splitlines():
        t = line.strip()
        if t.startswith('[期]'):
            month = t.split(']', 1)[1].strip()
            if month not in months:
                months.append(month)
            mode = None
        elif t.startswith('[積]'):
            mode = 'buy'
        elif t.startswith('[読]'):
            mode = 'read'
        elif t.startswith('[題]') and month and mode:
            # 別表記はここで寄せる。match() だけで寄せると
            # 「[積] ダクダデイラ」と「[読] 濁唾濔蓏」が別の行に割れる。
            title = t.split(']', 1)[1].strip()
            title = TL_ALIAS.get(title, title)
            (buys if mode == 'buy' else reads).setdefault(title, month)

    months.sort()

    # 蔵書との突き合わせ（完全一致 → 前方一致の順）
    exact, all_norm = {}, []
    for b in books:
        n = _norm(b['title'])
        exact.setdefault(n, b)
        exact.setdefault(_norm(re.split(r'[（(〈《【]', b['title'])[0]), b)
        all_norm.append((n, b))

    def match(title):
        n = _norm(title)
        if n in exact:
            return exact[n]
        if len(n) >= 4:
            cand = [x[1] for x in all_norm if x[0].startswith(n)]
            if len(cand) == 1:
                return cand[0]
        return None

    fmt = lambda m: m[:4] + '-' + m[4:] if m else None
    rows = []
    for title in sorted(set(buys) | set(reads),
                        key=lambda t: (buys.get(t) or reads.get(t) or '', t)):
        b = match(title)
        rows.append({
            't': title,
            'b': fmt(buys.get(title)),
            'r': fmt(reads.get(title)),
            'id': b['id'] if b else None,
            'cover': b['cover'] if b else '',
        })

    return {'months': [fmt(m) for m in months], 'books': rows}


def load_json(p):
    f = HERE / p
    return json.loads(f.read_text(encoding='utf-8')) if f.is_file() else []


def build():
    rows = list(csv.reader(open(HERE / 'booklog_utf8.csv', encoding='utf-8')))
    gb = {b['item_id']: b for b in load_json('googlebooks/out/books.json')}
    ob = {b['isbn']: b for b in load_json('openbd/out/books.json')}

    # Web から集めたジャンル・評判（data/enrich.json）。無ければ素通り。
    ef = HERE / 'data' / 'enrich.json'
    enrich = json.loads(ef.read_text(encoding='utf-8')) if ef.is_file() else {}

    books = []
    for r in rows:
        item_id = r[COL['item_id']]
        key = r[COL['isbn13']].strip() or item_id
        if key in EXCLUDE:
            continue
        g = gb.get(item_id, {})
        isbn = r[COL['isbn13']].strip() or g.get('isbn13', '')
        o = ob.get(isbn, {})

        # 書影は bookimg/<CSVのISBN13 または ASIN>.jpg を参照する
        path = f'bookimg/{key}.jpg'
        cover = path if (HERE / path).is_file() else ''

        label = label_of(r[COL['title']])
        # enrich.json のキーは CSV の ISBN13 または ASIN だが、
        # Google Books 由来の ISBN13 で採番された分もあるため両方を見る
        e = enrich.get(key) or enrich.get(isbn) or {}
        # 上書きは dict を組む前に当てる（後から update すると派生値が追随しない）
        ov = OVERRIDES.get(key, {})
        status = ov.get('status', r[COL['status']])
        finished = ov.get('finished', r[COL['finished']][:10])

        books.append({
            'id':        item_id,
            'isbn':      isbn,
            'title':     r[COL['title']],
            'kana':      o.get('title_kana', ''),
            'author':    r[COL['author']],
            'publisher': r[COL['publisher']],
            'year':      r[COL['pubyear']],
            'type':      r[COL['type']],
            'status':    status,
            'finished':  finished,
            'label':     label,
            'pages':     r[COL['pages']] or str(o.get('pages') or g.get('pages') or ''),
            'price':     o.get('price', ''),
            'desc':      o.get('description') or g.get('description', ''),
            'cover':     cover,
            # --- data/enrich.json 由来 ---
            'genres':    e.get('genres') or [],
            'tags':      e.get('tags') or [],
            'series':    e.get('series') or o.get('series', ''),
            'awards':    e.get('awards') or [],
            'rating':    e.get('rating'),
            'rating_src': e.get('rating_source') or '',
            'rating_n':  e.get('rating_count'),
            'axes':      e.get('axes') or {},
        })

    books.sort(key=lambda b: (b['finished'] or '0000'), reverse=True)

    payload = {'generated': date.today().isoformat(), 'books': books}
    out = HERE / 'data' / 'books.js'
    out.parent.mkdir(exist_ok=True)
    out.write_text('/* build_list.py が生成。直接編集しないこと。 */\n'
                   'window.BOOKSHELF = ' + json.dumps(payload, ensure_ascii=False) + ';\n',
                   encoding='utf-8')

    tl = build_timeline(books)
    if tl:
        (HERE / 'data' / 'timeline.js').write_text(
            '/* build_list.py が TLdata.txt から生成。直接編集しないこと。 */\n'
            'window.TIMELINE = ' + json.dumps(tl, ensure_ascii=False) + ';\n',
            encoding='utf-8')
        linked = sum(1 for r in tl['books'] if r['id'])
        print(f"data/timeline.js を書き出しました: {len(tl['books'])}冊 / "
              f"{len(tl['months'])}か月 / 蔵書と紐付き {linked}冊")

    n_cover = sum(1 for b in books if b['cover'])
    n_genre = sum(1 for b in books if b['genres'])
    n_label = sum(1 for b in books if b['label'])
    print(f'data/books.js を書き出しました: {len(books)}冊 / 書影 {n_cover}枚 / '
          f'ジャンル {n_genre}冊 / レーベル {n_label}冊')


if __name__ == '__main__':
    build()
