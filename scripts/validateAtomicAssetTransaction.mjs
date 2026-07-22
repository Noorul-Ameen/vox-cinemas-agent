#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAtomicAssetTransaction } from "./lib/atomicAssetTransaction.mjs";

const directory = await mkdtemp(join(tmpdir(), "voxi-atomic-assets-"));
const paths = (name) => ({
  current: join(directory, `${name}.current`),
  next: join(directory, `${name}.next`),
  backup: join(directory, `${name}.backup`),
});
const schedule = paths("schedule");
const information = paths("information");

try {
  await Promise.all([
    writeFile(schedule.current, "old schedule", "utf8"),
    writeFile(information.current, "old information", "utf8"),
    writeFile(schedule.next, "new schedule", "utf8"),
    writeFile(information.next, "new information", "utf8"),
  ]);

  let injected = false;
  const failedTransaction = createAtomicAssetTransaction([
    [schedule.current, schedule.next, schedule.backup],
    [information.current, information.next, information.backup],
  ], {
    renamePath: async (from, to) => {
      if (!injected && from === information.next) {
        injected = true;
        throw new Error("injected promotion failure");
      }
      await rename(from, to);
    },
  });
  await assert.rejects(failedTransaction.promote(), /injected promotion failure/);
  await failedTransaction.rollback();
  assert.equal(await readFile(schedule.current, "utf8"), "old schedule");
  assert.equal(await readFile(information.current, "utf8"), "old information");
  assert.equal(existsSync(schedule.backup), false);
  assert.equal(existsSync(information.backup), false);

  await Promise.all([
    writeFile(schedule.next, "new schedule", "utf8"),
    writeFile(information.next, "new information", "utf8"),
  ]);
  const successfulTransaction = createAtomicAssetTransaction([
    [schedule.current, schedule.next, schedule.backup],
    [information.current, information.next, information.backup],
  ]);
  await successfulTransaction.promote();
  await successfulTransaction.commit();
  assert.equal(await readFile(schedule.current, "utf8"), "new schedule");
  assert.equal(await readFile(information.current, "utf8"), "new information");
  assert.equal(existsSync(schedule.backup), false);
  assert.equal(existsSync(information.backup), false);
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log("Validated multi-asset promotion rollback and successful commit cleanup.");
