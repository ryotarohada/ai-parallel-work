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
