import type mapboxgl from "mapbox-gl";
import { DateTime } from "luxon";

export class MapLayerService {
  /**
   * Loads and adds the coastline layer to the map.
   */
  async loadCoastlineLayer(map: mapboxgl.Map): Promise<any> {
    const res = await fetch("/geojson/garis_pantai.geojson");
    const data = await res.json();

    if (!map.getSource("coastline")) {
      map.addSource("coastline", {
        type: "geojson",
        generateId: true,
        data,
      });
      map.addLayer({
        id: "outline-coastline",
        type: "line",
        source: "coastline",
        layout: { visibility: "none" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 5,
          "line-opacity": 1,
        },
      });
    }
    return data;
  }

  /**
   * Loads and adds the territory (wilayah) layer to the map.
   */
  async loadTerritoryLayer(map: mapboxgl.Map): Promise<any> {
    const res = await fetch("/geojson/all_kabkota_ind_reduce.geojson");
    const data = await res.json();

    if (!map.getSource("wilayah")) {
      map.addSource("wilayah", { type: "geojson", generateId: true, data });
      map.addLayer({
        id: "outline",
        type: "line",
        source: "wilayah",
        paint: {
          "line-color": "#807a72",
          "line-width": 1,
          "line-opacity": 0.7,
        },
      });
      map.addLayer({
        id: "wilayah-fill",
        type: "fill",
        source: "wilayah",
        paint: { "fill-color": "red", "fill-opacity": 0 },
      });
    }
    return data;
  }

  /**
   * Adds the timezone layer and its markers to the map.
   */
  addTimezoneLayer(map: mapboxgl.Map, mapboxglLib: any) {
    map.addSource("timezone", {
      type: "geojson",
      generateId: true,
      data: "/geojson/timezones_wVVG8.geojson",
    });
    map.addLayer({
      id: "timezone-line",
      type: "line",
      source: "timezone",
      paint: { "line-color": "orange", "line-width": 1, "line-opacity": 0.5 },
    });

    const markerData = [
      {
        lng: 107.4999769225339,
        lat: 3.4359354227361933,
        zone: "Asia/Jakarta",
        label: "WIB / GMT+7",
      },
      {
        lng: 119.1174733337183,
        lat: 3.4359354227361933,
        zone: "Asia/Makassar",
        label: "WITA / GMT+8",
      },
      {
        lng: 131.58387377752751,
        lat: 3.4359354227361933,
        zone: "Asia/Jayapura",
        label: "WIT / GMT+9",
      },
    ];

    markerData.forEach((m) => {
      const wrapper = document.createElement("div");
      const el = document.createElement("div");
      el.className = "bordered p-1 text-time show-pop-up text-center  ";
      const zoneClass = m.zone.replace(/\//g, "-");
      el.innerHTML = `<p class="uppercase text-xl" style="line-height:1rem"><span class="jam-${zoneClass}"></span></p><p>${m.label}</p>`;
      wrapper.appendChild(el);
      new mapboxglLib.Marker({ element: wrapper })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
    });

    const intervalId = setInterval(() => {
      markerData.forEach((m) => {
        const zoneClass = m.zone.replace(/\//g, "-");
        const el = document.querySelector(`.jam-${zoneClass}`);
        if (el)
          el.textContent = DateTime.now().setZone(m.zone).toFormat("HH:mm:ss");
      });
    }, 1000);

    return intervalId;
  }

  /**
   * Adds the Indonesian fault lines layer to the map.
   */
  addFaultLinesLayer(map: mapboxgl.Map) {
    if (map.getSource("indo_faults_lines")) return;

    map.addSource("indo_faults_lines", {
      type: "geojson",
      generateId: true,
      data: "/geojson/indo_faults_lines.geojson",
    });
    map.addLayer({
      id: "indo_faults_line_layer",
      type: "line",
      source: "indo_faults_lines",
      paint: { "line-color": "red", "line-width": 1, "line-opacity": 0.5 },
    });
  }
}
