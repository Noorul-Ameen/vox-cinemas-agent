import { expect, test } from "@playwright/test";
import {
  SNAPSHOT_ASSET_STATS,
  SNAPSHOT_BASE_PATH,
  SNAPSHOT_VERSION,
} from "../src/generated/voxSnapshotManifest.js";

const hostedSmokeEnabled = process.env.PLAYWRIGHT_HOSTED_SMOKE === "1";
const expectedCommit = String(process.env.EXPECTED_RELEASE_COMMIT || "").trim().toLowerCase();
const CSP_CONSOLE_PATTERN = /content security policy|violates? the following content security policy directive|refused to (?:execute|load|connect).*because it violates/iu;

test.describe("hosted Cloudflare release smoke", () => {
  test.skip(!hostedSmokeEnabled, "Set PLAYWRIGHT_HOSTED_SMOKE=1 to run hosted release checks.");

  test("serves the exact snapshot and fail-closed missing shard response", async ({ page, request }) => {
    const cspViolations = [];
    page.on("console", (message) => {
      const text = message.text();
      if (CSP_CONSOLE_PATTERN.test(text)) cspViolations.push(text);
    });
    await page.route(
      /^https:\/\/[^/]*elevenlabs\.(?:io|com)\//i,
      (route) => route.abort("blockedbyclient"),
    );
    await page.routeWebSocket(
      /^wss:\/\/[^/]*elevenlabs\.(?:io|com)\//i,
      (socket) => socket.close(),
    );

    const rootResponse = await page.goto("/");
    expect(rootResponse?.ok()).toBe(true);
    await expect(page.locator(".voxi-widget")).toBeVisible();
    expect(expectedCommit).toMatch(/^[a-f0-9]{7,64}$/);

    const releaseResponse = await request.get(`/release.json?hosted-smoke=${Date.now()}`, {
      failOnStatusCode: false,
    });
    expect(releaseResponse.status()).toBe(200);
    expect(releaseResponse.headers()["content-type"]).toMatch(/^application\/json\b/i);
    const release = await releaseResponse.json();
    expect(String(release.commit || "").toLowerCase()).toBe(expectedCommit);
    expect(release.snapshotVersion).toBe(SNAPSHOT_VERSION);

    await page.getByRole("button", { name: "Choose VOX cinema" }).first().click();
    await expect(page.getByRole("region", { name: "Choose your cinema" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search cinemas" }).fill("Mall of the Emirates");
    await page.getByRole("button", { name: /Mall of the Emirates/ }).click();
    const dateGroup = page.getByRole("group", { name: "Choose a date" });
    const dateButtons = dateGroup.getByRole("button");
    const dateCount = await dateButtons.count();
    expect(dateCount).toBeGreaterThan(0);
    await dateButtons.nth(dateCount > 1 ? 1 : 0).click();

    const input = page.locator("input[aria-label]").last();
    await input.fill("anything is fine");
    await input.press("Enter");
    await expect(page.getByRole("region", { name: "Choose a movie" })).toBeVisible();
    await expect(page.locator('main button:has([aria-label^="Relevant showtimes for "])').first()).toBeVisible();

    const knownShardPath = `${SNAPSHOT_BASE_PATH}/${SNAPSHOT_ASSET_STATS.largestShardPath}`;
    const knownShard = await request.get(knownShardPath, { failOnStatusCode: false });
    expect(knownShard.status()).toBe(200);
    expect(knownShard.headers()["content-type"]).toMatch(/^application\/json\b/i);
    expect(knownShard.headers()["cache-control"]).toMatch(/\bno-store\b/i);
    const knownPayload = await knownShard.json();
    expect(knownPayload.version).toBe(SNAPSHOT_VERSION);

    const missingShard = await request.get(
      `${SNAPSHOT_BASE_PATH}/__missing__/2099-12-31.json?release-gate=${Date.now()}`,
      { failOnStatusCode: false },
    );
    expect(missingShard.status()).toBe(404);
    expect(missingShard.headers()["content-type"]).toMatch(/^text\/html\b/i);
    expect(missingShard.headers()["cache-control"]).toMatch(/\bno-store\b/i);
    expect(await missingShard.text()).toContain("The requested Voxi resource is not available.");
    expect(cspViolations, "The hosted widget must not produce CSP console violations").toEqual([]);
  });
});
