import { execSync } from 'child_process';

export default async function createPR({ github, context, core }) {
  try {
    // 現在のブランチ名を取得
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    
    if (currentBranch === 'main') {
      console.log('Already on main branch, skipping PR creation');
      return null;
    }

    console.log(`Creating PR from branch: ${currentBranch}`);

    // PR作成
    const { data: pr } = await github.rest.pulls.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: `AI Implementation: ${context.payload.issue.title}`,
      head: currentBranch,
      base: 'main',
      body: `Closes #${context.payload.issue.number}

## 🤖 自動実装による変更

${context.payload.issue.body}

---
*Claude Code により自動実装されました*`
    });

    console.log(`✅ PR created: ${pr.html_url}`);
    core.setOutput('pr_url', pr.html_url);
    core.setOutput('pr_number', pr.number);
    
    return pr.html_url;
  } catch (error) {
    console.error('❌ PR creation failed:', error.message);
    core.setFailed(`PR creation failed: ${error.message}`);
    throw error;
  }
}