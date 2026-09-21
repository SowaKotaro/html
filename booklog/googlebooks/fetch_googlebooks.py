#!/usr/bin/env python3
"""Google Books API で書誌情報と書影を取得する。

  export GOOGLE_BOOKS_API_KEY=xxxx
  python3 googlebooks/fetch_googlebooks.py [--csv booklog_utf8.csv] [--refresh] [--no-covers]

紙の本は ISBN で直接引く。Kindle本はCSVにASINしか無いので、書名＋著者で検索して
ISBN13と書影を拾う。それでも決まらなかった分は out/unresolved.csv に書き出す
（Web検索など別手段に回すため）。

出力:
  raw/gb_raw.json       APIレスポンスそのまま（キーは isbn:xxx / title:xxx）
  out/books.json/.csv   整形済み
  out/unresolved.csv    特定できなかった本
  out/report.txt        サマリ
  covers/<id>.jpg       書影
"""
import argparse, csv, difflib, hashlib, json, os, re, sys, time, unicodedata
import urllib.error, urllib.parse, urllib.request
from pathlib import Path

API  = 'https://www.googleapis.com/books/v1/volumes'
HERE = Path(__file__).resolve().parent
UA   = {'User-Agent': 'booklog-cover-fetch/1.0'}
COL_ITEM_ID, COL_ISBN13, COL_TITLE, COL_AUTHOR, COL_TYPE = 1, 2, 11, 12, 15

# 書影は small→extraLarge まである。大きい順に拾う。
COVER_KEYS = ('extraLarge', 'large', 'medium', 'small', 'thumbnail', 'smallThumbnail')


class QuotaExceeded(RuntimeError):
    pass


def norm(t):
    """突き合わせ用にタイトルを正規化する。"""
    t = unicodedata.normalize('NFKC', t)
    t = re.sub(r'[（(\[【][^）)\]】]*[）)\]】]', '', t)
    return re.sub(r'[\s・:：,，.．!！?？"“”\'’~〜\-―ー_〈〉「」『』]', '', t).lower()


def search_title(t):
    """レーベル表記や【電子特別版】を落として検索語にする。"""
    t = re.sub(r'[（(\[【][^）)\]】]*[）)\]】]\s*$', '', t)
    t = re.sub(r'【[^】]*】', '', t)
    return re.sub(r'\s+', ' ', t).strip()


def title_variants(t):
    """「本題　副題」「本題～副題～」のように副題が付くCSV書名から、本題だけも候補にする。
    Google Books 側は本題のみで登録されていることが多い。
    空白を潰す前に分割すること（全角スペースが区切りとして使われているため）。"""
    stripped = re.sub(r'[（(\[【][^）)\]】]*[）)\]】]\s*$', '', t)
    stripped = re.sub(r'【[^】]*】', '', stripped)
    squash = lambda x: re.sub(r'\s+', ' ', x).strip()
    out = [squash(stripped)]
    for sep in ('\u3000', '～', '―', ' - ', '：'):
        if sep in stripped:
            head = squash(stripped.split(sep)[0])
            if len(head) >= 3:
                out.append(head)
    return list(dict.fromkeys(out))


def call(params, key, cache, cache_key, refresh=False):
    if cache_key in cache and not refresh:
        return cache[cache_key]
    if key:
        params = {**params, 'key': key}
    url = f'{API}?{urllib.parse.urlencode(params)}'
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                d = json.load(r)
            cache[cache_key] = d
            time.sleep(0.3)
            return d
        except urllib.error.HTTPError as e:
            if e.code == 429:
                raise QuotaExceeded(
                    'Google Books APIの1日あたり上限に達しました。\n'
                    '  APIキー未設定だと共有プロジェクトの枠を使うため、すぐ枯渇します。\n'
                    '  GOOGLE_BOOKS_API_KEY を設定して再実行してください。') from None
            if attempt == 2 or e.code < 500:
                print(f'    HTTP {e.code}: {cache_key}', file=sys.stderr)
                cache[cache_key] = {}
                return {}
            time.sleep(2 * (attempt + 1))
        except Exception as e:
            if attempt == 2:
                print(f'    {type(e).__name__}: {cache_key}', file=sys.stderr)
                cache[cache_key] = {}
                return {}
            time.sleep(2 * (attempt + 1))
    return {}


def pick(items, want_titles, want_author, threshold=0.7):
    """検索結果から最も近い1件を選ぶ。似ていなければ選ばない。
    want_titles は「フル書名」「本題のみ」など複数候補を渡す。"""
    best, best_score = None, 0.0
    wts = [norm(t) for t in want_titles]
    wa = norm(want_author)
    for it in items or []:
        vi = it.get('volumeInfo', {})
        gt = norm(vi.get('title', ''))
        score = max(difflib.SequenceMatcher(None, wt, gt).ratio() for wt in wts)
        author_hit = wa and any(
            difflib.SequenceMatcher(None, wa, norm(a)).ratio() > 0.6 for a in vi.get('authors', []))
        if author_hit:
            score += 0.15                                  # 著者が一致するなら加点
        if vi.get('industryIdentifiers'):
            score += 0.05                                  # ISBNを持つ版を優先
        # 著者が一致していて本題が十分近いなら、副題違いでも採用する
        if author_hit and score < threshold and max(
                difflib.SequenceMatcher(None, wt, gt).ratio() for wt in wts) > 0.55:
            score = threshold
        if score > best_score:
            best, best_score = it, score
    return (best, round(best_score, 3)) if best_score >= threshold else (None, round(best_score, 3))


def flatten(row, item, score, how):
    vi  = (item or {}).get('volumeInfo', {})
    ids = {i['type']: i['identifier'] for i in vi.get('industryIdentifiers', [])}
    img = vi.get('imageLinks', {})
    cover = next((img[k] for k in COVER_KEYS if img.get(k)), '')
    return {
        'item_id':    row[COL_ITEM_ID],
        'type':       row[COL_TYPE],
        'csv_title':  row[COL_TITLE],
        'csv_author': row[COL_AUTHOR],
        'matched_by': how,
        'score':      score,
        'volume_id':  (item or {}).get('id', ''),
        'gb_title':   vi.get('title', '') + (f" {vi['subtitle']}" if vi.get('subtitle') else ''),
        'gb_authors': ' / '.join(vi.get('authors', [])),
        'isbn13':     ids.get('ISBN_13', row[COL_ISBN13]),
        'isbn10':     ids.get('ISBN_10', ''),
        'publisher':  vi.get('publisher', ''),
        'published':  vi.get('publishedDate', ''),
        'pages':      vi.get('pageCount', ''),
        'categories': ' / '.join(vi.get('categories', [])),
        'cover':      cover.replace('http://', 'https://'),
        'description': (vi.get('description') or '').replace('\n', ' '),
    }


def download_covers(books):
    (HERE / 'covers').mkdir(exist_ok=True)   # .gitignore 済みで存在しないことがある
    """書影を保存し、(保存数, 重複していた画像の一覧) を返す。
    Google Books は書影が無い本に告知画像などを返すことがあり、それは複数の本で
    中身が完全に一致するので、ハッシュの重複で検出できる。"""
    wanted, saved = set(), 0
    for b in books:
        if not b['cover']:
            continue
        name = f"{b['isbn13'] or b['item_id']}.jpg"
        wanted.add(name)
        dest = HERE / 'covers' / name
        if dest.exists():
            saved += 1
            continue
        try:
            url = b['cover'].replace('&edge=curl', '')   # ページがめくれた装飾を外す
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                data = r.read()
            if data[:2] == b'\xff\xd8' or data[:4] == b'\x89PNG':
                dest.write_bytes(data)
                saved += 1
            time.sleep(0.2)
        except Exception as e:
            print(f"    書影NG {b['csv_title'][:26]}: {type(e).__name__}", file=sys.stderr)

    # 前回の実行で取得した、もう参照されていない画像を捨てる
    for f in (HERE / 'covers').glob('*.jpg'):
        if f.name not in wanted:
            f.unlink()

    by_hash = {}
    for f in (HERE / 'covers').glob('*.jpg'):
        by_hash.setdefault(hashlib.md5(f.read_bytes()).hexdigest(), []).append(f.stem)
    dups = [v for v in by_hash.values() if len(v) > 1]
    return saved, dups


def read_overrides():
    """自動マッチが誤る本の手動補正を読む（googlebooks/overrides.json）。"""
    f = HERE / 'overrides.json'
    if not f.is_file():
        return {}
    return {k: v for k, v in json.loads(f.read_text(encoding='utf-8')).items()
            if not k.startswith('_')}


def fetch_volume(vid, key, cache, refresh=False):
    """volume_id 指定の補正用に、個別ボリュームを1件取る。"""
    ck = f'volume:{vid}'
    if ck in cache and not refresh:
        return cache[ck]
    url = f'{API}/{vid}' + (f'?key={key}' if key else '')
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
            d = json.load(r)
    except Exception as e:
        print(f'    volume取得NG {vid}: {type(e).__name__}', file=sys.stderr)
        d = {}
    cache[ck] = d
    time.sleep(0.3)
    return d


def read_key_file():
    """キーを置いたファイルがあれば読む（いずれも .gitignore 済み）。"""
    for f in (HERE / '.apikey', HERE.parent / '.apikey' / 'booksapikey.txt'):
        if f.is_file():
            return f.read_text(encoding='utf-8').strip()
    return ''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--csv', default=str(HERE.parent / 'booklog_utf8.csv'))
    ap.add_argument('--api-key', default=os.environ.get('GOOGLE_BOOKS_API_KEY', '') or read_key_file())
    ap.add_argument('--refresh', action='store_true')
    ap.add_argument('--no-covers', action='store_true')
    a = ap.parse_args()
    if not a.api_key:
        print('警告: APIキーが未設定です。共有枠を使うため429で失敗する可能性が高いです。',
              file=sys.stderr)

    rows = list(csv.reader(open(a.csv, encoding='utf-8')))
    overrides = read_overrides()
    print(f'手動補正 {len(overrides)}件を読み込み', file=sys.stderr)
    raw_path = HERE / 'raw' / 'gb_raw.json'
    cache = json.loads(raw_path.read_text(encoding='utf-8')) if raw_path.exists() and not a.refresh else {}

    books, unresolved = [], []

    def resolve_by_title(r):
        """書名（＋著者）で検索して1件に絞る。見つからなければ (None, score)。"""
        variants = title_variants(r[COL_TITLE])
        q = f'intitle:{variants[0]}'
        d = call({'q': q, 'maxResults': 10}, a.api_key, cache, f'title:{q}', a.refresh)
        item, score = pick(d.get('items'), variants, r[COL_AUTHOR])
        if item:
            return item, score, 'title'
        # 2段目: 本題だけ＋著者名で引き直す。短い書名ほどこれが効く。
        q2 = f'intitle:{variants[-1]} inauthor:{r[COL_AUTHOR]}'
        d2 = call({'q': q2, 'maxResults': 10}, a.api_key, cache, f'title:{q2}', a.refresh)
        item, score = pick(d2.get('items'), variants, r[COL_AUTHOR])
        return item, score, 'title+author'

    try:
        for n, r in enumerate(rows, 1):
            ov = overrides.get(r[COL_ITEM_ID], {})
            if ov.get('skip'):
                unresolved.append((r, f"手動確認済: {ov['skip']}", 0))
                continue
            if ov.get('volume_id'):
                d = fetch_volume(ov['volume_id'], a.api_key, cache, a.refresh)
                if d.get('volumeInfo'):
                    books.append(flatten(r, d, 1.0, 'override'))
                    continue
            isbn = ov.get('isbn') or r[COL_ISBN13].strip()
            if isbn:                                       # 紙の本: まずISBNで直接
                d = call({'q': f'isbn:{isbn}'}, a.api_key, cache, f'isbn:{isbn}', a.refresh)
                items = d.get('items') or []
                if items:
                    books.append(flatten(r, items[0], 1.0, 'isbn'))
                    continue
            # ISBNが無い（Kindle）か、Google BooksにそのISBNが無い場合
            item, score, how = resolve_by_title(r)
            if item:
                books.append(flatten(r, item, score, how if not isbn else f'isbn欠→{how}'))
            else:
                unresolved.append((r, 'isbn・書名とも該当なし' if isbn else '書名検索で該当なし', score))
            if n % 25 == 0:
                print(f'  {n}/{len(rows)}', file=sys.stderr)
    except QuotaExceeded as e:
        print(f'\n中断: {e}', file=sys.stderr)
    finally:
        raw_path.parent.mkdir(exist_ok=True)
        raw_path.write_text(json.dumps(cache, ensure_ascii=False), encoding='utf-8')

    covers, dup_covers = (0, []) if a.no_covers else download_covers(books)

    out = HERE / 'out'
    (out / 'books.json').write_text(json.dumps(books, ensure_ascii=False, indent=1), encoding='utf-8')
    if books:
        with open(out / 'books.csv', 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.DictWriter(f, fieldnames=list(books[0].keys())); w.writeheader(); w.writerows(books)
    with open(out / 'unresolved.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(['item_id', 'type', 'title', 'author', '理由', 'score'])
        w.writerows([r[COL_ITEM_ID], r[COL_TYPE], r[COL_TITLE], r[COL_AUTHOR], why, sc]
                    for r, why, sc in unresolved)

    by = lambda k, v: sum(1 for b in books if b['matched_by'] == k and (v is None or b[v]))
    lines = [
        f'CSV総行数        : {len(rows)}',
        f'ISBNで取得       : {by("isbn", None)}',
        f'書名検索で取得   : {by("title", None)}',
        f'  うちISBN13判明 : {by("title", "isbn13")}',
        f'未解決           : {len(unresolved)}',
        f'書影あり         : {sum(1 for b in books if b["cover"])} / {len(books)}',
        f'書影ダウンロード : {covers}',
    ]
    if dup_covers:
        lines += ['', '-- 中身が同一の書影（告知画像などのプレースホルダの疑い）--']
        title_of = {b['isbn13'] or b['item_id']: b['csv_title'] for b in books}
        for g in dup_covers:
            lines += ['  ' + ' / '.join(title_of.get(x, x)[:34] for x in g)]
    report = '\n'.join(lines)
    (out / 'report.txt').write_text(report + '\n', encoding='utf-8')
    print(report)


if __name__ == '__main__':
    main()
