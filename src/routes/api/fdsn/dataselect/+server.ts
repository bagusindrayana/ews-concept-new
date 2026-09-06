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

    return `${baseUrl}/fdsnws/dataselect/1/query?${forwardParams.toString()}`;
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
                'User-Agent': 'EWS-Concept/1.0 (FDSN Dataselect Proxy)',
                'Accept': 'application/vnd.fdsn.mseed, application/octet-stream, */*'
            },
            signal: AbortSignal.timeout(45000)
        });

        const contentType = response.headers.get('content-type') || 'application/vnd.fdsn.mseed';
        const cacheControl = response.headers.get('cache-control') || 'public, max-age=60';
        const contentDisposition = response.headers.get('content-disposition');

        const headers: Record<string, string> = {
            ...CORS_HEADERS,
            'Content-Type': contentType,
            'Cache-Control': cacheControl
        };

        if (contentDisposition) {
            headers['Content-Disposition'] = contentDisposition;
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
        });
    } catch (error: any) {
        console.error(`[FDSN Dataselect Proxy Error] ${targetUrl}:`, error);
        return json(
            { error: 'Gagal mengambil data waveform dari upstream', details: error.message },
            { status: 502, headers: CORS_HEADERS }
        );
    }
};
