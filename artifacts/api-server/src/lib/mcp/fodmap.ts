import type { NormalizedProduct } from "./domain";

export const FODMAP_RULE_VERSION = "2026-10-24.1";
export const FODMAP_SOURCES = [
  "https://www.monashfodmap.com/blog/update-label-reading/",
  "https://www.monashfodmap.com/get-app-help/",
];
export const FODMAP_LIMITATION =
  "Ingredient screening only, not verified low-FODMAP suitability or medical advice. Serving size, ingredient quantities and processing remain unverified; no safe portion or meal-level FODMAP load is calculated.";

export type FodmapOutcome = "potential_concern" | "no_listed_concern" | "insufficient_information";
export interface FodmapEvidence {
  rule_id: string;
  matched_term: string;
  context: "declared" | "precautionary";
  explanation: string;
  source_urls: string[];
}
export interface FodmapAssessment {
  outcome: FodmapOutcome;
  rule_version: string;
  ingredients_text: string | null;
  precautionary_text: string | null;
  evidence: FodmapEvidence[];
  uncertainties: string[];
  source_urls: string[];
}

interface Rule {
  id: string;
  kind: "concern" | "review";
  aliases: string[];
  explanation: string;
}

// A deliberately small public-guidance rule set, not a laboratory food-rating
// database. Quantity/processing-dependent ingredients require review, not a
// blanket high-FODMAP verdict. Add aliases only with fixtures and source review.
const rules: Rule[] = [
  { id: "onion", kind: "concern", aliases: ["onion", "onions", "sīpoli", "sīpolu", "sīpols"],
    explanation: "Onion is a potential fructan concern, including powder; actual FODMAP content is not measured." },
  { id: "garlic", kind: "concern", aliases: ["garlic", "ķiploki", "ķiploku", "ķiploks", "ķiplokiem"],
    explanation: "Garlic is a potential fructan concern; an infused-oil preparation needs separate processing review." },
  { id: "concentrated_oligosaccharides", kind: "concern",
    aliases: ["inulin", "inulīns", "inulīnu", "fructooligosaccharides", "fruktooligosaharīdi", "galactooligosaccharides", "galaktooligosaharīdi", "FOS", "GOS", "chicory root fibre", "chicory root fiber", "cigoriņu saknes šķiedra"],
    explanation: "Added inulin/FOS/GOS or chicory-root fibre is a potential concentrated FODMAP concern." },
  { id: "polyols", kind: "concern",
    aliases: ["sorbitol", "sorbitols", "sorbīts", "E420", "mannitol", "mannitols", "E421", "maltitol", "maltitols", "E965", "xylitol", "ksilīts", "ksilitols", "E967", "isomalt", "izomalts", "E953", "lactitol", "laktitols", "E966"],
    explanation: "This listed polyol is a potential FODMAP concern; quantity and tolerance are not established." },
  { id: "lactose", kind: "concern", aliases: ["lactose", "laktoze", "laktozi", "laktozes"],
    explanation: "Declared lactose is a potential concern; a local lactose-free qualification does not certify the whole product." },
  { id: "dairy_quantity", kind: "review",
    aliases: ["milk", "piens", "piena", "pilnpiena", "skimmed milk", "cream", "krējums", "krējuma", "yoghurt", "yogurt", "jogurts", "jogurta", "whey", "sūkalas", "sūkalu", "cheese", "siers", "siera"],
    explanation: "Lactose content depends on the dairy ingredient, processing and amount; dairy is not automatically excluded as high-FODMAP." },
  { id: "cereal_quantity", kind: "review",
    aliases: ["wheat", "kviešu", "rye", "rudzu", "barley", "miežu"],
    explanation: "Cereal fructans depend on ingredient form, amount and processing. Gluten itself is not a FODMAP measurement." },
  { id: "sweetener_quantity", kind: "review",
    aliases: ["honey", "medus", "medu", "apple juice", "ābolu sula", "ābolu sulas", "pear juice", "bumbieru sula", "fruit juice concentrate", "augļu sulas koncentrāts", "high fructose corn syrup", "glucose-fructose syrup", "glikozes-fruktozes sīrups"],
    explanation: "Potential excess-fructose content depends on type and quantity; ingredient presence does not establish a serving threshold." },
  { id: "legume_quantity", kind: "review",
    aliases: ["soy flour", "soya flour", "sojas milti", "chickpea flour", "turku zirņu milti", "chickpeas", "chickpea", "chickpea protein", "chickpea protein isolate", "turku zirņi", "turku zirņu proteīns", "beans", "pupas", "lentils", "lēcas", "soy", "soya", "sojas", "lupin", "lupine", "lupīna", "lupīnu"],
    explanation: "Legume FODMAP content varies with processing and serving size; further review is needed." },
  { id: "ambiguous_mixture", kind: "review",
    aliases: ["spices", "spice", "garšvielas", "garšvielu", "flavouring", "flavoring", "flavourings", "flavorings", "natural flavour", "natural flavor", "aromatizētājs", "aromatizētāji", "aromatizētājus", "vegetable powder", "dārzeņu pulveris", "extract", "ekstrakts"],
    explanation: "An unspecified mixture/flavouring may hide relevant ingredients; its composition is insufficiently described." },
];

function pattern(aliases: string[]): RegExp {
  const alternatives = [...aliases].sort((a, b) => b.length - a.length).map((alias) =>
    alias.normalize("NFD").replace(/\p{M}/gu, "").split("").map((c) => {
      const accents: Record<string, string> = {
        a: "[aā]", c: "[cč]", e: "[eē]", g: "[gģ]", i: "[iī]", k: "[kķ]",
        l: "[lļ]", n: "[nņ]", s: "[sš]", u: "[uū]", z: "[zž]",
      };
      return accents[c.toLowerCase()] ?? (c === " " ? "[\\s-]+" : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }).join(""));
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "giu");
}

const compiled = rules.map((rule) => ({ ...rule, regex: pattern(rule.aliases) }));
// Recognized neutral vocabulary is deliberately restrictive. Unrecognized
// words or another language yield unknown, never an optimistic pass.
const neutral = pattern([
  "ingredients", "ingredient", "sastāvs", "sastāvdaļas", "rice", "rīsi", "rīsu",
  "flour", "milti", "water", "ūdens", "dzeramais", "salt", "sāls", "sāli",
  "sugar", "cukurs", "cukuru", "rapeseed", "rapšu", "sunflower", "saulespuķu",
  "olive", "olīvu", "oil", "eļļa", "eļļu", "oats", "auzu", "oat",
  "flakes", "pārslas", "corn", "kukurūzas", "potato", "kartupeļu",
  "starch", "ciete", "cieti", "egg", "eggs", "olu", "olas", "ola",
  "chicken", "vistas", "turkey", "tītara", "beef", "liellopu", "pork", "cūkgaļa",
  "meat", "gaļa", "gaļas", "fish", "zivis", "salmon", "lasis", "laša",
  "buckwheat", "griķi", "griķu", "quinoa", "kvinoja", "carrot", "burkāni",
  "organic", "bioloģisks", "bioloģiski", "bio", "and", "un", "with", "ar",
  "powder", "pulveris", "pulveri", "dried", "kaltēti", "infused", "infūzija",
  "free", "from", "bez", "no", "lactose-free", "bezlaktozes",
  "g", "kg", "mg", "ml", "l",
]);

export function assessFodmap(
  product?: Pick<NormalizedProduct, "ingredients_text">,
  unavailableReason?: string,
): FodmapAssessment {
  const original = product?.ingredients_text ?? null;
  const result: FodmapAssessment = {
    outcome: "insufficient_information", rule_version: FODMAP_RULE_VERSION,
    ingredients_text: original, precautionary_text: null,
    evidence: [], uncertainties: [FODMAP_LIMITATION], source_urls: [...FODMAP_SOURCES],
  };
  if (unavailableReason) {
    result.uncertainties.push(unavailableReason);
    return result;
  }
  if (!original?.trim()) {
    result.uncertainties.push("An ingredient list is unavailable; names, nutrition totals and ingredient analysis cannot substitute for it.");
    return result;
  }
  if (original.length > 32_768) {
    result.uncertainties.push("Ingredient text exceeds the screening processing limit; it has not been classified.");
    return result;
  }
  const text = original.normalize("NFC");
  const precaution = /(?:may\s+contain|traces?\s+of|var\s+satur[eē]t|iesp[eē]jamas?\s+p[eē]das)/iu.exec(text);
  const declared = precaution ? text.slice(0, precaution.index) : text;
  const advisory = precaution ? text.slice(precaution.index) : "";
  result.precautionary_text = advisory || null;
  if (advisory) result.uncertainties.push("Precautionary 'may contain' text is reported separately; it is not a measured FODMAP dose or a declared ingredient.");
  let concern = false;
  let review = false;
  if (precaution && (
    (declared.match(/\(/g)?.length ?? 0) > (declared.match(/\)/g)?.length ?? 0) ||
    /(?:ingredients|sast[aā]vs|sast[aā]vda[lļ]as)\s*:/iu.test(advisory)
  )) {
    review = true;
    result.uncertainties.push("A nested precautionary notice or a later ingredient section makes label boundaries ambiguous; manual review is required.");
  }
  const remaining = declared.split("");
  for (const rule of compiled) {
    for (const [section, context] of [[declared, "declared"], [advisory, "precautionary"]] as const) {
      for (const match of section.matchAll(rule.regex)) {
        const at = match.index!;
        const start = Math.max(section.lastIndexOf(",", at - 1), section.lastIndexOf(";", at - 1)) + 1;
        const localBefore = section.slice(Math.max(start, at - 25), at);
        const localAfter = section.slice(at + match[0].length, at + match[0].length + 12);
        const negated = /(?:\bno|\bwithout|\bfree\s+from|\bbez)\s*$/iu.test(localBefore) || /^[-\s]*free\b/iu.test(localAfter);
        const lactoseFree = rule.id === "dairy_quantity" && (
          /(?:lactose[-\s]*free|bezlaktozes|bez\s+laktozes)\s*$/iu.test(localBefore) ||
          /^\s*\(\s*(?:lactose[-\s]*free|bezlaktozes)\s*\)/iu.test(section.slice(at + match[0].length))
        );
        const infused = rule.id === "garlic" &&
          /^(?:[-\s]+infused\s+(?:olive\s+)?oil|\s+(?:infūzijas|infūzija)\s+eļļa)/iu.test(section.slice(at + match[0].length));
        if (context === "declared") {
          for (let i = at; i < at + match[0].length; i++) remaining[i] = " ";
          if (!negated && !lactoseFree) {
            if (rule.kind === "concern" && !infused) concern = true;
            else review = true;
          }
        }
        result.evidence.push({
          rule_id: rule.id, matched_term: match[0], context,
          explanation: negated || lactoseFree
            ? "A local absence/lactose-free qualification was found. This does not certify the product or override other ingredients."
            : infused
              ? "Garlic-infused oil requires review of preparation and residual solids; neither a blanket garlic exclusion nor a suitability claim is justified."
              : rule.explanation,
          source_urls: [...FODMAP_SOURCES],
        });
      }
    }
  }
  const residual = remaining.join("").replace(neutral, " ").replace(/[\d\s\p{P}\p{S}]+/gu, "");
  const meaningful = /\p{L}/u.test(declared.replace(/ingredients|sastāvs|sastāvdaļas/giu, ""));
  if (residual || !meaningful) {
    review = true;
    result.uncertainties.push("Some label terms or language could not be assessed by the limited Latvian/English rule set, or the list is incomplete. No suitability inference was made.");
  }
  if (review) result.uncertainties.push("Ingredient amount, composition or preparation requires review; ingredient order alone does not establish a safe dose.");
  result.outcome = concern ? "potential_concern" : review ? "insufficient_information" : "no_listed_concern";
  return result;
}

export function screenedProduct<T extends NormalizedProduct>(product: T): T & { fodmap_assessment: FodmapAssessment } {
  return { ...product, fodmap_assessment: assessFodmap(product) };
}
