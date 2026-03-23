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
    import { mapStore } from "$lib/stores/mapStore.svelte";

    let mapContainer: HTMLElement;
    let map: mapboxgl.Map;
    let markers: mapboxgl.Marker[] = [];

    const zoom = 4; // Tetap di zoom level tertentu agar fokus ke area
    let isLocked = $state(true);

    let networkStats = $state<any[]>([]);

    function fetchStations() {
        // Clear existing markers
        markers.forEach((m) => m.remove());
        markers = [];
        networkStats = [];

        const url = `https://geofon.gfz-potsdam.de/fdsnws/station/1/query?${mapStore.urlParams}&level=station`;

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

                // Handle both single network and multiple networks
                const networks = Array.isArray(networksList)
                    ? networksList
                    : networksList
                      ? [networksList]
                      : [];

                networks.forEach((networkNode) => {
                    let _totalStations = 0;
                    let _activeStations = 0;
                    let _inactiveStations = 0;
                    const stationsList = networkNode.Station as JsonNode[];
                    const stations = Array.isArray(stationsList)
                        ? stationsList
                        : stationsList
                          ? [stationsList]
                          : [];

                    stations.forEach((stationNode) => {
                        _totalStations++;
                        const endDate = (stationNode["@attributes"] as any)
                            ?.endDate;
                        if (endDate) {
                            _inactiveStations++;
                        } else {
                            _activeStations++;
                        }

                        const markerEl = document.createElement("div");
                        markerEl.className = "custom-marker";
                        markerEl.innerHTML = `
                            <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 24L0 0H24L12 24Z" fill="#${endDate ? "ff0000" : "fa0"}" />
                            </svg>
                        `;
                        markerEl.style.cursor = "pointer";

                        const customPopup = new mapboxgl.Popup({
                            offset: 28,
                            closeButton: true,
                            closeOnClick: true,
                        }).setHTML(`
                            <div class="bordered" style="background-color: black; padding: 5px;">
                                <h3 style="margin: 0 0 5px 0; font-size: 16px;">${(stationNode as any)["@attributes"]["code"]}</h3>
                                <p style="margin: 0; font-size: 14px;">${(stationNode as any).Site.Name}</p>
                            </div>
                        `);

                        const marker = new mapboxgl.Marker({
                            element: markerEl,
                            anchor: "bottom",
                        })
                            .setLngLat([
                                parseFloat((stationNode as any).Longitude),
                                parseFloat((stationNode as any).Latitude),
                            ])
                            .setPopup(customPopup)
                            .addTo(map);

                        markers.push(marker);
                    });

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
                });
            })
            .catch((error) => {
                console.error("Terjadi kesalahan:", error);
                const el = document.getElementById("loading-screen");
                if (el) el.style.display = "none";
            });
    }

    function toggleLock() {
        isLocked = !isLocked;
        if (map) {
            if (isLocked) {
                map.dragPan.disable();
            } else {
                map.dragPan.enable();
            }
        }
    }

    function saveArea() {
        if (!map) return;
        const bounds = map.getBounds();
        if (!bounds) return;

        mapStore.bbox = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
        ];
        isLocked = true;
        map.dragPan.disable();
        fetchStations();
    }

    onMount(() => {
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
            projection: "mercator",
            // Disable all interactions by default
            interactive: true,
            dragPan: false,
            scrollZoom: false,
            boxZoom: false,
            dragRotate: false,
            doubleClickZoom: false,
            touchZoomRotate: false,
        });

        // Fit map to bbox initially
        map.fitBounds(mapStore.bbox as any, {
            padding: 20,
            animate: false,
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

            fetchStations();
        });
    });

    onDestroy(() => {
        if (map) map.remove();
    });
</script>

<svelte:head>
    <title>Status Map | Mapbox BBox</title>
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
                    Station Status Map
                </h1>
            </div>
        </div>
    </div>
    <div
        class="flex flex-col lg:flex-row gap-4 w-full mb-2 items-stretch h-full"
    >
        <Card className="w-full lg:w-1/3">
            {#snippet title()}
                <h1>NETWORK CHANNEL STATUS</h1>
            {/snippet}
            <div class="overflow-y-auto h-[80vh]">
                <MentalToxicityLevel networks={networkStats} />
            </div>
        </Card>

        <div class="w-full lg:w-2/3 bordered relative overflow-hidden">
            <div
                class="w-full h-[80vh] bg-black rounded"
                bind:this={mapContainer}
            ></div>

            <!-- MAP OVERLAY CONTROLS -->
            <div
                class="absolute top-4 left-4 z-5 flex flex-col gap-3 w-64 pointer-events-none"
            >
                <!-- TOP STRIPE DECORATION -->
                <div class="pointer-events-auto">
                    <button
                        class="w-full cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered p-1 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        onclick={toggleLock}
                    >
                        <StripeBar
                            loop={!isLocked}
                            reverse={true}
                            duration={20}
                            color={isLocked ? "blue" : "red"}
                        ></StripeBar>
                        <span
                            class="absolute bg-black ews-label px-3 py-1 font-bold text-[10px] tracking-widest"
                        >
                            {isLocked
                                ? "UNLOCK INTERACTION"
                                : "LOCK INTERACTION"}
                        </span>
                    </button>
                </div>

                {#if !isLocked}
                    <div
                        class="pointer-events-auto animate-in fade-in slide-in-from-left duration-300"
                    >
                        <button
                            class="w-full cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered-red p-1 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            onclick={saveArea}
                        >
                            <StripeBar
                                color="red"
                                loop={true}
                                reverse={false}
                                duration={15}
                            ></StripeBar>
                            <span
                                class="absolute bg-black ews-label danger px-3 py-1 font-bold text-[10px] tracking-widest"
                            >
                                CONFIRM & SAVE AREA
                            </span>
                        </button>

                        <div
                            class="mt-2 p-2 bg-black/80 bordered-red backdrop-blur-sm"
                        >
                            <p
                                class="text-[9px] text-red-500 font-bold leading-tight uppercase tracking-tighter"
                            >
                                ⚠ EDIT MODE ACTIVE
                            </p>
                            <p
                                class="text-[9px] text-gray-400 mt-1 leading-tight"
                            >
                                PANNING ENABLED. ZOOMING LOCKED. ADJUST VIEWPORT
                                AND CONFIRM.
                            </p>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- STATUS INDICATOR -->
            <div class="absolute bottom-4 right-4 z-5 pointer-events-none">
                <div
                    class="bg-black/80 bordered p-2 backdrop-blur-sm flex items-center gap-3"
                >
                    <div class="flex flex-col">
                        <span
                            class="text-[8px] text-gray-500 font-bold uppercase"
                            >Map Status</span
                        >
                        <span
                            class="text-[10px] {isLocked
                                ? 'text-blue-400'
                                : 'text-red-500 animate-pulse'} font-bold uppercase tracking-widest"
                        >
                            {isLocked ? "SECURED" : "USER ADJUSTMENT"}
                        </span>
                    </div>
                    <div
                        class="w-8 h-8 flex items-center justify-center bordered"
                    >
                        <div
                            class="w-2 h-2 rounded-full {isLocked
                                ? 'bg-blue-500'
                                : 'bg-red-500 animate-ping'}"
                        ></div>
                    </div>
                </div>
            </div>
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
        THIS IS A CONCEPT DESIGN - DATA STATION DARI GEOFON
    </p>
</div>

<style>
    /* Ensure the grid rows naturally align left and right items on the same horizontal plane */
</style>
