import type { Role } from "@wakamete-plus/shared";

export type RoleSet = { [key in Role]?: number }

export const ROLE_SETS: Readonly<Record<number, RoleSet>> = {
  4: { villager: 1, seer: 1, werewolf: 1, medium: 1 },
  5: { villager: 1, seer: 1, werewolf: 1, madman: 1, hunter: 1 },
  6: { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 1 },
  7: { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1 },
  8: { villager: 1, seer: 1, werewolf: 2, madman: 1, medium: 1, shared: 2 },
  9: { villager: 5, seer: 1, werewolf: 2, medium: 1 },
  10: { villager: 5, seer: 1, werewolf: 2, madman: 1, medium: 1 },
  11: { villager: 5, seer: 1, werewolf: 2, madman: 1, medium: 1, hunter: 1 },
  12: { villager: 5, seer: 1, werewolf: 2, madman: 1, medium: 1, hunter: 1, fox: 1 },
  13: { villager: 6, seer: 1, werewolf: 2, madman: 1, medium: 1, hunter: 1, fox: 1 },
  14: { villager: 4, seer: 1, werewolf: 2, fanatic: 1, medium: 1, hunter: 1, shared: 2, fox: 1, immoralist: 1 },
  15: { villager: 5, seer: 1, werewolf: 2, fanatic: 1, medium: 1, hunter: 1, shared: 2, fox: 1, immoralist: 1 },
  16: { villager: 6, seer: 1, werewolf: 3, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  17: { villager: 7, seer: 1, werewolf: 3, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  18: { villager: 6, seer: 1, werewolf: 4, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1, cat: 1 },
  19: { villager: 6, seer: 1, werewolf: 4, fanatic: 1, medium: 1, hunter: 1, shared: 2, fox: 1, cat: 1, immoralist: 1 }
};

export function rolesForPlayerCount(playerCount: number): Role[] {
  const roleSet = ROLE_SETS[playerCount];
  if (!roleSet) {
    throw new Error(`${playerCount}人用の配役が定義されていません。`);
  }
  return (Object.entries(roleSet) as [Role, string | number][])
    .flatMap(([role, count]) => typeof count === "number" ? Array<Role>(count).fill(role) : []);
}

export const ROLE_SET_PLAYER_COUNTS = Object.keys(ROLE_SETS)
  .map(Number)
  .sort((left, right) => left - right);
