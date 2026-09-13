export interface Point2D {
  x: number; // Longitude or Screen X
  y: number; // Latitude or Screen Y
}

export type ContourSegment = [Point2D, Point2D];

export interface ContourLine {
  iso: number;
  type: 'land' | 'sea' | 'coastline';
  segments: ContourSegment[];
}

export interface GeoBbox {
  south: number;
  north: number;
  west: number;
  east: number;
}

/**
 * Calculates the great-circle distance between two points in kilometers
 * using the Haversine formula.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 2D Marching Squares contour generator from a regular elevation / depth grid.
 */
export function generateContours(
  grid: number[],
  cols: number,
  rows: number,
  bbox: GeoBbox,
  isovalues?: number[]
): ContourLine[] {
  if (!grid || grid.length < cols * rows || cols < 2 || rows < 2) {
    return [];
  }

  // If no custom isovalues, generate meaningful land and sea intervals
  const minElev = Math.min(...grid);
  const maxElev = Math.max(...grid);

  let targetIsovalues = isovalues;
  if (!targetIsovalues || targetIsovalues.length === 0) {
    const defaultSea = [
      -3000, -2000, -1500, -1000, -800, -600, -400, -200, -150, -100, -75, -50, -35, -25, -15, -10, -5
    ].filter((v) => v >= minElev && v <= maxElev);

    const defaultLand = [
      5, 15, 25, 50, 75, 100, 150, 250, 400, 600, 800, 1200, 1600, 2000
    ].filter((v) => v >= minElev && v <= maxElev);

    targetIsovalues = [...defaultSea, 0, ...defaultLand].sort((a, b) => a - b);
  }

  const result: ContourLine[] = [];

  function getVal(c: number, r: number): number {
    return grid[r * cols + c];
  }

  function getLon(c: number): number {
    return bbox.west + (c / (cols - 1)) * (bbox.east - bbox.west);
  }

  function getLat(r: number): number {
    return bbox.south + (r / (rows - 1)) * (bbox.north - bbox.south);
  }

  function lerp(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    v1: number,
    v2: number,
    iso: number
  ): Point2D {
    if (Math.abs(v1 - v2) < 1e-6) return { x: x1, y: y1 };
    const t = Math.max(0, Math.min(1, (iso - v1) / (v2 - v1)));
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  for (const iso of targetIsovalues) {
    const segments: ContourSegment[] = [];

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const bl_val = getVal(c, r);
        const br_val = getVal(c + 1, r);
        const tr_val = getVal(c + 1, r + 1);
        const tl_val = getVal(c, r + 1);

        let state = 0;
        if (bl_val >= iso) state |= 1;
        if (br_val >= iso) state |= 2;
        if (tr_val >= iso) state |= 4;
        if (tl_val >= iso) state |= 8;

        if (state === 0 || state === 15) continue;

        const bl_x = getLon(c),
          bl_y = getLat(r);
        const br_x = getLon(c + 1),
          br_y = getLat(r);
        const tr_x = getLon(c + 1),
          tr_y = getLat(r + 1);
        const tl_x = getLon(c),
          tl_y = getLat(r + 1);

        const A = lerp(bl_x, bl_y, br_x, br_y, bl_val, br_val, iso); // bottom
        const B = lerp(br_x, br_y, tr_x, tr_y, br_val, tr_val, iso); // right
        const C = lerp(tr_x, tr_y, tl_x, tl_y, tr_val, tl_val, iso); // top
        const D = lerp(tl_x, tl_y, bl_x, bl_y, tl_val, bl_val, iso); // left

        switch (state) {
          case 1:
            segments.push([D, A]);
            break;
          case 2:
            segments.push([A, B]);
            break;
          case 3:
            segments.push([D, B]);
            break;
          case 4:
            segments.push([B, C]);
            break;
          case 5:
            segments.push([D, C], [A, B]);
            break;
          case 6:
            segments.push([A, C]);
            break;
          case 7:
            segments.push([D, C]);
            break;
          case 8:
            segments.push([D, C]);
            break;
          case 9:
            segments.push([A, C]);
            break;
          case 10:
            segments.push([D, A], [C, B]);
            break;
          case 11:
            segments.push([B, C]);
            break;
          case 12:
            segments.push([D, B]);
            break;
          case 13:
            segments.push([A, B]);
            break;
          case 14:
            segments.push([D, A]);
            break;
        }
      }
    }

    if (segments.length > 0) {
      const lineType = iso > 0 ? 'land' : iso < 0 ? 'sea' : 'coastline';
      result.push({
        iso,
        type: lineType,
        segments
      });
    }
  }

  return result;
}

/**
 * Formats coordinates into degrees and minutes (e.g., -6.124 -> 06°07.4' S)
 */
export function formatCoordinateDMS(deg: number, isLat: boolean): string {
  const absDeg = Math.abs(deg);
  const d = Math.floor(absDeg);
  const m = ((absDeg - d) * 60).toFixed(1);
  const dir = isLat ? (deg >= 0 ? 'N' : 'S') : deg >= 0 ? 'E' : 'W';
  return `${String(d).padStart(2, '0')}°${m}'${dir}`;
}

export function formatDegree(deg: number, isLat: boolean): string {
  const dir = isLat ? (deg >= 0 ? '°N' : '°S') : deg >= 0 ? '°E' : '°W';
  return `${Math.abs(deg).toFixed(2)}${dir}`;
}
