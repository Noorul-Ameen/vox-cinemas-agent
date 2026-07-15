#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stamp = `${Date.now()}-${process.pid}`;
const currentJson = resolve(root, "data/vox_showtimes_full.json");
const currentModule = resolve(root, "src/mockVistaData.js");
const nextJson = resolve(root, `data/.vox_showtimes_full.next-${stamp}.json`);
const nextModule = resolve(root, `src/.mockVistaData.next-${stamp}.js`);
const backupJson = resolve(root, `data/.vox_showtimes_full.backup-${stamp}.json`);
const backupModule = resolve(root, `src/.mockVistaData.backup-${stamp}.js`);
const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const packageManager = process.env.npm_execpath
  ? { command: process.execPath, prefix: [process.env.npm_execpath] }
  : { command: process.platform === "win32" ? "npm.cmd" : "npm", prefix: [] };

function run(command, args, label) {
  console.error(`\n[refresh] ${label}`);
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: root, env: process.env, stdio: "inherit" });
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${label} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`));
    });
  });
}

async function runPackageScript(name) {
  return run(packageManager.command, [...packageManager.prefix, "run", name], `npm run ${name}`);
}

async function removeTemporaryFiles() {
  await Promise.all([nextJson, nextModule].map((path) => rm(path, { force: true }).catch(() => {})));
}

const mediaKey = (item) => String(item?.code || item?.slug || item?.name || "").trim().toLowerCase();

function mergeOfficialMedia(previousItems = [], nextItems = []) {
  const merged = new Map();
  for (const item of previousItems) {
    const key = mediaKey(item);
    if (key) merged.set(key, item);
  }
  for (const item of nextItems) {
    const key = mediaKey(item);
    if (key) merged.set(key, item);
  }
  return [...merged.values()];
}

async function retainPreviouslyVerifiedMedia() {
  if (!existsSync(currentJson)) return;
  const [previous, next] = await Promise.all([
    readFile(currentJson, "utf8").then(JSON.parse),
    readFile(nextJson, "utf8").then(JSON.parse),
  ]);
  const freshExperienceKeys = new Set((next.experienceMedia || []).map(mediaKey).filter(Boolean));
  const freshOfferKeys = new Set((next.offerMedia || []).map(mediaKey).filter(Boolean));
  next.experienceMedia = mergeOfficialMedia(previous.experienceMedia, next.experienceMedia);
  next.offerMedia = mergeOfficialMedia(previous.offerMedia, next.offerMedia);
  next.crawl = {
    ...next.crawl,
    retainedExperienceMediaCount: next.experienceMedia.filter((item) => !freshExperienceKeys.has(mediaKey(item))).length,
    retainedOfferMediaCount: next.offerMedia.filter((item) => !freshOfferKeys.has(mediaKey(item))).length,
  };
  await writeFile(nextJson, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

async function restoreBackups() {
  await rm(currentJson, { force: true }).catch(() => {});
  await rm(currentModule, { force: true }).catch(() => {});
  if (existsSync(backupJson)) await rename(backupJson, currentJson);
  if (existsSync(backupModule)) await rename(backupModule, currentModule);
}

let promoted = false;
try {
  const extractorArgs = [
    resolve(root, "scripts/extractVoxShowtimes.mjs"),
    "--output", nextJson,
    "--max-days", process.env.VOX_REFRESH_MAX_DAYS || "31",
    "--workers", process.env.VOX_REFRESH_WORKERS || "2",
  ];
  await run(process.execPath, extractorArgs, "extract official VOX UAE schedule");
  await retainPreviouslyVerifiedMedia();
  await run(process.execPath, [resolve(root, "scripts/validateShowtimeRefresh.mjs"), nextJson, currentJson], "validate freshness and completeness");
  await run(python, [resolve(root, "convert_extraction.py"), nextJson, nextModule], "generate Vista-shaped browser data");

  const generated = await import(`${pathToFileURL(nextModule).href}?refresh=${stamp}`);
  if (!generated.DATA_DATES?.length || !generated.SESSIONS?.length || !generated.FILMS?.length) {
    throw new Error("generated browser data is incomplete");
  }

  await rename(currentJson, backupJson);
  await rename(currentModule, backupModule);
  await rename(nextJson, currentJson);
  await rename(nextModule, currentModule);
  promoted = true;

  await runPackageScript("validate");
  await runPackageScript("build");
  await Promise.all([backupJson, backupModule].map((path) => rm(path, { force: true })));
  console.error("\n[refresh] Fresh official VOX schedule validated and promoted successfully.");
} catch (error) {
  if (promoted) await restoreBackups();
  console.error(`\n[refresh] Refresh was not published: ${error.message}`);
  process.exitCode = 1;
} finally {
  await removeTemporaryFiles();
  if (!promoted || process.exitCode) {
    await Promise.all([backupJson, backupModule].map((path) => rm(path, { force: true }).catch(() => {})));
  }
}
