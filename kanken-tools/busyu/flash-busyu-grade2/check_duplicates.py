
import json
from collections import Counter

def check_duplicates():
    """
    busyu_data.jsonを読み込み、'question'キーの値の重複をチェックします。
    """
    try:
        with open("busyu_data.json", "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print("エラー: busyu_data.json が見つかりません。")
        return
    except json.JSONDecodeError:
        print("エラー: busyu_data.json の解析に失敗しました。")
        return

    # 'question'の値のリストを作成
    questions = [item["question"] for item in data]

    # Counterを使って各questionの出現回数をカウント
    counts = Counter(questions)

    # 出現回数が1回より多いものを重複とみなす
    duplicates = {question: count for question, count in counts.items() if count > 1}

    if not duplicates:
        print("重複する 'question' は見つかりませんでした。")
    else:
        print("以下の重複する 'question' が見つかりました：")
        for question, count in duplicates.items():
            print(f"  - '{question}': {count}回")

if __name__ == "__main__":
    check_duplicates()
