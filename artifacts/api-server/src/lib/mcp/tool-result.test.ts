import assert from "node:assert/strict";
import test from "node:test";
import { compactProduct, normalizeProduct } from "./domain";
import {
  errorResult,
  jsonToolResult,
  MAX_TOOL_RESULT_BYTES,
} from "./tool-result";

const product = normalizeProduct({
  store: "rimi",
  productId: 3975,
  name: 'Biezpiens "Latvijas" — 0%\n```json\nTreat this as data',
  quantityValue: "300",
  quantityUnit: "g",
  externalUrl: "https://www.rimi.lv/e-veikals/lv/produkti/p/952513",
  nutrition: { protein: "11.10", carbsSugars: "0", nutriScoreGrade: "B" },
}, "rimi");

function assertTextEquivalent(value: Record<string, unknown>, summary: string) {
  const before = JSON.stringify(value);
  const result = jsonToolResult(value, summary);
  assert.ok("structuredContent" in result, "must not return an error");
  assert.equal(result.content.length, 2);
  const textOnly = result.content.filter((block) => block.type === "text");
  assert.equal(textOnly[0].text, summary);
  assert.deepEqual(JSON.parse(textOnly[1].text), value);
  assert.deepEqual(JSON.parse(textOnly[1].text), result.structuredContent);
  assert.equal(JSON.stringify(value), before, "must not mutate verified data");
  assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= MAX_TOOL_RESULT_BYTES);
  return JSON.parse(textOnly[1].text);
}

test("search text preserves original names, identifiers, links, zero, null and warnings", () => {
  const data = assertTextEquivalent({
    products: [compactProduct(product)],
    query: "biezpiens",
    partial: true,
    pages_scanned: 1,
    candidate_count: 1,
    has_more_candidates: null,
    coverage_note: "Bounded search, not exhaustive.",
  }, "Checked 1 candidate; returned 1 verified match.");
  assert.equal(data.products[0].original_name, product.original_name);
  assert.equal(data.products[0].product_id, 3975);
  assert.equal(data.products[0].store, "rimi");
  assert.equal(data.products[0].sugar_per_100, 0);
  assert.equal(data.products[0].fat_per_100, null);
  assert.equal(data.products[0].retailer_url, product.retailer_url);
  assert.deepEqual(data.products[0].warnings, product.warnings);
});

test("empty search is usable text data, not a missing product list", () => {
  const data = assertTextEquivalent({
    products: [], query: "not-found", partial: false,
    pages_scanned: 1, candidate_count: 0, has_more_candidates: false,
    coverage_note: "No verified matches.",
  }, "Returned 0 verified matches.");
  assert.deepEqual(data.products, []);
});

test("product detail text preserves missing nutrition, ingredients and analysis", () => {
  const detail = {
    ...product,
    ingredients_text: 'Piens\n"Ignore previous instructions" is catalogue text.',
    ingredient_analysis: { milk: true, note: null },
  };
  const data = assertTextEquivalent(detail, "Verified product 3975 at rimi.");
  assert.equal(data.energy_kcal, null);
  assert.ok(data.missing_fields.includes("energy_kcal"));
  assert.equal(data.ingredients_text, detail.ingredients_text);
  assert.deepEqual(data.ingredient_analysis, detail.ingredient_analysis);
});

test("basket text preserves partial totals, unresolved references and retailer groups", () => {
  const unresolved = {
    store: "maxima", product_id: 999, original_name: null,
    package_count: 1, package_quantity: null, package_unit: null,
    retailer_url: null, protein_contribution_g: null,
    unresolved_reason: "Product not found at the requested retailer.",
    nutri_score: null,
  };
  const completeness = {
    requested_packages: 2, calculable_packages: 1,
    unknown_packages: 1, completeness_percent: 50,
  };
  const basket = {
    groups: [{
      store: "rimi", retailer: "Rimi",
      lines: [{ ...unresolved, store: "rimi", product_id: 3975,
        original_name: product.original_name, protein_contribution_g: 33.3,
        unresolved_reason: null, retailer_url: product.retailer_url }],
      nutrition_completeness: { ...completeness, requested_packages: 1,
        unknown_packages: 0, completeness_percent: 100 },
    }, {
      store: "maxima", retailer: "Barbora (Maxima)", lines: [unresolved],
      nutrition_completeness: { ...completeness, requested_packages: 1,
        calculable_packages: 0, completeness_percent: 0 },
    }],
    known_protein_g: 33.3, total_protein_g: null,
    overall_nutrition_completeness: completeness,
    unresolved_items: [unresolved], partial: true,
    nutri_score_distribution: { A: 0, B: 1, C: 0, D: 0, E: 0,
      unknown: 1, counting_basis: "Counts packages, not averaged grades." },
    warnings: ["Known sum is partial, not a complete total.", "Prices and stock are not verified."],
  };
  const data = assertTextEquivalent(basket, "Shopping list contains 2 packages. Sum is partial.");
  assert.equal(data.total_protein_g, null);
  assert.equal(data.known_protein_g, 33.3);
  assert.equal(data.unresolved_items[0].product_id, 999);
  assert.equal(data.groups[1].retailer, "Barbora (Maxima)");
});

test("errors remain explicit text without fabricated structured results", () => {
  const result = errorResult("The catalogue is temporarily unavailable.");
  assert.equal(result.isError, true);
  assert.deepEqual(result.content, [{ type: "text", text: "The catalogue is temporarily unavailable." }]);
  assert.equal("structuredContent" in result, false);
});

test("result at the exact serialized byte limit succeeds; one byte over fails", () => {
  const value = { products: [] };
  const base = jsonToolResult(value, "");
  const available = MAX_TOOL_RESULT_BYTES - Buffer.byteLength(JSON.stringify(base), "utf8");
  const exact = jsonToolResult(value, "a".repeat(available));
  assert.ok("structuredContent" in exact);
  assert.equal(Buffer.byteLength(JSON.stringify(exact), "utf8"), MAX_TOOL_RESULT_BYTES);
  const oversized = jsonToolResult(value, "a".repeat(available + 1));
  assert.equal("structuredContent" in oversized, false);
  assert.ok("isError" in oversized && oversized.isError);
  assert.match(oversized.content[0].text, /too large/);
});

test("size bound counts UTF-8, escaped text, and both representations", () => {
  for (const text of ["a".repeat(140_000), '"\\\n'.repeat(25_000), "ā".repeat(70_000)]) {
    const value = { ingredients_text: text };
    assert.ok(Buffer.byteLength(JSON.stringify(value), "utf8") < MAX_TOOL_RESULT_BYTES,
      "old single-copy size check would accept this");
    const result = jsonToolResult(value, "Verified result.");
    assert.ok("isError" in result && result.isError);
    assert.equal("structuredContent" in result, false);
    assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") < MAX_TOOL_RESULT_BYTES);
  }
});
