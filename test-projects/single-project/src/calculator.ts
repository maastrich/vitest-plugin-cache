import { Calculator } from "./utils.js";

export class AdvancedCalculator extends Calculator {
  private operations: string[] = [];

  multiply(a: number, b: number): number {
    const result = a * b;
    this.operations.push(`multiply(${a}, ${b}) = ${result}`);
    return result;
  }

  divide(a: number, b: number): number {
    if (b === 0) throw new Error("Division by zero");
    const result = a / b;
    this.operations.push(`divide(${a}, ${b}) = ${result}`);
    return result;
  }

  getOperations(): string[] {
    return [...this.operations];
  }
}
