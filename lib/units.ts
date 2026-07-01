import type { WeightUnit } from "./types";

const GRAMS_PER: Record<WeightUnit, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

export const WEIGHT_UNITS: WeightUnit[] = ["g", "kg", "oz", "lb"];

export function toGrams(value: number, unit: WeightUnit): number {
  return value * GRAMS_PER[unit];
}

export function fromGrams(grams: number, unit: WeightUnit): number {
  return grams / GRAMS_PER[unit];
}

function decimalsFor(unit: WeightUnit): number {
  switch (unit) {
    case "g":
      return 1; // grams carry up to one decimal (e.g. 73.5 g)
    case "kg":
      return 2;
    case "oz":
      return 1;
    case "lb":
      return 2;
  }
}

/** Format a gram value in the given unit, e.g. (1234, "kg") -> "1.23 kg". Grams
 *  trim a trailing ".0" so whole numbers stay clean (1100 g, not 1100.0 g). */
export function formatWeight(
  grams: number,
  unit: WeightUnit,
  opts?: { withUnit?: boolean },
): string {
  const withUnit = opts?.withUnit ?? true;
  const decimals = decimalsFor(unit);
  const value = fromGrams(grams, unit);
  const str = value.toLocaleString(undefined, {
    minimumFractionDigits: unit === "g" ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
  return withUnit ? `${str} ${unit}` : str;
}

/**
 * Format for large summary numbers: auto-promotes g→kg and oz→lb once the
 * value gets big, so totals read naturally.
 */
export function formatWeightSmart(grams: number, unit: WeightUnit): string {
  if ((unit === "g" || unit === "kg") && grams >= 1000) {
    const kg = grams / 1000;
    return `${kg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
  }
  if ((unit === "g" || unit === "kg") && grams < 1000) {
    const v = Math.round(grams * 10) / 10;
    return `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })} g`;
  }
  if (unit === "lb" && fromGrams(grams, "lb") < 1) {
    return formatWeight(grams, "oz");
  }
  return formatWeight(grams, unit);
}

export function formatPrice(amount: number, currency: string): string {
  const zeroDecimal = currency === "KRW" || currency === "JPY";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: zeroDecimal ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}
