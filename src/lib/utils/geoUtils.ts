import * as turf from "@turf/turf";
import { DateTime } from "luxon";

/**
 * Generates random earthquake data for simulation.
 * @param geoJsonData Ground data to calculate bounding box
 * @returns Object containing random earthquake information
 */
export function generateRandomGempaData(geoJsonData: any) {
  if (!geoJsonData) return null;

  const bbox = turf.bbox(geoJsonData);
  const randomPosition = turf.randomPosition(bbox);
  const mag = (Math.random() * (10 - 5) + 5).toFixed(1);
  const depth = (Math.random() * 20).toFixed(1) + " Km";
  
  const randomLat = parseFloat(randomPosition[1].toFixed(4));
  const randomLng = parseFloat(randomPosition[0].toFixed(4));
  
  const message =
    "Gempa Bumi Test : Lat " +
    randomLat +
    " Lng " +
    randomLng +
    " Mag " +
    mag +
    " Depth " +
    depth;
    
  const dt = DateTime.now();
  const readAbleTime =
    dt.toISODate() + " " + dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS);

  return {
    id: `tg-${new Date().getTime()}`,
    lng: randomLng,
    lat: randomLat,
    mag: parseFloat(mag),
    depth,
    message,
    time: readAbleTime,
  };
}
