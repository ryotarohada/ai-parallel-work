# Notion × GitHub × Claude Code 自動実装システム 実装手順書

本書は **Notion を起点に Ready タスクを検知し、GitHub Issue を自動生成 → @claude コメントで Claude Code を起動 → PR 作成 → Slack 通知** までを自動化する仕組みの **実装者向け手順書** である。

---

## 1. 全体構成

```
Notion Database
  ↓ (5分ポーリング)
GitHub Actions : notion-poller
  ↓
GitHub Issue + @claude コメント
  ↓ (issue_comment)
GitHub Actions : claude-code
  ↓
Pull Request 作成
  ↓
Notion 更新 / Slack 通知
```

---

## 2. Notion セットアップ

### 2.1 Integration

- Internal Integration を作成
- 権限: Read / Update / Insert
- Token を控える

### 2.2 データベース設計

| プロパティ名 | タイプ | 設定                                      |
| ------------ | ------ | ----------------------------------------- |
| タスク名     | Title  | -                                         |
| プロンプト   | Text   | Claude Code への実装指示                  |
| ステータス   | Select | Todo, Ready, Running, Review, Done, Error |
| PR URL       | URL    | -                                         |
| 実行日時     | Date   | -                                         |
| エラー内容   | Text   | -                                         |

---|---|---|
| タスク名 | Title | Issue タイトル |
| Goal | Text | 目的 |
| Requirements | Text | 実装要件 |
| OutOfScope | Text | 非対象 |
| Status | Select | Todo / Ready / Running / Review / Done / Error |
| GitHub Issue URL | URL | 冪等性担保 |
| PR URL | URL | 成果物 |
| Error | Text | エラー内容 |

---

## 3. GitHub Secrets

```
NOTION_TOKEN
NOTION_DATABASE_ID
ANTHROPIC_API_KEY
SLACK_WEBHOOK_URL
```

---

## 4. ディレクトリ構成

```
.github/
  workflows/
    notion-poller.yml
    claude-code.yml
scripts/
  package.json
  notion.js
```

---

## 5. scripts 実装

### 5.1 package.json

```json
{
  "name": "notion-claude-automation",
  "type": "module",
  "dependencies": {
    "@notionhq/client": "^2.2.15",
    "@actions/github": "^6.0.0"
  }
}
```

### 5.2 Notion 操作スクリプト（scripts/notion.js）

```js
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

export async function fetchReadyTasks(limit = 3) {
  const res = await notion.databases.query({
    database_id: databaseId,
    filter: { property: "ステータス", select: { equals: "Ready" } },
    page_size: limit,
  });

  return res.results.map((p) => ({
    id: p.id,
    title: p.properties["タスク名"].title[0]?.plain_text ?? "Untitled",
    prompt: p.properties["プロンプト"].rich_text[0]?.plain_text ?? "",
  }));
}

export async function updatePage(id, props) {
  await notion.pages.update({ page_id: id, properties: props });
}
```

---

## 6. Workflow① Notion Poller

### .github/workflows/notion-poller.yml

```yaml
name: Notion Poller

on:
  schedule:
    - cron: "*/5 * * * *"
  workflow_dispatch:

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install
        working-directory: scripts

      - name: Fetch tasks and create issues
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          node <<'EOF'
          import { fetchReadyTasks, updatePage } from './scripts/notion.js';
          import { Octokit } from '@actions/github';

          const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
          const tasks = await fetchReadyTasks();

          for (const t of tasks) {
            const body = `# 実装指示\n\n${t.prompt}`;

            const issue = await octokit.rest.issues.create({
              owner: process.env.GITHUB_REPOSITORY.split('/')[0],
              repo: process.env.GITHUB_REPOSITORY.split('/')[1],
              title: t.title,
              body
            });

            await octokit.rest.issues.createComment({
              owner: issue.data.user.login,
              repo: issue.data.html_url.split('/')[4],
              issue_number: issue.data.number,
              body: '@claude\nIssue冒頭の実装指示に従って実装し、PRを作成してください。'
            });

            await updatePage(t.id, {
  ステータス: { select: { name: 'Running' } },
  '実行日時': { date: { start: new Date().toISOString() } }
});
          }
          EOF
```

---

## 7. Workflow② Claude Code

### .github/workflows/claude-code.yml

```yaml
name: Claude Code

on:
  issue_comment:
    types: [created]

jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: anthropics/claude-code-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Slack Notify
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Claude Code 実行完了: ${{ github.event.issue.html_url }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 8. 動作フロー

1. Notion でタスク作成（Status=Ready）
2. 最大 5 分で GitHub Issue 自動生成
3. @claude コメントにより Claude Code 起動
4. PR 作成
5. Slack 通知
6. Notion を Review / Error に更新（拡張可）

---

## 9. 運用上の注意

- 同時実行数は Notion 側で Ready 件数を制限
- Issue は 1 タスク = 1 PR
- Claude の仕様逸脱防止は Issue 構造で担保

---

## 10. 完了

本手順により、Notion を起点とした Claude Code 自動実装パイプラインが構築される。
