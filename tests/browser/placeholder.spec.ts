import { expect, test } from "@playwright/test";

// Placeholder until the real suite lands. The CSS layer depends on :has(),
// so confirm the WebKit build under test supports it.
test("WebKit supports :has() for the CSS layer", async ({ page }) => {
  await page.setContent(`
    <style>main article:has(a[href^="/reel/"]) { display: none !important; }</style>
    <main>
      <article id="reel"><a href="/reel/id_1/">reel</a></article>
      <article id="post"><a href="/p/id_2/">post</a></article>
    </main>
  `);
  await expect(page.locator("#reel")).toBeHidden();
  await expect(page.locator("#post")).toBeVisible();
});
