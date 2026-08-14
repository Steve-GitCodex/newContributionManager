// Rewrites the password-reset email template on the Identity Toolkit config.
// Dry run by default; pass --apply to write.

import { readFileSync } from 'fs';
import { GoogleAuth } from 'google-auth-library';

const APPLY = process.argv.includes('--apply');
const key = JSON.parse(readFileSync('keys/target.json', 'utf8'));
const endpoint = `https://identitytoolkit.googleapis.com/admin/v2/projects/${key.project_id}/config`;

// %APP_NAME% renders the GCP project display name, which is the unset
// `project-10877815438`. The product name is written out instead.
const TEMPLATE = {
    senderLocalPart: 'noreply',
    replyTo: 'noreply',
    bodyFormat: 'HTML',
    subject: 'Reset your ContriFlow password',
    body: [
        '<p>Hello,</p>',
        '<p>Someone asked to reset the ContriFlow password for %EMAIL%. Follow this link to choose a new one:</p>',
        "<p><a href='%LINK%'>%LINK%</a></p>",
        '<p>The link can only be used once. If you did not ask for it, ignore this email and your password stays as it is.</p>',
        '<p>Thanks,</p>',
        '<p>The ContriFlow team</p>'
    ].join('\n')
};

const auth = new GoogleAuth({ credentials: key, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const token = await auth.getAccessToken();
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const current = await (await fetch(endpoint, { headers })).json();
const existing = current.notification.sendEmail.resetPasswordTemplate;

console.log('current subject:', existing.subject);
console.log('new subject:    ', TEMPLATE.subject);
console.log('\ncurrent body:\n' + existing.body);
console.log('\nnew body:\n' + TEMPLATE.body);

if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write.');
    process.exit(0);
}

const response = await fetch(`${endpoint}?updateMask=notification.sendEmail.resetPasswordTemplate`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ notification: { sendEmail: { resetPasswordTemplate: TEMPLATE } } })
});

const result = await response.json();
if (!response.ok) {
    console.error('failed:', response.status, JSON.stringify(result));
    process.exit(1);
}

console.log('\napplied. stored subject:', result.notification.sendEmail.resetPasswordTemplate.subject);
