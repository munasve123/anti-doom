import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  forbidOnly: true,
  reporter: "list",
  projects: [
    {
      name: "webkit-iphone",
      use: { ...devices["iPhone 15"] },
    },
  ],
});
