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
import Downloads from "./views/Downloads.vue";
import History from "./views/History.vue";
import Requirements from "./views/Requirements.vue";
import Security from "./views/Security.vue";
import SecurityDetail from "./views/SecurityDetail.vue";
import TestDetail from "./views/TestDetail.vue";
import Tests from "./views/Tests.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Dashboard },
    { path: "/tests", component: Tests },
    { path: "/tests/:id", component: TestDetail },
    { path: "/coverage", component: Coverage },
    { path: "/requirements", component: Requirements },
    { path: "/security", component: Security },
    { path: "/security/:id", component: SecurityDetail },
    { path: "/downloads", component: Downloads },
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
