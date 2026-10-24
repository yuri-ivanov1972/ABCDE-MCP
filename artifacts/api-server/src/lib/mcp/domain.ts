import { assessFodmap, type FodmapAssessment } from "./fodmap";

export type Store = "rimi" | "maxima";
export type StoreChoice = Store | "both";
export type NutriScore = "A" | "B" | "C" | "D" | "E";

export interface SearchFilters {
  store: StoreChoice;
  minProtein?: number;
  maxSugar?: number;
  nutriScore?: NutriScore;
  ingredientScreening?: "fodmap";
  includeReview?: boolean;
}

export interface NormalizedProduct {
  store: Store;
  product_id: number;
  original_name: string | null;
  sku: string | null;
  package_quantity: number | null;
  package_unit: string | null;
  protein_per_100: number | null;
  sugar_per_100: number | null;
  fat_per_100: number | null;
  salt_per_100: number | null;
  nutrient_basis: "assumed_per_100g" | "unknown";
  nutri_score: NutriScore | null;
  retailer_url: string | null;
  image_url: string | null;
  category_name_lv: string | null;
  category_name_en: string | null;
  nutrition_source_date: string | null;
  missing_fields: string[];
  warnings: string[];
  energy_kcal: number | null;
  energy_kj: number | null;
  carbohydrates_per_100: number | null;
  saturated_fat_per_100: number | null;
  fibre_per_100: number | null;
  ingredients_text: string | null;
  ingredient_analysis: Record<string, unknown> | null;
  nova_score: number | null;
  fodmap_assessment?: FodmapAssessment;
}

type RawRecord = Record<string, unknown>;

export function asRecord(value: unknown): RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : {};
}

export function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeHttpsUrl(value: unknown): string | null {
  const candidate = cleanString(value);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function nutritionNumber(nutrition: RawRecord, key: string): number | null {
  return finiteNumber(nutrition[key]);
}

function massUnit(quantityUnit: string | null): "g" | "kg" | null {
  const unit = quantityUnit?.trim().toLowerCase();
  if (unit === "g" || unit === "gram" || unit === "grams") return "g";
  if (unit === "kg" || unit === "kilogram" || unit === "kilograms") return "kg";
  return null;
}

export function normalizeProduct(rawValue: unknown): NormalizedProduct {
  const raw = asRecord(rawValue);
  const id = finiteNumber(raw.productId);
  const store = raw.store;
  if (
    id === null ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    (store !== "rimi" && store !== "maxima")
  ) {
    throw new Error("The catalogue returned an invalid product identity.");
  }

  const nutrition = asRecord(raw.nutrition);
  const category = asRecord(raw.category);
  const quantity = finiteNumber(raw.quantityValue);
  const quantityUnit = cleanString(raw.quantityUnit);
  const basis = massUnit(quantityUnit) ? "assumed_per_100g" : "unknown";
  const gradeValue = cleanString(nutrition.nutriScoreGrade)?.toUpperCase();
  const grade =
    gradeValue && /^[A-E]$/.test(gradeValue)
      ? (gradeValue as NutriScore)
      : null;
  const photos = Array.isArray(raw.photos) ? raw.photos : [];
  const primaryPhoto = photos
    .map(asRecord)
    .find((photo) => photo.isPrimary === true && safeHttpsUrl(photo.photoUrl));
  const selectedPhoto =
    primaryPhoto ??
    photos.map(asRecord).find((photo) => safeHttpsUrl(photo.photoUrl));
  const ingredientCard = asRecord(raw.ingredientCard);
  const ingredientAnalysis =
    Object.keys(ingredientCard).length > 0 ? ingredientCard : null;

  const retailerUrl =
    safeHttpsUrl(raw.externalUrl) ??
    (store === "rimi" ? safeHttpsUrl(raw.rimiUrl) : null);
  const imageUrl = selectedPhoto
    ? safeHttpsUrl(selectedPhoto.photoUrl)
    : null;

  const values: Record<string, unknown> = {
    original_name:
      typeof raw.name === "string" && raw.name.trim() ? raw.name : null,
    sku: cleanString(raw.sku),
    package_quantity: quantity,
    package_unit: quantityUnit,
    protein_per_100: nutritionNumber(nutrition, "protein"),
    sugar_per_100: nutritionNumber(nutrition, "carbsSugars"),
    fat_per_100: nutritionNumber(nutrition, "fatTotal"),
    salt_per_100: nutritionNumber(nutrition, "salt"),
    nutri_score: grade,
    retailer_url: retailerUrl,
    image_url: imageUrl,
    category_name_lv: cleanString(category.nameLv),
    category_name_en: cleanString(category.nameEn),
    nutrition_source_date: cleanString(nutrition.dataSourceDate),
    energy_kcal: nutritionNumber(nutrition, "energyKcal"),
    energy_kj: nutritionNumber(nutrition, "energyKj"),
    carbohydrates_per_100: nutritionNumber(nutrition, "carbsTotal"),
    saturated_fat_per_100: nutritionNumber(nutrition, "fatSaturated"),
    fibre_per_100: nutritionNumber(nutrition, "fiber"),
    ingredients_text: cleanString(nutrition.ingredientsText),
    ingredient_analysis: ingredientAnalysis,
    nova_score: finiteNumber(raw.novaScore),
  };

  const missingFields = Object.entries(values)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
  const warnings: string[] = [];
  if (basis === "assumed_per_100g") {
    warnings.push(
      "The source does not specify nutrient basis; per-100-g basis is assumed for a mass product.",
    );
  } else {
    warnings.push(
      "The nutrient basis is unknown; per-100-g comparisons and package contributions are not verified.",
    );
  }
  if (!grade && nutrition.nutriScoreGrade != null) {
    warnings.push("The source Nutri-Score grade is unknown or invalid.");
  }
  if (ingredientAnalysis) {
    warnings.push(
      "Ingredient analysis is not medical advice, a complete ingredient inventory, or validated allergen classification.",
    );
  }

  return {
    store,
    product_id: id,
    original_name: values.original_name as string | null,
    sku: values.sku as string | null,
    package_quantity: quantity,
    package_unit: quantityUnit,
    protein_per_100: values.protein_per_100 as number | null,
    sugar_per_100: values.sugar_per_100 as number | null,
    fat_per_100: values.fat_per_100 as number | null,
    salt_per_100: values.salt_per_100 as number | null,
    nutrient_basis: basis,
    nutri_score: grade,
    retailer_url: retailerUrl,
    image_url: imageUrl,
    category_name_lv: values.category_name_lv as string | null,
    category_name_en: values.category_name_en as string | null,
    nutrition_source_date: values.nutrition_source_date as string | null,
    missing_fields: missingFields,
    warnings,
    energy_kcal: values.energy_kcal as number | null,
    energy_kj: values.energy_kj as number | null,
    carbohydrates_per_100: values.carbohydrates_per_100 as number | null,
    saturated_fat_per_100: values.saturated_fat_per_100 as number | null,
    fibre_per_100: values.fibre_per_100 as number | null,
    ingredients_text: values.ingredients_text as string | null,
    ingredient_analysis: ingredientAnalysis,
    nova_score: values.nova_score as number | null,
  };
}

export function buildProductQuery(
  query: string | undefined,
  filters: SearchFilters,
  page: number,
): URLSearchParams {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "100",
  });
  const trimmed = query?.trim();
  if (trimmed) params.set("search", trimmed);
  if (filters.store !== "both") params.set("store", filters.store);
  if (filters.minProtein !== undefined) {
    params.set("proteinMin", String(filters.minProtein));
  }
  if (filters.maxSugar !== undefined) {
    params.set("sugarMax", String(filters.maxSugar));
  }
  if (filters.nutriScore) params.set("nutriScores", filters.nutriScore);
  return params;
}

export function compactProduct(product: NormalizedProduct) {
  const {
    energy_kcal, energy_kj, carbohydrates_per_100, saturated_fat_per_100,
    fibre_per_100, ingredients_text, ingredient_analysis, nova_score,
    ...summary
  } = product;
  return summary;
}

export function matchesFilters(
  product: NormalizedProduct,
  filters: SearchFilters,
): boolean {
  if (filters.store !== "both" && product.store !== filters.store) return false;
  if (filters.nutriScore && product.nutri_score !== filters.nutriScore) {
    return false;
  }
  if (filters.minProtein !== undefined) {
    if (
      product.nutrient_basis !== "assumed_per_100g" ||
      product.protein_per_100 === null ||
      product.protein_per_100 < filters.minProtein
    ) {
      return false;
    }
  }
  if (filters.maxSugar !== undefined) {
    if (
      product.nutrient_basis !== "assumed_per_100g" ||
      product.sugar_per_100 === null ||
      product.sugar_per_100 > filters.maxSugar
    ) {
      return false;
    }
  }
  return true;
}

export interface BasketRequestItem {
  store: Store;
  product_id: number;
  quantity: number;
}

export interface BasketLineInput {
  store: Store;
  product_id: number;
  quantity: number;
  product?: NormalizedProduct;
  error?: string;
}

export interface BasketLine {
  store: Store;
  product_id: number;
  original_name: string | null;
  package_count: number;
  package_quantity: number | null;
  package_unit: string | null;
  retailer_url: string | null;
  protein_contribution_g: number | null;
  unresolved_reason: string | null;
  nutri_score: NutriScore | null;
  fodmap_assessment?: FodmapAssessment;
}

export function combineBasketItems(
  items: BasketRequestItem[],
): BasketRequestItem[] {
  const combined = new Map<string, BasketRequestItem>();
  let packageTotal = 0;
  for (const item of items) {
    const key = `${item.store}:${item.product_id}`;
    const previous = combined.get(key);
    const quantity = (previous?.quantity ?? 0) + item.quantity;
    if (quantity > 20) {
      throw new Error(
        "Combined quantity for one store-qualified product cannot exceed 20 packages.",
      );
    }
    combined.set(key, { ...item, quantity });
    packageTotal += item.quantity;
  }
  if (packageTotal > 100) {
    throw new Error("A basket cannot contain more than 100 packages.");
  }
  return [...combined.values()];
}

export function packageMassGrams(product: NormalizedProduct): number | null {
  if (
    product.package_quantity === null ||
    product.package_quantity <= 0 ||
    product.nutrient_basis !== "assumed_per_100g"
  ) {
    return null;
  }
  const unit = massUnit(product.package_unit);
  if (unit === "g") return product.package_quantity;
  if (unit === "kg") return product.package_quantity * 1000;
  return null;
}

export function calculateBasketLines(
  inputs: BasketLineInput[],
  screening?: "fodmap",
): BasketLine[] {
  return inputs.map((line) => {
    const product = line.product;
    let contribution: number | null = null;
    let reason: string | null = line.error ?? null;

    if (product && !reason) {
      const massGrams = packageMassGrams(product);
      if (product.protein_per_100 === null) {
        reason = "Protein data is missing or invalid.";
      } else if (massGrams === null) {
        reason =
          "Package mass or a compatible assumed-per-100-g basis is unavailable.";
      } else {
        contribution =
          (product.protein_per_100 * massGrams * line.quantity) / 100;
      }
    }

    return {
      store: line.store,
      product_id: line.product_id,
      original_name: product?.original_name ?? null,
      package_count: line.quantity,
      package_quantity: product?.package_quantity ?? null,
      package_unit: product?.package_unit ?? null,
      retailer_url: product?.retailer_url ?? null,
      protein_contribution_g: contribution,
      unresolved_reason: reason,
      nutri_score: product?.nutri_score ?? null,
      ...(screening ? { fodmap_assessment: assessFodmap(product) } : {}),
    };
  });
}

export function roundOutput(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
