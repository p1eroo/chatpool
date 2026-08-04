import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function appVersionPlugin(): Plugin {
  let outDir = "dist";
  let buildId = process.env.VITE_APP_BUILD_ID ?? new Date().toISOString();

  return {
    name: "chatpool-app-version",
    config(_config, { mode }) {
      if (mode === "development") {
        buildId = "dev";
      } else if (!process.env.VITE_APP_BUILD_ID) {
        buildId = new Date().toISOString();
      }

      return {
        define: {
          __APP_BUILD_ID__: JSON.stringify(buildId),
        },
      };
    },
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      if (buildId === "dev") return;

      const payload = {
        buildId,
        builtAt: buildId,
      };

      writeFileSync(
        resolve(outDir, "version.json"),
        `${JSON.stringify(payload, null, 2)}\n`,
        "utf8"
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), appVersionPlugin()],
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
