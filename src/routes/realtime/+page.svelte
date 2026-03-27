<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import Card from "$lib/components/Card.svelte";
    import WaveformChart from "$lib/components/WaveformChart.svelte";
    import { xmlToJson } from "$lib/xmlUtils";

    import type { PageData } from "./$types";

    import { PUBLIC_WEBSOCKET_URL } from "$env/static/public";
    import { WaveformService } from "$lib/services/WaveformService";
    import HexGrid from "$lib/components/HexGrid.svelte";
    import HexShape from "$lib/components/HexShape.svelte";
    import StripeBar from "$lib/components/StripeBar.svelte";

    export let data: PageData;
    let waveformChart: any;

    let stationData: any;
    let selectedChannel: any;
    let listChannel: any[] = [];

    let ws: WebSocket;

    let isDemoMode = false;
    let demoInterval: ReturnType<typeof setInterval>;
    let demoPhase = 0;

    let isDemoPsychoMode = false;
    let psychoInterval: ReturnType<typeof setInterval>;
    let psychoPoints: { nx: number; ny: number }[] = [];

    // --- PSYCHOGRAPHIC SETTING ---
    // Ubah angka-angka di bawah ini
    const PSYCHO_JUMP_SIZE = 0.3; // Semakin besar, semakin lebar zigzag/lompatannya (misal: 0.2 halus, 0.8 kasar)
    const PSYCHO_MAX_POINTS = 300; // Semakin besar, semakin tebal dan padat benang kusut di dalam kotak (misal: 300 sepi, 1000 penuh)
    const PSYCHO_POINTS_PER_TICK = 10; // Kecepatan gerak/animasi garis baru
    // ----------------------------------------------

    function toggleDemoData() {
        isDemoMode = !isDemoMode;
        if (isDemoMode) {
            // Bersihkan data lama dari buffer setiap kali beralih ke mode demo
            waveformService.clearBuffer();
            demoInterval = setInterval(() => {
                demoPhase = waveformService.generateDemoData(demoPhase);
                dataBuffer = waveformService.getBuffer();
            }, 40);
        } else {
            if (demoInterval) clearInterval(demoInterval);
        }
    }

    function toggleDemoPsycho() {
        isDemoPsychoMode = !isDemoPsychoMode;
        if (isDemoPsychoMode) {
            psychoPoints = [];
            let curX = 0;
            let curY = 0;
            for (let i = 0; i < PSYCHO_MAX_POINTS; i++) {
                curX += (Math.random() - 0.5) * PSYCHO_JUMP_SIZE;
                curY += (Math.random() - 0.5) * PSYCHO_JUMP_SIZE;
                if (curX > 1) curX = 1;
                else if (curX < -1) curX = -1;
                if (curY > 1) curY = 1;
                else if (curY < -1) curY = -1;
                psychoPoints.push({ nx: curX, ny: curY });
            }

            psychoInterval = setInterval(() => {
                for (let i = 0; i < PSYCHO_POINTS_PER_TICK; i++) {
                    curX += (Math.random() - 0.5) * PSYCHO_JUMP_SIZE;
                    curY += (Math.random() - 0.5) * PSYCHO_JUMP_SIZE;
                    if (curX > 1) curX = 1;
                    else if (curX < -1) curX = -1;
                    if (curY > 1) curY = 1;
                    else if (curY < -1) curY = -1;
                    // Introduce some sharp jumps occasionally to make it even more chaotic
                    if (Math.random() > 0.95) {
                        curX = (Math.random() - 0.5) * 2;
                        curY = (Math.random() - 0.5) * 2;
                    }
                    psychoPoints.push({ nx: curX, ny: curY });
                }
                if (psychoPoints.length > PSYCHO_MAX_POINTS) {
                    psychoPoints.splice(0, PSYCHO_POINTS_PER_TICK);
                }
            }, 30);
        } else {
            if (psychoInterval) clearInterval(psychoInterval);
        }
    }

    // Data point structure
    interface DataPoint {
        t: number; // timestamp in MS
        v: number; // amplitude value
    }

    // Buffer limit: only keep the last 5 minutes of data (300,000 ms)
    // to prevent memory issues.
    const MAX_BUFFER_MS = 300000;

    // Buffer to hold our waveform data points
    const waveformService = new WaveformService(MAX_BUFFER_MS);
    let dataBuffer = waveformService.getBuffer();

    // Zoom/Scale factor for Y-axis (Amplitude)
    let zoomLevel = 0.05;
    const MIN_ZOOM = 0.0001;
    const MAX_ZOOM = 0.1;

    // Responsive Canvas dimensions

    // Time View Window (how many milliseconds are visible on screen)
    // E.g., 10000ms = 10 seconds of data on screen at once
    let timeWindowMs = 20000;

    // Horizontal offset (for panning backwards in time)
    // 0 means looking at the latest data. > 0 means looking back in time.
    let timeOffsetMs = 0;

    // To freeze the timeline when panning

    // Buffer limit: only keep the last 5 minutes of data (300,000 ms)
    // to prevent memory issues.

    // Approximate sample rate if not available from miniseed record
    // Usually SeedLink gives 100Hz or 50Hz. Let's assume 100Hz (10ms per sample)
    const nominalSampleRateMs = 10;

    let logMessages = "";

    // Settings Modal State
    let isSettingsOpen = false;
    let selectedTimezone = 0; // 0: UTC, 7: WIB, 8: WITA, 9: WIT

    function loadDataStation(network: string, station: string) {
        const url = `https://geofon.gfz-potsdam.de/fdsnws/station/1/query?network=${network}&station=${station}&level=response&format=xml`;

        return fetch(url)
            .then((response) => {
                if (!response.ok)
                    throw new Error("Gagal mengambil data jaringan");
                // 1. Ubah response dari server menjadi String Teks
                return response.text();
            })
            .then((xmlString) => {
                stationData = xmlToJson(xmlString).FDSNStationXML;
                console.log(stationData);
                if (Array.isArray(stationData.Network.Station)) {
                    //find sation that dont have endDate
                    stationData.Network.Station =
                        stationData.Network.Station.find(
                            (item: any) =>
                                item["@attributes"].endDate == undefined,
                        );
                }
                const el = document.getElementById("loading-screen");
                if (el) el.style.display = "none";

                for (
                    let index = 0;
                    index < stationData.Network.Station.Channel.length;
                    index++
                ) {
                    const channel = stationData.Network.Station.Channel[index];

                    //check if channel already in listChannel based on code
                    var check = listChannel.find(
                        (item) =>
                            item["@attributes"].code ==
                            channel["@attributes"].code,
                    );
                    if (check) {
                        continue;
                    }
                    listChannel.push(channel);
                }

                //find listChannel that dont have ["@attributes"].endDate
                const activeChannels = listChannel.filter(
                    (item) =>
                        item["@attributes"].endDate == undefined ||
                        item["@attributes"].endDate == "",
                );

                let activeChannel = undefined;
                const priorityCodes = ["BHZ", "SHZ", "HHZ"];
                for (const code of priorityCodes) {
                    activeChannel = activeChannels.find(
                        (item) => item["@attributes"].code === code,
                    );
                    if (activeChannel) break;
                }

                if (!activeChannel && activeChannels.length > 0) {
                    activeChannel = activeChannels[0];
                }

                if (activeChannel != undefined) {
                    selectedChannel = activeChannel;
                } else {
                    selectedChannel = listChannel[listChannel.length - 1];
                }
            })
            .catch((error) => {
                console.error("Terjadi kesalahan:", error);
                const el = document.getElementById("loading-screen");
                if (el) el.style.display = "none";
            });
    }

    onMount(async () => {
        if (!browser) return;

        console.log(data);
        if (data.networkCode == "" || data.stationCode == "") {
            return;
        }

        const stationPromise = loadDataStation(
            data.networkCode ?? "GE",
            data.stationCode ?? "GSI",
        );

        await waveformService.init();
        await stationPromise;

        const wsUrl = PUBLIC_WEBSOCKET_URL || "ws://localhost:8080";
        ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
            const request = {
                net: data.networkCode ?? "GE",
                sta: data.stationCode ?? "GSI",
                cha: selectedChannel["@attributes"].code,
            };
            ws.send(JSON.stringify(request));
        };

        ws.onmessage = (e) => {
            const dataBufferIncoming = e.data;
            if (isDemoMode || isDemoPsychoMode) {
                return;
            }

            const buffer = dataBufferIncoming; // ArrayBuffer

            const decoder = new TextDecoder("utf-8");
            const text = decoder.decode(buffer);

            // console.log(text);
            if (text.trim() == "OK") {
                logMessages += `${new Date().toLocaleString()} : Server OK\n`;
                return;
            }

            try {
                waveformService.processMiniseed(
                    dataBufferIncoming,
                    nominalSampleRateMs,
                );
                dataBuffer = waveformService.getBuffer();
                logMessages += `${new Date().toLocaleString()} : New Data...\n`;
            } catch (err) {
                console.log(e);
                console.error("Error parsing miniSEED data:", err);
                logMessages += `${new Date().toLocaleString()} : Error parsing miniSEED data: ${err}\n`;
                logMessages += `${new Date().toLocaleString()} : ${text}\n`;
            }
        };

        (window as any)._mseedWs = ws;
    });

    onDestroy(() => {
        if (!browser) return;

        if ((window as any)._mseedWs) {
            (window as any)._mseedWs.close();
        }

        if (demoInterval) {
            clearInterval(demoInterval);
        }
        if (psychoInterval) {
            clearInterval(psychoInterval);
        }
    });
</script>

<svelte:head>
    <title>Live Seismic Waveform - Psychographic</title>
</svelte:head>

<div
    class="min-h-screen px-1 lg:px-0 py-1 lg:py-8 flex flex-col justify-center overflow-hidden font-mono relative gap-2"
>
    <div class="w-full flex flex-col-reverse lg:flex-row gap-2 justify-center">
        {#if stationData != null && stationData.Network.Station != undefined && !Array.isArray(stationData.Network.Station)}
            <div class="flex flex-col gap-4 w-auto h-full items-stretch">
                <Card className=" w-full lg:w-md ">
                    {#snippet title()}
                        <p class="p-1 text-xl ews-title text-3xl">
                            STATION INFORMATION
                        </p>
                    {/snippet}
                    {#snippet children()}
                        <div class="w-full flex flex-row gap-2 p-1 lg:p-2">
                            <div
                                class="badge ews-title text-3xl bordered flex justify-between w-full"
                            >
                                <div
                                    class="flex flex-col items-center justify-between p-1"
                                >
                                    <div class="text -characters">
                                        {stationData.Network["@attributes"][
                                            "code"
                                        ]}
                                    </div>
                                    <div class="text">
                                        {stationData.Network.Station[
                                            "@attributes"
                                        ]["code"]}
                                    </div>
                                </div>
                                <div class="decal">
                                    <div
                                        class="w-full h-full stripe-bar-vertical loop-stripe-vertical anim-duration-20"
                                    ></div>
                                    <div
                                        class="w-full h-full stripe-bar-vertical loop-stripe-vertical anim-duration-20"
                                    ></div>
                                </div>
                            </div>
                            <div class="bordered p-1 lg:p-2 w-full">
                                <table class="w-full">
                                    <tbody>
                                        <tr>
                                            <td class="text-left p-0">
                                                Site
                                            </td>
                                            <td class="text-right p-0">
                                                {stationData.Network.Station
                                                    .Site.Name}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td class="text-left p-0">
                                                Elevation
                                            </td>
                                            <td class="text-right p-0">
                                                {stationData.Network.Station
                                                    .Elevation}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td class="text-left p-0">
                                                Latitude
                                            </td>
                                            <td class="text-right p-0">
                                                {stationData.Network.Station
                                                    .Latitude}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td class="text-left p-0">
                                                Longitude
                                            </td>
                                            <td class="text-right p-0">
                                                {stationData.Network.Station
                                                    .Longitude}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    {/snippet}
                    {#snippet footer()}
                        <div class="flex justify-center w-full ews-title">
                            <span>{stationData.Network["Description"]}</span>
                        </div>
                    {/snippet}
                </Card>

                <Card className=" w-full lg:w-md h-full grow ">
                    {#snippet title()}
                        <p class="p-1 text-xl ews-title text-3xl">
                            STATION CHANNEL
                        </p>
                    {/snippet}
                    {#snippet children()}
                        <div class="p-1 lg:p-2 w-full">
                            <HexGrid variant="flat">
                                {#each listChannel as channel, channelIndex (channel["@attributes"]["code"])}
                                    <div
                                        class="ews-hex-hive flat opacity-0 show-pop-up"
                                        style="animation-delay: {Math.min(
                                            channelIndex * 50,
                                            1000,
                                        )}ms; width: 83px; height: 72px;"
                                    >
                                        <HexShape
                                            clipContent={true}
                                            color={channel["@attributes"]
                                                .endDate == "" ||
                                            channel["@attributes"].endDate ==
                                                undefined
                                                ? "orange"
                                                : "red"}
                                            className={selectedChannel !=
                                                undefined &&
                                            selectedChannel != null &&
                                            selectedChannel["@attributes"]
                                                .code ==
                                                channel["@attributes"]["code"]
                                                ? "blink blink-fast"
                                                : ""}
                                        >
                                            <button
                                                class="w-full h-full cursor-pointer"
                                                on:click={() => {
                                                    selectedChannel = channel;
                                                    const request = {
                                                        net:
                                                            data.networkCode ??
                                                            "GE",
                                                        sta:
                                                            data.stationCode ??
                                                            "GSI",
                                                        cha: selectedChannel[
                                                            "@attributes"
                                                        ].code,
                                                    };
                                                    if (
                                                        ws &&
                                                        ws.readyState ===
                                                            WebSocket.OPEN
                                                    ) {
                                                        ws.send(
                                                            JSON.stringify(
                                                                request,
                                                            ),
                                                        );
                                                    }
                                                }}
                                            >
                                                <div
                                                    class="w-full h-full flex justify-center items-center text-black text-center"
                                                >
                                                    {channel["@attributes"][
                                                        "code"
                                                    ]}
                                                </div>
                                            </button>
                                        </HexShape>
                                    </div>
                                {/each}
                            </HexGrid>
                        </div>
                    {/snippet}

                    {#snippet footer()}
                        <div class="flex flex-col gap-2 w-full">
                            <button
                                class="ews-btn ews-btn-primary"
                                on:click={() => (isSettingsOpen = true)}
                                >SETTING</button
                            >
                        </div>
                    {/snippet}
                </Card>
            </div>
        {/if}

        <div class="w-full max-w-7xl flex flex-col bordered p-1 grow gap-3">
            <div
                class="relative w-full h-[75vh] border-b-4 border-l-4 bg-black overflow-hidden flex flex-col items-center"
                style="border-bottom-color: #fa0; border-left-color: #fa0;"
            >
                <!-- Top Left -->
                <div
                    class="absolute right-2 lg:right-0 lg:top-6 left-4 lg:left-24 pointer-events-none z-5 max-w-100 flex flex-col justify-center items-end lg:items-start gap-1"
                >
                    <div
                        class="rounded-sm bordered text-3xl bg-black/60 shadow-lg h-10 text-center flex justify-center items-center px-1"
                    >
                        <div class="font-bold md:text-3xl uppercase ews-title">
                            {isDemoPsychoMode
                                ? "PSYCHOGRAPHIC DISPLAY"
                                : "SEISMIC WAVEFORM"}
                        </div>
                    </div>
                    {#if selectedChannel != null && selectedChannel != undefined}
                        <div
                            class="font-bold mt-1 tracking-widest text-sm md:text-xl ews-title"
                        >
                            {isDemoPsychoMode
                                ? "Phase 4 Link"
                                : "CHANNEL : " +
                                  selectedChannel["@attributes"].code}
                        </div>

                        {#if !isDemoPsychoMode}
                            <div
                                class="font-bold tracking-widest text-sm md:text-xl ews-title"
                            >
                                SENSOR : {selectedChannel["Sensor"]["Model"]}
                            </div>
                        {/if}
                    {/if}
                </div>

                <!-- Top Right -->
                <div
                    class="absolute bottom-16 lg:bottom-auto top-auto lg:top-18 md:top-4 right-2 lg:right-16 pointer-events-none flex flex-col items-end z-5"
                >
                    <div
                        class="rounded-lg p-1 inline-block bg-black/60 shadow-lg"
                    >
                        <div class="bordered px-3 py-1 flex flex-col text-3xl">
                            <div
                                class="font-bold text-[10px] md:text-sm tracking-widest leading-none mb-1 ews-title"
                            >
                                STATION:
                            </div>
                            <div
                                class="font-bold text-2xl md:text-4xl tracking-widest leading-none text-right ews-title"
                            >
                                {stationData != null &&
                                stationData.Network.Station != undefined &&
                                !Array.isArray(stationData.Network.Station)
                                    ? `${stationData.Network["@attributes"]["code"]} ${stationData.Network.Station["@attributes"]["code"]}`
                                    : "LOADING..."}
                            </div>
                        </div>
                    </div>
                    <div
                        class="font-bold text-[8px] md:text-xs tracking-widest text-right mt-1 bg-black/60 px-1 drop-shadow-[0_0_5px_rgba(255,102,0,1)]"
                        style="color: #fa0;"
                    >
                        Y: AMPLITUDE (COUNTS) | X: TIME ({selectedTimezone === 0
                            ? "UTC"
                            : selectedTimezone === 7
                              ? "WIB"
                              : selectedTimezone === 8
                                ? "WITA"
                                : "WIT"})
                    </div>
                </div>

                <WaveformChart
                    bind:this={waveformChart}
                    waveformData={dataBuffer}
                    bind:zoomLevel
                    bind:timeOffsetMs
                    {timeWindowMs}
                    {selectedTimezone}
                    {isDemoPsychoMode}
                    {psychoPoints}
                    backgroundColor="#000000"
                    gridColor="#33cc55"
                    axesColor="#fa0"
                    waveformColor="#ff9900"
                    psychoWaveformColor="#ff9900"
                    emptyTextColor="#fa0"
                />
            </div>

            <!-- Controls below -->
            <div
                class="flex justify-between items-center text-xs uppercase tracking-widest px-2"
                style="color: #fa0;"
            >
                <div class="flex items-center gap-1 lg:gap-4 flex-wrap">
                    <span>Pan: Click & Drag</span>
                    <span class="hidden md:inline">|</span>
                    <span>Zoom Y: Wheel</span>
                    <span class="hidden md:inline">|</span>
                    <span>Nav: Shift+Wheel</span>
                    <span class="hidden md:inline">|</span>
                    <span>Zoom: {zoomLevel.toFixed(4)}x</span>
                </div>
                <div
                    class="flex flex-col lg:flex-row items-center gap-0 lg:gap-4 h-4"
                >
                    {#if timeOffsetMs > 0}
                        <button
                            class="bg-orange-950 border hover:bg-orange-800 text-white text-xs lg:text-md px-1 lg:px-3 py-0 lg:py-1 rounded cursor-pointer transition-colors"
                            style="border-color: #fa0;"
                            on:click={() => waveformChart.resumeLive()}
                        >
                            Resume Live
                        </button>
                    {/if}
                </div>
            </div>

            <div
                class="bordered-red p-1 lg:p-2 overflow-y-auto h-24 text-primary text-xs"
                style="text-box: trim-both cap alphabetic;"
            >
                <pre>{logMessages}</pre>
            </div>
        </div>
    </div>
</div>

{#if isSettingsOpen}
    <div
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
        <Card className=" w-full max-w-lg shadow-2xl">
            {#snippet title()}
                <div class="flex justify-between items-center w-full">
                    <p class="p-1 text-xl ews-title text-3xl">SETTING CHART</p>
                    <button
                        class="text-orange-500 hover:text-orange-300 font-bold text-2xl px-2"
                        on:click={() => (isSettingsOpen = false)}
                        >&times;</button
                    >
                </div>
            {/snippet}

            {#snippet children()}
                <div class="flex flex-col gap-6 w-full p-1 lg:p-2">
                    <!-- Timezone Settings -->
                    <div class="flex flex-col gap-2">
                        <p
                            class="text-orange-500 font-bold uppercase tracking-widest text-sm mb-1"
                        >
                            Select Time Zone (X-Axis):
                        </p>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {#each [{ label: "UTC", value: 0 }, { label: "WIB", value: 7 }, { label: "WITA", value: 8 }, { label: "WIT", value: 9 }] as tz}
                                <button
                                    class="border uppercase font-bold p-2 text-center transition-colors {selectedTimezone ===
                                    tz.value
                                        ? 'bg-orange-500 text-black border-orange-500'
                                        : 'bg-transparent text-orange-500 border-orange-500 hover:bg-orange-950'}"
                                    on:click={() =>
                                        (selectedTimezone = tz.value)}
                                >
                                    {tz.label}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <hr class="border-orange-900 my-2" />

                    <!-- Demo Modes -->
                    <div class="flex flex-col gap-2">
                        <p
                            class="text-orange-500 font-bold uppercase tracking-widest text-sm mb-1"
                        >
                            Chart Testing (Demo):
                        </p>
                        <button
                            class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered p-1"
                            on:click={toggleDemoData}
                        >
                            <StripeBar
                                reverse={true}
                                loop={isDemoMode}
                                duration={20}
                            ></StripeBar>

                            <span class="absolute bg-black ews-label px-2 py-1"
                                >⚠ DEMO DATA</span
                            >
                        </button>

                        <button
                            class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered p-1 mt-2"
                            on:click={toggleDemoPsycho}
                        >
                            <StripeBar
                                reverse={true}
                                color="red"
                                loop={isDemoPsychoMode}
                                duration={20}
                            ></StripeBar>
                            <span class="absolute bg-black ews-label px-2 py-1"
                                >⚠ DEMO PSYCHOGRAPHIC DATA</span
                            >
                        </button>
                    </div>
                </div>
            {/snippet}
        </Card>
    </div>
{/if}

<div
    class="fixed m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center overlay-bg text-center z-5 -red"
    id="loading-screen"
>
    <span class="loader"></span>
    <p class="my-2 red-color p-2">
        THIS IS A CONCEPT DESIGN - DATA STASIUN DARI GEOFON
    </p>
</div>
