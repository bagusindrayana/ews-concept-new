import { haversineDistance } from './contourUtils';

export interface StationItem {
  no?: number;
  id: string;
  stationCode: string;
  networkCode: string;
  title: string;
  label: string;
  site: string;
  lat: number;
  lng: number;
  distance: number;
  mmi: string;
  pgaEw: number | null;
  pgaNs: number | null;
  pgaUd: number | null;
  siteClass: string;
  status: 'ACTIVE' | 'OFFLINE';
  connected?: boolean;
}

export interface EarthquakeDetailInfo {
  id: string;
  mag: number;
  lat: number;
  lng: number;
  depth: string;
  place: string;
  time: string;
  sourceType: 'mmi_stationlist' | 'sensor_global_fallback';
  stations: StationItem[];
}

/**
 * Parses BMKG stationlist_MMI.txt content.
 */
export function parseStationListMMI(rawText: string): {
  headerInfo: {
    mag: number;
    lat: number;
    lng: number;
    depth: string;
    place: string;
    time?: string;
  } | null;
  stations: StationItem[];
} {
  const lines = rawText.split('\n');
  const stations: StationItem[] = [];
  let headerInfo: any = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check header line:
    // e.g. "Gempabumi 12 September 2026, jam  04:23:56 WIB, Mag:5.9, Lat:5.81°LS, Long:106.56°BT, Kedalaman:376 Km, 6 km Tenggara KEPSERIBU-DKI"
    if (trimmed.startsWith('Gempabumi')) {
      const match = trimmed.match(
        /Mag:([0-9.]+),\s*Lat:([0-9.]+)[^A-Za-z]*([LS|LU]+),\s*Long:([0-9.]+)[^A-Za-z]*([BT|BB]+),\s*Kedalaman:([0-9]+)\s*Km(?:,\s*(.*))?/i
      );
      if (match) {
        let lat = parseFloat(match[2]);
        if (match[3].toUpperCase() === 'LS') lat = -lat;
        let lon = parseFloat(match[4]);
        if (match[5].toUpperCase() === 'BB') lon = -lon;

        // Extract time if present: "jam 04:23:56 WIB"
        const timeMatch = trimmed.match(/jam\s*([0-9:]+)\s*WIB/i);

        headerInfo = {
          mag: parseFloat(match[1]),
          lat,
          lng: lon,
          depth: match[6] + ' Km',
          place: match[7] ? match[7].trim() : 'Indonesia Region',
          time: timeMatch ? timeMatch[1] + ' WIB' : ''
        };
      }
    }

    // Process table lines:
    if (
      !trimmed.startsWith('|') ||
      trimmed.includes('IdSta') ||
      trimmed.startsWith('|--')
    ) {
      continue;
    }

    const parts = line.split('|').map((p) => p.trim());
    if (parts.length >= 11 && parts[2]) {
      stations.push({
        no: parseInt(parts[1]) || stations.length + 1,
        id: `BMKG-${parts[2]}`,
        stationCode: parts[2],
        networkCode: 'BMKG',
        title: `BMKG-${parts[2]}`,
        label: parts[2],
        site: parts[3] || 'BMKG Station',
        lat: parseFloat(parts[4]) || 0,
        lng: parseFloat(parts[5]) || 0,
        distance: parseFloat(parts[6]) || 0,
        mmi: parts[7] || '-',
        pgaEw: parts[8] ? parseFloat(parts[8]) : null,
        pgaNs: parts[9] ? parseFloat(parts[9]) : null,
        pgaUd: parts[10] ? parseFloat(parts[10]) : null,
        siteClass: parts[11] || '-',
        status: 'ACTIVE',
        connected: true
      });
    }
  }

  // Maximum 31 stations to match 1 MagiBusBoard module
  return {
    headerInfo,
    stations: stations.slice(0, 31)
  };
}

/**
 * Fallback: Fetches https://cdn.bmkg.go.id/sensor_global.json and calculates
 * the 31 closest sensors from the earthquake epicenter.
 */
export async function fetchClosestGlobalSensors(
  epicenterLat: number,
  epicenterLon: number
): Promise<StationItem[]> {
  try {
    const res = await fetch('https://cdn.bmkg.go.id/sensor_global.json');
    if (!res.ok) {
      throw new Error(`Failed to fetch sensor_global.json: HTTP ${res.status}`);
    }
    const features: any[] = await res.json();

    const sorted = features
      .map((f, idx) => {
        const coords = f.geometry?.coordinates || [0, 0];
        const lon = coords[0];
        const lat = coords[1];
        const dist = haversineDistance(epicenterLat, epicenterLon, lat, lon);
        const net = f.properties?.net || 'IA';
        const sta = f.properties?.sta || `STA${idx}`;

        return {
          no: idx + 1,
          id: `${net}-${sta}`,
          stationCode: sta,
          networkCode: net,
          title: `${net}-${sta}`,
          label: sta,
          site: f.properties?.description || 'BMKG Sensor Network',
          lat,
          lng: lon,
          distance: Math.round(dist * 10) / 10,
          mmi: '-',
          pgaEw: null,
          pgaNs: null,
          pgaUd: null,
          siteClass: '-',
          status: 'ACTIVE' as const,
          connected: true
        };
      })
      .sort((a, b) => a.distance - b.distance);

    // Take the 31 closest sensors and update their numbering
    return sorted.slice(0, 31).map((s, idx) => ({ ...s, no: idx + 1 }));
  } catch (err) {
    console.error('Error in fetchClosestGlobalSensors:', err);
    return [];
  }
}

/**
 * Main coordinator function:
 * Resolves earthquake metadata from /api/earthquakes,
 * fetches MMI station list, or falls back to sensor_global.json.
 */
export async function loadEarthquakeDetail(
  slug: string
): Promise<EarthquakeDetailInfo> {
  let matchedEq: any = null;

  // 1. Check /api/earthquakes
  try {
    const eqRes = await fetch('/api/earthquakes');
    if (eqRes.ok) {
      const eqData = await eqRes.json();
      const list: any[] = eqData.infoList || [];
      const targetSlug = String(slug).trim();
      const targetLower = targetSlug.toLowerCase();
      const cleanSlug = slug.replace(/\D/g, '');

      // 1. Primary match: EXACT ID match in infoList (case-insensitive)
      matchedEq = list.find((e: any) => {
        if (!e || e.id === undefined || e.id === null) return false;
        return String(e.id).trim().toLowerCase() === targetLower;
      });

      // 2. Exact match in geoJson.features by properties.id
      if (!matchedEq && eqData.geoJson?.features) {
        const feat = eqData.geoJson.features.find((f: any) => {
          const propId = String(f.properties?.id ?? '').trim().toLowerCase();
          return propId === targetLower;
        });
        if (feat) {
          matchedEq = {
            id: feat.properties?.id || slug,
            mag: parseFloat(feat.properties?.mag) || 5.0,
            lat: parseFloat(feat.geometry?.coordinates?.[1]) || 0,
            lng: parseFloat(feat.geometry?.coordinates?.[0]) || 0,
            depth: feat.properties?.depth || '10 Km',
            place: feat.properties?.place || 'Indonesia Region',
            time: feat.properties?.time || new Date().toLocaleString()
          };
        }
      }

      // 3. Exact match in dirasakanInfo
      if (!matchedEq && eqData.dirasakanInfo?.info) {
        const dInfo = eqData.dirasakanInfo.info;
        const dId = String(dInfo.id ?? '').trim().toLowerCase();
        if (dId === targetLower) {
          matchedEq = {
            id: dInfo.id,
            mag: parseFloat(dInfo.mag) || 5.0,
            lat: parseFloat(dInfo.lat) || 0,
            lng: parseFloat(dInfo.lng) || 0,
            depth: String(dInfo.depth || '10 Km'),
            place: dInfo.place || 'Indonesia Region',
            time: dInfo.time || new Date().toLocaleString()
          };
        }
      }

      // 4. Fallback timestamp matching ONLY if cleanSlug has at least 10 digits (e.g. YYYYMMDDhhmmss)
      // Never match short 4-digit years like '2026'!
      if (!matchedEq && cleanSlug.length >= 10) {
        matchedEq = list.find((e: any) => {
          if (!e) return false;
          const eMmi = String(e.mmi ?? '');
          const eTimeClean = e.time ? String(e.time).replace(/\D/g, '') : '';
          return eMmi === cleanSlug || eTimeClean === cleanSlug;
        });
      }
    }
  } catch (err) {
    console.warn('Could not query /api/earthquakes:', err);
  }

  // 2. Try fetching MMI station list from BMKG CDN
  // Both encoded and unencoded slash URLs
  let mmiRawText = '';
  const urlsToTry = [
    `https://cdn.bmkg.go.id/${slug}_rev%2Fstationlist_MMI.txt`,
    `https://cdn.bmkg.go.id/${slug}_rev/stationlist_MMI.txt`
  ];

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes('stationlist_MMI') || text.includes('Stasiun')) {
          mmiRawText = text;
          break;
        }
      }
    } catch {
      // Continue to next attempt
    }
  }

  // 3. Process MMI data if found
  if (mmiRawText) {
    const parsed = parseStationListMMI(mmiRawText);
    const header = parsed.headerInfo;

    return {
      id: slug,
      mag: matchedEq?.mag ?? header?.mag ?? 5.9,
      lat: matchedEq?.lat ?? header?.lat ?? -5.81,
      lng: matchedEq?.lng ?? header?.lng ?? 106.56,
      depth: matchedEq?.depth ?? header?.depth ?? '376 Km',
      place: matchedEq?.place ?? header?.place ?? 'Indonesia Region',
      time: matchedEq?.time ?? header?.time ?? new Date().toLocaleString(),
      sourceType: 'mmi_stationlist',
      stations: parsed.stations
    };
  }

  // 4. Fallback to sensor_global.json
  const defaultLat = matchedEq?.lat ?? -5.81;
  const defaultLng = matchedEq?.lng ?? 106.56;
  const closestStations = await fetchClosestGlobalSensors(defaultLat, defaultLng);

  const depthStr = matchedEq?.depth
    ? typeof matchedEq.depth === 'string' && matchedEq.depth.includes('Km')
      ? matchedEq.depth
      : `${Math.round(parseFloat(String(matchedEq.depth)) || 10)} Km`
    : '10 Km';

  return {
    id: slug,
    mag: matchedEq?.mag ? parseFloat(Number(matchedEq.mag).toFixed(1)) : 5.0,
    lat: defaultLat,
    lng: defaultLng,
    depth: depthStr,
    place: matchedEq?.place ?? 'Indonesia Region',
    time: matchedEq?.time ?? new Date().toLocaleString(),
    sourceType: 'sensor_global_fallback',
    stations: closestStations
  };
}
