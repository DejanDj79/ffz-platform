import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ after: vi.fn(), request: vi.fn(), complete: vi.fn(), config: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({ ...await importOriginal<typeof import("next/server")>(), after: mocks.after }));
vi.mock("@/lib/auth/password-reset", () => ({ requestPasswordReset: mocks.request, completePasswordReset: mocks.complete }));
vi.mock("@/lib/auth/reset-mail", () => ({ passwordResetMailConfig: mocks.config }));
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { clearAllRateLimitsForTests } from "@/lib/security/rate-limit";

function request(data: unknown) {
  return new Request("https://ffz.example/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}
beforeEach(() => { vi.resetAllMocks(); clearAllRateLimitsForTests(); });
describe("password recovery endpoints", () => {
  it("responds before looking up the account and normalizes email", async () => {
    const response = await forgot(request({ email: " Trader@Example.COM " }));
    expect(response.status).toBe(200);
    expect(mocks.request).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ message: expect.stringContaining("If an account exists") });
    await mocks.after.mock.calls[0][0]();
    expect(mocks.request).toHaveBeenCalledWith("trader@example.com");
  });
  it("does not return a token or disclose delivery failures", async () => {
    mocks.request.mockRejectedValue(new Error("private SMTP response"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await forgot(request({ email: "trader@example.com" }));
      await mocks.after.mock.calls[0][0]();
      expect(response.status).toBe(200);
      expect(log).toHaveBeenCalledWith("Password recovery failed. Check database and SMTP configuration.");
    } finally { log.mockRestore(); }
  });
  it("reports missing mail configuration uniformly without account lookup", async () => {
    mocks.config.mockImplementation(() => { throw new Error("missing SMTP"); });
    expect((await forgot(request({ email: "trader@example.com" }))).status).toBe(503);
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("limits requests per address and returns Retry-After", async () => {
    for (let i = 0; i < 5; i++) await forgot(request({ email: "trader@example.com" }));
    const response = await forgot(request({ email: "trader@example.com" }));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
  it("rejects malformed JSON and short passwords", async () => {
    const malformed = new Request("https://ffz.example/api/auth", { method: "POST", body: "{" });
    expect((await forgot(malformed)).status).toBe(400);
    expect((await reset(request({ token: "a".repeat(43), password: "short" }))).status).toBe(400);
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("rejects invalid links and accepts successful reset without automatic login", async () => {
    mocks.complete.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const data = { token: "a".repeat(43), password: "new-password" };
    expect((await reset(request(data))).status).toBe(400);
    const response = await reset(request(data));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
