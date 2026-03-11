export const ssr = false

import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
    const networkCode = url.searchParams.get('networkCode') ?? '';
    const stationCode = url.searchParams.get('stationCode') ?? '';

    return { networkCode, stationCode };
};