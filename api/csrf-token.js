import crypto from 'crypto';

/**
 * GET /api/csrf-token
 * Generates a new CSRF secret and token. The secret is set as a secure HTTP-only cookie,
 * and the token is returned in the JSON payload for the frontend to attach to future POST headers.
 */
export default function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // 1. Generate a cryptographically secure random secret
    const secret = crypto.randomBytes(32).toString('hex');
    
    // 2. Hash the secret to create the public-facing token
    const token = crypto.createHmac('sha256', process.env.CSRF_SALT || 'infinity-verse-secure-salt')
                        .update(secret)
                        .digest('hex');
    
    // 3. Set the secret in a strictly scoped HttpOnly cookie
    // SameSite=Strict prevents the browser from sending this cookie on cross-site requests
    const isProd = process.env.NODE_ENV === 'production';
    const cookieString = `csrfSecret=${secret}; HttpOnly; ${isProd ? 'Secure;' : ''} SameSite=Strict; Path=/; Max-Age=3600`;
    
    res.setHeader('Set-Cookie', cookieString);
    
    // 4. Return the token to the frontend
    return res.status(200).json({ csrfToken: token });
}
