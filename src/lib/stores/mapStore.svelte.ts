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
    { id: "iris", name: "IRIS (EarthScope)", baseUrl: "https://service.earthscope.org",seedLinkHost:"rtserve.earthscope.org" },
    { id: "knmi", name: "KNMI", baseUrl: "https://rdsa.knmi.nl" },
    { id: "ipgp", name: "IPGP", baseUrl: "https://ws.ipgp.fr" },
    { id: "bmkg", name: "BMKG", baseUrl: "https://geof.bmkg.go.id" },
    { id: "isc", name: "ISC AC", baseUrl: "https://www.isc.ac.uk" },
    { id: "usgs", name: "USGS", baseUrl: "https://earthquake.usgs.gov",seedLinkHost:"cwbpub.cr.usgs.gov" },
];

const DEFAULT_BBOX: BBox = [95, -11, 141, 6];
const DEFAULT_DATA_SOURCE_ID = "geofon";

class MapStore {
    #bbox = $state<BBox>(DEFAULT_BBOX);
    #dataSourceId = $state<string>(DEFAULT_DATA_SOURCE_ID);

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

            const savedDataSource = localStorage.getItem("data_source_id");
            if (savedDataSource) {
                this.#dataSourceId = savedDataSource;
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
        return this.#dataSourceId;
    }

    set dataSourceId(id: string) {
        this.#dataSourceId = id;
        if (browser) {
            localStorage.setItem("data_source_id", id);
        }
    }

    get dataSource(): DataSource {
        return DATA_SOURCES.find((ds) => ds.id === this.#dataSourceId) || DATA_SOURCES[0];
    }

    get urlParams() {
        const [minLng, minLat, maxLng, maxLat] = this.#bbox;
        return `minlatitude=${minLat}&maxlatitude=${maxLat}&minlongitude=${minLng}&maxlongitude=${maxLng}`;
    }
}

export const mapStore = new MapStore();
