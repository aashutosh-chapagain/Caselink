import { Resend } from 'resend';

export async function sendInviteEmail(
    to: string,
    inviteUrl: string,
    workspaceName: string,
): Promise<boolean> {
    if (!process.env.RESEND_API_KEY) return false;

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        await resend.emails.send({
            from: process.env.RESEND_FROM ?? 'onboarding@resend.dev',
            to,
            subject: `You've been invited to join ${workspaceName} on Caselink`,
            html: `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;max-width:480px;margin:0 auto;padding:32px 16px;">
  <h2 style="margin:0 0 8px;">You've been invited to Caselink</h2>
  <p style="color:#64748b;margin:0 0 24px;line-height:1.6;">
    You've been invited to join <strong>${workspaceName}</strong> as a caseworker.
    Click the button below to set up your account. This link expires in 7 days.
  </p>
  <a href="${inviteUrl}"
     style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
    Accept Invitation
  </a>
  <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">
    If the button doesn't work, copy this link:<br>${inviteUrl}
  </p>
</body>
</html>`,
        });
        return true;
    } catch (err) {
        console.error('[email] Failed to send invite:', err);
        return false;
    }
}
