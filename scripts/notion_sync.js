import { Client } from "@notionhq/client";
import { Octokit } from "@octokit/rest";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const databaseId = process.env.NOTION_DATABASE_ID;
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

// Ready状態のタスク取得
async function getReadyTasks(limit = 3) {
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: "ステータス",
      select: { equals: "Ready" },
    },
    page_size: limit,
  });

  return response.results.map((page) => ({
    id: page.id,
    title: page.properties["タスク名"].title[0]?.plain_text || "unnamed",
    prompt: page.properties["プロンプト"].rich_text[0]?.plain_text || "",
  }));
}

// Notion 更新
async function updateStatus(pageId, status, updates = {}) {
  const properties = {
    ステータス: { select: { name: status } },
  };

  if (updates.executedAt) {
    properties["実行日時"] = { date: { start: updates.executedAt } };
  }

  if (updates.error) {
    properties["エラー内容"] = {
      rich_text: [{ text: { content: updates.error.slice(0, 2000) } }],
    };
  }

  await notion.pages.update({
    page_id: pageId,
    properties,
  });
}

// メイン処理
async function poll() {
  const tasks = await getReadyTasks();

  if (tasks.length === 0) {
    console.log("No Ready tasks");
    return;
  }

  const now = new Date().toISOString();

  for (const task of tasks) {
    try {
      // Issue作成
      const issue = await octokit.rest.issues.create({
        owner,
        repo,
        title: task.title,
        body: `# 実装指示\n\n${task.prompt}`,
      });

      // @claude コメント
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issue.data.number,
        body: `@claude\nIssue冒頭の実装指示に従って実装し、PRを作成してください。`,
      });

      // Notion を Running に更新
      await updateStatus(task.id, "Running", { executedAt: now });

      console.log(`Created issue: ${issue.data.html_url}`);
    } catch (err) {
      await updateStatus(task.id, "Error", {
        error: err.message,
      });
    }
  }
}

// CLI
if (process.argv[2] === "poll") {
  await poll();
}
