import json

input_path = "./TLdata.txt"
output_path = "./TLdata.json"
f = open(input_path, 'r', encoding='UTF-8')

# data = f.read()
text_data = f.read()

# データの初期化
data = {}

# 行ごとにデータを処理
current_month = None
current_section = None
current_list = None

# テキストを行単位で分割
lines = text_data.strip().split("\n")

# 各行を処理
for line in lines:
    line = line.strip()  # 前後の空白を取り除く
    
    # [期] を見つけた場合
    if line.startswith("[期]"):
        current_month = line.split()[1]
        data[current_month] = {}
    
    # [積] や [読] を見つけた場合
    elif line.startswith("[積]") or line.startswith("[読]"):
        current_section = line.split()[1]
        # print(current_section)
        current_list = []
        data[current_month][line.split()[1]] = current_list
    
    # [題] を見つけた場合
    elif line.startswith("[題]"):
        current_list.append(line.split("]")[1].strip())
with open(output_path, 'w') as f:
    json.dump(data, f, indent=4, ensure_ascii=False)
# JSON形式に変換して出力
json_data = json.dumps(data, ensure_ascii=False, indent=4)
# print(json_data)