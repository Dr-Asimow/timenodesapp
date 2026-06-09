import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Custom domain: https://timenodes.app
  base: "/",
  plugins: [react()],
  server: { port: 5173, open: true },
});
