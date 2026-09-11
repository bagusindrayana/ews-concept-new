<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import StripeBar from "$lib/components/StripeBar.svelte";
    import MagiStatusDisplay from "$lib/components/MagiStatusDisplay.svelte";
    import {
        mapStore,
        DATA_SOURCES,
        type DataSource,
    } from "$lib/stores/mapStore.svelte";
    import HexShape from "$lib/components/HexShape.svelte";
    import HexGrid from "$lib/components/HexGrid.svelte";
    import { xmlToJson, type JsonNode } from "$lib/xmlUtils";
    import { fdsnFetch } from "$lib/utils/fdsnFetch";

    let activeCount = $derived(mapStore.dataSources.length);

    let melchiorSource = $derived(mapStore.dataSources[0]);
    let balthasarSource = $derived(mapStore.dataSources[1]);
    let casparSource = $derived(mapStore.dataSources[2]);

    let melchiorActive = $state(false);
    let balthasarActive = $state(false);
    let casparActive = $state(false);

    let isLoading = $state(true);

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

    //type status any
    let hexStatus: { id: number; status: any }[] = $state([]);

    async function fetchStatuses() {
        // Clear existing statuses
        statuses = [];

        const stationResults = await Promise.allSettled(
            mapStore.dataSources.map(async (source) => {
                const url = `${source.baseUrl}/fdsnws/station/1/query?${mapStore.urlParams}&level=station&nodata=404&channel=BH?,SH?`;
                const response = await fdsnFetch(url, "/api/fdsn/station");
                if (!response.ok)
                    throw new Error(`${source.name}: HTTP ${response.status}`);

                const xmlResult = xmlToJson(await response.text());

                const indexMagi = mapStore.dataSources.findIndex(
                    (s) => s.id === source.id,
                );
                if (indexMagi === 0) {
                    melchiorActive = true;
                } else if (indexMagi === 1) {
                    balthasarActive = true;
                } else if (indexMagi === 2) {
                    casparActive = true;
                }
                return xmlResult;
            }),
        );

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
                        (stationNode["@attributes"] as any)?.code || "UNKNOWN";
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

        const trueCount = statuses.length;
        const start = Math.max(
            0,
            Math.floor((hexStatus.length - trueCount) / 2),
        );
        // console.log(trueCount, start);
        setTimeout(() => {
            statuses.forEach((status, i) => {
                if (start + i < hexStatus.length) {
                    setTimeout(() => {
                        hexStatus[start + i].status = status;
                    }, i * 10);
                }
            });
        }, 1000);
    }

    onMount(() => {
        hexStatus = Array.from(
            {
                length:
                    Math.max(
                        window.screen.width / 2 + 10,
                        window.screen.height / 2 + 10,
                    ) / 2,
            },
            (_, index) => ({
                id: index + 1,
                status: null,
            }),
        );
        const el = document.getElementById("loading-screen");
        if (el) el.style.display = "none";
        isLoading = false;
        setTimeout(() => {
            fetchStatuses();
        }, 1000);
    });

    onDestroy(() => {
        console.log("MAGI page destroyed");
    });
</script>

<svelte:head>
    <title>MAGI SYSTEM | Supercomputer Consensus</title>
</svelte:head>

<div
    class="min-h-screen flex flex-col items-center overflow-x-hidden overflow-hidden font-mono"
>
    <!-- TOP NAVIGATION BAR -->
    <div
        class="flex no-snapshot fixed right-2 translate-y-0 top-2 left-0 right-0 m-auto flex-row justify-center items-center z-50 gap-2 pointer-events-none"
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
            href="/status-ui">STATUS UI</a
        >
    </div>

    <!-- <div
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
                    MAGI STATION STATUS
                </h1>
            </div>
        </div>
    </div> -->

    <div
        class="flex flex-col lg:flex-row gap-4 w-full items-stretch h-full relative h-screen"
    >
        {#if !isLoading}
            <div class="absolute w-[110%] top-[-50px] left-[-50px]">
                <HexGrid
                    variant="flat"
                    align="center"
                    revealVariant="diagonal-top-left"
                >
                    {#each hexStatus as hex, hexIndex}
                        {@const isSelected = mapStore.isDataSourceSelected(
                            hex.id.toString(),
                        )}
                        <label
                            class="w-full h-full cursor-pointer select-none relative"
                        >
                            <input
                                type="checkbox"
                                value={hex.id}
                                checked={isSelected}
                                onchange={() => {}}
                                class="sr-only"
                            />
                            <HexShape
                                clipContent={true}
                                color={hex.status?.status == "ACTIVE"
                                    ? "fdsn-selected"
                                    : ""}
                                className="w-full h-full transition-all duration-150 hover:brightness-125"
                            >
                                <div
                                    class="w-full h-full flex flex-col items-center justify-center text-center text-black px-4"
                                >
                                    <span
                                        class="text-[11px] sm:text-xs font-black uppercase tracking-wide leading-tight truncate max-w-full"
                                    >
                                        {hex.status?.stationCode ?? "N/A"}
                                    </span>
                                </div>
                            </HexShape>
                        </label>
                    {/each}
                </HexGrid>
            </div>
        {/if}
        <div class="absolute w-full flex justify-center h-full items-center">
            <div class="w-full max-w-[50vw]">
                <MagiStatusDisplay
                    isMelchiorActive={melchiorActive}
                    isBalthasarActive={balthasarActive}
                    isCasparActive={casparActive}
                />
            </div>
        </div>
    </div>
</div>

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
</style>
