import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowUrl = new URL("../.github/workflows/refresh-vox-showtimes.yml", import.meta.url);
const readmeUrl = new URL("../README.md", import.meta.url);
const workflow = await readFile(workflowUrl, "utf8");
const readme = await readFile(readmeUrl, "utf8");

const cronExpressions = [...workflow.matchAll(/-\s+cron:\s*["']([^"']+)["']/g)]
  .map((match) => match[1].trim());

const parseCron = (expression) => {
  const fields = expression.split(/\s+/);
  assert.equal(fields.length, 5, `refresh cron must contain five fields: ${expression}`);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  assert.match(minute, /^\d{1,2}$/, `refresh minute must be fixed: ${expression}`);
  assert.match(hour, /^\d{1,2}$/, `refresh hour must be fixed: ${expression}`);
  const minuteNumber = Number(minute);
  const hourNumber = Number(hour);
  assert.ok(minuteNumber >= 0 && minuteNumber <= 59, `refresh minute is invalid: ${expression}`);
  assert.ok(hourNumber >= 0 && hourNumber <= 23, `refresh hour is invalid: ${expression}`);
  return {
    expression,
    minute: minuteNumber,
    hour: hourNumber,
    dayOfMonth,
    month,
    dayOfWeek,
    uaeMinutes: ((hourNumber + 4) % 24) * 60 + minuteNumber,
  };
};

const schedules = cronExpressions.map(parseCron);
assert.ok(schedules.length >= 2, "showtime refresh needs a daily run plus a useful redundant run");

const daily = schedules.find((schedule) => (
  schedule.dayOfMonth === "*"
  && schedule.month === "*"
  && schedule.dayOfWeek === "*"
));
assert.ok(daily, "showtime refresh must include one daily schedule");

const PROGRAMMING_DAY_CUTOFF_MINUTES = 6 * 60;
const SAFE_SETTLING_WINDOW_MINUTES = 30;
assert.ok(
  daily.uaeMinutes >= PROGRAMMING_DAY_CUTOFF_MINUTES + SAFE_SETTLING_WINDOW_MINUTES,
  `daily refresh must start at least 30 minutes after 06:00 UAE, received ${daily.expression}`,
);
assert.ok(
  daily.uaeMinutes <= 8 * 60,
  `daily refresh should remain early enough for useful same-morning data, received ${daily.expression}`,
);

const thursdayRedundancy = schedules.find((schedule) => (
  schedule.dayOfMonth === "*"
  && schedule.month === "*"
  && schedule.dayOfWeek === "4"
  && schedule.expression !== daily.expression
));
assert.ok(thursdayRedundancy, "showtime refresh must retain a distinct Thursday redundancy check");
assert.ok(
  thursdayRedundancy.uaeMinutes > daily.uaeMinutes,
  "the Thursday redundancy check must run later than the daily post-cutoff refresh",
);

assert.equal(daily.expression, "30 2 * * *", "daily refresh must run at 02:30 UTC, which is 06:30 UAE");
assert.equal(thursdayRedundancy.expression, "30 6 * * 4", "Thursday redundancy must run at 06:30 UTC, which is 10:30 UAE");
assert.match(workflow, /30 minutes after the 06:00 programming-day cutoff/, "workflow must document why the daily time is safe");
assert.match(readme, /02:30 UTC, which is 06:30 UAE/, "README must document the daily UTC and UAE times");
assert.match(readme, /30 minutes after the 06:00 programming-day cutoff/, "README must document the post-cutoff settling window");
assert.match(readme, /Thursday at 06:30 UTC, which is 10:30 UAE/, "README must document the redundant Thursday timing");

const retryCountMatch = workflow.match(/MAX_PUSH_ATTEMPTS:\s*["']?(\d+)["']?/);
assert.ok(retryCountMatch, "refresh publishing must define a fixed retry bound");
const retryCount = Number(retryCountMatch[1]);
assert.ok(retryCount >= 2 && retryCount <= 5, "refresh publishing must use between two and five attempts");
assert.match(
  workflow,
  /for attempt in \$\(seq 1 "\$MAX_PUSH_ATTEMPTS"\)/,
  "refresh publishing must stop at the configured attempt bound",
);
assert.match(workflow, /GIT_TERMINAL_PROMPT:\s*["']0["']/, "git publishing must disable interactive credential prompts");
assert.match(
  workflow,
  /git fetch --no-tags origin refs\/heads\/main:refs\/remotes\/origin\/main/,
  "each publish attempt must update the local origin/main reference explicitly",
);
assert.match(workflow, /git rebase origin\/main/, "each publish attempt must replay the refresh on the latest main branch");
assert.match(workflow, /git rebase --abort/, "a conflicting refresh rebase must be aborted");
assert.match(workflow, /npm run validate(?:\r?\n|$)/, "a clean rebase must rerun the complete repository validator");
assert.match(workflow, /npm run build(?:\r?\n|$)/, "a clean rebase must rerun the production build");
assert.match(workflow, /git diff --check origin\/main\.\.HEAD/, "a clean rebase must check the resulting committed patch");
assert.match(workflow, /git -c credential\.interactive=never push origin HEAD:main/, "publishing must remain non-interactive");
const gitPushLines = workflow
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => /\bgit\b.*\bpush\b/.test(line));
assert.deepEqual(
  gitPushLines,
  ["if git -c credential.interactive=never push origin HEAD:main; then"],
  "refresh publishing must contain only the reviewed push command",
);
for (const line of gitPushLines) {
  assert.doesNotMatch(
    line,
    /(?:--force(?:-with-lease)?|(?:^|\s)-f(?:\s|$))/,
    "refresh publishing must not rewrite remote history",
  );
}

const fetchIndex = workflow.indexOf("git fetch --no-tags origin refs/heads/main:refs/remotes/origin/main");
const rebaseIndex = workflow.indexOf("git rebase origin/main");
const fullValidationIndex = workflow.indexOf("npm run validate", rebaseIndex);
const buildValidationIndex = workflow.indexOf("npm run build", rebaseIndex);
const pushIndex = workflow.indexOf("git -c credential.interactive=never push origin HEAD:main");
assert.ok(
  fetchIndex >= 0
  && rebaseIndex > fetchIndex
  && fullValidationIndex > rebaseIndex
  && buildValidationIndex > fullValidationIndex
  && pushIndex > buildValidationIndex,
  "fetch, rebase, validation, and push must remain in safe order",
);

const permissionsMatch = workflow.match(/^permissions:\s*\r?\n((?: {2}[^\r\n]+\r?\n)+)/m);
assert.ok(permissionsMatch, "workflow must declare explicit permissions");
const permissions = permissionsMatch[1]
  .trim()
  .split(/\r?\n/)
  .map((line) => line.trim())
  .sort();
assert.deepEqual(
  permissions,
  ["contents: write", "issues: write"],
  "workflow permissions must be limited to content and issue writes",
);
assert.match(workflow, /name:\s*Report refresh failure/, "refresh failures must have a repository alert step");
assert.match(workflow, /if:\s*failure\(\)/, "the repository alert must run only after a failure");
assert.match(workflow, /GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/, "failure alerts must use the built-in workflow token");
assert.match(workflow, /gh issue list/, "failure alerting must look for an existing open issue");
assert.match(workflow, /--search '"VOXi automated showtime refresh failed" in:title'/, "failure alerting must search by its stable issue title");
assert.match(workflow, /gh issue comment/, "failure alerting must update an existing issue");
assert.match(workflow, /gh issue create/, "failure alerting must create an issue when none is open");
assert.doesNotMatch(workflow, /secrets\./, "refresh publishing and alerting must not require a repository secret");

console.log(`Validated refresh timing, ${retryCount} bounded publish attempts, conflict revalidation, and repository failure alerts.`);
