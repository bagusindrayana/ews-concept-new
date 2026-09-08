import { browser } from "$app/environment";

// BBox format: [minLng, minLat, maxLng, maxLat]
export type BBox = [number, number, number, number];

export interface DataSource {
    id: string;
    name: string;
    baseUrl: string;
    seedLinkHost?: string;
}

export const DATA_SOURCES: DataSource[] = [
    { id: "geofon", name: "GEOFON (GFZ)", baseUrl: "https://geofon.gfz.de" },
    { id: "iris", name: "IRIS (EarthScope)", baseUrl: "https://service.earthscope.org", seedLinkHost: "rtserve.earthscope.org" },
    { id: "knmi", name: "KNMI", baseUrl: "https://rdsa.knmi.nl" },
    { id: "ipgp", name: "IPGP", baseUrl: "https://ws.ipgp.fr" },
    { id: "bmkg", name: "BMKG", baseUrl: "https://geof.bmkg.go.id" },
    { id: "isc", name: "ISC AC", baseUrl: "https://www.isc.ac.uk" },
    { id: "usgs", name: "USGS", baseUrl: "https://earthquake.usgs.gov", seedLinkHost: "cwbpub.cr.usgs.gov" },
    { id: "bgr", name: "BGR", baseUrl: "https://eida.bgr.de" },
    { id: "koeri", name: "KOERI", baseUrl: "http://eida-service.koeri.boun.edu.tr" },
    { id: "ethz", name: "ETHZ", baseUrl: "http://eida.ethz.ch" },
    { id: "icgc", name: "ICGC", baseUrl: "http://ws.icgc.cat" },
    { id: "ingv", name: "INGV", baseUrl: "http://webservices.ingv.it" },
    { id: "lmu", name: "LMU", baseUrl: "http://erde.geophysik.uni-muenchen.de" },
    { id: "niep", name: "NIEP", baseUrl: "https://eida-sc3.infp.ro" },
    { id: "noa", name: "NOA", baseUrl: "http://eida.gein.noa.gr" },
    { id: "orfeus", name: "ORFEUS", baseUrl: "http://www.orfeus-eu.org" },
    { id: "resif", name: "RESIF", baseUrl: "http://ws.resif.fr" },
    { id: "ncedc", name: "NCEDC", baseUrl: "https://service.ncedc.org" },
    { id: "scedc", name: "SCEDC", baseUrl: "http://service.scedc.caltech.edu" },
    { id: "texnet", name: "TexNet", baseUrl: "http://rtserve.beg.utexas.edu" },
    { id: "usp-iag", name: "USP-IAG", baseUrl: "http://seisrequest.iag.usp.br" },
    { id: "auspass", name: "AusPass", baseUrl: "https://auspass.edu.au:8080", seedLinkHost: "auspass.edu.au" },
    { id: "esm", name: "ESM", baseUrl: "https://esm-db.eu" },
    { id: "geonet", name: "GeoNet", baseUrl: "https://service.geonet.org.nz" },
    { id: "haiti", name: "Haiti", baseUrl: "https://ayiti.unice.fr/ayiti-seismes" },
    { id: "sismoazur", name: "SismoAzur", baseUrl: "https://sismoazur.oca.eu" },
];

const DEFAULT_BBOX: BBox = [95, -11, 141, 6];
const DEFAULT_DATA_SOURCE_ID = "geofon";
const MAX_DATA_SOURCES = 3;

class MapStore {
    #bbox = $state<BBox>(DEFAULT_BBOX);
    #dataSourceIds = $state<string[]>([DEFAULT_DATA_SOURCE_ID]);

    constructor() {
        if (browser) {
            const savedBbox = localStorage.getItem("map_bbox");
            if (savedBbox) {
                try {
                    this.#bbox = JSON.parse(savedBbox);
                } catch (e) {
                    console.error("Failed to parse saved bbox", e);
                }
            }

            const savedDataSources = localStorage.getItem("data_source_ids");
            const savedDataSource = localStorage.getItem("data_source_id");
            if (savedDataSources) {
                try {
                    const ids = JSON.parse(savedDataSources);
                    if (Array.isArray(ids)) this.dataSourceIds = ids;
                } catch (e) {
                    console.error("Failed to parse saved data sources", e);
                }
            } else if (savedDataSource) {
                this.dataSourceIds = [savedDataSource];
            }
        }
    }

    get bbox() {
        return this.#bbox;
    }

    set bbox(newBBox: BBox) {
        this.#bbox = newBBox;
        if (browser) {
            localStorage.setItem("map_bbox", JSON.stringify(newBBox));
        }
    }

    get dataSourceId() {
        return this.#dataSourceIds[0];
    }

    set dataSourceId(id: string) {
        this.dataSourceIds = [id];
    }

    get dataSourceIds() {
        return this.#dataSourceIds;
    }

    set dataSourceIds(ids: string[]) {
        const validIds = ids.filter((id, index) =>
            DATA_SOURCES.some((ds) => ds.id === id) && ids.indexOf(id) === index,
        ).slice(0, MAX_DATA_SOURCES);
        this.#dataSourceIds = validIds.length > 0 ? validIds : [DEFAULT_DATA_SOURCE_ID];
        if (browser) {
            localStorage.setItem("data_source_ids", JSON.stringify(this.#dataSourceIds));
            localStorage.setItem("data_source_id", this.#dataSourceIds[0]);
        }
    }

    toggleDataSource(id: string) {
        if (this.#dataSourceIds.includes(id)) {
            if (this.#dataSourceIds.length === 1) return;
            this.dataSourceIds = this.#dataSourceIds.filter((sourceId) => sourceId !== id);
            return;
        }
        if (this.#dataSourceIds.length < MAX_DATA_SOURCES) {
            this.dataSourceIds = [...this.#dataSourceIds, id];
        }
    }

    isDataSourceSelected(id: string) {
        return this.#dataSourceIds.includes(id);
    }

    get dataSource(): DataSource {
        return DATA_SOURCES.find((ds) => ds.id === this.dataSourceId) || DATA_SOURCES[0];
    }

    get dataSources(): DataSource[] {
        return this.#dataSourceIds
            .map((id) => DATA_SOURCES.find((ds) => ds.id === id))
            .filter((ds): ds is DataSource => Boolean(ds));
    }

    get urlParams() {
        const [minLng, minLat, maxLng, maxLat] = this.#bbox;
        return `minlatitude=${minLat}&maxlatitude=${maxLat}&minlongitude=${minLng}&maxlongitude=${maxLng}`;
    }
}

export const mapStore = new MapStore();
