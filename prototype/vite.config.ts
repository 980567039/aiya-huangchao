import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // The prototype reads the repository-level data/ directory as its source of truth.
      allow: [".."],
    },
  },
});
