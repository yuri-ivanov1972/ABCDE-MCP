import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProductQuery,
  calculateBasketLines,
  combineBasketItems,
  compactProduct,
  finiteNumber,
  matchesFilters,
  normalizeProduct,
  packageMassGrams,
  roundOutput,
  type BasketLineInput,
} from "./domain.ts";

const rimiBread = {
  productId: 3975,
  store: "rimi",
  name: '"LATVIJAS Graudu maize" kliju pilngraudu 300g',
  sku: "952513",
  quantityValue: "300.00",
  quantityUnit: "g",
  externalUrl: "https://www.rimi.lv/e-veikals/lv/produkti/p/952513",
  nutrition: {
    protein: "11.10",
    carbsSugars: "0.50",
    fatTotal: "3.60",
    salt: "1.00",
    nutriScoreGrade: "B",
  },
};

const maximaBread = {
  productId: 7451,
  store: "maxima",
  name: "100% rudzu miltu tostermaize 390g",
  quantityValue: "390",
  quantityUnit: "g",
  externalUrl: "https://barbora.lv/produkti/tostermaize",
  nutrition: {
    protein: "11.9",
    carbsSugars: "4.6",
    fatTotal: "4.6",
    salt: "1.6",
    nutriScoreGrade: "D",
    dataSourceDate: null,
  },
};

test("strict numeric parsing distinguishes valid zero from missing and invalid", () => {
  assert.equal(finiteNumber("0"), 0);
  assert.equal(finiteNumber(0), 0);
  assert.equal(finiteNumber("  11.10 "), 11.1);
  assert.equal(finiteNumber(""), null);
  assert.equal(finiteNumber("  "), null);
  assert.equal(finiteNumber("1,2"), null);
  assert.equal(finiteNumber("NaN"), null);
  assert.equal(finiteNumber(Infinity), null);
  assert.equal(finiteNumber(null), null);
  assert.equal(finiteNumber(true), null);
});

test("product normalization keeps store-qualified identifiers and numeric zero", () => {
  const rimi = normalizeProduct({
    ...rimiBread,
    nutrition: { ...rimiBread.nutrition, protein: "0" },
  });
  const maxima = normalizeProduct(maximaBread);

  assert.equal(rimi.store, "rimi");
  assert.equal(rimi.product_id, 3975);
  assert.equal(rimi.protein_per_100, 0);
  assert.equal(rimi.nutrient_basis, "assumed_per_100g");
  assert.equal(maxima.store, "maxima");
  assert.equal(maxima.product_id, 7451);
  assert.equal(maxima.original_name, maximaBread.name);
  assert.equal(maxima.nutrition_source_date, null);
  assert.equal(maxima.nutri_score, "D");
  assert.throws(
    () => normalizeProduct({ ...rimiBread, store: "unknown" }),
    /identity/,
  );
});

test("normalization marks missing nutrients null and volume basis unknown", () => {
  const product = normalizeProduct({
    productId: 22,
    store: "rimi",
    name: "Drink",
    quantityValue: "1",
    quantityUnit: "l",
    nutrition: { protein: "", carbsSugars: "bad", nutriScoreGrade: "F" },
  });
  assert.equal(product.protein_per_100, null);
  assert.equal(product.sugar_per_100, null);
  assert.equal(product.nutri_score, null);
  assert.equal(product.nutrient_basis, "unknown");
  assert.ok(product.missing_fields.includes("protein_per_100"));
  assert.ok(product.warnings.some((warning) => warning.includes("unknown")));
});

test("search query mapping omits empty search and forwards only supported filters", () => {
  const params = buildProductQuery("  maize  ", {
    store: "maxima",
    minProtein: 10,
    maxSugar: 4,
    nutriScore: "B",
  }, 2);
  assert.equal(params.get("search"), "maize");
  assert.equal(params.get("store"), "maxima");
  assert.equal(params.get("page"), "2");
  assert.equal(params.get("pageSize"), "100");
  assert.equal(params.get("proteinMin"), "10");
  assert.equal(params.get("sugarMax"), "4");
  assert.equal(params.get("nutriScores"), "B");
  assert.equal(params.has("max_price"), false);

  const browse = buildProductQuery("", { store: "both" }, 1);
  assert.equal(browse.has("search"), false);
  assert.equal(browse.has("store"), false);
});

test("all requested store and nutrition filters are enforced locally", () => {
  const rimi = normalizeProduct(rimiBread);
  const maxima = normalizeProduct(maximaBread);

  assert.equal(
    matchesFilters(maxima, {
      store: "rimi",
      minProtein: 10,
      maxSugar: 5,
      nutriScore: "D",
    }),
    false,
  );
  assert.equal(
    matchesFilters(maxima, {
      store: "maxima",
      minProtein: 90,
    }),
    false,
  );
  assert.equal(
    matchesFilters(rimi, {
      store: "rimi",
      minProtein: 10,
      maxSugar: 1,
      nutriScore: "B",
    }),
    true,
  );
  assert.equal(
    matchesFilters(
      normalizeProduct({
        ...rimiBread,
        quantityUnit: "ml",
      }),
      { store: "both", minProtein: 1 },
    ),
    false,
  );
  assert.equal(
    matchesFilters(
      normalizeProduct({
        ...rimiBread,
        nutrition: { ...rimiBread.nutrition, protein: null },
      }),
      { store: "both", minProtein: 0 },
    ),
    false,
  );
});

test("basket identities include store and duplicate package counts combine safely", () => {
  const combined = combineBasketItems([
    { store: "rimi", product_id: 3975, quantity: 2 },
    { store: "rimi", product_id: 3975, quantity: 1 },
    { store: "maxima", product_id: 3975, quantity: 1 },
  ]);
  assert.equal(combined.length, 2);
  assert.equal(combined.find((item) => item.store === "rimi")?.quantity, 3);
  assert.equal(combined.find((item) => item.store === "maxima")?.quantity, 1);
  assert.throws(
    () =>
      combineBasketItems([
        { store: "rimi", product_id: 1, quantity: 12 },
        { store: "rimi", product_id: 1, quantity: 9 },
      ]),
    /cannot exceed 20/,
  );
  assert.throws(
    () =>
      combineBasketItems([
        { store: "rimi", product_id: 1, quantity: 20 },
        { store: "maxima", product_id: 1, quantity: 20 },
        { store: "rimi", product_id: 2, quantity: 20 },
        { store: "maxima", product_id: 2, quantity: 20 },
        { store: "rimi", product_id: 3, quantity: 20 },
        { store: "maxima", product_id: 3, quantity: 1 },
      ]),
    /100 packages/,
  );
});

test("mass conversion and basket total validate 113.01 g without early rounding", () => {
  const first = normalizeProduct(rimiBread);
  const second = normalizeProduct(maximaBread);
  assert.equal(packageMassGrams(first), 300);
  assert.equal(packageMassGrams(normalizeProduct({
    ...rimiBread,
    quantityValue: "0.39",
    quantityUnit: "kg",
  })), 390);
  assert.equal(
    packageMassGrams(
      normalizeProduct({ ...rimiBread, quantityUnit: "piece" }),
    ),
    null,
  );

  const lines = calculateBasketLines([
    { store: "rimi", product_id: 3975, quantity: 2, product: first },
    { store: "maxima", product_id: 7451, quantity: 1, product: second },
  ]);
  const known = lines.reduce(
    (sum, line) => sum + (line.protein_contribution_g ?? 0),
    0,
  );
  assert.equal(roundOutput(known), 113.01);
  assert.equal(lines[0]?.protein_contribution_g, 66.6);
  assert.equal(lines[1]?.protein_contribution_g, 46.41);
});

test("unknown mass, missing protein, and missing products remain visible", () => {
  const volume = normalizeProduct({
    ...rimiBread,
    quantityUnit: "ml",
  });
  const noProtein = normalizeProduct({
    ...rimiBread,
    nutrition: { ...rimiBread.nutrition, protein: null },
  });
  const inputs: BasketLineInput[] = [
    { store: "rimi", product_id: 1, quantity: 1, product: volume },
    { store: "rimi", product_id: 2, quantity: 1, product: noProtein },
    { store: "maxima", product_id: 3, quantity: 2, error: "Product not found." },
  ];
  const lines = calculateBasketLines(inputs);
  assert.equal(lines.length, 3);
  assert.equal(lines[0]?.protein_contribution_g, null);
  assert.match(lines[0]?.unresolved_reason ?? "", /Package mass/);
  assert.equal(lines[1]?.protein_contribution_g, null);
  assert.match(lines[1]?.unresolved_reason ?? "", /Protein data/);
  assert.equal(lines[2]?.original_name, null);
  assert.equal(lines[2]?.package_count, 2);
  assert.equal(lines[2]?.unresolved_reason, "Product not found.");
});

test("original names stay exact, missing names stay null, and URL/photo fallbacks are safe", () => {
  const original = '  Oriģinālais nosaukums  ';
  const product = normalizeProduct({
    ...rimiBread,
    name: original,
    externalUrl: "",
    rimiUrl: "https://www.rimi.lv/product",
    photos: [
      { isPrimary: true, photoUrl: "javascript:alert(1)" },
      { photoUrl: "https://images.example/product.jpg" },
    ],
  });
  assert.equal(product.original_name, original);
  assert.equal(product.retailer_url, "https://www.rimi.lv/product");
  assert.equal(product.image_url, "https://images.example/product.jpg");
  const missing = normalizeProduct({ ...maximaBread, name: "", externalUrl: null, rimiUrl: "https://rimi.lv/not-maxima" });
  assert.equal(missing.original_name, null);
  assert.equal(missing.retailer_url, null);
  assert.ok(missing.missing_fields.includes("original_name"));
});

test("compact search products omit long ingredient details and zero bounds still match zero", () => {
  const product = normalizeProduct({
    ...rimiBread,
    ingredientCard: { longAnalysis: "details" },
    nutrition: { ...rimiBread.nutrition, protein: 0, carbsSugars: 0 },
  });
  assert.equal(matchesFilters(product, { store: "both", minProtein: 0, maxSugar: 0 }), true);
  const summary = compactProduct(product);
  assert.equal(summary.protein_per_100, 0);
  assert.equal("ingredient_analysis" in summary, false);
  assert.equal("ingredients_text" in summary, false);
});
