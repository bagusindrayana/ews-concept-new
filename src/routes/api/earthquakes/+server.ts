import { json } from '@sveltejs/kit';
import { EarthquakeDataService } from '$lib/services/earthquakeDataService';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    try {
        const service = new EarthquakeDataService();
        const data = await service.initializeAllEarthquakes();
        
        return json(data, {
            headers: {
                'Cache-Control': 'public, max-age=60'
            }
        });
    } catch (error) {
        console.error('API Error:', error);
        return json({ error: 'Failed to fetch earthquake data' }, { status: 500 });
    }
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        const customConfigs = await request.json();
        const service = new EarthquakeDataService();
        const data = await service.initializeAllEarthquakes(customConfigs);
        
        return json(data);
    } catch (error) {
        console.error('API Error (POST):', error);
        return json({ error: 'Failed to fetch earthquake data with custom config' }, { status: 500 });
    }
};
