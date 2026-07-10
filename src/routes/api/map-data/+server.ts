import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { type } = body;

        if (type === 'roads') {
            const { bbox } = body;
            if (!bbox || typeof bbox.south !== 'number' || typeof bbox.west !== 'number' || typeof bbox.north !== 'number' || typeof bbox.east !== 'number') {
                return json({ error: 'Missing or invalid bbox coordinates' }, { status: 400 });
            }
            const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
            const query = `[out:json][timeout:30];(way["highway"](${bboxStr}););out geom;`;
            const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'http://localhost:5173/'
                }
            });
            if (!res.ok) {
                return json({ error: `Overpass API returned status ${res.status}` }, { status: res.status });
            }
            const data = await res.json();
            return json(data);
        }

        if (type === 'elevation') {
            const { locations } = body;
            if (!locations || typeof locations !== 'string') {
                return json({ error: 'Missing or invalid locations format' }, { status: 400 });
            }
            const url = `https://api.opentopodata.org/v1/srtm30m?locations=${locations}`;

            const res = await fetch(url);
            if (!res.ok) {
                return json({ error: `OpenTopoData API returned status ${res.status}` }, { status: res.status });
            }
            const data = await res.json();
            return json(data);
        }

        return json({ error: 'Invalid type parameter' }, { status: 400 });
    } catch (error: any) {
        console.error('API proxy error:', error);
        return json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
};
