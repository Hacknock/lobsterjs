import { test, expect } from "vitest";
import lobster from "./lobster";

test("1+1=2", () => {
  expect(lobster.add(1, 1)).toBe(2);
});

test("2*2=4", () => {
  expect(lobster.times(2, 2)).toBe(4);
});
