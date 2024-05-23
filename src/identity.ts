import crypto from 'crypto';

export function generateHash(): string {
    const hash = crypto.createHash('sha256');
    hash.update(Math.random().toString());
    return 'nlg' + hash.digest('hex').substring(0, 38);
}
