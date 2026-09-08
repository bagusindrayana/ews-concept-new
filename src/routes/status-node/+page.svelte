<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { xmlToJson, type JsonNode } from "$lib/xmlUtils";
    import StripeBar from "$lib/components/StripeBar.svelte";
    import RibCageLayout from "$lib/components/RibCageLayout.svelte";
    import { mapStore } from "$lib/stores/mapStore.svelte";
    import { fdsnFetch } from "$lib/utils/fdsnFetch";
    import MagiBusSwitch from "$lib/components/MagiBusSwitch.svelte";

    // Dummy data for the status list
    let statuses = $state<
        {
            id: string;
            title: string;
            status: string;
            type: string;
            stationCode: string;
            networkCode: string;
            site: string;
        }[]
    >([]);

    async function fetchStatuses() {
        // Clear existing statuses
        statuses = [];
        
        // URL with selected data source
        // const url = `${mapStore.dataSource.baseUrl}/fdsnws/station/1/query?${mapStore.urlParams}&level=station&nodata=404&channel=BH?,SH?`;

        const stationResults = await Promise.allSettled(
            mapStore.dataSources.map(async (source) => {
                const url = `${source.baseUrl}/fdsnws/station/1/query?${mapStore.urlParams}&level=station&nodata=404&channel=BH?,SH?`;
                const response = await fdsnFetch(url, "/api/fdsn/station");
                if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
                return xmlToJson(await response.text());
            }),
        );

        const el = document.getElementById("loading-screen");
        if (el) el.style.display = "none";

        stationResults.forEach((result) => {
            if (result.status === "rejected") {
                console.error("Gagal mengambil data station:", result.reason);
                return;
            }

            const fdsn = result.value.FDSNStationXML as JsonNode;
            const networksList = fdsn?.Network as JsonNode[];
            const networks = Array.isArray(networksList)
                ? networksList
                : networksList
                  ? [networksList]
                  : [];
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

                        statuses.push({
                            id: `${netCode}-${staCode}`,
                            title: `${netCode}-${staCode}`,
                            status: endDate ? "OFFLINE" : "ACTIVE",
                            type: endDate ? "danger" : "normal",
                            stationCode: `${staCode}`,
                            networkCode: `${netCode}`,
                            site: `${(stationNode["Site"] as any)?.Name || "UNKNOWN"}`,
                        });
                    });
                });
        });
        
    }

    onMount(() => {
        fetchStatuses();
    });



    onDestroy(() => {
        console.log("Component destroyed");
    });
</script>

<svelte:head>
    <title>Status Node</title>
</svelte:head>

<div
    class="min-h-screen py-1 md:py-4 flex flex-col items-center overflow-x-hidden overflow-y-auto font-mono"
>
    <div
        class="flex no-snapshot fixed right-2 translate-y-0 top-2 left-0 right-0 m-auto flex-row justify-center items-center z-100 gap-2 pointer-events-none"
        style="width:fit-content;"
    >
        <a
            class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
            href="/">HOME</a
        >
        <a
            class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
            href="/status-map">STATION MAP</a
        >
        <a
        class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
        href="/magi">MAGI</a
      >
    </div>

    <div
        class="mb-2 text-center p-2 z-10 w-full bordered flex justify-center items-center relative show-pop-up mt-6"
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

    <div class="w-full h-1 bg-primary"></div>

    <div class="mb-6">
        <MagiBusSwitch
          variant="board"
          
        />
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
