import json
import random

def generate_random_color():
    # ランダムにRGB値を生成し、16進数形式にフォーマット
    color = "#{:06x}".format(random.randint(0, 0xFFFFFF))
    return color

input_path = "./TLdata.json"
with open(input_path, 'r', encoding='utf-8') as file:
    data = json.load(file)

start_px = 0 # 各ノードのy座標までの距離の基準となる．Offsetみたいな役割
max_px = 0
min_px = 210
per_px = 70

# 区切り線の座標を格納するリスト
divider_px = []

# ノードのリストを格納するリスト
nodes = []
links = []

# 月とカテゴリを繰り返して処理
month_list = [
    "202209", "202210", "202211", "202212",
    "202301", "202302", "202303", "202304", "202305", "202306", "202307", "202308", "202309", "202310", "202311", "202312",
    "202401", "202402", "202403", "202404", "202405", "202406", "202407", "202408", "202409", "202410", "202411", "202412",
    "202501"
    ]

for month in month_list:
    start_px = max_px
    divider_px.append(start_px + per_px // 2)
    for category, books in data[month].items():
        group = "積" if category == "TSUN" else "読"  # TSUNは「積」、DOKUは「読」
        
        # 本ごとにノードを生成
        for idx, book in enumerate(books, start=1):
            node = {
                "id": f"{month}-{group}-{idx}",
                "label": book,
                "group": group,
                "y": idx * per_px + start_px  # y座標はインデックスに基づいて調整
            }
            if max_px < (idx * per_px + start_px):
                max_px = idx * per_px + start_px

            nodes.append(node)
    if max_px - start_px < min_px:
        max_px = start_px + min_px

for i in range(len(nodes)):
    if nodes[i]["group"] == "読":
        doku_label = nodes[i]["label"]
        doku_id = nodes[i]["id"]
        for j in range(len(nodes)):
            if nodes[j]["group"] == "読":
                continue
            tsun_label = nodes[j]["label"]
            tsun_id = nodes[j]["id"]
            if doku_label == tsun_label:
                link = {
                    "source": tsun_id,
                    "target": doku_id
                }
                links.append(link)

# print(links)
print(f"区切り線\n{divider_px}")
print(f"svgのheightは{max_px+100}")
# 結果をJSON形式で出力
result = {"nodes": nodes, "links": links}
with open("./auto.json", 'w') as f:
    json.dump(result, f, indent=4, ensure_ascii=False)
# JSON形式に変換して出力
json_data = json.dumps(result, ensure_ascii=False, indent=4)
