
import requests
from bs4 import BeautifulSoup
import json

def scrape_busyu():
    """
    指定されたURLから部首の問題と答えをスクレイピングし、JSON形式で出力します。
    """
    base_url = "https://kanken.jitenon.jp/mondai-busyu02-{:02d}"
    results = []

    for i in range(1, 41):
        url = base_url.format(i)
        print(url)
        try:
            response = requests.get(url)
            response.raise_for_status()  # HTTPエラーがあれば例外を発生させる
            response.encoding = response.apparent_encoding

            soup = BeautifulSoup(response.text, 'html.parser')

            # 問題と答えの要素をすべて取得
            question_elements = soup.find_all(class_="busyu-q01")
            answer_elements = soup.find_all(class_="busyu-answer01")

            if question_elements and answer_elements and len(question_elements) == len(answer_elements):
                for q_elem, a_elem in zip(question_elements, answer_elements):
                    question = q_elem.get_text(strip=True)
                    answer = a_elem.get_text(strip=True)
                    
                    results.append({
                        "question": question,
                        "answer": answer,
                        "remark": ""
                    })
            else:
                print(f"Warning: ページ {url} で問題と答えのペアが見つからないか、数が一致しませんでした。")

        except requests.exceptions.RequestException as e:
            print(f"Error: ページ {url} の取得中にエラーが発生しました: {e}")

    return json.dumps(results, indent=4, ensure_ascii=False)

if __name__ == "__main__":
    scraped_data = scrape_busyu()
    with open("busyu_data.json", "w", encoding="utf-8") as f:
        f.write(scraped_data)
    print("データを busyu_data.json に保存しました。")
