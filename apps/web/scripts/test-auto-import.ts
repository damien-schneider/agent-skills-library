/**
 * Integration test script for auto-import functionality
 * Run with: bun run apps/web/scripts/test-auto-import.ts
 *
 * This script tests the real API endpoints used by the auto-import feature.
 * It does NOT modify the database - it only validates that APIs are accessible
 * and return expected data structures.
 */

const SKILLS_SH_API_URL = "https://skills.sh/api/skills";
const GITHUB_API_URL = "https://api.github.com/repos";
const GITHUB_RAW_URL = "https://raw.githubusercontent.com";
const MARKDOWN_TITLE_REGEX = /^#\s+.+$/m;

const TEST_REPO_OWNER = "vercel-labs";
const TEST_REPO_NAME = "agent-skills";
const TEST_REPO_IDENTIFIER = `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`;

interface SkillsShSkill {
  id: string;
  name: string;
  installs: number;
  topSource: string;
}

interface SkillsShApiResponse {
  skills: SkillsShSkill[];
  hasMore: boolean;
}

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url?: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({
      name,
      passed: true,
      duration: Date.now() - start,
    });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({
      name,
      passed: false,
      duration: Date.now() - start,
      error: errorMessage,
    });
    console.log(`❌ ${name} (${Date.now() - start}ms)`);
    console.log(`   Error: ${errorMessage}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function testSkillsShApiConnection(): Promise<void> {
  const response = await fetch(`${SKILLS_SH_API_URL}?page=1`);
  assert(response.ok, `Expected OK response, got ${response.status}`);

  const data: SkillsShApiResponse = await response.json();
  assert(Array.isArray(data.skills), "Expected skills to be an array");
  assert(data.skills.length > 0, "Expected at least one skill");
  assert(typeof data.hasMore === "boolean", "Expected hasMore to be boolean");
}

async function testSkillsShApiSkillStructure(): Promise<void> {
  const response = await fetch(`${SKILLS_SH_API_URL}?page=1`);
  const data: SkillsShApiResponse = await response.json();

  for (const skill of data.skills.slice(0, 5)) {
    assert(typeof skill.id === "string", "Expected skill.id to be string");
    assert(typeof skill.name === "string", "Expected skill.name to be string");
    assert(
      typeof skill.installs === "number",
      "Expected skill.installs to be number"
    );
    assert(
      typeof skill.topSource === "string",
      "Expected skill.topSource to be string"
    );
  }
}

async function testSkillsShApiPagination(): Promise<void> {
  const page1 = await fetch(`${SKILLS_SH_API_URL}?page=1`);
  const data1: SkillsShApiResponse = await page1.json();

  if (data1.hasMore) {
    const page2 = await fetch(`${SKILLS_SH_API_URL}?page=2`);
    const data2: SkillsShApiResponse = await page2.json();

    assert(Array.isArray(data2.skills), "Page 2 should have skills array");
  }
}

async function testVercelSkillsPresence(): Promise<void> {
  const allSkills: SkillsShSkill[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const response = await fetch(`${SKILLS_SH_API_URL}?page=${page}`);
    const data: SkillsShApiResponse = await response.json();
    allSkills.push(...data.skills);
    hasMore = data.hasMore;
    page++;
  }

  const vercelSkills = allSkills.filter(
    (s) => s.topSource === TEST_REPO_IDENTIFIER
  );
  console.log(
    `   Found ${vercelSkills.length} vercel-labs skills in ${page - 1} pages`
  );
}

async function testGitHubApiConnection(): Promise<void> {
  const response = await fetch(
    `${GITHUB_API_URL}/${TEST_REPO_IDENTIFIER}/contents`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "skills-agent-library-test",
      },
    }
  );

  assert(response.ok, `Expected OK response, got ${response.status}`);

  const contents: GitHubFile[] = await response.json();
  assert(Array.isArray(contents), "Expected contents to be an array");
}

async function testGitHubRateLimitHeaders(): Promise<void> {
  const response = await fetch(
    `${GITHUB_API_URL}/${TEST_REPO_IDENTIFIER}/contents`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "skills-agent-library-test",
      },
    }
  );

  const remaining = response.headers.get("X-RateLimit-Remaining");
  const limit = response.headers.get("X-RateLimit-Limit");

  assert(remaining !== null, "Expected X-RateLimit-Remaining header");
  assert(limit !== null, "Expected X-RateLimit-Limit header");

  const remainingNum = Number.parseInt(remaining as string, 10);
  const limitNum = Number.parseInt(limit as string, 10);

  console.log(`   Rate limit: ${remainingNum}/${limitNum} remaining`);

  if (remainingNum < 10) {
    console.log("   ⚠️  Warning: Low rate limit remaining");
  }
}

async function testRepoStructure(): Promise<void> {
  const response = await fetch(
    `${GITHUB_API_URL}/${TEST_REPO_IDENTIFIER}/contents`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "skills-agent-library-test",
      },
    }
  );

  const contents: GitHubFile[] = await response.json();
  const skillsDir = contents.find(
    (item) => item.type === "dir" && item.name === "skills"
  );

  assert(skillsDir !== undefined, "Expected to find 'skills' directory");
}

async function testSkillsDirectory(): Promise<void> {
  const response = await fetch(
    `${GITHUB_API_URL}/${TEST_REPO_IDENTIFIER}/contents/skills`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "skills-agent-library-test",
      },
    }
  );

  assert(response.ok, `Expected OK response, got ${response.status}`);

  const skillDirs: GitHubFile[] = await response.json();
  const dirs = skillDirs.filter((item) => item.type === "dir");

  assert(dirs.length > 0, "Expected to find skill directories");
  console.log(`   Found ${dirs.length} skill directories`);

  const dirNames = dirs.map((d) => d.name);
  console.log(`   Directories: ${dirNames.join(", ")}`);
}

async function testFetchSkillMarkdown(): Promise<void> {
  const response = await fetch(
    `${GITHUB_RAW_URL}/${TEST_REPO_IDENTIFIER}/main/skills/react-best-practices/SKILL.md`
  );

  assert(response.ok, `Expected OK response, got ${response.status}`);

  const content = await response.text();
  assert(content.length > 50, "Expected SKILL.md to have content");

  const hasTitle = MARKDOWN_TITLE_REGEX.test(content);
  assert(hasTitle, "Expected SKILL.md to have a title");
}

async function testMultipleSkillFiles(): Promise<void> {
  const dirResponse = await fetch(
    `${GITHUB_API_URL}/${TEST_REPO_IDENTIFIER}/contents/skills`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "skills-agent-library-test",
      },
    }
  );

  const skillDirs: GitHubFile[] = await dirResponse.json();
  const dirs = skillDirs.filter((item) => item.type === "dir");

  const fetchResults: { skill: string; length: number; hasTitle: boolean }[] =
    [];

  for (const dir of dirs.slice(0, 3)) {
    const response = await fetch(
      `${GITHUB_RAW_URL}/${TEST_REPO_IDENTIFIER}/main/skills/${dir.name}/SKILL.md`
    );

    if (response.ok) {
      const content = await response.text();
      fetchResults.push({
        skill: dir.name,
        length: content.length,
        hasTitle: MARKDOWN_TITLE_REGEX.test(content),
      });
    }
  }

  assert(fetchResults.length > 0, "Expected to fetch at least one SKILL.md");
  console.log(`   Fetched ${fetchResults.length}/${dirs.length} skill files`);

  for (const r of fetchResults) {
    console.log(
      `   - ${r.skill}: ${r.length} chars, title: ${r.hasTitle ? "yes" : "no"}`
    );
  }
}

async function testGitHubNonExistentRepo(): Promise<void> {
  const response = await fetch(
    `${GITHUB_API_URL}/nonexistent-owner-12345/nonexistent-repo/contents`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "skills-agent-library-test",
      },
    }
  );

  assert(response.status === 404, `Expected 404, got ${response.status}`);
}

async function testEndToEndSkillDiscovery(): Promise<void> {
  console.log("   Step 1: Fetching skills.sh leaderboard...");
  const leaderboardResponse = await fetch(`${SKILLS_SH_API_URL}?page=1`);
  const leaderboard: SkillsShApiResponse = await leaderboardResponse.json();

  const vercelSkillsFromLeaderboard = leaderboard.skills.filter(
    (s) => s.topSource === TEST_REPO_IDENTIFIER
  );
  console.log(
    `   Found ${vercelSkillsFromLeaderboard.length} vercel-labs skills in leaderboard`
  );

  console.log("   Step 2: Fetching GitHub skill directories...");
  const githubResponse = await fetch(
    `${GITHUB_API_URL}/${TEST_REPO_IDENTIFIER}/contents/skills`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "skills-agent-library-test",
      },
    }
  );
  const githubDirs: GitHubFile[] = await githubResponse.json();

  assert(Array.isArray(githubDirs), "Expected githubDirs to be an array");

  const skillDirNames = githubDirs
    .filter((item) => item.type === "dir")
    .map((item) => item.name);
  console.log(`   Found ${skillDirNames.length} skill directories on GitHub`);

  console.log("   Step 3: Fetching SKILL.md for available skills...");
  let fetchedCount = 0;
  for (const skill of skillDirNames.slice(0, 3)) {
    const mdResponse = await fetch(
      `${GITHUB_RAW_URL}/${TEST_REPO_IDENTIFIER}/main/skills/${skill}/SKILL.md`
    );
    if (mdResponse.ok) {
      const content = await mdResponse.text();
      const leaderboardSkill = vercelSkillsFromLeaderboard.find(
        (s) => s.id === skill || s.name.toLowerCase().includes(skill)
      );
      console.log(
        `   - ${skill}: ${content.length} chars${leaderboardSkill ? `, ${leaderboardSkill.installs} installs` : ""}`
      );
      fetchedCount++;
    }
  }

  assert(fetchedCount > 0, "Expected to fetch at least one skill file");
}

async function main(): Promise<void> {
  console.log("\n🧪 Auto-Import Integration Tests\n");
  console.log(`Testing with: ${TEST_REPO_IDENTIFIER}`);
  console.log("=".repeat(60));

  console.log("\n📡 Skills.sh API Tests\n");
  await runTest("skills.sh API connection", testSkillsShApiConnection);
  await runTest("skills.sh skill structure", testSkillsShApiSkillStructure);
  await runTest("skills.sh pagination", testSkillsShApiPagination);
  await runTest("vercel-labs skills presence", testVercelSkillsPresence);

  console.log("\n🐙 GitHub API Tests\n");
  await runTest("GitHub API connection", testGitHubApiConnection);
  await runTest("GitHub rate limit headers", testGitHubRateLimitHeaders);
  await runTest("repo structure", testRepoStructure);
  await runTest("skills directory", testSkillsDirectory);
  await runTest("fetch skill markdown", testFetchSkillMarkdown);
  await runTest("multiple skill files", testMultipleSkillFiles);
  await runTest("non-existent repo handling", testGitHubNonExistentRepo);

  console.log("\n🔄 End-to-End Flow Tests\n");
  await runTest("end-to-end skill discovery", testEndToEndSkillDiscovery);

  console.log(`\n${"=".repeat(60)}`);
  console.log("\n📊 Summary\n");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${totalDuration}ms`);

  if (failed > 0) {
    console.log("\n❌ Failed tests:");
    for (const result of results.filter((r) => !r.passed)) {
      console.log(`   - ${result.name}: ${result.error}`);
    }
    process.exit(1);
  }

  console.log("\n✅ All tests passed!\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
