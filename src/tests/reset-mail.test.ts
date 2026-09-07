import { describe, expect, it, vi, afterEach } from "vitest";
const mock = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn(), createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: mock.createTransport } }));
import { passwordResetMailConfig, sendPasswordResetEmail } from "@/lib/auth/reset-mail";
import { resetPasswordSchema } from "@/lib/auth/validation";
const env = {
  NODE_ENV: "production", FFZ_APP_URL: "https://ffz.example", SMTP_HOST: "smtp.example",
  SMTP_USER: "user", SMTP_PASSWORD: "secret", SMTP_FROM: "FFZ <noreply@ffz.example>", SMTP_PORT: "587",
} as NodeJS.ProcessEnv;
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe("password reset email configuration", () => {
  it("requires a trusted HTTPS origin in production and TLS for SMTP", () => {
    expect(passwordResetMailConfig(env).transport).toMatchObject({ port: 587, secure: false, requireTLS: true });
    expect(passwordResetMailConfig({ ...env, SMTP_PORT: "465" }).transport.secure).toBe(true);
    for (const origin of ["http://ffz.example", "https://user:pass@ffz.example", "https://ffz.example/path", "https://ffz.example?redirect=x"]) {
      expect(() => passwordResetMailConfig({ ...env, FFZ_APP_URL: origin })).toThrow();
    }
    expect(() => passwordResetMailConfig({ ...env, SMTP_PASSWORD: "" })).toThrow();
    expect(() => passwordResetMailConfig({ ...env, SMTP_PORT: "NaN" })).toThrow();
  });
  it("uses a fragment token so links do not put secrets in HTTP access logs", async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    mock.createTransport.mockReturnValue(mock);
    mock.sendMail.mockResolvedValue({ accepted: ["trader@example.com"] });
    await sendPasswordResetEmail("trader@example.com", "a".repeat(43));
    const mail = mock.sendMail.mock.calls[0][0];
    expect(mail.to).toEqual({ address: "trader@example.com", name: "" });
    expect(mail.text).toContain("https://ffz.example/reset-password#token=");
    expect(mail.text).not.toContain("?token=");
    expect(mock.close).toHaveBeenCalled();
  });
  it("rejects passwords that bcrypt would truncate, including multibyte input", () => {
    const token = "a".repeat(43);
    expect(resetPasswordSchema.safeParse({ token, password: "a".repeat(72) }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token, password: "a".repeat(73) }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token, password: "😀".repeat(19) }).success).toBe(false);
  });
});
