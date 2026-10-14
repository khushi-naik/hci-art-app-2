import { test, expect } from "@playwright/test";
test("two guests read rules, draw privately, refresh, reveal and download a real PNG", async ({
  browser,
}) => {
  const ctxA = await browser.newContext(),
    ctxB = await browser.newContext();
  const a = await ctxA.newPage(),
    b = await ctxB.newPage();
  await a.goto("/");
  await expect(a.getByRole("button", { name: "Create a room" })).toBeEnabled();
  await a.screenshot({ path: "docs/screenshots/landing.png", fullPage: true });
  await a.getByRole("button", { name: "Create a room" }).click();
  await a.getByLabel("Your display name").fill("Alex");
  await a.getByRole("button", { name: "Create my room" }).click();
  await expect(a).toHaveURL(/\/room\/[A-Z2-9]{8}/);
  const url = a.url();
  await b.goto(url);
  await b.getByLabel("Your display name").fill("Blake");
  await b.getByRole("button", { name: "Join this room" }).click();
  for (const page of [a, b]) {
    await expect(
      page.getByText("Keep the surprise", { exact: true }),
    ).toBeVisible();
    await page.locator(".rules summary").click();
    await expect(
      page.getByText("Keep the surprise", { exact: true }),
    ).not.toBeVisible();
    await page.locator(".rules summary").click();
    await expect(
      page.getByText("Keep the surprise", { exact: true }),
    ).toBeVisible();
  }
  await a.screenshot({ path: "docs/screenshots/lobby.png", fullPage: true });
  await a.getByRole("combobox", { name: "Time per turn" }).selectOption("2");
  await a.getByRole("button", { name: "I’m ready" }).click();
  await b.getByRole("button", { name: "I’m ready" }).click();
  await a.getByRole("button", { name: "Begin together" }).click();
  await expect(a.locator(".turn-bar")).toBeVisible();
  await expect(b.locator(".turn-bar")).toBeVisible();
  await expect
    .poll(
      async () =>
        (await a.getByRole("button", { name: "Finish early" }).count()) +
        (await b.getByRole("button", { name: "Finish early" }).count()),
    )
    .toBe(1);
  const artist = (await a.getByRole("button", { name: "Finish early" }).count())
      ? a
      : b,
    waiter = artist === a ? b : a;
  await expect(artist.locator("canvas").first()).toBeVisible();
  await expect(waiter.locator("canvas")).toHaveCount(0);
  await expect(
    waiter.getByRole("button", { name: "Sound off" }),
  ).toHaveAttribute("aria-pressed", "false");
  await waiter.getByRole("button", { name: "Sound off" }).click();
  await expect(
    waiter.getByRole("button", { name: "Sound on" }),
  ).toHaveAttribute("aria-pressed", "true");
  await waiter.getByRole("button", { name: "Sound on" }).click();
  await waiter.getByLabel("Reduce motion").check();
  await expect(waiter.getByLabel("Reduce motion")).toBeChecked();
  await waiter
    .getByRole("button", { name: "How to Play", exact: false })
    .click();
  await expect(waiter.getByRole("dialog")).toBeVisible();
  await waiter.keyboard.press("Escape");
  const box = await artist.locator(".artboard").boundingBox();
  if (!box) throw Error("No canvas");
  await artist.mouse.move(box.x + 40, box.y + 40);
  await artist.mouse.down();
  await artist.mouse.move(box.x + 150, box.y + 120, { steps: 20 });
  await artist.mouse.up();
  await artist.getByRole("button", { name: "Undo", exact: false }).click();
  await artist.getByRole("button", { name: "Redo", exact: false }).click();
  await expect(artist.getByRole("status")).toContainText("Saved privately", {
    timeout: 10000,
  });
  await artist.screenshot({
    path: "docs/screenshots/drawing.png",
    fullPage: true,
  });
  await waiter.screenshot({
    path: "docs/screenshots/waiting.png",
    fullPage: true,
  });
  await artist.reload();
  await expect(
    artist.getByRole("button", { name: "Finish early" }),
  ).toBeVisible();
  await artist.getByRole("button", { name: "Finish early" }).click();
  await expect(
    waiter.getByText("Your canvas opens in a moment."),
  ).toBeVisible();
  await expect(waiter.locator("canvas")).toHaveCount(0);
  await expect(
    waiter.getByRole("button", { name: "Finish early" }),
  ).toBeVisible({ timeout: 18000 });
  await expect(artist.locator("canvas")).toHaveCount(0);
  // An eraser stroke in the second overlay must not remove earlier ink.
  await waiter.getByRole("button", { name: "Eraser", exact: true }).click();
  const secondBox = await waiter.locator(".artboard").boundingBox();
  if (!secondBox) throw Error("No second canvas");
  await waiter.mouse.move(secondBox.x + 40, secondBox.y + 40);
  await waiter.mouse.down();
  await waiter.mouse.move(secondBox.x + 150, secondBox.y + 120, { steps: 20 });
  await waiter.mouse.up();
  await waiter.getByRole("button", { name: "Finish early" }).click();
  for (const page of [a, b])
    await expect(
      page.getByRole("heading", { name: "Look what you made." }),
    ).toBeVisible();
  await expect
    .poll(async () => await a.locator(".artboard canvas").count())
    .toBeGreaterThan(0);
  const hasOriginalInk = await a.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLCanvasElement>(".artboard canvas"),
    ).some((canvas) => {
      const data = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 4)
        if (
          data[i] === 96 &&
          data[i + 1] === 125 &&
          data[i + 2] === 105 &&
          data[i + 3] > 200
        )
          return true;
      return false;
    }),
  );
  expect(hasOriginalInk).toBe(true);
  await a.screenshot({ path: "docs/screenshots/reveal.png", fullPage: true });
  const downloadPromise = a.waitForEvent("download");
  await a.getByRole("button", { name: "Download PNG" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(800);
  await ctxA.close();
  await ctxB.close();
});

test("mobile welcome and lobby keep all rules and readiness usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Create a room" }).click();
  await page.getByLabel("Your display name").fill("River");
  await page.getByRole("button", { name: "Create my room" }).click();
  await expect(
    page.getByText("Enjoy the final reveal", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".rules ol li")).toHaveCount(7);
  await page.getByRole("button", { name: "I’m ready" }).click();
  await expect(
    page.getByRole("button", { name: "Ready · undo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Begin together" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/mobile-lobby.png",
    fullPage: true,
  });
});
