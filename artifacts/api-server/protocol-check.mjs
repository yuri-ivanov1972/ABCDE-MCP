import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const endpoint = new URL(
  process.argv.slice(2).find((argument) => argument !== "--") ??
  "http://localhost:80/mcp",
);
const origin = new URL("/", endpoint);
const beforeResponse = await fetch(new URL("/api/stats", origin));
assert.equal(beforeResponse.status, 200);
const before = await beforeResponse.json();
let calls = 0;

async function connect(mode) {
  const client = new Client(
    { name: "abcde-release-check", version: "1.0.0" },
    { capabilities: {}, versionNegotiation: { mode } },
  );
  await client.connect(new StreamableHTTPClientTransport(endpoint));
  return client;
}

async function invoke(client, name, args, expectError = false) {
  calls++;
  const result = await client.callTool({ name, arguments: args });
  assert.equal(Boolean(result.isError), expectError, `${name}: ${JSON.stringify(result.content)}`);
  const textBlocks = result.content.filter((block) => block.type === "text");
  assert.ok(textBlocks.length > 0, `${name}: model-visible text is required`);
  if (!expectError) {
    assert.ok(result.structuredContent);
    assert.equal(textBlocks.length, 2, `${name}: summary and complete JSON text`);
    assert.ok(textBlocks[0].text.length > 0);
    assert.deepEqual(JSON.parse(textBlocks[1].text), result.structuredContent,
      `${name}: text-only consumers must receive every structured field`);
    assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= 256 * 1024);
  } else {
    assert.equal(result.structuredContent, undefined);
  }
  return result.structuredContent;
}

function checkAssessment(assessment) {
  assert.ok(assessment, "FODMAP assessment must survive output-schema validation");
  assert.ok(["potential_concern", "no_listed_concern", "insufficient_information"].includes(assessment.outcome));
  assert.ok(assessment.rule_version.length > 0);
  assert.ok(assessment.source_urls.includes("https://www.monashfodmap.com/blog/update-label-reading/"));
  assert.ok(assessment.uncertainties.some((note) => note.includes("not verified low-FODMAP")));
  for (const evidence of assessment.evidence) {
    assert.ok(evidence.matched_term.length > 0);
    assert.ok(evidence.rule_id.length > 0);
    assert.ok(evidence.source_urls.length > 0);
  }
}

// Both the legacy initialize handshake used by existing clients and modern
// protocol negotiation must work through the same public proxy route.
for (const mode of ["legacy", "auto"]) {
  const client = await connect(mode);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), [
      "build_basket", "get_product", "search_products",
    ]);
    assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true));
    console.log(`PASS ${mode}: official SDK negotiation and exactly three read-only tools`);

    const rimi = await invoke(client, "get_product", { store: "rimi", product_id: 3975 });
    const maxima = await invoke(client, "get_product", { store: "maxima", product_id: 7451 });
    assert.equal(rimi.store, "rimi");
    assert.equal(maxima.store, "maxima");
    assert.equal(rimi.product_id, 3975);
    assert.equal(maxima.product_id, 7451);
    assert.equal(rimi.nutrient_basis, "assumed_per_100g");
    assert.equal(new URL(maxima.retailer_url).hostname, "barbora.lv");
    await invoke(client, "get_product", { store: "rimi", product_id: 3975 });
    console.log("PASS live product details for both retailers and repeated cached call");

    const filtered = await invoke(client, "search_products", {
      query: "maize", store: "rimi", max_results: 5,
      min_protein_per_100g: 10, max_sugar_per_100g: 1, nutri_score: "B",
    });
    assert.ok(filtered.pages_scanned <= 3);
    assert.ok(filtered.candidate_count <= 300);
    for (const product of filtered.products) {
      assert.equal(product.store, "rimi");
      assert.equal(product.nutri_score, "B");
      assert.ok(product.protein_per_100 >= 10);
      assert.ok(product.sugar_per_100 <= 1);
      assert.equal(product.nutrient_basis, "assumed_per_100g");
    }
    const strictMaxima = await invoke(client, "search_products", {
      query: "maize", store: "maxima", min_protein_per_100g: 90, max_results: 3,
    });
    assert.equal(strictMaxima.products.length, 0);
    const browse = await invoke(client, "search_products", { store: "both", max_results: 2 });
    assert.ok(browse.products.length <= 2);
    console.log("PASS live bounded searches, local store/nutrient enforcement, and filter-only browse");

    const basket = await invoke(client, "build_basket", {
      items: [
        { store: "rimi", product_id: 3975, quantity: 1 },
        { store: "rimi", product_id: 3975, quantity: 1 },
        { store: "maxima", product_id: 7451, quantity: 1 },
      ],
    });
    assert.equal(basket.known_protein_g, 113.01);
    assert.equal(basket.total_protein_g, 113.01);
    assert.equal(basket.groups.length, 2);
    assert.equal(basket.nutri_score_distribution.B, 2);
    assert.equal(basket.nutri_score_distribution.D, 1);
    assert.equal(basket.overall_nutrition_completeness.requested_packages, 3);
    console.log("PASS live duplicate basket: 113.01 g; B × 2, D × 1");

    const partial = await invoke(client, "build_basket", {
      items: [
        { store: "rimi", product_id: 3975, quantity: 1 },
        { store: "maxima", product_id: 999999999, quantity: 1 },
      ],
    });
    assert.equal(partial.partial, true);
    assert.equal(partial.total_protein_g, null);
    assert.equal(partial.unresolved_items.length, 1);
    await invoke(client, "build_basket", {
      items: [{ store: "maxima", product_id: 999999999, quantity: 1 }],
    }, true);
    await invoke(client, "get_product", { store: "rimi", product_id: 999999999 }, true);
    await invoke(client, "build_basket", {
      items: [
        { store: "rimi", product_id: 3975, quantity: 20 },
        { store: "rimi", product_id: 3975, quantity: 1 },
      ],
    }, true);
    console.log("PASS missing product, partial basket, all-failed basket, and duplicate quantity limit");
    for (const [store, product_id] of [["rimi", 3975], ["maxima", 7451]]) {
      const detail = await invoke(client, "get_product", { store, product_id, ingredient_screening: "fodmap" });
      checkAssessment(detail.fodmap_assessment);
      assert.equal(detail.fodmap_assessment.ingredients_text, detail.ingredients_text);
    }
    for (const include_review of [false, true]) {
      const screened = await invoke(client, "search_products", {
        query: "maize", store: "rimi", max_results: 2,
        ingredient_screening: "fodmap", include_review,
      });
      assert.equal(screened.screening.mode, "fodmap");
      assert.ok(screened.screening.detail_lookups <= 10);
      assert.ok(screened.candidate_count <= 300);
      assert.equal(screened.screening.eligible_count,
        screened.screening.assessed_count + screened.screening.unassessed_count);
      assert.equal(screened.screening.eligible_count,
        screened.screening.flagged_count + screened.screening.unknown_count + screened.screening.no_listed_concern_count);
      for (const product of screened.products) {
        checkAssessment(product.fodmap_assessment);
        assert.equal(product.fodmap_assessment.outcome, "no_listed_concern");
      }
      if (include_review) {
        assert.ok(Array.isArray(screened.review_products));
        assert.ok(screened.review_products.length <= 2);
        for (const product of screened.review_products) {
          checkAssessment(product.fodmap_assessment);
          assert.notEqual(product.fodmap_assessment.outcome, "no_listed_concern");
        }
      } else assert.equal(screened.review_products, undefined);
    }
    for (const [baseline, items] of [
      [basket, [
        { store: "rimi", product_id: 3975, quantity: 2 },
        { store: "maxima", product_id: 7451, quantity: 1 },
      ]],
      [partial, [
        { store: "rimi", product_id: 3975, quantity: 1 },
        { store: "maxima", product_id: 999999999, quantity: 1 },
      ]],
    ]) {
      const screened = await invoke(client, "build_basket", { items, ingredient_screening: "fodmap" });
      assert.equal(screened.known_protein_g, baseline.known_protein_g);
      assert.equal(screened.total_protein_g, baseline.total_protein_g);
      assert.deepEqual(screened.overall_nutrition_completeness, baseline.overall_nutrition_completeness);
      for (let index = 0; index < screened.groups.length; index++) {
        const stripped = screened.groups[index].lines.map(({ fodmap_assessment, ...line }) => {
          checkAssessment(fodmap_assessment);
          return line;
        });
        assert.deepEqual(stripped, baseline.groups[index].lines);
      }
      assert.ok(screened.warnings.some((note) => note.includes("does not remove basket items")));
    }
    console.log(`PASS ${mode}: FODMAP search exclusion/review, both retailers' details, and unchanged complete/partial baskets`);
    console.log(`PASS ${mode}: all three tools expose complete, equivalent text and structured data`);
  } finally {
    await client.close();
  }
}

const statsResponse = await fetch(new URL("/api/stats", origin));
assert.equal(statsResponse.status, 200);
const after = await statsResponse.json();
assert.ok(after.toolCalls >= before.toolCalls + calls);
assert.equal(after.measuredSessions, null);
assert.equal(after.sessionMeasurementAvailable, false);
assert.deepEqual(Object.keys(after).sort(), [
  "measuredSessions", "sessionMeasurementAvailable", "toolCalls",
]);
console.log(`PASS aggregate counter includes all ${calls} tool attempts, including cache hits and failures`);
console.log(`Verified endpoint: ${endpoint.href}`);
console.log("NOT TESTED: real Claude account conversation. Development endpoint results do not verify a published release.");
