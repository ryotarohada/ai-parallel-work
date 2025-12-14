# Notion連携 AI バッチ処理システム

Notionデータベースをタスク管理の起点とし、5分おきにポーリングしてReady状態のタスクをClaude AIで並行実行。完了後にNotion と Slack に通知するシステムです。

## 🚀 機能

- **自動ポーリング**: 5分ごとにNotionデータベースをチェック
- **並行実行**: 最大5タスクを同時実行
- **AI処理**: Claude 4 Sonnetでタスクを自動実行
- **自動PR作成**: 実行結果をGitHubにPR作成
- **ステータス管理**: Notionで進捗をリアルタイム管理
- **Slack通知**: 完了時に自動通知

## 📁 プロジェクト構成

```
ai-parallel-work/
├── scripts/
│   ├── package.json          # スクリプト用依存関係
│   ├── notion_sync.js        # Notion API連携
│   └── claude_task.js        # Claude AI実行
├── .github/workflows/
│   ├── notion-poller.yml     # 5分ごとのポーリング
│   └── batch-tasks.yml       # 並行タスク実行
├── package.json              # ルートパッケージ設定
└── README.md
```

## ⚙️ セットアップ

### 1. Notion準備

#### 1.1 Notionインテグレーション作成
1. https://www.notion.so/my-integrations にアクセス
2. 「New integration」をクリック
3. 名前: `GitHub AI Bot`、権限: Read/Write content
4. 「Submit」後、Internal Integration Token をコピー

#### 1.2 データベース作成
1. Notionで新規ページ作成
2. `/database` でデータベース追加
3. 以下のプロパティを設定:

| プロパティ名 | タイプ | 設定 |
|------------|--------|------|
| タスク名 | Title | - |
| プロンプト | Text | - |
| ステータス | Select | Todo, Ready, Running, Review, Done, Error |
| PR URL | URL | - |
| 実行日時 | Date | - |
| エラー内容 | Text | - |

4. データベース右上「...」→「Add connections」→作成したインテグレーションを選択
5. データベースURLからIDを取得: `https://notion.so/workspace/DATABASE_ID?v=...`

### 2. GitHub Secrets設定

リポジトリの Settings > Secrets and variables > Actions で以下を追加:

```
NOTION_TOKEN: Notion Internal Integration Token
NOTION_DATABASE_ID: NotionデータベースID
ANTHROPIC_API_KEY: Claude APIキー
SLACK_WEBHOOK_URL: Slack Webhook URL (オプション)
```

### 3. 依存関係インストール

```bash
# ルートとscriptsディレクトリの両方にインストール
npm run install:all

# または個別に
npm install
cd scripts && npm install
```

## 🔧 使い方

### 基本的なフロー

1. **タスク作成**: Notionでタスクを追加
2. **Ready状態**: ステータスを"Ready"に変更
3. **自動実行**: 最大5分待機で自動実行開始
4. **結果確認**: 完了後にSlack通知、NotionでPRリンク確認
5. **レビュー**: GitHubでPRをレビューしてマージ

### ローカル環境設定

```bash
# .envファイルを作成
cd scripts
cp .env.example .env

# .envファイルを編集してAPIキーを設定
# NOTION_TOKEN=your-actual-token
# NOTION_DATABASE_ID=your-actual-db-id
# ANTHROPIC_API_KEY=your-actual-key
```

### ローカルテスト

```bash
# 依存関係インストール
npm run install:all

# Notion接続テスト
npm run test:notion

# Claude実行テスト
npm run test:claude
```

### GitHub Actions手動実行

1. Actions → "Notion Poller" → "Run workflow"
2. 実行ログとNotionステータスを確認
3. PRが作成されたか確認

## 📊 ステータスの流れ

```
Todo → Ready → Running → Review/Error → Done
```

- **Todo**: 初期状態
- **Ready**: 実行待ち（自動実行対象）
- **Running**: 実行中
- **Review**: 実行完了、PR作成済み
- **Error**: エラー発生
- **Done**: レビュー完了、マージ済み

## 🛠️ トラブルシューティング

### Notionから取得できない
- Integration tokenを確認
- データベースにConnectionが追加されているか確認
- データベースIDが正しいか確認

### ワークフローが起動しない
- cronが有効か確認（mainブランチにマージ必要）
- Ready状態のタスクがあるか確認
- GitHub Actionsの実行履歴確認

### PRが作成されない
- ブランチ名の重複確認
- GitHub tokenの権限確認

## 🔮 拡張アイデア

- **優先度対応**: Notionに優先度フィールド追加
- **コスト追跡**: API使用量をNotionに記録
- **Webhook化**: リアルタイム実行対応
- **レビュー自動化**: AI生成コードの自動テスト

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

PRやIssueをお気軽にお送りください！