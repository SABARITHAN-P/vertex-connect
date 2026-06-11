import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@components": path.resolve("src/components"),
      "@pages": path.resolve("src/pages"),
      "@hooks": path.resolve("src/hooks"),
      "@context": path.resolve("src/context"),
      "@services": path.resolve("src/services"),
      "@socket": path.resolve("src/socket"),
      "@utils": path.resolve("src/utils"),
      "@assets": path.resolve("src/assets"),
    },
  },
});
