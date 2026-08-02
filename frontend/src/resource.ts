import type {
  Role,
  Team,
  GamePhase
} from "@wakamete-plus/shared";

export const roleLabels: Record<Role, string> = {
  villager: "村人",
  seer: "占い師",
  werewolf: "人狼",
  madman: "狂人",
  medium: "霊能者",
  hunter: "狩人",
  shared: "共有者",
  fox: "妖狐",
  cat: "猫又",
  fanatic: "狂信者",
  immoralist: "背徳者"
};

export const phaseLabels: Record<GamePhase, string> = {
  waiting: "待機中",
  nightDiscussion: "夜の議論",
  nightAttack: "夜の襲撃",
  dayDiscussion: "昼の議論",
  dayVote: "昼の投票",
  ended: "終了"
};

export const teamLabels: Record<Team, string> = {
  villagers: "村人",
  werewolves: "人狼",
  fox: "妖狐"
}

export const roleDescriptions: Record<Role, string> = {
  villager: `ありません。
しかし、アナタの知恵と勇気で村を救うことができるはずです。`,
  seer: `村人ひとりを「人」か「狼」か調べることができます。
また、妖狐を占うことで呪い殺すこともできます。
アナタが村人の勝利を握っています！`,
  werewolf: `夜の間に他の人狼と協力し村人ひとり殺害できます。
自分以外の人狼がだれなのか知ることができます。
アナタはその強力な力で村人を食い殺すのです。`,
  madman: `人狼の勝利がアナタの勝利となります。
アナタはできるかぎり狂って場をかき乱すのです。バカになれ。`,
  medium: "処刑された人物が人間か人狼かを知ることができます。",
  hunter: "夜に一人を護衛し、人狼の襲撃から守ることができます。",
  shared: "他の共有者がわかり、夜に共有者同士で会話できます。",
  fox: "第三陣営です。襲撃では死亡しませんが、占われると翌朝死亡します。",
  cat: "襲撃されると襲撃者と相打ちになり、処刑されると生存者を一人道連れにします。",
  fanatic: "人狼陣営です。村にいる人狼が誰なのか常にわかります。",
  immoralist: "妖狐陣営です。生存する妖狐がいなくなると後追いします。"
};
