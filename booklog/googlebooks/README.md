# Google Books 書誌・書影取得

ブクログのエクスポートCSV (`../booklog_utf8.csv`) から
[Google Books API](https://developers.google.com/books) で書誌情報と書影を取得する。

## APIキー

キー無しだとGoogleの共有プロジェクト枠を使うことになり、ほぼ確実に
`429 Quota exceeded (Queries per day)` で失敗する。自分のキーを用意すること（無料・1000req/日）。

1. https://console.cloud.google.com/ でプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」→ **Books API** を有効化
3. 「認証情報」→「認証情報を作成」→ **APIキー**

読み込み順は `--api-key` → 環境変数 `GOOGLE_BOOKS_API_KEY` → `googlebooks/.apikey`。
`.apikey` と `covers/` `raw/` は `.gitignore` 済み。

```bash
echo 'AIza...' > googlebooks/.apikey
python3 googlebooks/fetch_googlebooks.py
```

## 動作

| 対象 | 方法 |
|---|---|
| 紙の本（ISBN13あり） | `q=isbn:...` で直接 |
| Kindle本（ASINのみ） | `q=intitle:<書名>` で検索し、書名と著者の類似度で1件選ぶ。ISBN13と書影を拾う |

類似度が 0.7 未満のものは採用せず `out/unresolved.csv` に回す（Web検索など別手段用）。

## 出力

| ファイル | 内容 |
|---|---|
| `raw/gb_raw.json` | APIレスポンスそのまま。再取得せず整形し直せる |
| `out/books.json` / `out/books.csv` | 整形済み |
| `out/unresolved.csv` | 特定できなかった本 |
| `out/report.txt` | サマリ |
| `covers/<isbn13>.jpg` | 書影 |

## 注意

- `--refresh` を付けない限り `raw/gb_raw.json` をキャッシュとして使う。
- 429を受けたら即中断し、それまでの取得分はキャッシュに保存される。キー設定後に再実行すれば続きから。
- Google Booksの書名はブクログと一致しないことがある。突き合わせは `item_id` / `isbn13` で行うこと。
