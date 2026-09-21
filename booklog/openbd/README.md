# openBD 書誌データ取得

ブクログのエクスポートCSV (`../booklog_utf8.csv`) の13桁ISBNを使って
[openBD](https://openbd.jp/) から書誌情報を取得する。

## 使い方

```bash
python3 openbd/fetch_openbd.py                 # 取得＋整形（raw があれば差分のみ取得）
python3 openbd/fetch_openbd.py --refresh       # キャッシュを無視して全件取り直す
python3 openbd/fetch_openbd.py --csv other.csv # 別のCSVを対象にする
```

標準ライブラリのみで動く。認証不要、100件ずつまとめて問い合わせる。

## 出力

| ファイル | 内容 |
|---|---|
| `raw/openbd_raw.json` | APIレスポンスそのまま（ISBNをキーにした辞書）。再取得せず整形し直せる |
| `out/books.json` | 1冊1レコードに平坦化したもの |
| `out/books.csv` | 同上のCSV（Excel向けに UTF-8 BOM 付き） |
| `out/report.txt` | 取得サマリと未ヒットISBN |

## 注意

- **openBDはISBN専用**。Kindle本はCSVにASINしか無いので引けない（113/169件が対象外）。
- データの厚みが2層ある。版元ドットコム加盟社の本はページ数・目次・内容紹介・書影まで揃うが、
  非加盟社の本は書名・著者・出版社・価格程度しか入らない。
- **書名はブクログと一致しない**。openBDはNDL由来の書誌形（`三体. 3[上]`）を返すことが多く、
  ブクログ側は流通上の書名（`三体3 死神永生 上`）。突き合わせはISBNで行うこと。
- 見つからない場合も HTTP 200 で `[null]` が返る。
