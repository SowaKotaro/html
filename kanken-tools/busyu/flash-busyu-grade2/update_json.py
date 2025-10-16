
import json
import re

def update_json_from_markdown():
    """
    busyu.mdの内容を読み取り、busyu_data.jsonを更新します。
    - mdファイルにしか存在しない漢字データをjsonに追加します。
    - mdファイルに備考があれば、jsonのremarkを更新します。
    """
    # --- 1. busyu_data.jsonの読み込み ---
    try:
        with open("busyu_data.json", "r", encoding="utf-8") as f:
            json_data = json.load(f)
    except FileNotFoundError:
        print("エラー: busyu_data.json が見つかりません。")
        return
    except json.JSONDecodeError:
        print("エラー: busyu_data.json の解析に失敗しました。")
        return

    # 質問(漢字)をキーにした辞書を作成し、高速な検索を可能にする
    json_dict = {item["question"]: item for item in json_data}

    # --- 2. busyu.mdの読み込みと解析 ---
    try:
        with open("busyu.md", "r", encoding="utf-8") as f:
            md_content = f.readlines()
    except FileNotFoundError:
        print("エラー: busyu.md が見つかりません。")
        return

    # --- 3. データのマージ処理 ---
    # ヘッダー行(2行)をスキップしてテーブルの各行を処理
    for line in md_content[2:]:
        # Markdownのテーブル行をパース
        cells = [cell.strip() for cell in line.split('|') if cell.strip()]
        if len(cells) < 2:
            continue

        kanji = cells[0]
        busyu = cells[1]
        remark = cells[3] if len(cells) > 3 else ""

        # 3a. 既存データのremarkを更新
        if kanji in json_dict:
            if remark: # md側にremarkがある場合のみ更新
                json_dict[kanji]["remark"] = remark
        # 3b. 新規データを追加
        else:
            new_entry = {
                "question": kanji,
                "answer": busyu,
                "remark": remark
            }
            json_data.append(new_entry)
            # 次のループで参照できるように、辞書にも追加
            json_dict[kanji] = new_entry

    # --- 4. 更新されたデータをJSONファイルに書き込み ---
    with open("busyu_data.json", "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=4, ensure_ascii=False)

    print("busyu_data.json の更新が完了しました。")

if __name__ == "__main__":
    update_json_from_markdown()
