# Notion 連携 Claude Code AI バッチ処理システム 実装手順書

## 概要

Notion データベースをタスク管理の起点とし、5 分おきにポーリングして Ready 状態のタスクを並行実行。Claude Code Action で自動的にコード実装から PR 作成まで完結。

---

## 手順 1: Notion 準備

### 1-1. Notion インテグレーション作成

1. https://www.notion.so/my-integrations にアクセス
2. 「New integration」をクリック
3. 名前: `GitHub AI Bot`
4. Type: **Internal integration**
5. Associated workspace: データベースを作成するワークスペースを選択
6. Capabilities:
   - Read content: ✓
   - Update content: ✓
   - Insert content: ✓
7. 「Submit」後、**Internal Integration Token**をコピー

### 1-2. データベース作成

1. Notion で新規ページ作成
2. `/database` でインラインデータベース追加
3. 以下のプロパティを設定:

| プロパティ名 | タイプ | 設定                                      |
| ------------ | ------ | ----------------------------------------- |
| タスク名     | Title  | -                                         |
| プロンプト   | Text   | -                                         |
| ステータス   | Select | Todo, Ready, Running, Review, Done, Error |
| PR URL       | URL    | -                                         |
| 実行日時     | Date   | -                                         |
| エラー内容   | Text   | -                                         |

### 1-3. データベースに接続権限を付与

**重要: インラインデータベースの場合は親ページに接続が必要**

1. データベースが埋め込まれている**親ページ**を開く
2. 右上の「**Share**」ボタンをクリック
3. 検索欄に「GitHub AI Bot」と入力
4. インテグレーションを選択して「**Invite**」

### 1-4. データベース ID 取得

1. データベースビューを開く
2. 右上「•••」→ 「Copy link to view」
3. URL の形式を確認:
   ```
   https://www.notion.so/PAGE_ID?v=DATABASE_ID
   ```
   **`?v=` の後ろの部分がデータベース ID です**

### 1-5. GitHub Secrets に登録

GitHub リポジトリ → Settings → Secrets and variables → Actions

以下 3 つを登録:

```
NOTION_TOKEN: Internal Integration Token
NOTION_DATABASE_ID: データベースID（?v=の後ろ）
ANTHROPIC_API_KEY: AnthropicのAPIキー
SLACK_WEBHOOK_URL: SlackのWebhook URL
```

---

## 手順 2: 実装ファイル作成

### 2-1. ディレクトリ構造

```
.github/
  workflows/
    notion-poller.yml
    claude-batch.yml
scripts/
  package.json
  notion_sync.js
```

### 2-2. package.json 作成

`scripts/package.json`:

```json
{
  "name": "notion-claude-integration",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@notionhq/client": "^2.2.15"
  }
}
```

### 2-3. Notion 同期スクリプト

`scripts/notion_sync.js`:

```javascript
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

// Ready状態のタスクを取得
export async function getReadyTasks() {
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: "ステータス",
      select: { equals: "Ready" },
    },
  });

  return response.results.map((page) => ({
    id: page.id,
    name: page.properties["タスク名"].title[0]?.plain_text || "unnamed",
    prompt: page.properties["プロンプト"].rich_text[0]?.plain_text || "",
  }));
}

// ステータス更新
export async function updateStatus(pageId, status, updates = {}) {
  const properties = {
    ステータス: { select: { name: status } },
  };

  if (updates.prUrl) {
    properties["PR URL"] = { url: updates.prUrl };
  }

  if (updates.executedAt) {
    properties["実行日時"] = { date: { start: updates.executedAt } };
  }

  if (updates.error) {
    properties["エラー内容"] = {
      rich_text: [{ text: { content: updates.error.substring(0, 2000) } }],
    };
  }

  await notion.pages.update({
    page_id: pageId,
    properties,
  });
}

// CLIモード: Ready状態のタスクをJSON出力
if (process.argv[1].endsWith("notion_sync.js")) {
  const action = process.argv[2];

  if (action === "fetch") {
    // Ready状態のタスクを取得してRunningに更新
    const tasks = await getReadyTasks();

    if (tasks.length === 0) {
      console.log("[]");
      process.exit(0);
    }

    // Running状態に更新
    const now = new Date().toISOString();
    for (const task of tasks) {
      await updateStatus(task.id, "Running", { executedAt: now });
    }

    console.log(JSON.stringify(tasks));
  } else if (action === "update") {
    // ステータス更新
    const pageId = process.argv[3];
    const status = process.argv[4];
    const prUrl = process.argv[5];
    const error = process.argv[6];

    await updateStatus(pageId, status, {
      prUrl: prUrl !== "null" ? prUrl : undefined,
      error: error !== "null" ? error : undefined,
    });

    console.log("Updated");
  }
}
```

### 2-4. ポーリングワークフロー

`.github/workflows/notion-poller.yml`:

```yaml
name: Notion Poller

on:
  schedule:
    - cron: "*/5 * * * *" # 5分おき
  workflow_dispatch: # 手動実行も可能

jobs:
  check-notion:
    runs-on: ubuntu-latest
    outputs:
      tasks: ${{ steps.fetch.outputs.tasks }}
      has_tasks: ${{ steps.fetch.outputs.has_tasks }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm install
        working-directory: scripts

      - name: Fetch Ready Tasks
        id: fetch
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
        run: |
          TASKS=$(node scripts/notion_sync.js fetch)
          echo "tasks=$TASKS" >> $GITHUB_OUTPUT
          if [ "$TASKS" = "[]" ]; then
            echo "has_tasks=false" >> $GITHUB_OUTPUT
            echo "No tasks ready for execution"
          else
            echo "has_tasks=true" >> $GITHUB_OUTPUT
            echo "Found tasks: $TASKS"
          fi

  trigger-batch:
    needs: check-notion
    if: needs.check-notion.outputs.has_tasks == 'true'
    uses: ./.github/workflows/claude-batch.yml
    with:
      tasks: ${{ needs.check-notion.outputs.tasks }}
    secrets: inherit
```

### 2-5. Claude Code バッチ実行ワークフロー

`.github/workflows/claude-batch.yml`:

```yaml
name: Claude Code Batch Tasks

on:
  workflow_call:
    inputs:
      tasks:
        required: true
        type: string
  workflow_dispatch:
    inputs:
      tasks:
        description: "タスク定義JSON"
        required: true
        default: '[{"id":"xxx","name":"test","prompt":"Hello Worldを出力するJavaScript関数を作成"}]'

jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}
    steps:
      - id: set-matrix
        run: |
          echo "matrix=${{ inputs.tasks }}" >> $GITHUB_OUTPUT

  execute-tasks:
    needs: setup
    runs-on: ubuntu-latest
    strategy:
      matrix:
        task: ${{ fromJson(needs.setup.outputs.matrix) }}
      max-parallel: 5
      fail-fast: false # エラーでも他タスク続行
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install Notion dependencies
        run: npm install
        working-directory: scripts

      - name: Execute Claude Code
        id: claude
        uses: anthropics/claude-code-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            タスク: ${{ matrix.task.name }}

            以下の要件を満たすコードを実装してください:
            ${{ matrix.task.prompt }}

            実装後、変更をコミットしてください。
          max_iterations: 30
        continue-on-error: true

      - name: Get PR URL
        id: get_pr
        if: success()
        run: |
          # 最新のPRを取得（Claude Codeが作成したPR）
          PR_URL=$(gh pr list --head "${{ github.ref_name }}" --json url --jq '.[0].url' || echo "")
          echo "pr_url=$PR_URL" >> $GITHUB_OUTPUT
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Update Notion Status (Success)
        if: steps.claude.outcome == 'success'
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
        run: |
          node scripts/notion_sync.js update \
            "${{ matrix.task.id }}" \
            "Review" \
            "${{ steps.get_pr.outputs.pr_url }}" \
            "null"

      - name: Update Notion Status (Failure)
        if: steps.claude.outcome == 'failure'
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
        run: |
          ERROR_MSG="Claude Code execution failed. Check GitHub Actions logs for details."
          node scripts/notion_sync.js update \
            "${{ matrix.task.id }}" \
            "Error" \
            "null" \
            "$ERROR_MSG"

  notify:
    needs: execute-tasks
    runs-on: ubuntu-latest
    if: always()
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm install
        working-directory: scripts

      - name: Count Results
        id: count
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
        run: |
          # Reviewステータスのタスク数を取得
          REVIEW_COUNT=$(node -e "
            import('@notionhq/client').then(async ({ Client }) => {
              const notion = new Client({ auth: process.env.NOTION_TOKEN });
              const response = await notion.databases.query({
                database_id: process.env.NOTION_DATABASE_ID,
                filter: { property: 'ステータス', select: { equals: 'Review' } }
              });
              console.log(response.results.length);
            })
          ")

          # Errorステータスのタスク数を取得
          ERROR_COUNT=$(node -e "
            import('@notionhq/client').then(async ({ Client }) => {
              const notion = new Client({ auth: process.env.NOTION_TOKEN });
              const response = await notion.databases.query({
                database_id: process.env.NOTION_DATABASE_ID,
                filter: { property: 'ステータス', select: { equals: 'Error' } }
              });
              console.log(response.results.length);
            })
          ")

          echo "review_count=$REVIEW_COUNT" >> $GITHUB_OUTPUT
          echo "error_count=$ERROR_COUNT" >> $GITHUB_OUTPUT

      - name: Slack Notification
        uses: slackapi/slack-github-action@v1.27.0
        with:
          payload: |
            {
              "text": "🤖 Claude Code バッチ処理完了",
              "blocks": [
                {
                  "type": "header",
                  "text": {
                    "type": "plain_text",
                    "text": "Claude Code バッチ処理完了"
                  }
                },
                {
                  "type": "section",
                  "fields": [
                    {
                      "type": "mrkdwn",
                      "text": "*実行結果:*\n${{ needs.execute-tasks.result }}"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*レビュー待ち:*\n${{ steps.count.outputs.review_count }} タスク"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*エラー:*\n${{ steps.count.outputs.error_count }} タスク"
                    }
                  ]
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "<${{ github.server_url }}/${{ github.repository }}/pulls|PRを確認> | <https://notion.so/${{ secrets.NOTION_DATABASE_ID }}|Notionで確認>"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK
```

---

## 手順 3: 動作確認

### 3-1. 初期セットアップ

```bash
# リポジトリをクローン
git clone <your-repo>
cd <your-repo>

# scriptsディレクトリで依存関係インストール
cd scripts
npm install

# メインブランチにプッシュ（cronを有効化）
git add .
git commit -m "feat: add Notion + Claude Code integration"
git push origin main
```

### 3-2. ローカルテスト

```bash
# Notion接続テスト
export NOTION_TOKEN="your-token"
export NOTION_DATABASE_ID="your-db-id"
node scripts/notion_sync.js fetch
```

### 3-3. Notion でテストタスク作成

| タスク名       | プロンプト                                                                                    | ステータス |
| -------------- | --------------------------------------------------------------------------------------------- | ---------- |
| hello-function | console.log で Hello World を出力する JavaScript 関数を src/utils/hello.js に作成してください | Ready      |

### 3-4. 手動実行でテスト

1. GitHub → Actions → "Notion Poller"
2. "Run workflow" をクリック
3. 実行ログ確認:
   - タスク検出確認
   - Claude Code 実行確認
   - PR 作成確認
4. Notion でステータス変化確認（Ready → Running → Review）
5. GitHub で PR 確認
6. Slack 通知確認

---

## 手順 4: 運用開始

### 4-1. 自動ポーリング有効化

- メインブランチにマージされると 5 分おきに自動実行
- Ready 状態のタスクがあれば自動処理

### 4-2. 日常の使い方

**タスク追加:**

1. Notion でタスク追加（ステータス: Todo）
2. プロンプト記入
3. ステータスを"Ready"に変更
4. 最大 5 分待機で自動実行開始

**進捗確認:**

- Notion: ステータス・PR URL で進捗確認
- Slack: 完了通知でまとめて確認
- GitHub: PR でコードレビュー

**エラー対応:**

1. Notion でステータス="Error"を確認
2. エラー内容欄を確認
3. プロンプト修正
4. ステータスを"Ready"に戻す → 再実行

---

## 手順 5: 既存コード修正への対応

Claude Code は既存ファイルの読み込み・編集が可能です。

### プロンプトの書き方例

**新規ファイル作成:**

```
src/components/Button.tsxに再利用可能なButtonコンポーネントを作成してください。
TailwindCSSでスタイリングし、variant（primary/secondary）をサポートしてください。
```

**既存ファイル修正:**

```
src/api/auth.tsのlogin関数を修正してください。
- rate limitingを追加（1分間に5回まで）
- エラーハンドリングを改善
既存のコードを読み込んで、最小限の変更で実装してください。
```

**複数ファイル横断:**

```
ユーザー認証機能を実装してください:
1. src/api/auth.ts: 認証API
2. src/hooks/useAuth.ts: Reactフック
3. src/components/LoginForm.tsx: ログインフォーム
既存のコードスタイルに合わせてください。
```

### Claude Code の動作

1. プロンプトを読んで必要なファイルを特定
2. 既存ファイルを読み込み（該当する場合）
3. コード生成・編集
4. テスト実行（テストがある場合）
5. 変更をコミット
6. PR 作成（自動）

---

## トラブルシューティング

### Notion から取得できない

- **Integration Token 確認**: Secrets に正しく登録されているか
- **接続権限確認**: 親ページにインテグレーションが Invite されているか
- **データベース ID 確認**: `?v=` の後ろの部分を使用しているか

### ワークフローが起動しない

- **main ブランチ確認**: cron は main ブランチでのみ動作
- **Ready 状態確認**: Notion にステータス="Ready"のタスクがあるか
- **Actions 有効確認**: リポジトリ設定で Actions が有効か

### Claude Code が失敗する

- **プロンプト明確化**: 具体的な指示を記載
- **ファイルパス指定**: 既存ファイル修正時は明示的にパス指定
- **max_iterations 調整**: 複雑なタスクは値を増やす

### PR が作成されない

- **GitHub Token 確認**: workflow 内で使用するトークンの権限
- **ブランチ保護**: main ブランチの保護設定を確認

### Notion 更新が失敗する

- **スクリプトエラー確認**: Actions ログでエラー詳細確認
- **プロパティ名確認**: Notion のプロパティ名が一致しているか

---

## カスタマイズ例

### 並行実行数の調整

```yaml
strategy:
  matrix:
    task: ${{ fromJson(needs.setup.outputs.matrix) }}
  max-parallel: 3 # 3タスクまで同時実行
```

### ポーリング間隔の変更

```yaml
on:
  schedule:
    - cron: "*/10 * * * *" # 10分おきに変更
```

### Claude Code モデル変更

```yaml
- name: Execute Claude Code
  uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    model: claude-opus-4-20250514 # Opusに変更
    prompt: ...
```

### プロジェクト固有の指示追加

```yaml
prompt: |
  タスク: ${{ matrix.task.name }}

  【重要】以下のガイドラインに従ってください:
  - TypeScriptを使用
  - ESLintルールに準拠
  - テストを必ず追加

  要件:
  ${{ matrix.task.prompt }}
```

---

## 次のステップ

### 機能拡張アイデア

1. **優先度対応**: Notion に優先度フィールドを追加し、高優先度から実行
2. **依存関係管理**: タスク間の依存関係を定義
3. **コスト追跡**: API 使用量を Notion に記録
4. **自動テスト**: 生成コードのテスト自動実行
5. **レビュー自動化**: AI によるコードレビュー追加

### 高度な運用

- **CLAUDE.md 追加**: プロジェクト固有のコーディング規約を定義
- **MCP 連携**: Model Context Protocol で外部ツール統合
- **マルチリポジトリ**: 複数リポジトリで同一システム運用

---

## まとめ

このシステムで実現できること:
✅ Notion でタスク管理
✅ 5 分おきの自動実行
✅ Claude Code による高品質なコード生成
✅ 既存コードの修正も可能
✅ 自動 PR 作成
✅ Slack 通知で完了確認
✅ チーム全体で並行開発加速

完了です！素晴らしい AI 駆動開発体験をお楽しみください 🚀
