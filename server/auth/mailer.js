const nodemailerAvailable = (() => {
    try { require.resolve('nodemailer'); return true; } catch { return false; }
})();

/**
 * Sends the address-verification email.
 *
 * Delivery is configured through the environment. With SMTP settings present the message is
 * sent; without them the link is written to the server log instead, so registration and
 * verification can be exercised before mail is set up. The log fallback is announced loudly
 * because a deployment that silently logs verification links to a console is not verifying
 * anything.
 *
 *     KN_SMTP_HOST      smtp.example.edu
 *     KN_SMTP_PORT      587
 *     KN_SMTP_USER      username
 *     KN_SMTP_PASSWORD  password
 *     KN_MAIL_FROM      "KN-Wildlife <no-reply@example.edu>"
 *     KN_PORTAL_URL     https://kn-wildlife.crc.nd.edu   (used to build the link)
 */

const PORTAL_URL = process.env.KN_PORTAL_URL || 'http://localhost:5173';

function configured() {
    return Boolean(process.env.KN_SMTP_HOST && process.env.KN_MAIL_FROM && nodemailerAvailable);
}

function verificationLink(token) {
    return `${PORTAL_URL.replace(/\/$/, '')}/verify?token=${encodeURIComponent(token)}`;
}

function messageBody(link) {
    return [
        'Thank you for registering with the KN-Wildlife data portal.',
        '',
        'Confirm this address to activate your account:',
        link,
        '',
        `This link is valid for 24 hours.`,
        '',
        'If you did not register, no account will be activated and you can ignore this message.',
    ].join('\n');
}

async function sendVerification(email, token) {
    const link = verificationLink(token);

    if (!configured()) {
        const reason = nodemailerAvailable
            ? 'KN_SMTP_HOST and KN_MAIL_FROM are not set'
            : 'nodemailer is not installed';
        console.warn(
            `\n[auth] EMAIL NOT SENT (${reason}).\n` +
            `[auth] Verification link for ${email}:\n` +
            `[auth]   ${link}\n` +
            `[auth] Configure SMTP before relying on address verification.\n`
        );
        return { delivered: false, link };
    }

    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({
        host: process.env.KN_SMTP_HOST,
        port: Number(process.env.KN_SMTP_PORT || 587),
        secure: Number(process.env.KN_SMTP_PORT) === 465,
        auth: process.env.KN_SMTP_USER
            ? { user: process.env.KN_SMTP_USER, pass: process.env.KN_SMTP_PASSWORD }
            : undefined,
    });

    await transport.sendMail({
        from: process.env.KN_MAIL_FROM,
        to: email,
        subject: 'Confirm your KN-Wildlife data portal account',
        text: messageBody(link),
    });

    return { delivered: true, link: null };
}

module.exports = { sendVerification, verificationLink, configured, PORTAL_URL };
