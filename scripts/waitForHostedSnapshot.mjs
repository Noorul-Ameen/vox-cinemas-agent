import {
  SNAPSHOT_ASSET_STATS,
  SNAPSHOT_BASE_PATH,
  SNAPSHOT_VERSION,
} from "../src/generated/voxSnapshotManifest.js";

const baseUrl = String(process.env.PLAYWRIGHT_BASE_URL || "").trim().replace(/\/+$/, "");
const expectedCommit = String(process.env.EXPECTED_RELEASE_COMMIT || "").trim().toLowerCase();
const timeoutMs = Number(process.env.HOSTED_DEPLOY_TIMEOUT_MS || 15 * 60 * 1000);
const pollMs = Number(process.env.HOSTED_DEPLOY_POLL_MS || 10 * 1000);

if (!/^https:\/\//i.test(baseUrl)) {
  throw new Error("PLAYWRIGHT_BASE_URL must be an HTTPS hosted URL.");
}
if (!/^[a-f0-9]{7,64}$/.test(expectedCommit)) {
  throw new Error("EXPECTED_RELEASE_COMMIT must be a git commit hash.");
}
if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
  throw new Error("HOSTED_DEPLOY_TIMEOUT_MS must be a positive number.");
}
if (!Number.isFinite(pollMs) || pollMs < 1) {
  throw new Error("HOSTED_DEPLOY_POLL_MS must be a positive number.");
}

const snapshotUrl = `${baseUrl}${SNAPSHOT_BASE_PATH}/${SNAPSHOT_ASSET_STATS.largestShardPath}`;
const releaseUrl = `${baseUrl}/release.json`;
const deadline = Date.now() + timeoutMs;
let lastResult = "No response received.";

while (Date.now() < deadline) {
  try {
    const releaseResponse = await fetch(`${releaseUrl}?release-wait=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const releaseContentType = releaseResponse.headers.get("content-type") || "";
    if (releaseResponse.status !== 200 || !/^application\/json\b/i.test(releaseContentType)) {
      lastResult = `Release marker returned HTTP ${releaseResponse.status} with content type ${releaseContentType || "not supplied"}.`;
      throw new Error(lastResult);
    }

    const release = await releaseResponse.json();
    const hostedCommit = String(release?.commit || "").trim().toLowerCase();
    if (hostedCommit !== expectedCommit || release?.snapshotVersion !== SNAPSHOT_VERSION) {
      lastResult = `Release marker returned commit ${hostedCommit || "not supplied"} and snapshot ${String(release?.snapshotVersion || "not supplied")}.`;
      throw new Error(lastResult);
    }

    const snapshotResponse = await fetch(`${snapshotUrl}?release-wait=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const snapshotContentType = snapshotResponse.headers.get("content-type") || "";
    if (snapshotResponse.status === 200 && /^application\/json\b/i.test(snapshotContentType)) {
      const payload = await snapshotResponse.json();
      if (payload?.version === SNAPSHOT_VERSION) {
        console.log(`Hosted commit ${expectedCommit} with snapshot ${SNAPSHOT_VERSION} is available.`);
        process.exit(0);
      }
      lastResult = `Snapshot shard returned version ${String(payload?.version || "not supplied")}.`;
    } else {
      lastResult = `Snapshot shard returned HTTP ${snapshotResponse.status} with content type ${snapshotContentType || "not supplied"}.`;
    }
  } catch (error) {
    if (lastResult === "No response received.") {
      lastResult = error instanceof Error ? error.message : String(error);
    }
  }

  console.log(`Waiting for hosted commit ${expectedCommit} and snapshot ${SNAPSHOT_VERSION}. Last result: ${lastResult}`);
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}

throw new Error(`Hosted commit ${expectedCommit} with snapshot ${SNAPSHOT_VERSION} was not available before timeout. Last result: ${lastResult}`);
