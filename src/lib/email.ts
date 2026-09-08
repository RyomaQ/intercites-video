import { Resend } from "resend";

export async function sendCodeEmail(email: string, codeValue: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY / EMAIL_FROM manquants");

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Your Intercité code",
    html: `
      <p>Thanks for buying the Intercité film!</p>
      <p>Here is your download code:</p>
      <p style="font-size: 20px; font-weight: bold; letter-spacing: 2px;">${codeValue}</p>
      <p>Go to <a href="https://video.intercitesbmx.com">video.intercitesbmx.com</a> and enter this code to download the film.</p>
      <p>This code can only be used once.</p>
    `,
  });

  if (error) {
    throw new Error(`Resend failed: ${JSON.stringify(error)}`);
  }
}
