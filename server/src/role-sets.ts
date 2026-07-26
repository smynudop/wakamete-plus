import type { Role } from "@wakamete-plus/shared";

export type RoleSet = Record<Role, number>;

export const ROLE_SETS: Readonly<Record<number, RoleSet>> = {
  4:  { villager: 1, seer: 1, werewolf: 1, madman: 1, medium: 0, hunter: 0, shared: 0, fox: 0 },
  5:  { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 0, hunter: 0, shared: 0, fox: 0 },
  6:  { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 0, shared: 0, fox: 0 },
  7:  { villager: 2, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 0 },
  8:  { villager: 5, seer: 1, werewolf: 2, madman: 0, medium: 0, hunter: 0, shared: 0, fox: 0 },
  9:  { villager: 4, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 0 },
  10: { villager: 5, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 0 },
  11: { villager: 5, seer: 1, werewolf: 2, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 0 },
  12: { villager: 5, seer: 1, werewolf: 2, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 1 },
  13: { villager: 6, seer: 1, werewolf: 2, madman: 1, medium: 1, hunter: 1, shared: 0, fox: 1 },
  14: { villager: 6, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  15: { villager: 7, seer: 1, werewolf: 1, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  16: { villager: 6, seer: 1, werewolf: 3, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
  17: { villager: 7, seer: 1, werewolf: 3, madman: 1, medium: 1, hunter: 1, shared: 2, fox: 1 },
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

export function rolesForHumanPlayers(totalPlayerCount: number): Role[] {
  const roles = rolesForPlayerCount(totalPlayerCount);
  const firstVillagerIndex = roles.indexOf("villager");
  if (firstVillagerIndex === -1) {
    throw new Error(`${totalPlayerCount}人用の配役には初日犠牲者用の村人が必要です。`);
  }
  roles.splice(firstVillagerIndex, 1);
  return roles;
}

export const ROLE_SET_PLAYER_COUNTS = Object.keys(ROLE_SETS)
  .map(Number)
  .sort((left, right) => left - right);
