import { createRouter, createWebHistory } from "vue-router";
import TopPage from "./pages/TopPage.vue";
import LobbyPage from "./pages/LobbyPage.vue";
import GamePage from "./pages/GamePage.vue";
import RoleSetsPage from "./pages/RoleSetsPage.vue";
import GameLogsPage from "./pages/GameLogsPage.vue";
import RulesPage from "./pages/RulesPage.vue";
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "top", component: TopPage },
    { path: "/lobby", name: "lobby", component: LobbyPage },
    { path: "/role-sets", name: "role-sets", component: RoleSetsPage },
    { path: "/rules", name: "rules", component: RulesPage },
    { path: "/logs", name: "game-logs", component: GameLogsPage },
    { path: "/logs/:roomId", name: "game-log", component: GamePage },
    { path: "/rooms/:roomId", name: "room", component: GamePage },
    ...(import.meta.env.DEV
      ? [{
          path: "/development/game",
          name: "game-preview",
          component: () => import("./pages/GamePreviewPage.vue")
        }]
      : [])
  ]
});
