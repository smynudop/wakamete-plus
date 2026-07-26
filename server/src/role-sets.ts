import type { Role } from "@wakamete-plus/shared";

export type RoleSet = Record<Role, number>;

export const ROLE_SETS: Readonly<Record<number, RoleSet>> = {
  3:  { villager: 0, seer: 1, werewolf: 1, madman: 1, medium: 0, hunter: 0, shared: 0, fox: 0 },
  4:  { villager: 1, seer: 1, werewolf: 1, madman: 1, medium: 0, hunter: 0, shared: 0, fox: 0 },
  5:  { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 0, hunter: 0, shared: 0, fox: 0 },
  6:  { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 0, shared: 0, fox: 0 },
  7:  { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 0 },
  8:  { villager: 1, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 0 },
  9:  { villager: 1, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  10: { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  11: { villager: 3, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  12: { villager: 4, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  13: { villager: 5, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  14: { villager: 6, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  15: { villager: 7, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  16: { villager: 8, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  17: { villager: 9, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  18: { villager: 10, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  19: { villager: 11, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 }
};

export function rolesForPlayerCount(playerCount: number): Role[] {
  const roleSet = ROLE_SETS[playerCount];
  if (!roleSet) {
    throw new Error(`${playerCount}人用の配役が定義されていません。`);
  }
  return (Object.entries(roleSet) as [Role, number][])
    .flatMap(([role, count]) => Array<Role>(count).fill(role));
}

