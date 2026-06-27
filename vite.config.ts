import { defineConfig } from "vite";
import { resolve } from "node:path";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export default defineConfig({
  plugins: [
    {
      name: "copy-plugin-assets",
      writeBundle() {
        const outDir = join(__dirname, "dist");
        mkdirSync(outDir, { recursive: true });
        for (const file of ["plugin.json", "README.md", "README_zh_CN.md"]) {
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
      external: ["siyuan", "node:child_process", "node:fs/promises", "node:os", "node:path"],
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
