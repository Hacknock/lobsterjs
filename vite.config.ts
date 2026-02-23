import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Lobster",
      fileName: "lobster",
      formats: ["es", "umd"],
    },
    outDir: "dist",
    minify: true,
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
