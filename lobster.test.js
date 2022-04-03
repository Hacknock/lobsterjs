import { describe, it, expect } from "vitest";
import lobster_utils from "./lobster_utils";

describe("matchStrikethrough", () => {
  it("find simple text", () => {
    const sut = "hoge hoge ~~hoge hoge~~ hoge hoge";
    const actual = lobster_utils.matchStrikethrough(sut);
    expect(actual).toBe("~~hoge hoge~~");
  });

  it("not found", () => {
    const sut = "hoge hoge ~hoge hoge~ hoge hoge";
    const actual = lobster_utils.matchStrikethrough(sut);
    expect(actual).toBeNull();
  });
});
