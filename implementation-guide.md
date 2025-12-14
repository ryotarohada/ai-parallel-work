# Notion 連携 AI バッチ処理システム MVP 実装手順書

## 概要

Notion データベースをタスク管理の起点とし、5 分おきにポーリングして Ready 状態のタスクを並行実行。完了後に Notion と Slack に通知。

---

## 手順 1: Notion 準備

### 1-1. Notion インテグレーション作成

1. https://www.notion.so/my-integrations にアクセス
2. 「New integration」をクリック
3. 名前: `GitHub AI Bot`、権限: Read/Write content
4. 「Submit」後、Internal Integration Token をコピー

### 1-2. データベース作成

1. Notion で新規ページ作成
2. `/database` でデータベース追加
3. 以下のプロパティを設定:

| プロパティ名 | タイプ | 設定                                      |
| ------------ | ------ | ----------------------------------------- |
| タスク名     | Title  | -                                         |
| プロンプト   | Text   | -                                         |
| ステータス   | Select | Todo, Ready, Running, Review, Done, Error |
| PR URL       | URL    | -                                         |
| 実行日時     | Date   | -                                         |
| エラー内容   | Text   | -                                         |

4. データベース右上「...」→「Add connections」→ 作成したインテグレーションを選択
5. データベース URL から ID を取得:
   ```
   https://notion.so/workspace/DATABASE_ID?v=...
   ```

### 1-3. GitHub Secrets に登録

```
NOTION_TOKEN: Internal Integration Token
NOTION_DATABASE_ID: データベースID
```

---

## 手順 2: 実装ファイル作成

### 2-1. ディレクトリ構造

```
.github/
  workflows/
    notion-poller.yml
    batch-tasks.yml
scripts/
  package.json
  notion_sync.js
  claude_task.js
```

### 2-2. package.json 更新

`scripts/package.json`:

```json
{
  "name": "ai-batch-tasks",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.0",
    "@notionhq/client": "^2.2.15"
  }
}
```

### 2-3. Notion 同期スクリプト

`scripts/notion_sync.js`:

```javascript
import { Client } from "@notionhq/client";
import fs from "fs";

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
      rich_text: [{ text: { content: updates.error } }],
    };
  }

  await notion.pages.update({
    page_id: pageId,
    properties,
  });
}

// CLIモード: Ready状態のタスクをJSON出力
if (process.argv[1].endsWith("notion_sync.js")) {
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
}
```

### 2-4. Claude 実行スクリプト更新

`scripts/claude_task.js`:

```javascript
import Anthropic from "@anthropic-ai/sdk";
import { updateStatus } from "./notion_sync.js";
import fs from "fs";

const taskId = process.argv[2]; // Notion page ID
const taskName = process.argv[3];
const prompt = process.argv[4];

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const result = message.content[0].text;
    fs.writeFileSync(`output_${taskName}.txt`, result);

    console.log(`Task ${taskName} completed`);
  } catch (error) {
    // エラー時はNotionに記録
    if (process.env.NOTION_TOKEN && taskId) {
      await updateStatus(taskId, "Error", {
        error: error.message.substring(0, 2000),
      });
    }

    fs.writeFileSync(`error_${taskName}.log`, error.toString());
    throw error;
  }
}

main();
```

### 2-5. ポーリングワークフロー

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
          TASKS=$(node scripts/notion_sync.js)
          echo "tasks=$TASKS" >> $GITHUB_OUTPUT
          if [ "$TASKS" = "[]" ]; then
            echo "has_tasks=false" >> $GITHUB_OUTPUT
          else
            echo "has_tasks=true" >> $GITHUB_OUTPUT
          fi

  trigger-batch:
    needs: check-notion
    if: needs.check-notion.outputs.has_tasks == 'true'
    uses: ./.github/workflows/batch-tasks.yml
    with:
      tasks: ${{ needs.check-notion.outputs.tasks }}
    secrets: inherit
```

### 2-6. バッチ実行ワークフロー

`.github/workflows/batch-tasks.yml`:

```yaml
name: Batch AI Tasks

on:
  workflow_call:
    inputs:
      tasks:
        required: true
        type: string
  workflow_dispatch:
    inputs:
      tasks:
        description: 'タスク定義JSON'
        required: true
        default: '[{"id":"xxx","name":"test","prompt":"Hello World"}]'

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
      fail-fast: false  # エラーでも他タスク続行
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install
        working-directory: scripts

      - name: Execute Claude Task
        id: claude
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
        run: |
          node scripts/claude_task.js "${{ matrix.task.id }}" "${{ matrix.task.name }}" "${{ matrix.task.prompt }}"

      - name: Create Branch & Commit
        if: success()
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git checkout -b ai/${{ matrix.task.name }}
          git add output_${{ matrix.task.name }}.txt
          git commit -m "AI: ${{ matrix.task.name }}"
          git push origin ai/${{ matrix.task.name }}

      - name: Create Pull Request
        if: success()
        id: pr
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          PR_URL=$(gh pr create \
            --title "AI実装: ${{ matrix.task.name }}" \
            --body "自動生成
Notion Task ID: ${{ matrix.task.id }}" \
            --base main \
            --head ai/${{ matrix.task.name }} \
            --draft \
            --json url -q .url)
          echo "pr_url=$PR_URL" >> $GITHUB_OUTPUT

      - name: Update Notion Status (Success)
        if: success()
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
        run: |
          node -e "
          import('./scripts/notion_sync.js').then(m =>
            m.updateStatus('${{ matrix.task.id }}', 'Review', {
              prUrl: '${{ steps.pr.outputs.pr_url }}'
            })
          )"

      - name: Update Notion Status (Failure)
        if: failure()
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
        run: |
          ERROR_LOG=\$(cat error_${{ matrix.task.name }}.log 2>/dev/null || echo 'Unknown error')
          node -e "
          import('./scripts/notion_sync.js').then(m =>
            m.updateStatus('${{ matrix.task.id }}', 'Error', {
              error: \`\${ERROR_LOG}\`.substring(0, 2000)
            })
          )"

  notify:
    needs: execute-tasks
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Slack Notification
        uses: slackapi/slack-github-action@v1.27.0
        with:
          payload: |
            {
              "text": "🤖 Notion AIバッチ処理完了",
              "blocks": [
                {
                  "type": "header",
                  "text": {
                    "type": "plain_text",
                    "text": "Notion連携バッチ処理完了"
                  }
                },
                {
                  "type": "section",
                  "fields": [
                    {
                      "type": "mrkdwn",
                      "text": "*ステータス:*\n${{ needs.execute-tasks.result }}"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*リポジトリ:*\n<${{ github.server_url }}/${{ github.repository }}|${{ github.repository }}>"
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
# リポジトリのscriptsディレクトリで実行
cd scripts
npm install
```

### 3-2. ローカルテスト

```bash
# Notion接続テスト
export NOTION_TOKEN="your-token"
export NOTION_DATABASE_ID="your-db-id"
node scripts/notion_sync.js
```

### 3-3. Notion でタスク作成

| タスク名    | プロンプト                                                  | ステータス |
| ----------- | ----------------------------------------------------------- | ---------- |
| hello-world | console.log で Hello World を出力する JavaScript 関数を作成 | Ready      |

### 3-4. 手動実行

1. GitHub Actions → "Notion Poller" → "Run workflow"
2. 実行ログ確認
3. Notion のステータス変化確認
4. PR が作成されたか確認
5. Slack 通知確認

---

## 手順 4: 運用開始

### 4-1. cron 有効化

- ポーリングワークフローが自動的に 5 分おきに実行される
- Ready 状態のタスクがあれば自動実行

### 4-2. タスク追加フロー

1. Notion でタスク追加
2. ステータスを"Ready"に変更
3. 最大 5 分待機
4. 自動実行開始
5. 完了したら Slack 通知
6. Notion で PR リンク確認
7. GitHub でレビュー

### 4-3. エラー時の対応

1. Notion でステータス="Error"を確認
2. エラー内容欄を確認
3. 修正してステータスを"Ready"に戻す
4. 再実行

---

## トラブルシューティング

### Notion から取得できない

- Integration token を確認
- データベースに Connection が追加されているか確認
- データベース ID が正しいか確認

### ワークフローが起動しない

- cron が有効か確認（main ブランチにマージ必要）
- Ready 状態のタスクがあるか確認
- GitHub Actions の実行履歴確認

### PR が作成されない

- ブランチ名の重複確認
- GitHub token の権限確認

---

## 次のステップ

1. **優先度対応**: Notion に優先度フィールド追加
2. **コスト追跡**: API 使用量を Notion に記録
3. **Webhook 化**: リアルタイム実行対応
4. **レビュー自動化**: AI 生成コードの自動テスト

完了です！
