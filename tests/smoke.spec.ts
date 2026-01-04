import { test, expect } from "@playwright/test";

test("app loads and shows main panels", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Task Groups" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Snippets" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved Prompts" })).toBeVisible();

  await expect(
    page.getByPlaceholder("Start typing your prompt here... Type '{{' to include snippet."),
  ).toBeVisible();
});
