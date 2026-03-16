<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { xmlToJson, type JsonNode } from "$lib/xmlUtils";
    import StripeBar from "$lib/components/StripeBar.svelte";
    import MentalToxicityLevel from "$lib/components/MentalToxicityLevel.svelte";
    import Card from "$lib/components/Card.svelte";

    import { PUBLIC_MAPBOX_ACCESS_TOKEN } from "$env/static/public";

    import mapboxgl from "mapbox-gl";
    import "mapbox-gl/dist/mapbox-gl.css";
    import * as turf from "@turf/turf";

    // 1. Definisikan bbox dengan urutan: [minLng, minLat, maxLng, maxLat]
    const bbox: [number, number, number, number] = [95, -11, 141, 6];

    // 2. Ubah bbox menjadi GeoJSON Polygon
    const polygon = turf.bboxPolygon(bbox);

    // 3. Dapatkan titik tengahnya (mengembalikan GeoJSON Feature <Point>)
    const centerPoint = turf.center(polygon);

    // 4. Ekstrak koordinat [longitude, latitude]
    const [centerLng, centerLat] = centerPoint.geometry.coordinates;

    let mapContainer: HTMLElement;
    let map: mapboxgl.Map;

    const lng = 123.90146694265115;
    const lat = -1.370489908625089;
    const zoom = 3;

    let networkStats = $state<any[]>([]);

    onMount(() => {
        // https://geof.bmkg.go.id/fdsnws/station/1/
        // URL GEOFON (tanpa format=text agar mengembalikan XML)
        const url =
            "https://geofon.gfz-potsdam.de/fdsnws/station/1/query?minlatitude=-11&maxlatitude=6&minlongitude=95&maxlongitude=141&level=station";

        fetch(url)
            .then((response) => {
                if (!response.ok)
                    throw new Error("Gagal mengambil data jaringan");
                return response.text();
            })
            .then((xmlString) => {
                const el = document.getElementById("loading-screen");
                if (el) el.style.display = "none";
                const data = xmlToJson(xmlString);
                const fdsn = data.FDSNStationXML as JsonNode;
                const networksList = fdsn.Network as JsonNode[];

                for (const networkNode of networksList) {
                    let _totalStations = 0;
                    let _activeStations = 0;
                    let _inactiveStations = 0;
                    const stationsList = networkNode.Station as JsonNode[];
                    for (const stationNode of stationsList) {
                        _totalStations++;
                        if (stationNode["@attributes"]?.endDate) {
                            _inactiveStations++;
                        } else {
                            _activeStations++;
                        }
                    }
                    console.log(networkNode);
                    networkStats.push({
                        id:
                            (networkNode["@attributes"] as any)?.code ||
                            "UNKNOWN",
                        name:
                            (networkNode["@attributes"] as any)?.code ||
                            "UNKNOWN",
                        total_channel: _totalStations,
                        active_channel: _activeStations,
                        inactive_channel: _inactiveStations,
                    });
                }

                // Handle both single network and multiple networks
                const networks = Array.isArray(networksList)
                    ? networksList
                    : [networksList];

                console.log("Ada hasil " + networks.length);
                networks.forEach((networkNode) => {
                    const netCode =
                        (networkNode["@attributes"] as any)?.code || "UNKNOWN";
                    const stationsList = networkNode.Station as JsonNode[];

                    // Handle both single station and multiple stations
                    const stations = Array.isArray(stationsList)
                        ? stationsList
                        : [stationsList];

                    stations.forEach((stationNode) => {
                        // console.log(stationNode);
                        const staCode =
                            (stationNode["@attributes"] as any)?.code ||
                            "UNKNOWN";
                        const startDate = (stationNode["@attributes"] as any)
                            ?.startDate;
                        const endDate = (stationNode["@attributes"] as any)
                            ?.endDate;

                        // 1. Buat elemen div untuk menampung marker
                        const markerEl = document.createElement("div");
                        markerEl.className = "custom-marker";

                        // 2. Masukkan kode SVG segitiga terbalik ke dalamnya
                        // M12 24L0 0H24L12 24Z menggambar segitiga terbalik sempurna
                        markerEl.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 24L0 0H24L12 24Z" fill="#${endDate ? "ff0000" : "fa0"}" />
        </svg>
    `;

                        // 3. (Opsional) Tambahkan sedikit styling CSS langsung jika perlu
                        markerEl.style.cursor = "pointer";

                        // 2. Buat Popup
                        const customPopup = new mapboxgl.Popup({
                            offset: 28, // Geser popup ke atas sejauh 28px agar tidak menutupi segitiga (tingginya 24px)
                            closeButton: true, // Menampilkan tombol silang (X) untuk menutup
                            closeOnClick: true, // Popup tertutup jika area peta lain diklik
                        }).setHTML(`
        <div class="bordered" style="background-color: black; padding: 5px;">
            <h3 style="margin: 0 0 5px 0; font-size: 16px;">${(stationNode as any)["@attributes"]["code"]}</h3>
            <p style="margin: 0; font-size: 14px;">${(stationNode as any).Site.Name}</p>
        </div>
    `);

                        // 4. Tambahkan marker ke peta
                        new mapboxgl.Marker({
                            element: markerEl,
                            anchor: "bottom", // PENTING: Membuat ujung bawah (lancip) menunjuk tepat ke koordinat
                        })
                            .setLngLat([
                                parseFloat((stationNode as any).Longitude),
                                parseFloat((stationNode as any).Latitude),
                            ]) // Titik koordinat tempat marker diletakkan
                            .setPopup(customPopup)
                            .addTo(map);
                    });
                });
            })
            .catch((error) => {
                console.error("Terjadi kesalahan:", error);
                setTimeout(() => {
                    const el = document.getElementById("loading-screen");
                    if (el) el.style.display = "none";
                }, 1000);
            });

        if (!PUBLIC_MAPBOX_ACCESS_TOKEN) {
            console.error("Mapbox token is missing!");
            return;
        }

        mapboxgl.accessToken = PUBLIC_MAPBOX_ACCESS_TOKEN;

        map = new mapboxgl.Map({
            container: mapContainer,
            style: {
                version: 8,
                sources: {},
                layers: [
                    {
                        id: "background",
                        type: "background",
                        paint: {
                            "background-color": "#000000",
                        },
                    },
                ],
            },
            center: [centerLng, centerLat],
            zoom: zoom,
            projection: "mercator",
        });

        map.on("load", () => {
            map.addSource("world-boundaries", {
                type: "geojson",
                data: "/geojson/world.geo.json",
            });

            map.addLayer({
                id: "world-boundaries-line",
                type: "line",
                source: "world-boundaries",
                layout: {
                    "line-join": "round",
                    "line-cap": "round",
                },
                paint: {
                    "line-color": "#fa0",
                    "line-width": 1,
                },
            });
        });

        map.on("moveend", () => {
            const bounds = map.getBounds();

            if (bounds == null) {
                return;
            }

            const bbox = [
                bounds.getWest(), // minLng
                bounds.getSouth(), // minLat
                bounds.getEast(), // maxLng
                bounds.getNorth(), // maxLat
            ];

            console.log("BBox Layar Saat Ini:", bbox);
        });
    });

    onDestroy(() => {});
</script>

<svelte:head>
    <title>Status UI | Rib Cage Layout</title>
</svelte:head>

<div
    class="min-h-screen py-1 md:py-4 flex flex-col items-center overflow-x-hidden overflow-y-auto font-mono"
>
    <div
        class="mb-2 text-center p-2 z-10 w-full bordered flex justify-center items-center relative show-pop-up"
    >
        <div class="overflow-hidden">
            <StripeBar loop={true} duration={20} color="red"></StripeBar>
            <div
                class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
            >
                <h1
                    class="text-xl p-1 font-bold ews-title text-3xl danger uppercase bg-black"
                >
                    Station Status
                </h1>
            </div>
        </div>
    </div>
    <div class="flex flex-col lg:flex-row gap-4 w-full mb-2 items-stretch">
        <Card className="w-full">
            {#snippet title()}
                <h1>NETWORK CHANNEL STATUS</h1>
            {/snippet}
            <MentalToxicityLevel networks={networkStats} />
        </Card>

        <div class="w-full h-full bordered">
            <div
                class="w-full h-full min-h-[700px] bg-black rounded"
                bind:this={mapContainer}
            ></div>
        </div>
    </div>
</div>

<!-- LOADING SCREEN -->
<div
    class="fixed m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center overlay-bg text-center z-10 -red"
    id="loading-screen"
>
    <span class="loader"></span>
    <p class="my-2 red-color p-2">
        INI MERUPAKAN DESAIN KONSEP - DATA STATION DARI GEOFON
    </p>
</div>

<style>
    /* Ensure the grid rows naturally align left and right items on the same horizontal plane */
</style>
