import assert from "node:assert/strict";
import test from "node:test";
import { assessFodmap, FODMAP_RULE_VERSION, FODMAP_LIMITATION } from "./fodmap";
import { fodmapAssessmentSchema } from "./fodmap-schema";
import { calculateBasketLines, compactProduct, normalizeProduct, roundOutput } from "./domain";
import { jsonToolResult } from "./tool-result";

const assess = (text: string | null) => assessFodmap({ ingredients_text: text });
const makeProduct = (id: number, ingredients: string | null, store: "rimi" | "maxima" = "rimi") =>
  normalizeProduct({ productId: id, store, name: 'Oriģinālais "produkts"', quantityValue: 300,
    quantityUnit: "g", nutrition: { ingredientsText: ingredients, protein: 11.1, carbsSugars: 0 } });

test("FODMAP concerns match Latvian/English aliases and preserve original evidence", () => {
  for (const text of ["Ūdens, ĶIPLOKU pulveris", "rice, onion powder", "water, INULĪNS", "rice, E420"]) {
    const result = assess(text);
    assert.equal(result.outcome, "potential_concern", text);
    assert.equal(result.ingredients_text, text);
    assert.equal(result.rule_version, FODMAP_RULE_VERSION);
    assert.ok(result.evidence.length);
    assert.ok(result.evidence.every((e) => e.source_urls.length === 2));
    assert.ok(result.uncertainties.includes(FODMAP_LIMITATION));
    assert.deepEqual(fodmapAssessmentSchema.parse(result), result);
  }
});

test("accent variants and decomposed Latvian text match without changing the source", () => {
  for (const text of ["udens, kiploku pulveris", "ūdens, sīpolu pulveris".normalize("NFD")]) {
    assert.equal(assess(text).outcome, "potential_concern");
    assert.equal(assess(text).ingredients_text, text);
  }
});

test("word boundaries do not confuse island, mannitosis or inulinase with risk aliases", () => {
  const result = assess("rice, island, mannitosis, inulinase");
  assert.equal(result.evidence.length, 0);
  assert.equal(result.outcome, "insufficient_information", "unknown terms cannot silently pass");
});

test("a recognized simple list can have no listed concerns but never a suitability verdict", () => {
  const result = assess("Ingredients: rice flour (90%), water, salt");
  assert.equal(result.outcome, "no_listed_concern");
  assert.match(result.uncertainties[0], /not verified low-FODMAP suitability/);
  assert.equal("safe_serving_size" in result, false);
});

test("missing, incomplete, unsupported-language or unknown vocabulary stays unknown", () => {
  for (const text of [null, "", "Ingredients:", "123%", "Состав: рис, вода", "farine de riz, eau", "rice, mystery blend"]) {
    assert.equal(assess(text).outcome, "insufficient_information", String(text));
  }
  assert.equal(assess("wheat flour, water, spices").outcome, "insufficient_information");
});

test("gluten-free, low sugar or a product name alone cannot certify a FODMAP result", () => {
  assert.equal(assess("gluten-free, sugar-free").outcome, "insufficient_information");
  const product = makeProduct(1, null);
  product.original_name = "Low FODMAP lactose-free product";
  product.ingredient_analysis = { lowFodmap: true, certified: true };
  assert.equal(assessFodmap(product).outcome, "insufficient_information");
});

test("dairy and cereal ingredients require quantity/processing review, regardless of order", () => {
  for (const text of ["milk, water", "water, wheat flour (1%)", "wheat flour (90%), water",
    "water, rye", "cream, water", "soy flour, water", "chickpea protein isolate, rice"]) {
    const result = assess(text);
    assert.equal(result.outcome, "insufficient_information", text);
    assert.ok(result.evidence.length);
    assert.ok(result.uncertainties.some((s) => s.includes("ingredient order")));
  }
});

test("lactose-free qualification is local, not a pass for added lactose or other risks", () => {
  assert.equal(assess("lactose-free milk, salt").outcome, "no_listed_concern");
  assert.equal(assess("Bezlaktozes piens, sāls").outcome, "no_listed_concern");
  assert.equal(assess("Bez laktozes piens, sāls").outcome, "no_listed_concern");
  assert.equal(assess("milk (lactose-free), salt").outcome, "no_listed_concern");
  assert.equal(assess("lactose-free milk and lactose").outcome, "potential_concern");
  assert.equal(assess("lactose-free milk, lactose").outcome, "potential_concern");
  assert.equal(assess("lactose-free milk, inulin").outcome, "potential_concern");
  assert.equal(assess("lactose-free milk, whey powder").outcome, "insufficient_information");
});

test("garlic-infused oil is ambiguous processing, not blanket garlic exclusion or a pass", () => {
  const result = assess("garlic-infused oil, salt");
  assert.equal(result.outcome, "insufficient_information");
  assert.match(result.evidence[0].explanation, /residual solids/);
  assert.equal(assess("ķiploku infūzijas eļļa, sāls").outcome, "insufficient_information");
  assert.equal(assess("garlic-infused oil and garlic powder").outcome, "potential_concern");
});

test("precautionary notices are separate evidence, not declared ingredients or doses", () => {
  for (const text of ["rice, salt. May contain milk and garlic.", "Rīsi, sāls. Var saturēt piena un ķiploku pēdas."]) {
    const result = assess(text);
    assert.equal(result.outcome, "no_listed_concern");
    assert.ok(result.precautionary_text);
    assert.ok(result.evidence.every((e) => e.context === "precautionary"));
  }
  assert.equal(assess("garlic, rice. May contain milk").outcome, "potential_concern");
  assert.equal(assess("May contain milk").outcome, "insufficient_information");
});

test("compound ingredients and vague flavourings never silently become no-concern matches", () => {
  assert.equal(assess("rice, sauce (water, onion, salt)").outcome, "potential_concern");
  assert.equal(assess("rice, natural flavour").outcome, "insufficient_information");
  assert.equal(assess("rice, garšvielas").outcome, "insufficient_information");
  assert.equal(assess("rice, sauce (may contain milk), onion").outcome, "insufficient_information");
  assert.equal(assess("rice. May contain milk. Ingredients: garlic").outcome, "insufficient_information");
});

test("long ingredient text stays unassessed with the original text intact", () => {
  const text = "rice ".repeat(7_000);
  const result = assess(text);
  assert.equal(result.outcome, "insufficient_information");
  assert.equal(result.ingredients_text, text);
  assert.match(result.uncertainties.at(-1)!, /processing limit/);
});

test("screened baskets retain every line and quantity, including missing products and protein totals", () => {
  const product = makeProduct(3975, "rice, onion");
  const inputs = [
    { store: "rimi" as const, product_id: 3975, quantity: 2, product },
    { store: "maxima" as const, product_id: 999, quantity: 1, error: "Not found" },
  ];
  const baseline = calculateBasketLines(inputs);
  const screened = calculateBasketLines(inputs, "fodmap");
  assert.equal(screened.length, baseline.length);
  for (let i = 0; i < screened.length; i++) {
    const { fodmap_assessment, ...line } = screened[i];
    assert.deepEqual(line, baseline[i]);
    assert.ok(fodmap_assessment);
  }
  assert.equal(screened[0].fodmap_assessment?.outcome, "potential_concern");
  assert.equal(screened[1].fodmap_assessment?.outcome, "insufficient_information");
  assert.equal(roundOutput(screened[0].protein_contribution_g!), 66.6);
  assert.equal("fodmap_assessment" in baseline[0], false);
});

test("screening survives compact search output and complete text/structured formatting", () => {
  const product = makeProduct(3975, "rice, onion");
  product.fodmap_assessment = assessFodmap(product);
  const compact = compactProduct(product);
  assert.equal(compact.original_name, product.original_name);
  assert.equal("ingredients_text" in compact, false);
  assert.equal(compact.fodmap_assessment?.ingredients_text, "rice, onion");
  const value = { products: [compact], review_products: [compact] };
  const result = jsonToolResult(value, "Ingredient screening only.");
  assert.ok("structuredContent" in result);
  assert.deepEqual(JSON.parse(result.content[1].text), result.structuredContent);
});
