import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import "./styles.css";
import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import App from "./App.vue";
import Coverage from "./views/Coverage.vue";
import Dashboard from "./views/Dashboard.vue";
import Diagnostics from "./views/Diagnostics.vue";
import Downloads from "./views/Downloads.vue";
import History from "./views/History.vue";
import Requirements from "./views/Requirements.vue";
import Security from "./views/Security.vue";
import TestDetail from "./views/TestDetail.vue";
import Tests from "./views/Tests.vue";
import Manual from "./views/Manual.vue";
import Readiness from "./views/Readiness.vue";
import { navItems } from "./services/navigation";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Dashboard, alias: ["/overview"] },
    { path: "/tests", component: Tests, alias: ["/test-cases"] },
    { path: "/tests/:id", component: TestDetail },
    { path: "/manual", component: Manual },
    { path: "/readiness", component: Readiness },
    { path: "/coverage", component: Coverage },
    { path: "/requirements", component: Requirements },
    { path: "/security", component: Security },
    { path: "/downloads", component: Downloads, alias: ["/evidence"] },
    { path: "/diagnostics", component: Diagnostics },
    { path: "/history", component: History, alias: ["/executions"] }
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) {
      // Report data loads asynchronously, so the anchor target may not exist
      // yet; views handle late scrolling themselves in that case.
      try {
        if (document.querySelector(to.hash)) return { el: to.hash, top: 12 };
      } catch {
        return { top: 0 };
      }
      return undefined;
    }
    return { top: 0 };
  }
});

router.afterEach((to) => {
  const section = navItems.find(
    (item) =>
      to.path === item.to ||
      (item.to !== "/" && to.path.startsWith(`${item.to}/`)) ||
      (item.aliases ?? []).some((alias) => to.path === alias || to.path.startsWith(`${alias}/`))
  );
  document.title = section ? `${section.title} · Quality Report` : "Quality Report";
});

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: "quality",
    themes: {
      quality: {
        dark: false,
        colors: {
          primary: "#1f5f5b",
          secondary: "#6f5b2f",
          surface: "#ffffff",
          background: "#f7f8f6",
          error: "#b42318",
          warning: "#b54708",
          success: "#157f3b",
          info: "#3457a0"
        }
      }
    }
  }
});

createApp(App).use(router).use(vuetify).mount("#app");
