/**
 * Tests for MoneyValue: half-even (bankers) rounding, tie cases, negatives.
 */

import { describe, it, expect } from "vitest";
import { toMoneyValue } from "../moneyValue";

describe("toMoneyValue", () => {
  it("1.005000 -> display 1.00 (half-even: round to even)", () => {
    const v = toMoneyValue("1.005000");
    expect(v.raw).toBe("1.005000");
    expect(v.display).toBe("1.00");
  });

  it("1.015000 -> display 1.02 (half-even: round to even)", () => {
    const v = toMoneyValue("1.015000");
    expect(v.raw).toBe("1.015000");
    expect(v.display).toBe("1.02");
  });

  it("2.005000 -> display 2.00 (half-even: 2 is even)", () => {
    const v = toMoneyValue("2.005000");
    expect(v.raw).toBe("2.005000");
    expect(v.display).toBe("2.00");
  });

  it("2.015000 -> display 2.02 (half-even: 2 is even)", () => {
    const v = toMoneyValue("2.015000");
    expect(v.raw).toBe("2.015000");
    expect(v.display).toBe("2.02");
  });

  it("negative tie: -1.005000 -> display -1.00", () => {
    const v = toMoneyValue("-1.005000");
    expect(v.raw).toBe("-1.005000");
    expect(v.display).toBe("-1.00");
  });

  it("negative: -1.015000 -> display -1.02", () => {
    const v = toMoneyValue("-1.015000");
    expect(v.raw).toBe("-1.015000");
    expect(v.display).toBe("-1.02");
  });

  it("display always exactly 2 decimals", () => {
    expect(toMoneyValue("0").display).toBe("0.00");
    expect(toMoneyValue("1").display).toBe("1.00");
    expect(toMoneyValue("1.1").display).toBe("1.10");
    expect(toMoneyValue("1.99").display).toBe("1.99");
  });

  it("raw normalized to 6 dp", () => {
    expect(toMoneyValue("1").raw).toBe("1.000000");
    expect(toMoneyValue("1.5").raw).toBe("1.500000");
    expect(toMoneyValue("1.1234567").raw).toBe("1.123457");
  });

  it("invalid input treated as zero", () => {
    const v = toMoneyValue("not a number");
    expect(v.raw).toBe("0.000000");
    expect(v.display).toBe("0.00");
  });
});
