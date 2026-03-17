import { browser } from "$app/environment";

// BBox format: [minLng, minLat, maxLng, maxLat]
export type BBox = [number, number, number, number];

const DEFAULT_BBOX: BBox = [95, -11, 141, 6];

class MapStore {
    #bbox = $state<BBox>(DEFAULT_BBOX);

    constructor() {
        if (browser) {
            const saved = localStorage.getItem("map_bbox");
            if (saved) {
                try {
                    this.#bbox = JSON.parse(saved);
                } catch (e) {
                    console.error("Failed to parse saved bbox", e);
                }
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

    get urlParams() {
        const [minLng, minLat, maxLng, maxLat] = this.#bbox;
        return `minlatitude=${minLat}&maxlatitude=${maxLat}&minlongitude=${minLng}&maxlongitude=${maxLng}`;
    }
}

export const mapStore = new MapStore();
