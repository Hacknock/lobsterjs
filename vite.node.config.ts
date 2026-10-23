import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.node.ts"),
      name: "LobsterNode",
      fileName: "lobster.node",
      formats: ["es", "cjs"],
    },
    outDir: "dist",
    emptyOutDir: false,
    minify: true,
  },
});
