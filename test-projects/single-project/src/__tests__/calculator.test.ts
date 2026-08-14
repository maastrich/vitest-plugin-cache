import { describe, expect, it } from "vitest";
import { AdvancedCalculator } from "../calculator.js";

describe("AdvancedCalculator", () => {
  it("should extend basic calculator functionality", () => {
    const calc = new AdvancedCalculator();
    expect(calc.add(2, 3)).toBe(5);
    expect(calc.getHistory()).toEqual([5]);
  });

  it("should multiply numbers", () => {
    const calc = new AdvancedCalculator();
    expect(calc.multiply(3, 4)).toBe(12);
    expect(calc.getOperations()).toContain("multiply(3, 4) = 12");
  });

  it("should divide numbers", () => {
    const calc = new AdvancedCalculator();
    expect(calc.divide(10, 2)).toBe(5);
    expect(calc.getOperations()).toContain("divide(10, 2) = 5");
  });

  it("should throw error when dividing by zero", () => {
    const calc = new AdvancedCalculator();
    expect(() => calc.divide(10, 0)).toThrow("Division by zero");
  });

  it("should track all operations", () => {
    const calc = new AdvancedCalculator();
    calc.add(1, 2);
    calc.multiply(3, 4);
    calc.divide(8, 2);

    expect(calc.getHistory()).toEqual([3]);
    expect(calc.getOperations()).toHaveLength(2);
    expect(calc.getOperations()).toContain("multiply(3, 4) = 12");
    expect(calc.getOperations()).toContain("divide(8, 2) = 4");
  });
});
