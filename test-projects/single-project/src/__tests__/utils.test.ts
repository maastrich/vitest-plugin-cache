import { describe, expect, it } from "vitest";
import { add, Calculator, fibonacci, multiply } from "../utils.js";

describe("Utils", () => {
  describe("add", () => {
    it("should add two positive numbers", () => {
      expect(add(2, 3)).toBe(5);
    });

    it("should add negative numbers", () => {
      expect(add(-2, -3)).toBe(-5);
    });

    it("should add positive and negative numbers", () => {
      expect(add(5, -3)).toBe(2);
    });
  });

  describe("multiply", () => {
    it("should multiply two positive numbers", () => {
      expect(multiply(3, 4)).toBe(12);
    });

    it("should multiply by zero", () => {
      expect(multiply(5, 0)).toBe(0);
    });

    it("should multiply negative numbers", () => {
      expect(multiply(-2, -3)).toBe(6);
    });
  });

  describe("fibonacci", () => {
    it("should calculate fibonacci numbers correctly", () => {
      expect(fibonacci(0)).toBe(0);
      expect(fibonacci(1)).toBe(1);
      expect(fibonacci(5)).toBe(5);
      expect(fibonacci(10)).toBe(55);
    });
  });

  describe("Calculator", () => {
    it("should add numbers and track history", () => {
      const calc = new Calculator();
      expect(calc.add(2, 3)).toBe(5);
      expect(calc.add(4, 5)).toBe(9);
      expect(calc.getHistory()).toEqual([5, 9]);
    });

    it("should clear history", () => {
      const calc = new Calculator();
      calc.add(1, 2);
      calc.clearHistory();
      expect(calc.getHistory()).toEqual([]);
    });
  });
});
