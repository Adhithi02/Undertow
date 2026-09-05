import nodemailer from "nodemailer";

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "465");
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !Number.isInteger(port) || !user || !password) return null;
  return { host, port, user, password };
}

export async function sendBriefingEmail(to: string, text: string): Promise<boolean> {
  const config = smtpConfig();
  if (!config) return false;
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
    });
    await transporter.sendMail({
      from: { name: "Undertow", address: config.user },
      to,
      subject: "What moved beneath the surface",
      text,
    });
    return true;
  } catch {
    return false;
  }
}