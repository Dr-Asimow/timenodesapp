import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages alt yolda sunar: https://dr-asimow.github.io/timenodesapp/
  base: "/timenodesapp/",
  plugins: [react()],
  server: { port: 5173, open: true },
});
