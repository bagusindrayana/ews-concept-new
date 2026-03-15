import { XMLParser } from "fast-xml-parser";
import { DateTime } from "luxon";
import type { InfoGempa, InfoTsunami } from "$lib/types";
import { DataNormalizer, type DataMappingConfig } from "./dataNormalizer";
import sourceDataConfig from "$lib/config/source-data.json";

// ── Utility Helpers ────────────────────────────────────────────────────────

/**
 * Robustly parses a SQL-style timestamp (UTC) and converts it to Jakarta time.
 * Handles formats like "2026-03-15 22:45:47.386256"
 */
function utcSqlToJakarta(value: string | undefined): DateTime {
  if (!value) return DateTime.now().setZone("Asia/Jakarta");
  
  // Try direct SQL parse
  let dt = DateTime.fromSQL(value, { zone: "UTC" });
  if (!dt.isValid) {
    // Try fromISO fallback (replacing space with T)
    dt = DateTime.fromISO(value.replace(" ", "T"), { zone: "UTC" });
  }
  if (!dt.isValid) {
    // Try fromFormat fallback (first 19 chars)
    dt = DateTime.fromFormat(value.substring(0, 19), "yyyy-MM-dd HH:mm:ss", { zone: "UTC" });
  }
  
  return dt.isValid ? dt.setZone("Asia/Jakarta") : DateTime.now().setZone("Asia/Jakarta");
}

function formatReadableTime(dt: DateTime): string {
  if (!dt.isValid) return "Invalid Date";
  return dt.toFormat("yyyy-MM-dd HH:mm:ss");
}

function timeToMmi(readableTime: string): number {
  return parseInt(
    readableTime
      ?.replaceAll("-", "")
      .replaceAll(" ", "")
      .replaceAll(":", "") || "0",
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface GeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: number[];
  };
  properties: Record<string, any>;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface FetchGempaResult {
  geoJson: GeoJsonFeatureCollection;
  infoList: InfoGempa[];
}

export interface FetchGempaDirasakanResult {
  id: string;
  info: InfoGempa;
  sentTime: DateTime;
  raw: any;
}

export interface FetchGempaKecilResult {
  feature: GeoJsonFeature;
  info: InfoGempa;
  sentTime: DateTime;
  raw: any;
}

export interface GempaLiveItem {
  id: string;
  info: InfoGempa;
}

export interface ParsedSocketGempa {
  feature: GeoJsonFeature;
  info: InfoGempa;
}

export interface InitializeEarthquakesResult {
  geoJson: GeoJsonFeatureCollection;
  infoList: InfoGempa[];
  dirasakanInfo: FetchGempaDirasakanResult | null;
  kecilInfo: FetchGempaKecilResult | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function cacheBust(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${Date.now()}`;
}

// ── Service ────────────────────────────────────────────────────────────────

export class EarthquakeDataService {
  private parser = new XMLParser();
  private normalizer = new DataNormalizer();
  private configs = sourceDataConfig as DataMappingConfig[];

  private getConfig(id: string): DataMappingConfig {
    const cfg = this.configs.find((c) => c.id === id);
    if (!cfg) throw new Error(`Configuration not found for: ${id}`);
    return cfg;
  }

  // ──── gempaQL.json → GeoJSON + InfoGempa list ────────────────────────

  async fetchTitikGempa(
    existingEventIds: Set<string> = new Set(),
  ): Promise<FetchGempaResult> {
    const url = cacheBust(
      "https://bmkg-content-inatews.storage.googleapis.com/gempaQL.json",
    );
    const res = await fetch(url);
    const data: GeoJsonFeatureCollection = await res.json();

    const infoList: InfoGempa[] = [];
    for (const f of data.features) {
      if (existingEventIds.has(f.properties.id)) continue;
      const dt = utcSqlToJakarta(f.properties.time);
      const readableTime = formatReadableTime(dt);
      infoList.push({
        id: f.properties.id,
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        mag: f.properties.mag,
        depth: f.properties.depth,
        place: f.properties.place,
        time: readableTime,
        mmi: 0,
      });
    }

    return { geoJson: data, infoList };
  }

  // ──── datagempa.json → InfoGempa (gempa dirasakan terakhir) ──────────

  async fetchGempaDirasakan(): Promise<FetchGempaDirasakanResult> {
    const url = cacheBust(
      "https://bmkg-content-inatews.storage.googleapis.com/datagempa.json",
    );
    const res = await fetch(url);
    const data = await res.json();

    const coords = data.info.point.coordinates.split(",");
    const sentTime = DateTime.fromISO(data.sent.replace("WIB", ""), {
      zone: "Asia/Jakarta",
    });
    const readableTime = formatReadableTime(sentTime);

    const info: InfoGempa = {
      id: data.identifier,
      lng: parseFloat(coords[0]),
      lat: parseFloat(coords[1]),
      place: data.info.felt,
      mag: data.info.magnitude,
      depth: data.info.depth,
      message: data.info.description,
      time: readableTime,
      mmi: timeToMmi(readableTime),
    };

    return { id: data.identifier, info, sentTime, raw: data };
  }

  // ──── lastQL.json → GeoJSON Feature + InfoGempa ──────────────────────

  async fetchGempaKecil(): Promise<FetchGempaKecilResult | null> {
    const url = cacheBust(
      "https://bmkg-content-inatews.storage.googleapis.com/lastQL.json",
    );
    const res = await fetch(url);
    const data = await res.json();

    if (!data.features || data.features.length === 0) return null;

    const feature = data.features[0] as GeoJsonFeature;
    const dt = utcSqlToJakarta(feature.properties.time);
    const readableTime = formatReadableTime(dt);

    const info: InfoGempa = {
      id: feature.properties.id,
      lng: parseFloat(feature.geometry.coordinates[0] as any),
      lat: parseFloat(feature.geometry.coordinates[1] as any),
      mag: parseFloat(feature.properties.mag),
      depth: feature.properties.depth,
      message: `${feature.properties.place}\nMag : ${Number(feature.properties.mag).toFixed(1)}`,
      place: feature.properties.place,
      time: readableTime,
      mmi: timeToMmi(readableTime),
    };

    return { feature, info, sentTime: dt, raw: data };
  }

  // ──── live30event.xml → GempaLiveItem[] ──────────────────────────────

  async fetchGempaLive(
    existingEventIds: Set<string> = new Set(),
  ): Promise<GempaLiveItem[]> {
    const url =
      "https://bmkg-content-inatews.storage.googleapis.com/live30event.xml";
    const res = await fetch(url);
    const text = await res.text();
    const jObj = this.parser.parse(text);

    const items: GempaLiveItem[] = [];
    if (jObj.Infogempa && jObj.Infogempa.gempa) {
      const gempas = Array.isArray(jObj.Infogempa.gempa) ? jObj.Infogempa.gempa : [jObj.Infogempa.gempa];
      for (const f of gempas) {
        if (existingEventIds.has(f.eventid)) continue;
        const dt = utcSqlToJakarta(f.waktu);
        const readableTime = formatReadableTime(dt);
        items.push({
          id: f.eventid,
          info: {
            id: f.eventid,
            lng: f.bujur,
            lat: f.lintang,
            mag: f.mag,
            depth: f.dalam,
            place: f.area,
            time: readableTime,
            mmi: 0,
          },
        });
      }
    }

    return items;
  }

  // ──── last30tsunamievent.xml → random tsunami info for demo ──────────

  async fetchTsunamiEvents(): Promise<any[]> {
    const url =
      "https://bmkg-content-inatews.storage.googleapis.com/last30tsunamievent.xml";
    const res = await fetch(url);
    const text = await res.text();
    const jObj = this.parser.parse(text);
    return jObj.alert.info.filter((v: any) => v.wzarea != undefined);
  }

  // ──── Unified Initialization ───────────────────────────────────────────

  async fetchAllFromConfig(): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const promises = this.configs.map(async (cfg) => {
      try {
        const url = cacheBust(cfg.source_url);
        const res = await fetch(url);
        const data = cfg.type === "xml" ? await res.text() : await res.json();
        const normalized = await this.normalizer.parseAndNormalize<InfoGempa>(data, cfg);
        results.set(cfg.id, { config: cfg, raw: data, normalized });
      } catch (error) {
        console.error(`Error fetching/normalizing source ${cfg.id}:`, error);
        results.set(cfg.id, null);
      }
    });
    await Promise.all(promises);
    return results;
  }

  // ──── Unified Initialization ───────────────────────────────────────────

  async initializeAllEarthquakes(
    customConfigs?: DataMappingConfig[],
  ): Promise<InitializeEarthquakesResult> {
    const configsToUse = customConfigs || this.configs;
    const results = new Map<string, any>();
    const promises = configsToUse.map(async (cfg) => {
      try {
        const url = cacheBust(cfg.source_url);
        const res = await fetch(url);
        const data = cfg.type === "xml" ? await res.text() : await res.json();
        const normalized = await this.normalizer.parseAndNormalize<InfoGempa>(
          data,
          cfg,
        );
        results.set(cfg.id, { config: cfg, raw: data, normalized });
      } catch (error) {
        console.error(`Error fetching/normalizing source ${cfg.id}:`, error);
        results.set(cfg.id, null);
      }
    });
    await Promise.all(promises);

    const configResults = results;

    let dirasakanInfo: FetchGempaDirasakanResult | null = null;
    let kecilInfo: FetchGempaKecilResult | null = null;
    let mainGeoJson: GeoJsonFeatureCollection | null = null;

    const infoMap = new Map<string, InfoGempa>();
    const featureMap = new Map<string, GeoJsonFeature>();

    for (const [id, result] of configResults.entries()) {
      if (!result) continue;

      const { config, raw, normalized } = result;

      // Handle main GeoJSON (usually from the first "all" source that has features)
      if (config.category === "all" && !mainGeoJson && raw.type === "FeatureCollection") {
        mainGeoJson = raw;
      } else if (config.category === "all" && !mainGeoJson && Array.isArray(raw.features)) {
          mainGeoJson = { type: "FeatureCollection", features: raw.features };
      }

      // Route data based on category
      switch (config.category) {
        case "feel":
          if (!dirasakanInfo && normalized[0]) {
            const info = normalized[0];
            const sentTime = DateTime.fromISO(raw.sent.replace("WIB", "").trim(), {
              zone: "Asia/Jakarta",
            });
            dirasakanInfo = { id: info.id, info, sentTime, raw };
          }
          break;
        case "small":
          if (!kecilInfo && normalized[0]) {
            const info = normalized[0];
            const feature = raw.features?.[0];
            const dt = feature ? utcSqlToJakarta(feature.properties.time) : DateTime.now();
            kecilInfo = { feature, info, sentTime: dt, raw };
          }
          break;
      }

      // Add all items to global maps for deduplication and sorting
      normalized.forEach((info: InfoGempa) => {
        if (!infoMap.has(info.id)) {
          infoMap.set(info.id, info);
          
          // Try to find corresponding feature in raw data or generate one
          let feature = null;
          if (Array.isArray(raw.features)) {
            feature = raw.features.find((f: any) => f.properties.id === info.id);
          }
          
          featureMap.set(info.id, feature || this.toGeoJsonFeature(info));
        }
      });
    }

    // Convert map values to arrays and sort
    const finalInfoList = Array.from(infoMap.values());
    finalInfoList.sort(
      (a, b) => new Date(b.time!).getTime() - new Date(a.time!).getTime(),
    );

    // Rebuild GeoJSON features array matching the sorted order
    const finalGeoJsonFeatures = finalInfoList.map(
      (info) => featureMap.get(info.id)!,
    );

    const mergedGeoJson: GeoJsonFeatureCollection = mainGeoJson || {
      type: "FeatureCollection",
      features: finalGeoJsonFeatures,
    };

    // If we merged multiple sources, ensure features match the info list
    if (configResults.size > 1) {
        mergedGeoJson.features = finalGeoJsonFeatures;
    }

    return {
      geoJson: mergedGeoJson,
      infoList: finalInfoList,
      dirasakanInfo,
      kecilInfo,
    };
  }

  // ──── Socket data parsers ────────────────────────────────────────────

  parseGempaFromSocket(data: any): ParsedSocketGempa {
    const feature = data.features[0];
    const dt = utcSqlToJakarta(feature.properties.time);
    const readableTime = formatReadableTime(dt);
    const msg = `${feature.properties.place}\nMag : ${Number(feature.properties.mag).toFixed(1)}\nDepth : ${feature.properties.depth}`;

    const info: InfoGempa = {
      id: feature.properties.id,
      lng: parseFloat(feature.geometry.coordinates[0]),
      lat: parseFloat(feature.geometry.coordinates[1]),
      mag: parseFloat(feature.properties.mag),
      depth: feature.properties.depth,
      message: msg,
      place: feature.properties.place,
      time: readableTime,
      mmi: timeToMmi(dt.toISODate()!),
    };

    const geoFeature = this.toGeoJsonFeature(info);
    return { feature: geoFeature, info };
  }

  parseTsunamiFromSocket(data: any): {
    isTsunami: boolean;
    isCancel: boolean;
    id: string;
    coords: [number, number];
    sentTime: DateTime;
    raw: any;
  } {
    let isTsunami = false;
    let isCancel = false;

    if (data.info.wzarea != undefined && data.info.wzarea.length > 0) {
      if (data.info.subject === "Warning Tsunami PD-4") {
        isCancel = true;
      } else if (data.info.subject.includes("Warning Tsunami")) {
        isTsunami = true;
      }
    }

    const coords = data.info.point.coordinates.split(",");
    const sentTime = DateTime.fromISO(data.sent.replace("WIB", ""), {
      zone: "Asia/Jakarta",
    });

    return {
      isTsunami,
      isCancel,
      id: data.identifier,
      coords: [parseFloat(coords[0]), parseFloat(coords[1])],
      sentTime,
      raw: data,
    };
  }

  // ──── GeoJSON helpers ────────────────────────────────────────────────

  toGeoJsonFeature(info: InfoGempa): GeoJsonFeature {
    return {
      geometry: {
        type: "Point",
        coordinates: [info.lng, info.lat, 1],
      },
      type: "Feature",
      properties: {
        id: info.id,
        depth: parseFloat(String(info.depth).replace(" Km", "")).toFixed(2),
        mag: info.mag,
        time: info.time,
        place: info.place,
      },
    };
  }

  mergeIntoGeoJson(
    existing: GeoJsonFeatureCollection,
    newFeatures: GeoJsonFeature[],
  ): GeoJsonFeatureCollection {
    const existingIds = new Set(
      existing.features.map((f) => f.properties.id),
    );
    const toAdd = newFeatures.filter((f) => !existingIds.has(f.properties.id));
    return {
      ...existing,
      features: [...existing.features, ...toAdd],
    };
  }

  /**
   * Check if an earthquake event is recent (within threshold ms, default 10 min)
   */
  isRecent(sentTime: DateTime, thresholdMs: number = 600000): boolean {
    return (
      DateTime.now().setZone("Asia/Jakarta").toMillis() -
      sentTime.toMillis() <
      thresholdMs
    );
  }

  /**
   * Check if an earthquake event is recent using UTC comparison
   */
  isRecentUtc(sentTime: DateTime, thresholdMs: number = 600000): boolean {
    return (
      DateTime.now().setZone("UTC").toMillis() - sentTime.toMillis() <
      thresholdMs
    );
  }

  /**
   * Build warning handler data from InfoGempa + raw API data
   */
  buildWarningData(
    info: InfoGempa,
    raw: any,
  ): {
    id: string;
    lng: number;
    lat: number;
    mag: number;
    place?: string;
    depth: string;
    message: string;
    time: string;
  } {
    return {
      id: info.id,
      lng: info.lng,
      lat: info.lat,
      mag: typeof info.mag === "number" ? info.mag : parseFloat(info.mag),
      place: info.place,
      depth: typeof info.depth === "string" ? info.depth : String(info.depth),
      message:
        raw?.info?.description && raw?.info?.instruction
          ? raw.info.description + "\n" + raw.info.instruction
          : info.message || "",
      time: info.time || new Date().toLocaleString(),
    };
  }

  /**
   * Fetches historical records for a specific earthquake event.
   * @param eventId The ID of the earthquake event.
   * @returns Array of record rows (each row is an array of strings).
   */
  async fetchHistoryRecords(eventId: string): Promise<string[][]> {
    const url = cacheBust(
      `https://bmkg-content-inatews.storage.googleapis.com/history.${eventId}.txt`,
    );
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const text = await res.text();
      const lines = text.split("\n").filter((line) => line.trim().length > 0);
      // Skip the first line (header) like in the original logic
      return lines.slice(1).map((line) => line.split("|"));
    } catch (error) {
      console.error("Error fetching history records:", error);
      return [];
    }
  }
}
