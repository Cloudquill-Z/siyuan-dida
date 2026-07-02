import { defineConfig } from "vite";
import { resolve } from "node:path";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import packageJson from "./package.json";

export default defineConfig({
  define: {
    __PLUGIN_VERSION__: JSON.stringify(packageJson.version)
  },
  plugins: [
    {
      name: "copy-plugin-assets",
      writeBundle() {
        const outDir = join(__dirname, "dist");
        mkdirSync(outDir, { recursive: true });
        for (const file of ["plugin.json", "README.md", "README_zh_CN.md", "icon.png", "preview.png"]) {
          const src = join(__dirname, file);
          if (existsSync(src)) {
            copyFileSync(src, join(outDir, file));
          }
        }
      }
    }
  ],
  build: {
    target: "es2020",
    minify: false,
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["cjs"],
      fileName: () => "index.js"
    },
    rollupOptions: {
      external: ["siyuan", "node:child_process", "node:fs", "node:fs/promises", "node:os", "node:path"],
      output: {
        assetFileNames: "index.css"
      }
    },
    outDir: "dist"
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
