import json
import time
import re
from typing import List, Dict
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://derujun-2kyu.com/mondai/yojijukugo/{}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FourCharIdiomScraper/1.0; +https://example.com)"
}
START = 1
END = 24
SLEEP_SEC = 0.7

def text_only(el) -> str:
  return re.sub(r"\s+", " ", el.get_text(separator="", strip=True))

def strip_number_prefix(s: str) -> str:
  # 先頭の "2." のような番号+ドットを除去
  return re.sub(r"^\d+\.\s*", "", s)

def split_reading_to_four(reading: str) -> str:
  # ひらがな・カタカナのみ残して正規化
  kana = re.sub(r"[^ぁ-ゖァ-ヺー]", "", reading)
  # 4拍に分けられないものはそのまま返し、分けられる場合は4分割
  # ここでは「四字熟語の読みが4要素」である前提で、単純に均等分割はせず
  # 一般的にはスペース区切りがないので、ひらがなを形態素分割できないため
  # まずは全体を返し、後段UI側で分割を決める場合は調整してください。
  # もし「かなを四等分」で簡易対応するなら下記を使用:
  # n = len(kana)
  # chunks = [kana[0:n//4], kana[n//4:n//2], kana[n//2:3*n//4], kana[3*n//4:]]
  # return " ".join(chunks)
  return kana

def normalize_kanji(kanji: str) -> str:
  # CJKと記号・空白のみ残し、余計な空白を除去
  s = re.sub(r"[^\s一-龥々仝〆〇]", "", kanji)
  s = re.sub(r"\s+", "", s)  # 四字熟語は4文字続きに
  if len(s) == 4:
    return " ".join(list(s))  # UI用に「一 石 二 鳥」のようにスペース区切りに
  return s

def extract_from_question(div_q) -> Dict[str, str]:
  # 漢字（解答側 .a の .yojijukugo）
  a_el = div_q.select_one(".yojijukugo-q-inline .a .yojijukugo")
  kanji_raw = text_only(a_el) if a_el else ""
  kanji_raw = strip_number_prefix(kanji_raw)
  kanji = normalize_kanji(kanji_raw)

  # 読みと意味（.i の中の2つの div）
  i_el = div_q.select_one(".yojijukugo-q-inline .i")
  yomi = ""
  imi = ""
  if i_el:
    divs = i_el.select("div")
    if len(divs) >= 1:
      yomi = text_only(divs[0])
    if len(divs) >= 2:
      imi = text_only(divs[1])

  # 読みは半角スペース区切り4要素へ（UI要件に合わせる場合）
  # 上のsplit_reading_to_four()は未分割を返す設計。スペース区切りへ強制するなら次行を有効化:
  # yomi = " ".join(list(split_reading_to_four(yomi)))  # 1文字ずつ→要調整
  # 実用的には辞書に合わせて手でスペースを入れるのが確実だが、
  # サイトの提示にスペースがないため、ここではそのまま返す。
  # もしUI側で「4セル表示」を強制するなら、kanjiに合わせて分割:
  if len(kanji.replace(" ", "")) == 4 and len(yomi) >= 4:
    # かなを4ブロックに近似分割（均等近似）
    n = len(yomi)
    cuts = [0, round(n*0.25), round(n*0.5), round(n*0.75), n]
    chunks = [yomi[cuts[i]:cuts[i+1]] for i in range(4)]
    yomi = " ".join(chunks)

  return {
    "reading": yomi.strip(),
    "kanji": kanji.strip(),
    "meaning": imi.strip()
  }

def scrape_page(num: int) -> List[Dict[str, str]]:
  url = BASE_URL.format(num)
  print(f"Fetching: {url}")
  resp = requests.get(url, headers=HEADERS, timeout=20)
  resp.raise_for_status()
  soup = BeautifulSoup(resp.text, "html.parser")
  items = []
  for div_q in soup.select("div.question"):
    item = extract_from_question(div_q)
    # 最低限の検証
    if item["kanji"]:
      items.append(item)
  return items

def scrape_all() -> List[Dict[str, str]]:
  all_items: List[Dict[str, str]] = []
  for num in range(1, 25):
    try:
      page_items = scrape_page(num)
      all_items.extend(page_items)
    except Exception as e:
      print(f"Error at page {num}: {e}")
    time.sleep(SLEEP_SEC)
  return all_items

if __name__ == "__main__":
  data = scrape_all()
  print(f"Collected {len(data)} items.")
  with open("idioms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)