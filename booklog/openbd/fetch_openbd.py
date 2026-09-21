#!/usr/bin/env python3
"""ブクログのエクスポートCSVから ISBN を拾って openBD の書誌情報をまとめて取得する。

  python3 openbd/fetch_openbd.py [--csv booklog_utf8.csv] [--refresh]

出力:
  openbd/raw/openbd_raw.json  APIレスポンスそのまま（再取得なしで再整形できる）
  openbd/out/books.json       整形済み
  openbd/out/books.csv        整形済み（表計算ソフト向け・UTF-8 BOM付き）
  openbd/out/report.txt       取得サマリと未取得リスト
"""
import argparse, csv, hashlib, json, struct, sys, time, urllib.parse, urllib.request
from pathlib import Path

API = 'https://api.openbd.jp/v1/get'
UA  = {'User-Agent': 'booklog-cover-fetch/1.0'}
CHUNK = 100                       # 1リクエストあたりのISBN数
HERE = Path(__file__).resolve().parent

# ブクログCSVの列（ヘッダ行なし）
COL_ITEM_ID, COL_ISBN13, COL_TITLE, COL_TYPE = 1, 2, 11, 15

# Cコード（SubjectSchemeIdentifier=78）の桁ごとの意味
C_TARGET = {'0':'一般','1':'教養','2':'実用','3':'専門','4':'検定教科書',
            '5':'婦人','6':'学参I','7':'学参II','8':'児童','9':'雑誌扱い'}
C_FORM   = {'0':'単行本','1':'文庫','2':'新書','3':'全集・双書','4':'ムック・その他',
            '5':'事典・辞典','6':'図鑑','7':'絵本','8':'磁性媒体など','9':'コミック'}
C_GENRE  = {'0':'総記','1':'哲学・宗教・心理','2':'歴史・地理','3':'社会科学','4':'自然科学',
            '5':'工学・工業','6':'産業','7':'芸術・生活','8':'語学','9':'文学'}


def fetch(isbns, refresh=False):
    """openBD から取得。既存の raw があればそれを使い、足りない分だけ問い合わせる。"""
    raw_path = HERE / 'raw' / 'openbd_raw.json'
    cache = {}
    if raw_path.exists() and not refresh:
        cache = json.loads(raw_path.read_text(encoding='utf-8'))
    todo = [i for i in isbns if i not in cache]
    print(f'キャッシュ {len(cache)}件 / 取得対象 {len(todo)}件', file=sys.stderr)

    for n in range(0, len(todo), CHUNK):
        batch = todo[n:n + CHUNK]
        url = f'{API}?{urllib.parse.urlencode({"isbn": ",".join(batch)})}'
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=60) as r:
                    got = json.load(r)
                break
            except Exception as e:                       # ネットワーク瞬断向けの素朴なリトライ
                if attempt == 2:
                    raise
                print(f'  再試行 {attempt+1}/2: {e}', file=sys.stderr)
                time.sleep(2 * (attempt + 1))
        # レスポンスはリクエストしたISBNと同じ順・同じ長さで、無い本は null
        for isbn, rec in zip(batch, got):
            cache[isbn] = rec
        print(f'  {n + len(batch)}/{len(todo)}', file=sys.stderr)
        time.sleep(0.5)                                  # 連続アクセスを少し空ける

    raw_path.parent.mkdir(exist_ok=True)

    raw_path.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding='utf-8')
    return cache


def flatten(isbn, d):
    """openBD の入れ子レスポンスを1冊=1レコードに平坦化する。
    非加盟出版社の本は onix 側のキーが丸ごと無いので、全て get/?. で防御する。"""
    if not d:
        return None
    s  = d.get('summary', {})
    o  = d.get('onix', {})
    dd = o.get('DescriptiveDetail', {})
    cd = o.get('CollateralDetail', {})
    te = (dd.get('TitleDetail') or {}).get('TitleElement') or {}
    texts = cd.get('TextContent') or []

    def text_of(*types):
        for t in types:
            for x in texts:
                if x.get('TextType') == t and x.get('Text'):
                    return x['Text']
        return ''

    ccode = next((x.get('SubjectCode', '') for x in (dd.get('Subject') or [])
                  if x.get('SubjectSchemeIdentifier') == '78'), '')
    cover = s.get('cover') or next(
        (v.get('ResourceLink', '')
         for r in (cd.get('SupportingResource') or [])
         for v in (r.get('ResourceVersion') or []) if v.get('ResourceLink')), '')

    return {
        'isbn':       s.get('isbn', isbn),
        'title':      s.get('title', ''),
        'title_kana': (te.get('TitleText') or {}).get('collationkey', ''),
        'subtitle':   (te.get('Subtitle') or {}).get('content', ''),
        'volume':     s.get('volume', ''),
        'series':     s.get('series', ''),
        'author':     s.get('author', ''),
        'authors':    ' / '.join(filter(None, (
                        (c.get('PersonName') or {}).get('content')
                        for c in (dd.get('Contributor') or [])))),
        'publisher':  s.get('publisher', ''),
        'pubdate':    s.get('pubdate', ''),
        'pages':      (dd.get('Extent') or [{}])[0].get('ExtentValue', ''),
        'price':      ((o.get('ProductSupply') or {}).get('SupplyDetail') or {})
                        .get('Price', [{}])[0].get('PriceAmount', ''),
        'ccode':      ccode,
        'c_target':   C_TARGET.get(ccode[0:1], '') if len(ccode) == 4 else '',
        'c_form':     C_FORM.get(ccode[1:2], '')   if len(ccode) == 4 else '',
        'c_genre':    C_GENRE.get(ccode[2:3], '')  if len(ccode) == 4 else '',
        'cover':      cover,
        'description': text_of('03', '02'),
        'toc':        text_of('04'),
    }


def image_size(d):
    """保存前に実寸を確かめる（1x1などのダミーを弾くため）。"""
    if d[:4] == b'\x89PNG':
        return struct.unpack('>II', d[16:24])
    i = 2
    while i < len(d) - 9:
        if d[i] != 0xFF:
            i += 1
            continue
        if d[i + 1] in (0xC0, 0xC1, 0xC2):
            return (d[i + 7] << 8 | d[i + 8], d[i + 5] << 8 | d[i + 6])
        i += 2 + (d[i + 2] << 8 | d[i + 3])
    return (0, 0)


def download_covers(books):
    (HERE / 'covers').mkdir(exist_ok=True)   # .gitignore 済みで存在しないことがある
    """cover が入っている本だけ落とす。openBD の cover は空文字＝書影なしが正しく、
    URLを組み立てても404になるので、組み立て直しはしない。"""
    saved, sizes, wanted = 0, [], set()
    for b in books:
        if not b['cover']:
            continue
        name = f"{b['isbn']}.jpg"
        wanted.add(name)
        dest = HERE / 'covers' / name
        if dest.exists():
            saved += 1
            sizes.append(image_size(dest.read_bytes()))
            continue
        try:
            with urllib.request.urlopen(urllib.request.Request(b['cover'], headers=UA), timeout=40) as r:
                data = r.read()
            w, h = image_size(data)
            if w >= 50 and h >= 50:
                dest.write_bytes(data)
                saved += 1
                sizes.append((w, h))
            time.sleep(0.2)
        except Exception as e:
            print(f"    書影NG {b['title'][:26]}: {type(e).__name__}", file=sys.stderr)
    for f in (HERE / 'covers').glob('*.jpg'):
        if f.name not in wanted:
            f.unlink()
    return saved, sizes


def extra_isbns(path):
    """別ソース（Google Books）で判明したISBNを取り込む。CSVにISBNが無いKindle本でも、
    紙版のISBNが分かれば openBD を引ける。"""
    f = Path(path)
    if not f.is_file():
        return []
    return [b['isbn13'] for b in json.loads(f.read_text(encoding='utf-8')) if b.get('isbn13')]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--csv', default=str(HERE.parent / 'booklog_utf8.csv'))
    ap.add_argument('--refresh', action='store_true', help='キャッシュを無視して全件取り直す')
    ap.add_argument('--extra-isbn', default=str(HERE.parent / 'googlebooks' / 'out' / 'books.json'),
                    help='追加ISBNの供給元（Google Booksの出力）')
    ap.add_argument('--no-covers', action='store_true')
    a = ap.parse_args()

    rows = list(csv.reader(open(a.csv, encoding='utf-8')))
    isbns, skipped = [], []
    for r in rows:
        (isbns if r[COL_ISBN13].strip() else skipped).append(
            r[COL_ISBN13].strip() or (r[COL_ITEM_ID], r[COL_TITLE], r[COL_TYPE]))
    isbns = list(dict.fromkeys(isbns + extra_isbns(a.extra_isbn)))   # 重複排除

    cache = fetch(isbns, a.refresh)
    books = [b for b in (flatten(i, cache.get(i)) for i in isbns) if b]
    missing = [i for i in isbns if not cache.get(i)]
    covers, sizes = (0, []) if a.no_covers else download_covers(books)

    out = HERE / 'out'
    (out / 'books.json').write_text(
        json.dumps(books, ensure_ascii=False, indent=1), encoding='utf-8')
    with open(out / 'books.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(books[0].keys()))
        w.writeheader(); w.writerows(books)

    title_of = {r[COL_ISBN13].strip(): r[COL_TITLE] for r in rows if r[COL_ISBN13].strip()}
    filled = lambda k: sum(1 for b in books if b[k])
    lines = [
        f'CSV総行数            : {len(rows)}',
        f'ISBN13あり(取得対象) : {len(isbns)}',
        f'ASINのみ(対象外)     : {len(skipped)}   ← 電子書籍。openBDはISBN専用なので引けない',
        f'openBDでヒット       : {len(books)}',
        f'openBDに無し         : {len(missing)}',
        f'書影ダウンロード     : {covers}'
        + (f'   実寸 {min(w for w,_ in sizes)}〜{max(w for w,_ in sizes)}px幅' if sizes else ''),
        '',
        '-- 項目ごとの充足率（ヒットした本のうち値が入っている件数）--',
        *(f'  {k:11}: {filled(k):3}/{len(books)}' for k in
          ('title','title_kana','author','publisher','pubdate','pages','price','ccode','cover','description','toc')),
    ]
    if missing:
        lines += ['', '-- openBDに無かったISBN --',
                  *(f'  {i}  {title_of.get(i,"")[:46]}' for i in missing)]
    report = '\n'.join(lines)
    (out / 'report.txt').write_text(report + '\n', encoding='utf-8')
    print(report)


if __name__ == '__main__':
    main()
