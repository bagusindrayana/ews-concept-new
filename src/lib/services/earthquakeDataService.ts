import { XMLParser } from "fast-xml-parser";
import { DateTime } from "luxon";
import type { InfoGempa, InfoTsunami } from "$lib/types";

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

function utcSqlToJakarta(sqlTime: string): DateTime {
  return DateTime.fromSQL(sqlTime, { zone: "UTC" }).setZone("Asia/Jakarta");
}

function formatReadableTime(dt: DateTime): string {
  return `${dt.toISODate()} ${dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS)}`;
}

function timeToMmi(readableTime: string): number {
  return parseInt(
    readableTime
      ?.replaceAll("-", "")
      .replaceAll(" ", "")
      .replaceAll(":", "") || "0",
  );
}

// ── Service ────────────────────────────────────────────────────────────────

export class EarthquakeDataService {
  private parser = new XMLParser();

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
    for (const f of jObj.Infogempa.gempa) {
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

  async initializeAllEarthquakes(): Promise<InitializeEarthquakesResult> {
    const [titikResult, dirasakanResult, kecilResult, liveResult] =
      await Promise.allSettled([
        this.fetchTitikGempa(),
        this.fetchGempaDirasakan(),
        this.fetchGempaKecil(),
        this.fetchGempaLive(),
      ]);

    // Extract successful data
    let baseGeoJson: GeoJsonFeatureCollection = {
      type: "FeatureCollection",
      features: [],
    };
    let baseInfoList: InfoGempa[] = [];

    if (titikResult.status === "fulfilled") {
      baseGeoJson = titikResult.value.geoJson;
      baseInfoList = titikResult.value.infoList;
    }

    const dirasakanInfo =
      dirasakanResult.status === "fulfilled" ? dirasakanResult.value : null;
    const kecilInfo =
      kecilResult.status === "fulfilled" ? kecilResult.value : null;
    const liveItems =
      liveResult.status === "fulfilled" ? liveResult.value : [];

    // Map `id` to `InfoGempa` for deduplication
    const infoMap = new Map<string, InfoGempa>();

    // Priority 1: Main List
    for (const info of baseInfoList) {
      infoMap.set(info.id, info);
    }

    // Priority 2: Live Events
    for (const item of liveItems) {
      if (!infoMap.has(item.id)) {
        infoMap.set(item.id, item.info);
      }
    }

    // Priority 3: Gempa Kecil
    if (kecilInfo && !infoMap.has(kecilInfo.info.id)) {
      infoMap.set(kecilInfo.info.id, kecilInfo.info);
    }

    // Priority 4: Gempa Dirasakan
    if (dirasakanInfo && !infoMap.has(dirasakanInfo.info.id)) {
      infoMap.set(dirasakanInfo.info.id, dirasakanInfo.info);
    }

    // Convert map values to arrays
    const finalInfoList = Array.from(infoMap.values());
    finalInfoList.sort(
      (a, b) => new Date(b.time!).getTime() - new Date(a.time!).getTime(),
    );

    // Rebuild GeoJSON features from the final deduplicated info list
    const finalGeoJsonFeatures = finalInfoList.map((info) =>
      this.toGeoJsonFeature(info),
    );

    const mergedGeoJson: GeoJsonFeatureCollection = {
      type: "FeatureCollection",
      features: finalGeoJsonFeatures,
    };

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
}
