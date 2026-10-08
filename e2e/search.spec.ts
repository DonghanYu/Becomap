import { expect, test, type Page } from "@playwright/test";

/** 하이드레이션 전 클릭이 무시될 수 있어, 선택 상태가 반영될 때까지 다시 누릅니다. */
async function choose(page: Page, name: string) {
  const radio = page.getByRole("radio", { name });
  await expect(async () => {
    await radio.click();
    await expect(radio).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
  }).toPass({ timeout: 15000 });
}

test("'변호사' 검색 → 결과 화면 → 다음 단기 목적지 표시", async ({ page }) => {
  await page.goto("/");
  // 모바일 폭에서 가로 스크롤이 생기지 않아야 함
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("searchbox").or(page.getByLabel("되고 싶은 직업")).fill("변호사");
  await page.getByRole("button", { name: "검색" }).click();

  await expect(page).toHaveURL(/\/jobs\/lawyer$/);
  await expect(page.getByRole("heading", { name: "변호사가 되고 싶어요" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("경로 빈도는 인과가 아닙니다");
  await expect(page.getByTestId("sample-size")).toHaveText("종사자 30명");
  await expect(page.getByRole("img", { name: "변호사 경로 그래프" })).toBeVisible();

  await choose(page, "고교생");
  const dest = page.getByTestId("destination");
  await expect(dest).toContainText("다음 단기 목적지");
  await expect(dest).toContainText("학부-법학");

  await choose(page, "대학생(학부)");
  await expect(dest).toContainText("학원-LEET 준비");
});

test("관문 패널: 공식 통계와 출처, 통계가 없으면 '공식 통계 확인 중'", async ({ page }) => {
  await page.goto("/jobs/lawyer");
  await page.getByText("마디 목록으로 보기").click();
  const panel = page.getByTestId("node-panel");
  await expect(async () => {
    await page.getByRole("button", { name: "관문-변호사시험", exact: true }).click();
    await expect(panel).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await expect(panel).toContainText("응시자 대비 합격률: 50.95%");
  await expect(panel.getByRole("link", { name: "출처" }).first()).toHaveAttribute("href", /moj\.go\.kr/);

  await page.goto("/jobs/doctor");
  await page.getByText("마디 목록으로 보기").click();
  await expect(async () => {
    await page.getByRole("button", { name: "관문-의사 국가시험", exact: true }).click();
    await expect(page.getByTestId("node-panel")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await expect(page.getByTestId("gate-pending")).toHaveText("공식 통계 확인 중");
});

test("16개 직업 결과 화면이 모두 열립니다", async ({ page }) => {
  await page.goto("/");
  const links = await page.locator('a[href^="/jobs/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(links).toHaveLength(16);
  for (const href of links) {
    await page.goto(href);
    await expect(page.getByRole("note")).toContainText("경로 빈도는 인과가 아닙니다");
    await expect(page.getByRole("img", { name: /경로 그래프$/ })).toBeVisible();
  }
});

test("검색엔진 차단: robots.txt와 noindex", async ({ page, request }) => {
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /");
  const res = await page.goto("/");
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
