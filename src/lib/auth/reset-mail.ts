import nodemailer from "nodemailer";

export function passwordResetMailConfig(env: NodeJS.ProcessEnv = process.env) {
  const origin = new URL(env.FFZ_APP_URL ?? "");
  const local = env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if ((origin.protocol !== "https:" && !(local && origin.protocol === "http:")) ||
      origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Invalid FFZ_APP_URL");
  }
  const port = Number(env.SMTP_PORT || "587");
  if (!env.SMTP_HOST?.trim() || !env.SMTP_USER?.trim() || !env.SMTP_PASSWORD ||
      !env.SMTP_FROM?.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Password recovery email is not configured");
  }
  return {
    origin: origin.origin,
    from: env.SMTP_FROM.trim(),
    transport: {
      host: env.SMTP_HOST.trim(), port, secure: port === 465, requireTLS: port !== 465,
      auth: { user: env.SMTP_USER.trim(), pass: env.SMTP_PASSWORD },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
      dnsTimeout: 10_000, disableFileAccess: true, disableUrlAccess: true,
    },
  };
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const config = passwordResetMailConfig();
  // Fragment stays out of proxy access logs and HTTP referrers.
  const link = `${config.origin}/reset-password#token=${encodeURIComponent(token)}`;
  const transport = nodemailer.createTransport(config.transport);
  try {
    const result = await transport.sendMail({
      from: config.from, to: { address: email, name: "" },
      subject: "Reset your FFZ password",
      text: `Reset your FFZ Platform password:\n\n${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this email. Your password has not changed.`,
    });
    if (result.accepted.length === 0) throw new Error("Reset email was not accepted");
  } finally {
    transport.close();
  }
}
