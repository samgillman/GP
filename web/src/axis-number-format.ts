import type { AxisNumberFormat } from "./axes.ts";

/**
 * GP's explicit decimal-label contract, not a recovered native rounding rule.
 * Round the number's shortest decimal representation half away from zero.
 * Integer arithmetic avoids binary toFixed ties such as 1.005 -> "1.00".
 */
export function formatAxisTick(
  value: number,
  format: AxisNumberFormat,
): string {
  if (!Number.isFinite(value))
    throw new RangeError("Axis tick values must be finite.");
  if (
    !Number.isInteger(format.decimals) ||
    format.decimals < 0 ||
    format.decimals > 9
  )
    throw new RangeError("Axis decimal places must be an integer from 0 to 9.");

  const { decimals, decimalSeparator, thousandsSeparator, prefix, suffix } =
    format;
  const [mantissa, exponent = "0"] = Math.abs(value).toString().split("e");
  const [integer, fraction = ""] = mantissa.split(".");
  const coefficient = BigInt(integer + fraction);
  const shift = Number(exponent) - fraction.length + decimals;
  let units: bigint;
  if (shift >= 0) {
    units = coefficient * 10n ** BigInt(shift);
  } else {
    const divisor = 10n ** BigInt(-shift);
    const quotient = coefficient / divisor;
    const remainder = coefficient % divisor;
    units = quotient + (remainder * 2n >= divisor ? 1n : 0n);
  }

  const digits = units.toString().padStart(decimals + 1, "0");
  const whole = decimals ? digits.slice(0, -decimals) : digits;
  const grouped = thousandsSeparator
    ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator)
    : whole;
  const decimalPart = decimals
    ? decimalSeparator + digits.slice(-decimals)
    : "";
  const sign = value < 0 && units !== 0n ? "-" : "";
  return prefix + sign + grouped + decimalPart + suffix;
}
