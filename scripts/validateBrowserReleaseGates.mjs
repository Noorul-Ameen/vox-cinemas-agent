import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [
  config,
  deterministicSpec,
  hostedSpec,
  crossBrowserSpec,
  validationWorkflow,
  hostedWorkflow,
  packageJson,
  viteConfig,
  hostedWaiter,
  retryableLazy,
  appSource,
] = await Promise.all([
  read("playwright.config.js"),
  read("e2e/voxi-widget.spec.js"),
  read("e2e/hosted-smoke.spec.js"),
  read("e2e/cross-browser-text.spec.js"),
  read(".github/workflows/validate.yml"),
  read(".github/workflows/hosted-smoke.yml"),
  read("package.json"),
  read("vite.config.js"),
  read("scripts/waitForHostedSnapshot.mjs"),
  read("src/components/RetryableLazy.jsx"),
  read("src/App.jsx"),
]);

assert.match(config, /PLAYWRIGHT_BASE_URL/, "Playwright must support a hosted base URL.");
assert.match(config, /webServer:\s*hostedBaseUrl[\s\S]*undefined/, "A hosted run must not start the local preview server.");
assert.match(config, /name:\s*"firefox-text"[\s\S]*Desktop Firefox/, "Firefox must run the typed cross-browser journey.");
assert.match(config, /name:\s*"webkit-safari-engine-text"[\s\S]*Desktop Safari/, "WebKit must provide Safari-engine typed journey coverage.");

for (const requiredGate of [
  /CSP console violation/,
  /420px widget/,
  /FORBIDDEN_DASH_PATTERN/,
  /microphone denial is recoverable/,
  /checkout review saves a device-local summary/,
  /typed cancellation stays in the booking flow/,
  /bank offers render detailed FAB guidance/,
  /corrupt booking storage fails closed/,
  /unsafe booking field types fails closed/,
  /unsupported stored booking currency fails closed/,
  /corrupt nested release recovery fails closed/,
  /invalid recovered discovery date and time fields fail closed/,
  /malformed paused journey recovery fails closed/,
  /empty-stage release recovery retains an FAQ-only transcript/,
  /release recovery retains an active discovery question/,
  /denied booking storage stays fail-closed/,
  /lazy offer chunk rollover refreshes the release/,
  /browser back and forward preserve/,
  /اعرض حجوزاتي/,
]) {
  assert.match(deterministicSpec, requiredGate, `Missing deterministic browser gate: ${requiredGate}`);
}
assert.match(deterministicSpec, /routeWebSocket[\s\S]*elevenlabs/, "Deterministic tests must block live ElevenLabs transport.");
assert.match(deterministicSpec, /src\/components\/OffersPanel\.jsx/, "The stale chunk gate must resolve OffersPanel from the current manifest.");
assert.match(deterministicSpec, /waitForEvent\("framenavigated"[\s\S]*Try again/, "The stale chunk gate must prove that a newer release triggers a page refresh.");
assert.match(deterministicSpec, /Release rollover must trigger exactly one top-level reload/, "The stale chunk gate must prove a controlled reload.");
assert.match(deterministicSpec, /A stale entry document must never import a new release module in place/, "The stale chunk gate must reject mixed-release module execution.");
assert.match(deterministicSpec, /voxi_release_journey_recovery/, "The stale chunk gate must prove that session-scoped recovery state is consumed.");
assert.match(deterministicSpec, /failed recovery write must not reload/, "The stale chunk gate must prove that blocked session storage cannot destroy the active journey.");

assert.match(hostedSpec, /PLAYWRIGHT_HOSTED_SMOKE/, "Hosted smoke must require an explicit opt-in.");
assert.match(hostedSpec, /SNAPSHOT_VERSION/, "Hosted smoke must assert the exact snapshot marker.");
assert.match(hostedSpec, /release\.commit[\s\S]*expectedCommit/, "Hosted smoke must assert the exact deployed commit.");
assert.match(hostedSpec, /anything is fine[\s\S]*Choose a movie/, "Hosted smoke must complete a core typed discovery journey.");
assert.match(hostedSpec, /status\(\)\)\.toBe\(404\)/, "Hosted smoke must require a 404 for a missing shard.");
assert.match(hostedSpec, /text\\\/html/, "Hosted smoke must require the custom HTML 404.");
assert.match(hostedSpec, /no-store/, "Hosted smoke must require no-store on snapshot responses.");
assert.match(hostedSpec, /The requested Voxi resource is not available/, "Hosted smoke must assert the custom missing-resource marker.");

for (const requiredCrossBrowserGate of [
  /Show me movies tomorrow at Mall of the Emirates after 7 PM/,
  /Choose \$\{movieTitle\}/,
  /Select seats \$\{seatLabels\[0\]\} and \$\{seatLabels\[1\]\}/,
  /تابع بالعربية/,
  /العودة إلى مراجعة إتمام الحجز/,
  /widget must not overflow/,
]) {
  assert.match(crossBrowserSpec, requiredCrossBrowserGate, `Missing cross-browser typed gate: ${requiredCrossBrowserGate}`);
}

assert.match(validationWorkflow, /upload-artifact/, "Validation CI must upload Playwright artifacts.");
for (const [name, source] of [
  ["validation", validationWorkflow],
  ["hosted smoke", hostedWorkflow],
]) {
  const officialActionReferences = [...source.matchAll(/uses:\s*(actions\/[^@\s]+)@([^\s#]+)/gu)];
  assert.ok(officialActionReferences.length >= 3, `${name} CI must declare its official setup actions.`);
  for (const [, action, revision] of officialActionReferences) {
    assert.match(revision, /^[0-9a-f]{40}$/u, `${name} CI ${action} must be pinned to an immutable full commit SHA.`);
  }
  assert.match(
    source,
    /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a\s+# v7\.0\.1/u,
    `${name} CI must use the Node.js 24 artifact uploader.`,
  );
}
assert.match(hostedWorkflow, /workflow_run:/, "Hosted smoke must be able to follow a successful validation run.");
assert.match(hostedWorkflow, /waitForHostedSnapshot/, "Hosted smoke must wait for the matching Cloudflare snapshot.");
assert.match(hostedWorkflow, /PLAYWRIGHT_BASE_URL:\s*https:\/\/voxi-ai\.pages\.dev/, "Hosted smoke must target the production Cloudflare URL.");
assert.match(hostedWorkflow, /EXPECTED_RELEASE_COMMIT:\s*\$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.sha \}\}/, "Hosted smoke must bind to the validated commit.");
assert.match(viteConfig, /CF_PAGES_COMMIT_SHA[\s\S]*release\.json[\s\S]*snapshotVersion/, "The production build must emit a commit and snapshot release marker.");
assert.match(viteConfig, /manifest:\s*"asset-manifest\.json"/, "The production build must emit a current lazy-asset manifest.");
assert.match(hostedWaiter, /expectedCommit[\s\S]*release\.json[\s\S]*snapshotVersion[\s\S]*SNAPSHOT_VERSION/, "The hosted waiter must require the exact commit and snapshot.");
assert.match(retryableLazy, /failed\.pathname !== chunk\.pathname[\s\S]*onStaleVersion[\s\S]*reloadImpl/, "A stale lazy chunk must preserve state and refresh to the current release.");
assert.match(retryableLazy, /preserved !== true[\s\S]*active journey could not be preserved/, "A release refresh must require an explicit successful recovery write.");
assert.match(retryableLazy, /VOXI_RELEASE_RECOVERY_FAILED[\s\S]*recoveryChunkUrl[\s\S]*chunkUrl/, "A failed recovery write must retain the stale chunk context for a safe retry.");
assert.match(appSource, /voxi_release_journey_recovery[\s\S]*takeReleaseJourneyRecovery[\s\S]*saveReleaseJourneyRecovery/, "The app must keep a bounded session-scoped release recovery record.");
assert.match(appSource, /RELEASE_RECOVERABLE_STAGE_VIEWS = new Set\(\[[\s\S]*"empty"[\s\S]*"discovery"/, "Release recovery must retain safe FAQ-only transcripts and active discovery questions.");
assert.match(appSource, /isSafeReleaseRecoveryStage[\s\S]*isSafeReleaseRecoveryMovie[\s\S]*isSafeReleaseRecoveryTransaction/, "Release recovery must validate nested render data before hydration.");
assert.match(appSource, /isSafeReleaseJourneyRecoveryRecord\(recovery, recovery\.savedAt\)[\s\S]*sessionStorage\.setItem/, "Unsupported release recovery state must not authorize a reload.");
assert.match(appSource, /preferredTime[\s\S]*timeRangeStart[\s\S]*timeRangeEnd[\s\S]*isReleaseRecoveryCalendarDate\(preferences\.date\)/, "Recovered discovery time and date fields must be render-safe.");
assert.match(appSource, /isReleaseRecoveryCurrency[\s\S]*isSafeReleaseRecoveryTransaction/, "Recovered transaction currencies must be constrained before formatting.");
assert.match(appSource, /onStaleVersion=\{preserveJourneyForReleaseReload\}/, "Lazy release refreshes must receive the active journey recovery callback.");

const scripts = JSON.parse(packageJson).scripts || {};
for (const installScript of ["pretest:e2e", "pretest:e2e:cross-browser", "pretest:e2e:hosted"]) {
  assert.equal(
    scripts[installScript],
    "playwright install --with-deps chromium firefox webkit",
    `${installScript} must provision Chromium, Firefox, WebKit, and their host dependencies.`,
  );
}
assert.equal(
  scripts["test:e2e"],
  "playwright test e2e/voxi-widget.spec.js e2e/voxi-accessibility.spec.js e2e/cross-browser-text.spec.js",
  "The default browser suite must include deterministic, accessibility, and cross-browser text coverage.",
);
assert.equal(scripts["test:e2e:cross-browser"], "playwright test e2e/cross-browser-text.spec.js", "Cross-browser text coverage must remain directly runnable.");
assert.equal(scripts["test:e2e:hosted"], "playwright test e2e/hosted-smoke.spec.js e2e/cross-browser-text.spec.js", "Hosted tests must include release smoke and cross-browser text coverage.");
assert.match(scripts.validate || "", /validateAccessibility\.mjs/, "The main validation command must include accessibility source checks.");

console.log("Validated deterministic and hosted browser release gates.");
