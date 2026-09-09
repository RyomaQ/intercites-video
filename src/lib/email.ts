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
      <div style="max-width: 480px; margin: 0 auto; padding: 32px 24px; font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111111;">
        <div style="font-size: 18px; font-weight: 700; letter-spacing: 0.02em; margin-bottom: 32px;">Intercité</div>

        <p style="font-size: 15px; line-height: 1.5; margin: 0 0 8px;">Hi there,</p>
        <p style="font-size: 15px; line-height: 1.5; margin: 0 0 24px;">Thanks for buying the Intercité film! Here is your download code:</p>

        <div style="background: #f2f2f2; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px;">
          <span style="font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 700; letter-spacing: 4px;">${codeValue}</span>
        </div>

        <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px;">
          Go to <a href="https://video.intercitesbmx.com" style="color: #111111;">video.intercitesbmx.com</a> and enter this code to download the film.
        </p>
        <p style="font-size: 15px; line-height: 1.5; font-weight: 700; color: #d92d2d; margin: 0;">
          This code can only be used once.
        </p>
      </div>
    `,
    text: `Thanks for buying the Intercité film!

Here is your download code: ${codeValue}

Go to https://video.intercitesbmx.com and enter this code to download the film.

This code can only be used once.`,
  });

  if (error) {
    throw new Error(`Resend failed: ${JSON.stringify(error)}`);
  }
}
