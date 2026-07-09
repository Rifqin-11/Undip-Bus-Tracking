import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@simobi.my.id";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "Admin123";

async function loginAsAdmin(page: Page) {
  await page.goto("/id/login");

  await expect(
    page.getByRole("heading", { name: /selamat datang|welcome/i }),
  ).toBeVisible();

  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);

  await Promise.all([
    page.waitForURL(
      (url) => url.pathname === "/id" || url.pathname === "/id/",
      { timeout: 20_000 },
    ),
    page.getByRole("button", { name: /^(masuk|sign in)$/i }).click(),
  ]);

  await expect(page.locator("body")).toContainText(/SIMOBI|Peta|Monitoring/i);
}

test.describe("Blackbox SIMOBI - akses halaman", () => {
  test("BB-UI-01 halaman dashboard /id dapat dibuka", async ({ page }) => {
    await page.goto("/id");

    await expect(page).toHaveURL(/\/id/);
    await expect(page.locator("body")).toContainText(
      /SIMOBI|Monitoring|Peta|Buggy|Halte/i,
    );
  });

  test("BB-UI-02 halaman login menampilkan form email dan kata sandi", async ({
    page,
  }) => {
    await page.goto("/id/login");

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^(masuk|sign in)$/i }),
    ).toBeVisible();
  });
});

test.describe("Blackbox SIMOBI - API publik dan keamanan", () => {
  test("BB-API-01 GET /api/haltes mengembalikan array halte", async ({
    request,
  }) => {
    const response = await request.get("/api/haltes");

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();

    if (data.length > 0) {
      expect(data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          lat: expect.any(Number),
          lng: expect.any(Number),
        }),
      );
    }
  });

  test("BB-API-02 GET /api/buggy mengembalikan array armada", async ({
    request,
  }) => {
    const response = await request.get("/api/buggy");

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test("BB-SEC-01 API admin menolak request tanpa login", async ({
    request,
  }) => {
    const response = await request.get("/api/admin/buggies");

    expect([401, 403]).toContain(response.status());
  });

  test("BB-SEC-02 endpoint GPS menolak payload tanpa bearer token", async ({
    request,
  }) => {
    const response = await request.post("/api/gps-beacon", {
      data: {
        devicesId: "TEST-DEVICE",
        lat: -7.0545,
        lng: 110.4441,
        speedKmh: 10,
        timestamp: new Date().toISOString(),
      },
    });

    // 401 jika BUGGY_INGEST_TOKEN sudah dikonfigurasi.
    // 500 masih diterima untuk lingkungan lokal yang belum mengatur token.
    expect([401, 500]).toContain(response.status());
  });
});

test.describe("Blackbox SIMOBI - autentikasi admin", () => {
  test("BB-AUTH-01 admin dapat login dan membuka GPS Tracker", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.goto("/id/gps-tracker");

    await expect(page).toHaveURL(/\/id\/gps-tracker/);
    await expect(page.locator("body")).toContainText(/SIMOBI Telemetry/i);
    await expect(page.locator("body")).toContainText(/Bridge target/i);
  });
});
