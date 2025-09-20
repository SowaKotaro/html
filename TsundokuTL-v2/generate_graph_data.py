import json
import random

def parse_text_data(text_data):
    data = {}
    current_month = None
    current_section = None
    current_list = None
    lines = text_data.strip().split("\n")
    for line in lines:
        line = line.strip()
        if line.startswith("[期]"):
            current_month = line.split()[1]
            data[current_month] = {}
        elif line.startswith("[積]") or line.startswith("[読]"):
            current_section = line.split()[1]
            current_list = []
            data[current_month][current_section] = current_list
        elif line.startswith("[題]"):
            if current_list is not None:
                current_list.append(line.split("]")[1].strip())
    return data

def create_graph_data(data):
    start_px = 0
    max_px = 0
    min_px = 210
    per_px = 70
    divider_px = []
    nodes = []
    links = []
    
    month_list = sorted(data.keys())

    for month in month_list:
        start_px = max_px
        divider_px.append(start_px + per_px // 2)
        if month in data:
            for category, books in data[month].items():
                group = "積" if category == "TSUN" else "読"
                for idx, book in enumerate(books, start=1):
                    node = {
                        "id": f"{month}-{group}-{idx}",
                        "label": book,
                        "group": group,
                        "y": idx * per_px + start_px
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

    svg_height = max_px + 100
    
    # 月のキャプションを生成
    captions = [f"{month[:4]}年{month[4:]}月" for month in month_list]

    return {"nodes": nodes, "links": links, "separatorLines": divider_px, "svgHeight": svg_height, "captionTexts": captions}

def main():
    input_path = "./TLdata.txt"
    output_path = "./graph_data.json"
    
    with open(input_path, 'r', encoding='UTF-8') as f:
        text_data = f.read()
        
    parsed_data = parse_text_data(text_data)
    graph_data = create_graph_data(parsed_data)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(graph_data, f, indent=4, ensure_ascii=False)
    
    print(f"Successfully generated {output_path}")

if __name__ == "__main__":
    main()
