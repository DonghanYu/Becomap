import { expect, test, type Page } from "@playwright/test";

// 주소는 baseURL(/Becomap/) 기준 상대 경로로 씁니다.
async function choose(page: Page, name: string) {
  const radio = page.getByRole("radio", { name });
  await expect(async () => {
    await radio.click();
    await expect(radio).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
  }).toPass({ timeout: 15000 });
}

test("정적 데모: '변호사' 검색 → 결과 → 다음 단기 목적지", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText("읽기 전용 데모")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel("되고 싶은 직업").fill("변호사");
  await page.getByRole("button", { name: "검색" }).click();

  await expect(page).toHaveURL(/\/Becomap\/jobs\/lawyer\/$/);
  await expect(page.getByRole("note")).toContainText("경로 빈도는 인과가 아닙니다");
  await expect(page.getByTestId("sample-size")).toHaveText("종사자 30명");
  await choose(page, "고교생");
  await expect(page.getByTestId("destination")).toContainText("학부-법학");
});

test("정적 데모: 별칭 검색과 16개 직업 칩", async ({ page }) => {
  await page.goto("search/?q=CPA");
  await expect(page).toHaveURL(/\/Becomap\/jobs\/accountant\/$/);
  await page.goto("./");
  await expect(page.locator('a[href^="/Becomap/jobs/"]')).toHaveCount(16);
});

test("정적 데모: 등록 화면은 데모 안내, noindex 유지", async ({ page }) => {
  await page.goto("contribute/");
  await expect(page.getByRole("heading", { name: "종사자 경로 등록" })).toBeVisible();
  await expect(page.getByText("읽기 전용 데모입니다", { exact: false })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
