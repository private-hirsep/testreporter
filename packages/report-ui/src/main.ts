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

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Dashboard },
    { path: "/tests", component: Tests },
    { path: "/tests/:id", component: TestDetail },
    { path: "/manual", component: Manual },
    { path: "/coverage", component: Coverage },
    { path: "/requirements", component: Requirements },
    { path: "/security", component: Security },
    { path: "/downloads", component: Downloads },
    { path: "/diagnostics", component: Diagnostics },
    { path: "/history", component: History }
  ]
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
