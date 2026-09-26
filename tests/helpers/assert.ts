import { expect } from 'bun:test';

export const assert = {
  equal(actual: unknown, expected: unknown, message?: string): void {
    expect(actual, message).toBe(expected);
  },
  deepEqual(actual: unknown, expected: unknown, message?: string): void {
    expect(actual, message).toEqual(expected);
  },
  match(actual: string, expression: RegExp, message?: string): void {
    expect(actual, message).toMatch(expression);
  },
  doesNotMatch(actual: string, expression: RegExp, message?: string): void {
    expect(actual, message).not.toMatch(expression);
  },
};
