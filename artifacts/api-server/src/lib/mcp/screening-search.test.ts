import assert from "node:assert/strict";
import test from "node:test";
import { CatalogueError, searchProducts } from "./catalogue";
import { normalizeProduct } from "./domain";
import type { SearchFilters } from "./domain";

function raw(id: number, text: string | null, store = "rimi", protein = 10) {
  return { productId: id, store, name: `Original ${id}`, quantityValue: 100,
    quantityUnit: "g", nutrition: { ingredientsText: text, protein, carbsSugars: 0 } };
}
const active = () => new AbortController().signal;
const filters: SearchFilters = { store: "rimi", ingredientScreening: "fodmap" };
const list = (products: unknown[]) => async () => ({ products, totalCount: products.length });
const noDetail = async () => { throw new Error("Unexpected detail request"); };

test("screening continues after rejected products before applying the match limit", async () => {
  const result = await searchProducts("rice", filters, 1, active(), {
    list: list([raw(1, "rice, onion"), raw(2, "rice, spices"), raw(3, "rice, salt")]), detail: noDetail,
  });
  assert.deepEqual(result.products.map((p) => p.product_id), [3]);
  assert.equal(result.candidate_count, 3);
  assert.equal(result.screening?.flagged_count, 1);
  assert.equal(result.screening?.unknown_count, 1);
  assert.equal(result.screening?.no_listed_concern_count, 1);
  assert.equal(result.screening?.assessed_count, 3);
  assert.equal("review_products" in result, false);
});

test("review is explicit, separate, bounded, and cannot fill the match quota", async () => {
  const products = [raw(1, "rice, onion"), raw(2, "rice, spices"), raw(3, "rice, salt")];
  const result = await searchProducts(undefined, { ...filters, includeReview: true }, 1, active(), {
    list: list(products), detail: noDetail,
  });
  assert.deepEqual(result.products.map((p) => p.product_id), [3]);
  assert.deepEqual(result.review_products?.map((p) => p.product_id), [1]);
  assert.equal(result.screening?.review_omitted, 1);
  assert.equal(result.screening?.review_returned, 1);
});

test("unknown data after bounded detail hydration is excluded, not guessed from analysis", async () => {
  let lookups = 0;
  const result = await searchProducts(undefined, filters, 2, active(), {
    list: list([raw(1, null), raw(2, null)]),
    detail: async (_store, id) => {
      lookups++;
      return normalizeProduct({ ...raw(id, id === 1 ? "rice, salt" : null), ingredientCard: { safe: true } });
    },
  });
  assert.equal(lookups, 2);
  assert.equal(result.screening?.detail_lookups, 2);
  assert.deepEqual(result.products.map((p) => p.product_id), [1]);
  assert.equal(result.screening?.unknown_count, 1);
});

test("at most ten missing-list detail lookups; later complete lists still get screened", async () => {
  const products = [...Array.from({ length: 12 }, (_, i) => raw(i + 1, null)), raw(13, "rice, salt")];
  let lookups = 0;
  const result = await searchProducts(undefined, { ...filters, includeReview: true }, 2, active(), {
    list: list(products),
    detail: async (_store, id) => { lookups++; return normalizeProduct(raw(id, null)); },
  });
  assert.equal(lookups, 10);
  assert.equal(result.screening?.unassessed_count, 2);
  assert.equal(result.screening?.unknown_count, 12);
  assert.equal(result.screening?.eligible_count, 13);
  assert.equal(result.screening?.assessed_count, 11);
  assert.equal(result.screening?.partial, true);
  assert.equal(result.partial, true);
  assert.deepEqual(result.products.map((p) => p.product_id), [13]);
  assert.equal(result.review_products?.length, 2);
  assert.match(result.coverage_note, /could not be assessed/);
});

test("detail failures remain explicit unknowns while valid later candidates can match", async () => {
  const result = await searchProducts(undefined, { ...filters, includeReview: true }, 2, active(), {
    list: list([raw(1, null), raw(2, "rice")]),
    detail: async () => { throw new CatalogueError("rate_limited", "quota"); },
  });
  assert.equal(result.screening?.detail_failures, 1);
  assert.equal(result.screening?.unassessed_count, 1);
  assert.equal(result.review_products?.[0].fodmap_assessment?.outcome, "insufficient_information");
  assert.match(result.review_products?.[0].fodmap_assessment?.uncertainties.at(-1)!, /incomplete/);
  assert.deepEqual(result.products.map((p) => p.product_id), [2]);
});

test("store and nutrition filters run before hydration and are rechecked on detail data", async () => {
  let calls = 0;
  const result = await searchProducts(undefined, { ...filters, minProtein: 10 }, 2, active(), {
    list: list([raw(1, null, "maxima"), raw(2, null, "rimi", 1), raw(3, null)]),
    detail: async (_store, id) => { calls++; return normalizeProduct(raw(id, "rice", "rimi", 0)); },
  });
  assert.equal(calls, 1);
  assert.equal(result.products.length, 0);
  assert.equal(result.screening?.eligible_count, 0);
});

test("a mismatched detail identity is never accepted as a product match", async () => {
  const result = await searchProducts(undefined, filters, 1, active(), {
    list: list([raw(1, null)]),
    detail: async () => normalizeProduct(raw(999, "rice", "maxima")),
  });
  assert.equal(result.products.length, 0);
  assert.equal(result.screening?.detail_failures, 1);
});

test("cancellation during detail hydration propagates without retries or false results", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(searchProducts(undefined, filters, 1, controller.signal, {
    list: list([raw(1, null), raw(2, null)]),
    detail: async (_store, _id, signal) => {
      calls++;
      assert.equal(signal, controller.signal);
      controller.abort(new Error("screening_cancelled"));
      throw signal.reason;
    },
  }), /screening_cancelled/);
  assert.equal(calls, 1);
});

test("cancellation before a search or during an empty page cannot return a success", async () => {
  const before = new AbortController();
  before.abort(new Error("already_cancelled"));
  let started = false;
  await assert.rejects(searchProducts(undefined, filters, 1, before.signal, {
    list: async () => { started = true; return { products: [] }; }, detail: noDetail,
  }), /already_cancelled/);
  assert.equal(started, false);
  const during = new AbortController();
  await assert.rejects(searchProducts(undefined, filters, 1, during.signal, {
    list: async () => {
      during.abort(new Error("empty_page_cancelled"));
      return { products: [], totalCount: 0 };
    }, detail: noDetail,
  }), /empty_page_cancelled/);
});

test("a later failed page returns partial screening counts and review evidence, even with zero matches", async () => {
  let page = 0;
  const result = await searchProducts(undefined, { ...filters, includeReview: true }, 2, active(), {
    list: async () => {
      if (++page > 1) throw new CatalogueError("unavailable", "upstream");
      return { products: Array.from({ length: 100 }, (_, i) => raw(i + 1, "onion")), totalCount: 200 };
    }, detail: noDetail,
  });
  assert.equal(result.partial, true);
  assert.equal(result.products.length, 0);
  assert.equal(result.screening?.flagged_count, 100);
  assert.equal(result.review_products?.length, 2);
  assert.match(result.coverage_note, /catalogue request failed/);
});

test("screened scans stay bounded at three pages of 100, deduplicating store-qualified IDs", async () => {
  let pages = 0;
  const result = await searchProducts(undefined, filters, 1, active(), {
    list: async () => ({ products: Array.from({ length: 100 }, (_, i) => raw(i + 1, "onion")),
      totalCount: (++pages, 1_000) }), detail: noDetail,
  });
  assert.equal(pages, 3);
  assert.equal(result.candidate_count, 300);
  assert.equal(result.screening?.eligible_count, 100);
  assert.equal(result.partial, true);
});

test("non-screened callers retain previous data and never incur ingredient detail lookups", async () => {
  const result = await searchProducts(undefined, { store: "rimi" }, 1, active(), {
    list: list([raw(1, null)]), detail: noDetail,
  });
  assert.equal(result.products.length, 1);
  assert.equal("screening" in result, false);
  assert.equal("review_products" in result, false);
  assert.equal("fodmap_assessment" in result.products[0], false);
});
