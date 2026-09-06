import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { serverFdsnFetch } from '$lib/server/fdsnServerFetch';

function resolveTargetUrl(requestUrl: URL): string {
    const searchParams = requestUrl.searchParams;
    const directUrl = searchParams.get('url');
    if (directUrl) {
        return directUrl;
    }

    const baseUrl = (searchParams.get('baseUrl') || searchParams.get('base_url') || 'https://geofon.gfz.de').replace(/\/+$/, '');
    const forwardParams = new URLSearchParams(searchParams);
    forwardParams.delete('baseUrl');
    forwardParams.delete('base_url');
    forwardParams.delete('dataSource');
    forwardParams.delete('dataSourceId');

    return `${baseUrl}/fdsnws/event/1/query?${forwardParams.toString()}`;
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () => {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
    });
};

export const GET: RequestHandler = async ({ url }) => {
    let targetUrl: string;
    try {
        targetUrl = resolveTargetUrl(url);
        const parsed = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return json({ error: 'Invalid URL protocol' }, { status: 400, headers: CORS_HEADERS });
        }
    } catch (e: any) {
        return json({ error: 'Malformed URL: ' + e.message }, { status: 400, headers: CORS_HEADERS });
    }

    try {
        const response = await serverFdsnFetch(targetUrl, {
            headers: {
                'User-Agent': 'EWS-Concept/1.0 (FDSN Event Proxy)',
                'Accept': 'application/xml, text/xml, application/json, text/plain, */*'
            },
            signal: AbortSignal.timeout(30000)
        });

        const contentType = response.headers.get('content-type') || 'application/xml; charset=utf-8';
        const cacheControl = response.headers.get('cache-control') || 'public, max-age=60';

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: {
                ...CORS_HEADERS,
                'Content-Type': contentType,
                'Cache-Control': cacheControl
            }
        });
    } catch (error: any) {
        console.error(`[FDSN Event Proxy Error] ${targetUrl}:`, error);
        return json(
            { error: 'Gagal mengambil data event gempa dari upstream', details: error.message },
            { status: 502, headers: CORS_HEADERS }
        );
    }
};
