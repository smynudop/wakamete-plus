import { describe, expect, it } from "vitest";
import { ROLE_SETS, rolesForPlayerCount } from "../src/role-sets.js";

describe("ROLE_SETS", () => {
  it.each(Object.entries(ROLE_SETS))(
    "%s人用配役の合計が参加人数と一致する",
    (playerCount, roleSet) => {
      const total = Object.values(roleSet).reduce((sum, count) => sum + count, 0);
      expect(total).toBe(Number(playerCount));
      expect(rolesForPlayerCount(Number(playerCount))).toHaveLength(Number(playerCount));
      expect(roleSet.villager).toBeGreaterThanOrEqual(1);
    }
  );

  it("未定義の人数を拒否する", () => {
    expect(() => rolesForPlayerCount(2)).toThrow("2人用の配役が定義されていません。");
  });
});
