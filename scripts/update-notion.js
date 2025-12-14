import { Client } from '@notionhq/client';

export default async function updateNotionStatus({ 
  notionToken, 
  databaseId, 
  issueTitle, 
  prUrl, 
  status = 'Review' 
}) {
  try {
    const notion = new Client({ auth: notionToken });

    console.log(`Searching for Notion page with title: "${issueTitle}"`);

    // IssueタイトルでNotionページを検索
    const dbResponse = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'タスク名',
        title: { equals: issueTitle }
      }
    });

    if (dbResponse.results.length === 0) {
      console.warn('⚠️ No matching Notion page found');
      return false;
    }

    const pageId = dbResponse.results[0].id;
    console.log(`Found Notion page: ${pageId}`);

    // ステータスとPR URLを更新
    const properties = {
      'ステータス': { select: { name: status } }
    };

    if (prUrl) {
      properties['PR URL'] = { url: prUrl };
    }

    await notion.pages.update({
      page_id: pageId,
      properties
    });

    console.log(`✅ Notion updated: Status=${status}, PR URL=${prUrl}`);
    return true;
  } catch (error) {
    console.error('❌ Notion update failed:', error.message);
    throw error;
  }
}