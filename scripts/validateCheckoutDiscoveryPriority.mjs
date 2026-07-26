import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

assert.match(
  app,
  /const checkoutFaq = activeCheckout && !preInformationDiscoveryFilterTurn && !localOfferTurn/,
  "voice checkout FAQ routing must yield to an already-detected discovery filter turn",
);
assert.match(
  app,
  /const checkoutFaq = activeCheckout && !preInformationDiscoveryFilterTurn && actionIntent/,
  "typed checkout FAQ routing must yield to an already-detected discovery filter turn",
);

console.log("Validated checkout discovery priority.");
