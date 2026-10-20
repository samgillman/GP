import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAxisTick } from "./axis-number-format.ts";
import type { AxisNumberFormat } from "./axes.ts";

const fixed = (
  decimals: number,
  extra: Partial<AxisNumberFormat> = {},
): AxisNumberFormat => ({
  decimals,
  decimalSeparator: ".",
  thousandsSeparator: "",
  prefix: "",
  suffix: "",
  ...extra,
});

// Shared with the Python Decimal(str(value))/ROUND_HALF_UP export contract.
const golden: [number, number, string][] = [
  [1.005, 2, "1.01"],
  [-1.005, 2, "-1.01"],
  [2.675, 2, "2.68"],
  [-2.675, 2, "-2.68"],
  [1.0049999999999997, 2, "1.00"],
  [-1.0049999999999997, 2, "-1.00"],
  [2.5, 0, "3"],
  [-2.5, 0, "-3"],
  [0.5, 0, "1"],
  [-0.5, 0, "-1"],
  [-0.0004, 3, "0.000"],
  [-0.0005, 3, "-0.001"],
  [0, 9, "0.000000000"],
  [-0, 9, "0.000000000"],
  [-0, 0, "0"],
  [999.995, 2, "1000.00"],
  [1e21, 2, "1000000000000000000000.00"],
  [1e-7, 9, "0.000000100"],
  [5e-324, 9, "0.000000000"],
  [-5e-324, 0, "0"],
  [1.0000000005, 9, "1.000000001"],
  [9.9999999995, 9, "10.000000000"],
  [1.2345678901, 9, "1.234567890"],
  [123, 4, "123.0000"],
];
for (const [value, decimals, expected] of golden) {
  test(`decimal golden ${Object.is(value, -0) ? "-0" : value} with ${decimals} places`, () => {
    assert.equal(formatAxisTick(value, fixed(decimals)), expected);
  });
}

test("fixed decimals expand large exponent notation without scientific fallback", () => {
  assert.equal(formatAxisTick(1e100, fixed(2)), "1" + "0".repeat(100) + ".00");
  assert.equal(formatAxisTick(-1e100, fixed(9)), "-1" + "0".repeat(100) + ".000000000");
  assert.equal(
    formatAxisTick(Number.MAX_VALUE, fixed(0)),
    "17976931348623157" + "0".repeat(292),
  );
});

test("integer grouping follows rounding carries and does not group fractions", () => {
  const grouped = fixed(2, { thousandsSeparator: "," });
  assert.equal(formatAxisTick(999.995, grouped), "1,000.00");
  assert.equal(formatAxisTick(-999.995, grouped), "-1,000.00");
  assert.equal(formatAxisTick(1234567.89, grouped), "1,234,567.89");
  assert.equal(formatAxisTick(12.3456789, fixed(9, { thousandsSeparator: "," })), "12.345678900");
  assert.equal(formatAxisTick(-0.004, grouped), "0.00");
});

test("every supported decimal/grouping separator is literal and independent", () => {
  for (const decimalSeparator of [".", ",", "·"] as const) {
    for (const thousandsSeparator of ["", ",", " ", "'"] as const) {
      // The shared model rejects conflicting nonempty separators.
      if (decimalSeparator === thousandsSeparator) continue;
      const format = fixed(2, { decimalSeparator, thousandsSeparator });
      assert.equal(
        formatAxisTick(-1234567.5, format),
        `-1${thousandsSeparator}234${thousandsSeparator}567${decimalSeparator}50`,
      );
      assert.equal(
        formatAxisTick(1234, { ...format, decimals: 0 }),
        `1${thousandsSeparator}234`,
      );
    }
  }
});

test("prefix and suffix are literal text, including markup and replacement tokens", () => {
  const format = fixed(2, {
    prefix: '<script>alert("x")</script>',
    suffix: "$&<img src=x onerror=alert(1)>",
    thousandsSeparator: "'",
  });
  assert.equal(
    formatAxisTick(-1234.5, format),
    '<script>alert("x")</script>-1\'234.50$&<img src=x onerror=alert(1)>',
  );
  assert.equal(
    formatAxisTick(-0.001, fixed(2, { prefix: "≈ ", suffix: " µM" })),
    "≈ 0.00 µM",
  );
});

test("all supported precisions retain exactly their specified fractional width", () => {
  for (let decimals = 0; decimals <= 9; decimals++) {
    assert.equal(
      formatAxisTick(12, fixed(decimals)),
      "12" + (decimals ? "." + "0".repeat(decimals) : ""),
    );
  }
});

test("public formatter rejects nonfinite values and unbounded precision", () => {
  for (const value of [NaN, Infinity, -Infinity])
    assert.throws(() => formatAxisTick(value, fixed(2)), /finite/);
  for (const decimals of [-1, 0.5, 10, 1e9, NaN, Infinity])
    assert.throws(() => formatAxisTick(1, fixed(decimals)), /0 to 9/);
});
