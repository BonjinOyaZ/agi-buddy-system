# init_zphilo_yaml.py
# Z-PHILO: 初期テンプレの zphilo.yaml を生成するスクリプト

from datetime import date
import yaml

zphilo_template = {
    "user": {
        "name": "",
        "created_at": str(date.today())
    },
    "philosophy": {
        "title": "",
        "description": ""
    },
    "mission": {
        "statement": ""
    },
    "vision": {
        "year_5": "",
        "year_10": "",
        "year_20": ""
    },
    "values": [
        {"situation": "逆境に直面したとき", "action": ""},
        {"situation": "利益と倫理が衝突したとき", "action": ""},
        {"situation": "人と意見が食い違ったとき", "action": ""},
        {"situation": "怒りを感じたとき", "action": ""},
        {"situation": "判断に迷ったとき（優先順位）", "action": ""},
        {"situation": "新しい挑戦をするか迷ったとき", "action": ""},
        {"situation": "誘惑や甘えに流されそうなとき", "action": ""},
        {"situation": "仲間が困っているとき", "action": ""},
        {"situation": "自分の実力が足りないと痛感したとき", "action": ""},
        {"situation": "誰かに裏切られたり、失望したとき", "action": ""}
    ]
}

# YAMLとして書き出し
def write_zphilo_yaml(path="zphilo.yaml"):
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(zphilo_template, f, allow_unicode=True, sort_keys=False)
    print(f"'{path}' を生成しました。Z哲学の旅を始めましょう！")

if __name__ == "__main__":
    write_zphilo_yaml()
