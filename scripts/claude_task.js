import Anthropic from "@anthropic-ai/sdk";
import { updateStatus } from "./notion_sync.js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const taskId = process.argv[2]; // Notion page ID
const taskName = process.argv[3];
const prompt = process.argv[4];

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  try {
    // プロンプトを拡張してJavaScript実装を要求
    const enhancedPrompt = `${prompt}

実装要件:
- 動作するJavaScriptコードを出力してください
- ES modulesを使用（import/export）
- 適切なJSDocコメント付き
- エラーハンドリング含む
- コードのみを出力し、説明文は不要

ファイル名: ${taskName}.js`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: enhancedPrompt }],
    });

    let result = message.content[0].text;

    // マークダウンのコードブロックを除去
    result = result.replace(/```javascript\n?/g, '').replace(/```\n?/g, '');

    // src/ディレクトリを作成（存在しない場合）
    const srcDir = '../src';
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }

    // src/ディレクトリにJSファイルとして保存
    const outputPath = `${srcDir}/${taskName}.js`;
    fs.writeFileSync(outputPath, result.trim());

    console.log(`Task ${taskName} completed - created ${outputPath}`);
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
