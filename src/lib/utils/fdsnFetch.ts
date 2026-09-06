export type FdsnProxyEndpoint =
    | '/api/fdsn/station'
    | '/api/fdsn/dataselect'
    | '/api/fdsn/event';

/**
 * Helper to fetch FDSNWS resources directly, falling back automatically
 * to the local SvelteKit proxy REST API if a CORS error or network failure occurs.
 *
 * @param directUrl The original external FDSNWS URL
 * @param proxyEndpoint The corresponding SvelteKit proxy endpoint ('/api/fdsn/station', etc.)
 * @param init Optional fetch RequestInit options
 */
export async function fdsnFetch(
    directUrl: string,
    proxyEndpoint: FdsnProxyEndpoint,
    init?: RequestInit
): Promise<Response> {
    try {
        const response = await fetch(directUrl, init);
        // Note: In browsers, CORS failures do not return a response with a status code;
        // they reject the promise with a TypeError.
        // If we got a response (even 404 nodata), return it.
        return response;
    } catch (err: any) {
        console.warn(
            `[FDSN Fallback] Direct fetch failed (likely CORS) for ${directUrl}. Retrying via proxy ${proxyEndpoint}...`,
            err
        );
        const proxyUrl = `${proxyEndpoint}?url=${encodeURIComponent(directUrl)}`;
        return await fetch(proxyUrl, init);
    }
}
