import tls from 'node:tls';
import http from 'node:http';
import { URL } from 'node:url';

/**
 * Known domain migrations in the seismology community.
 * e.g., IRIS merged into EarthScope Consortium and service.iris.edu redirects
 * to service.earthscope.org with broken duplicate Content-Length headers.
 */
const DOMAIN_REWRITES: Record<string, string> = {
    'service.iris.edu': 'service.earthscope.org'
};

/**
 * Inspects a redirect response via raw socket when Node's HTTP/1.1 parser (undici)
 * throws HTTPParserError (e.g. "Duplicate Content-Length") on an upstream redirect.
 */
function fetchRawRedirect(rawUrl: string, userAgent: string): Promise<{ statusCode: number; headers: Record<string, string> }> {
    return new Promise((resolve, reject) => {
        const u = new URL(rawUrl);
        const isHttps = u.protocol === 'https:';
        const port = u.port ? parseInt(u.port, 10) : (isHttps ? 443 : 80);

        const socket = (isHttps ? tls : http).connect({
            host: u.hostname,
            port,
            ...(isHttps ? { servername: u.hostname } : {}),
            timeout: 15000
        } as any, () => {
            const req = `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.hostname}\r\nUser-Agent: ${userAgent}\r\nConnection: close\r\n\r\n`;
            socket.write(req);
        });

        let chunks: Buffer[] = [];
        let headersParsed = false;

        socket.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
            if (!headersParsed) {
                const combined = Buffer.concat(chunks);
                const headerEndIdx = combined.indexOf('\r\n\r\n');
                if (headerEndIdx !== -1) {
                    headersParsed = true;
                    const headerPart = combined.subarray(0, headerEndIdx).toString('latin1');
                    const lines = headerPart.split('\r\n');
                    const statusCode = parseInt(lines[0].split(' ')[1], 10);
                    const headers: Record<string, string> = {};

                    for (let i = 1; i < lines.length; i++) {
                        const idx = lines[i].indexOf(':');
                        if (idx > -1) {
                            const k = lines[i].substring(0, idx).trim().toLowerCase();
                            const v = lines[i].substring(idx + 1).trim();
                            if (!headers[k]) {
                                headers[k] = v;
                            }
                        }
                    }

                    socket.destroy();
                    resolve({ statusCode, headers });
                }
            }
        });

        socket.on('error', reject);
        socket.on('timeout', () => {
            socket.destroy(new Error('Socket timeout while reading raw redirect headers'));
        });
    });
}

/**
 * Normalizes known outdated FDSN domains to their current active domains.
 */
export function normalizeFdsnUrl(inputUrl: string): string {
    try {
        const parsed = new URL(inputUrl);
        if (DOMAIN_REWRITES[parsed.hostname]) {
            parsed.hostname = DOMAIN_REWRITES[parsed.hostname];
            return parsed.toString();
        }
    } catch {
        // if invalid, return as is
    }
    return inputUrl;
}

/**
 * Robust fetch wrapper for server-side proxying of FDSNWS endpoints.
 * Handles duplicate Content-Length headers and malformed upstream redirects safely.
 */
export async function serverFdsnFetch(targetUrl: string, init: RequestInit = {}): Promise<Response> {
    const normalizedUrl = normalizeFdsnUrl(targetUrl);
    const userAgent = (init.headers as Record<string, string>)?.[`User-Agent`] || 'EWS-Concept/1.0 (FDSN Proxy)';

    try {
        return await fetch(normalizedUrl, init);
    } catch (err: any) {
        const errMsg = err?.cause?.message || err?.message || '';
        const isDuplicateContentLength = errMsg.includes('Duplicate Content-Length') || errMsg.includes('HTTP/1.1 protocol');

        if (isDuplicateContentLength) {
            console.warn(`[FDSN Proxy] Upstream returned malformed headers (${errMsg}) for ${normalizedUrl}. Attempting raw redirect resolution...`);
            try {
                const rawRes = await fetchRawRedirect(normalizedUrl, userAgent);
                if ([301, 302, 303, 307, 308].includes(rawRes.statusCode) && rawRes.headers['location']) {
                    const redirectUrl = new URL(rawRes.headers['location'], normalizedUrl).toString();
                    console.log(`[FDSN Proxy] Following recovered redirect to: ${redirectUrl}`);
                    return await fetch(redirectUrl, init);
                }
            } catch (rawErr: any) {
                console.error('[FDSN Proxy] Raw redirect recovery failed:', rawErr);
            }
        }

        throw err;
    }
}
