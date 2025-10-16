import json

def check_duplicates():
    """
    idioms.jsonファイル内のkanjiフィールドの重複をチェックします。
    """
    try:
        with open('idioms.json', 'r', encoding='utf-8') as f:
            idioms = json.load(f)
    except FileNotFoundError:
        print("エラー: idioms.jsonファイルが見つかりません。")
        return
    except json.JSONDecodeError:
        print("エラー: idioms.jsonファイルの形式が正しくありません。")
        return

    kanji_list = [item.get('kanji') for item in idioms if item.get('kanji')]
    
    seen = set()
    duplicates = set()
    
    for kanji in kanji_list:
        if kanji in seen:
            duplicates.add(kanji)
        else:
            seen.add(kanji)
            
    if duplicates:
        print("重複が見つかりました:")
        for dup in sorted(list(duplicates)):
            print(f"- {dup}")
    else:
        print("重複はありませんでした。")

if __name__ == '__main__':
    check_duplicates()
