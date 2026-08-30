import {expect, test} from "@playwright/test";

test("Chromium automation runtime is operational", async ({page}) => {
  await page.setContent("<main><h1>AI Video Factory</h1><button>开始制作</button></main>");
  await expect(page.getByRole("heading")).toHaveText("AI Video Factory");
  await expect(page.getByRole("button")).toHaveText("开始制作");
});
