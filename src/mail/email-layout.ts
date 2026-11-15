export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Simple branded email used for clinic team invitations. */
export function buildEmail(params: {
  title: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
}): { html: string; text: string } {
  const body = params.paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px 16px;background:#f4f6f8;font-family:Segoe UI,system-ui,sans-serif;color:#172033;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dce3ea;border-radius:12px;padding:32px 28px;">
    <tr><td style="font-size:18px;font-weight:700;color:#1e3a5f;padding-bottom:8px;">PetHealth Vet</td></tr>
    <tr><td style="font-size:22px;font-weight:700;padding-bottom:16px;">${escapeHtml(params.title)}</td></tr>
    <tr><td style="font-size:15px;line-height:1.6;color:#334155;">${body}</td></tr>
    <tr><td style="padding-top:20px;"><a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;padding:12px 20px;background:#1e3a5f;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${escapeHtml(params.ctaLabel)}</a></td></tr>
  </table>
</body>
</html>`;
  const text = [
    'PetHealth Vet',
    '',
    params.title,
    '',
    ...params.paragraphs,
    '',
    `${params.ctaLabel}: ${params.ctaUrl}`,
  ].join('\n');
  return { html, text };
}
