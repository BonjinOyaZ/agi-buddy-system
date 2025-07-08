import yaml
import subprocess
import os

# ファイルパスの定義
ZPHILO_YAML_PATH = "zphilo.yaml"
INIT_SCRIPT_PATH = "init_zphilo_yaml.py"
GEMINI_MD_PATH = "GEMINI.md"

def load_zphilo_yaml():
    """zphilo.yaml を読み込み、存在しない場合は初期化スクリプトを実行する"""
    if not os.path.exists(ZPHILO_YAML_PATH):
        print(f"'{ZPHILO_YAML_PATH}' が見つかりません。初期化スクリプトを実行します。")
        run_init_script()
    try:
        with open(ZPHILO_YAML_PATH, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except yaml.YAMLError as e:
        print(f"エラー: '{ZPHILO_YAML_PATH}' の読み込み中に問題が発生しました: {e}")
        print("ファイルの内容を確認するか、初期化を試してください。")
        exit(1)
    except FileNotFoundError:
        print(f"エラー: '{ZPHILO_YAML_PATH}' が見つかりません。")
        exit(1)

def run_init_script():
    """init_zphilo_yaml.py を実行して zphilo.yaml を初期化する"""
    print("Z-PHILOのデータを初期化します...")
    try:
        # init_zphilo_yaml.py の出力が文字化けしないように encoding と errors を指定
        result = subprocess.run(["python", INIT_SCRIPT_PATH], check=True, capture_output=True, text=True, encoding='utf-8', errors='ignore')
        print(result.stdout.strip())
        print("Z-PHILOの初期化が完了しました。")
    except subprocess.CalledProcessError as e:
        print(f"エラー: 初期化スクリプトの実行中に問題が発生しました: {e}")
        print(f"標準出力: {e.stdout.strip()}")
        print(f"標準エラー: {e.stderr.strip()}")
        exit(1)
    except FileNotFoundError:
        print(f"エラー: '{INIT_SCRIPT_PATH}' が見つかりません。ファイルパスを確認してください。")
        exit(1)

def get_next_step(data):
    """zphilo.yaml の内容から次の入力ステップを判断する"""
    user_info = data.get('user', {})
    philosophy_info = data.get('philosophy', {})
    mission_info = data.get('mission', {})
    vision_info = data.get('vision', {})
    values_list = data.get('values', [])

    if not user_info.get('name'):
        return "ユーザー名"
    if not philosophy_info.get('title') or not philosophy_info.get('description'):
        return "哲学のタイトルと説明"
    if not mission_info.get('statement'):
        return "使命"
    if not vision_info.get('year_5') or not vision_info.get('year_10') or not vision_info.get('year_20'):
        return "ビジョン（5年後、10年後、20年後）"

    for i, val in enumerate(values_list):
        if not val.get('action'):
            return f"行動指針（{val.get('situation', '不明な状況')}）"
    
    return "全ての項目が入力済みです。素晴らしい！"

def main():
    """メイン処理"""
    print("Z-PHILO CLIへようこそ！")

    # 初期化の選択肢
    reset_choice = input("Z-PHILOのデータを最初からやり直しますか？ (y/N): ").lower()
    if reset_choice == 'y':
        run_init_script()
        # 初期化後、再度データを読み込む
        zphilo_data = load_zphilo_yaml()
    else:
        zphilo_data = load_zphilo_yaml()

    # 進捗状況の確認と次のステップの提示
    next_step = get_next_step(zphilo_data)
    print(f"\n現在の進捗状況: {next_step}")

    prompt = ""
    if "全ての項目が入力済みです" in next_step:
        print("君の哲学は既に確立されておるな。いつでもわしと対話できるぞ。")
        prompt = "君の哲学について、さらに深掘りしてみようか。どんなことでも話してみるがよい。"
    else:
        print(f"次は「{next_step}」について、わしと壁打ちするがよい。")
        prompt = f"君の「{next_step}」について、わしと共に言葉を紡いでいこう。さあ、語り始めてくれ。"

    # 対話の準備
    print("\n渋沢栄一翁との対話の準備が整いました。")
    print("以下のプロンプトをコピーし、わしとの対話に貼り付けておくれ。")
    print("その際、対話の文脈として zphilo.yaml と GEMINI.md も一緒に含めるのが肝要じゃ。")
    print("\n--- ここからコピー ---")
    print(f"{prompt} @{GEMINI_MD_PATH} @{ZPHILO_YAML_PATH}")
    print("--- ここまでコピー ---\n")

if __name__ == "__main__":
    main()
