import type { Role } from "@wakamete-plus/shared";

export type RoleSet = Record<Role, number>;

export const ROLE_SETS: Readonly<Record<number, RoleSet>> = {
  4:  { villager: 1, seer: 1, werewolf: 1, madman: 1, medium: 0, hunter: 0, shared: 0, fox: 0, cat: 0, fanatic: 0, immoralist: 0 },
  5:  { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 0, hunter: 0, shared: 0, fox: 0, cat: 0, fanatic: 0, immoralist: 0 },
  6:  { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 0, shared: 0, fox: 0, cat: 0, fanatic: 0, immoralist: 0 },
  7:  { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 0, cat: 0, fanatic: 0, immoralist: 0 },
  8:  { villager: 1, seer: 1, werewolf: 2, madman: 1, medium: 1, hunter: 0, shared: 2, fox: 0, cat: 0, fanatic: 0, immoralist: 0 },
  9:  { villager: 4, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 0, cat: 0, fanatic: 0, immoralist: 0 },
  10: { villager: 5, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 0, cat: 0, fanatic: 0, immoralist: 0 },
  11: { villager: 5, seer: 1, werewolf: 2, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 0, cat: 0, fanatic: 0, immoralist: 0 },
  12: { villager: 5, seer: 1, werewolf: 2, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 1, cat: 0, fanatic: 0, immoralist: 0 },
  13: { villager: 6, seer: 1, werewolf: 2, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 1, cat: 0, fanatic: 0, immoralist: 0 },
  14: { villager: 6, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1, cat: 0, fanatic: 0, immoralist: 0 },
  15: { villager: 7, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1, cat: 0, fanatic: 0, immoralist: 0 },
  16: { villager: 6, seer: 1, werewolf: 3, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1, cat: 0, fanatic: 0, immoralist: 0 },
  17: { villager: 5, seer: 1, werewolf: 3, madman: 0, medium: 1, hunter: 1, shared: 2, fox: 1, cat: 1, fanatic: 1, immoralist: 1 },
  18: { villager: 8, seer: 1, werewolf: 1, madman: 0, medium: 1, hunter: 1, shared: 2, fox: 1, cat: 1, fanatic: 1, immoralist: 1 },
  19: { villager: 9, seer: 1, werewolf: 1, madman: 0, medium: 1, hunter: 1, shared: 2, fox: 1, cat: 1, fanatic: 1, immoralist: 1 }
};

export function rolesForPlayerCount(playerCount: number): Role[] {
  const roleSet = ROLE_SETS[playerCount];
  if (!roleSet) {
    throw new Error(`${playerCount}人用の配役が定義されていません。`);
  }
  return (Object.entries(roleSet) as [Role, number][])
    .flatMap(([role, count]) => Array<Role>(count).fill(role));
}

export const ROLE_SET_PLAYER_COUNTS = Object.keys(ROLE_SETS)
  .map(Number)
  .sort((left, right) => left - right);
