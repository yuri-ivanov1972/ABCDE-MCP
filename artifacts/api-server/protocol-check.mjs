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
