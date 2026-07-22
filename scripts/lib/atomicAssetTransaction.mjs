import { existsSync } from "node:fs";
import { rename, rm } from "node:fs/promises";

function normalizePair(pair) {
  const [currentPath, nextPath, backupPath] = pair;
  if (!currentPath || !nextPath || !backupPath) {
    throw new Error("Atomic asset pairs require current, next, and backup paths");
  }
  return { currentPath, nextPath, backupPath };
}

/**
 * Promote a related set of generated files and directories as one recoverable
 * transaction. A process crash cannot make multiple filesystem renames truly
 * atomic, but every synchronous failure is rolled back without losing the last
 * known-good asset set.
 */
export function createAtomicAssetTransaction(
  assetPairs,
  {
    pathExists = existsSync,
    renamePath = rename,
    removePath = rm,
  } = {},
) {
  const pairs = assetPairs.map(normalizePair);
  const backedUpPaths = new Set();
  const installedPaths = new Set();
  let promotionStarted = false;
  let settled = false;

  const remove = (path) => removePath(path, { recursive: true, force: true });

  async function promote() {
    if (promotionStarted) throw new Error("Atomic asset promotion has already started");
    const missing = pairs.filter(({ nextPath }) => !pathExists(nextPath)).map(({ nextPath }) => nextPath);
    if (missing.length) throw new Error(`Generated assets are missing before promotion: ${missing.join(", ")}`);

    promotionStarted = true;
    for (const { currentPath, backupPath } of pairs) {
      await remove(backupPath);
      if (!pathExists(currentPath)) continue;
      await renamePath(currentPath, backupPath);
      backedUpPaths.add(currentPath);
    }
    for (const { currentPath, nextPath } of pairs) {
      await renamePath(nextPath, currentPath);
      installedPaths.add(currentPath);
    }
  }

  async function rollback() {
    if (settled) return;
    for (const { currentPath } of [...pairs].reverse()) {
      if (installedPaths.has(currentPath)) await remove(currentPath).catch(() => {});
    }
    for (const { currentPath, backupPath } of [...pairs].reverse()) {
      if (!backedUpPaths.has(currentPath)) continue;
      await remove(currentPath).catch(() => {});
      if (pathExists(backupPath)) await renamePath(backupPath, currentPath);
    }
    for (const { backupPath } of pairs) await remove(backupPath).catch(() => {});
    installedPaths.clear();
    backedUpPaths.clear();
    settled = true;
  }

  async function commit() {
    if (!promotionStarted) throw new Error("Cannot commit before promotion");
    if (settled) return;
    for (const { backupPath } of pairs) await remove(backupPath);
    installedPaths.clear();
    backedUpPaths.clear();
    settled = true;
  }

  return {
    commit,
    promote,
    rollback,
    get promotionStarted() {
      return promotionStarted;
    },
  };
}
