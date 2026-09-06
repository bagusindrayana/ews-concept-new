/**
 * Known domain migrations in the seismology community.
 * e.g., IRIS merged into EarthScope Consortium and service.iris.edu redirects
 * to service.earthscope.org. Rewriting directly avoids redirect overhead
 * and issues with upstream duplicate headers.
 */
const DOMAIN_REWRITES: Record<string, string> = {
    'service.iris.edu': 'service.earthscope.org'
};

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
 * Compatible with Edge runtimes (Cloudflare Workers / Pages) and Node.js.
 */
export async function serverFdsnFetch(targetUrl: string, init: RequestInit = {}): Promise<Response> {
    const normalizedUrl = normalizeFdsnUrl(targetUrl);
    return await fetch(normalizedUrl, init);
}
