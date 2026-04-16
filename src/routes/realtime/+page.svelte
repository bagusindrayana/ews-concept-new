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

    // Historical Data Mode
    let startTimeInput: string = ""; // datetime-local format: "2026-04-02T00:00"
    let endTimeInput: string = "";
    let isHistoricalMode: boolean = false;
    let isLoadingHistory: boolean = false;
    let historyError: string = "";
    let historicalStartMs: number = 0;
    let historicalEndMs: number = 0;

    // Local MiniSEED file upload
    let miniseedFileInput: HTMLInputElement;
    let isLoadingMiniseed: boolean = false;
    let miniseedError: string = "";
    let miniseedFileName: string = "";

    // Web Serial ESP32
    let isEspConnected = false;
    let espSerialPort: any;

    class LineBreakTransformer {
        chunks: string;
        constructor() {
            this.chunks = "";
        }

        transform(chunk: string, controller: any) {
            this.chunks += chunk;
            const lines = this.chunks.split("\n");
            this.chunks = lines.pop() || "";
            lines.forEach((line) => controller.enqueue(line.trim()));
        }

        flush(controller: any) {
            if (this.chunks) {
                controller.enqueue(this.chunks.trim());
            }
        }
    }
    let targetP1 = -1;
    let targetP2 = -1;
    let targetP3 = -1;

    let currentP1 = -1;
    let currentP2 = -1;
    let currentP3 = -1;

    let lerpAnimFrame: number;

    const LERP_SPEED = 0.1; // Tingkat kehalusan, semakin kecil makin halus

    function lerpLoop() {
        if (!isEspConnected) return;

        if (targetP1 !== -1 && currentP1 !== -1) {
            currentP1 += (targetP1 - currentP1) * LERP_SPEED;
            zoomLevel = MIN_ZOOM + (currentP1 / 4095) * (MAX_ZOOM - MIN_ZOOM);
        }

        if (targetP2 !== -1 && currentP2 !== -1) {
            currentP2 += (targetP2 - currentP2) * LERP_SPEED;
            timeWindowMs = 2000 + (currentP2 / 4095) * (300000 - 2000);
        }

        if (targetP3 !== -1 && currentP3 !== -1) {
            currentP3 += (targetP3 - currentP3) * LERP_SPEED;

            // Snap ke 0 ketika target sudah pasti 0 agar resumeLive memicu
            if (targetP3 === 0 && currentP3 < 1) {
                currentP3 = 0;
            }

            if (currentP3 === 0) {
                if (timeOffsetMs !== 0) {
                    timeOffsetMs = 0;
                    if (waveformChart) waveformChart.resumeLive();
                }
            } else {
                timeOffsetMs = (currentP3 / 4095) * 300000;
            }
        }

        lerpAnimFrame = requestAnimationFrame(lerpLoop);
    }

    async function connectEsp32() {
        if (!browser) return;
        try {
            if ("serial" in navigator) {
                if (!espSerialPort) {
                    espSerialPort = await (
                        navigator as any
                    ).serial.requestPort();
                    await espSerialPort.open({ baudRate: 115200 });
                    isEspConnected = true;
                    logMessages += `${new Date().toLocaleString()} : ESP32 Serial Connected\n`;
                    targetP1 = -1;
                    targetP2 = -1;
                    targetP3 = -1;
                    currentP1 = -1;
                    currentP2 = -1;
                    currentP3 = -1;
                    if (lerpAnimFrame) cancelAnimationFrame(lerpAnimFrame);
                    lerpAnimFrame = requestAnimationFrame(lerpLoop);
                    readEsp32Serial();
                } else {
                    // Close the port if already connected
                    await espSerialPort.close();
                    espSerialPort = null;
                    isEspConnected = false;
                    if (lerpAnimFrame) cancelAnimationFrame(lerpAnimFrame);
                    logMessages += `${new Date().toLocaleString()} : ESP32 Serial Disconnected\n`;
                }
            } else {
                console.error("Web Serial API not supported in this browser.");
                logMessages += `${new Date().toLocaleString()} : Web Serial API not supported.\n`;
            }
        } catch (err) {
            console.error("Error connecting to ESP32:", err);
            logMessages += `${new Date().toLocaleString()} : ESP32 Connection Error.\n`;
        }
    }

    async function readEsp32Serial() {
        if (!espSerialPort) return;
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = espSerialPort.readable.pipeTo(
            textDecoder.writable,
        );
        const reader = textDecoder.readable
            .pipeThrough(new TransformStream(new LineBreakTransformer()))
            .getReader();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    try {
                        const data = JSON.parse(value);
                        if (
                            data.p1 !== undefined &&
                            data.p2 !== undefined &&
                            data.p3 !== undefined
                        ) {
                            let p1Val = data.p1 < 50 ? 0 : data.p1;
                            let p2Val = data.p2 < 50 ? 0 : data.p2;
                            let p3Val = data.p3 < 50 ? 0 : data.p3;

                            targetP1 = p1Val;
                            targetP2 = p2Val;
                            targetP3 = p3Val;

                            if (currentP1 === -1) currentP1 = p1Val;
                            if (currentP2 === -1) currentP2 = p2Val;
                            if (currentP3 === -1) currentP3 = p3Val;
                        }
                    } catch (e) {
                        // ignore JSON parse errors or partial lines
                    }
                }
            }
        } catch (err) {
            console.error("Serial read error", err);
        } finally {
            isEspConnected = false;
            espSerialPort = null;
            if (lerpAnimFrame) cancelAnimationFrame(lerpAnimFrame);
        }
    }

    async function loadHistoricalData() {
        if (!startTimeInput || !endTimeInput) {
            historyError = "Start Time dan End Time harus diisi.";
            return;
        }

        // datetime-local gives "YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS" (local time, no Z)
        // We treat user input as UTC — append 'Z' to force UTC parsing
        const toUTC = (dt: string) => {
            const s = dt.length === 16 ? dt + ":00" : dt; // ensure HH:MM:SS
            return new Date(s + "Z").getTime();
        };

        const startMs = toUTC(startTimeInput);
        const endMs = toUTC(endTimeInput);

        if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
            historyError = "Range waktu tidak valid.";
            return;
        }

        historyError = "";
        isLoadingHistory = true;

        // Format ISO for FDSN API (already UTC since startMs is UTC based)
        const startISO = new Date(startMs).toISOString();
        const endISO = new Date(endMs).toISOString();

        const network = data.networkCode ?? "GE";
        const station = data.stationCode ?? "LUWI";
        const channel = selectedChannel
            ? selectedChannel["@attributes"].code
            : "BHZ";

        const url = `https://geofon.gfz.de/fdsnws/dataselect/1/query?starttime=${encodeURIComponent(startISO)}&endtime=${encodeURIComponent(endISO)}&nodata=404&network=${network}&station=${station}&channel=${channel}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                historyError = `Gagal fetch data: HTTP ${response.status}`;
                isLoadingHistory = false;
                return;
            }

            const arrayBuffer = await response.arrayBuffer();

            // Clear buffer and load historical data
            // Pass startMs as hint for timestamp fallback, skipTrim=true so 1-hour+ data isn't cut
            waveformService.clearBuffer();
            waveformService.processMiniseedRaw(
                arrayBuffer,
                nominalSampleRateMs,
                startMs,
                true,
            );
            dataBuffer = waveformService.getBuffer();

            if (dataBuffer.length === 0) {
                historyError =
                    "Data kosong atau tidak ada data pada rentang waktu ini.";
                isLoadingHistory = false;
                return;
            }

            // Use USER's requested range for historicalStartMs/EndMs
            // (don't use actualEnd — it may be Date.now() if timestamp parsing failed)
            historicalStartMs = startMs;
            historicalEndMs = endMs;
            isHistoricalMode = true;
            timeOffsetMs = 0; // Start at right edge (endTime)

            // Jump chart to end of historical range
            if (waveformChart) {
                waveformChart.jumpToHistoricalEnd();
            }

            const actualStart = dataBuffer[0].t;
            const actualEnd = dataBuffer[dataBuffer.length - 1].t;
            logMessages += `${new Date().toLocaleString()} : Historical data loaded (${dataBuffer.length} pts | actual: ${new Date(actualStart).toISOString()} ~ ${new Date(actualEnd).toISOString()})\n`;
            isSettingsOpen = false;
        } catch (err: any) {
            historyError = `Error: ${err.message}`;
            console.error(err);
        } finally {
            isLoadingHistory = false;
        }
    }

    function clearHistoricalMode() {
        waveformService.clearBuffer();
        dataBuffer = waveformService.getBuffer();
        historicalStartMs = 0;
        historicalEndMs = 0;
        isHistoricalMode = false;
        timeOffsetMs = 0;
        historyError = "";
        miniseedFileName = "";
        miniseedError = "";
        if (waveformChart) waveformChart.resumeLive();
        logMessages += `${new Date().toLocaleString()} : Back to live mode\n`;
    }

    async function loadMiniseedFile(e: Event) {
        const input = e.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        miniseedFileName = file.name;
        miniseedError = "";
        isLoadingMiniseed = true;

        try {
            const arrayBuffer = await file.arrayBuffer();

            waveformService.clearBuffer();
            // No expectedStartMs hint — let header timestamps drive it
            waveformService.processMiniseedRaw(
                arrayBuffer,
                nominalSampleRateMs,
                undefined,
                true,
            );
            dataBuffer = waveformService.getBuffer();

            if (dataBuffer.length === 0) {
                miniseedError =
                    "Tidak ada data yang dapat dibaca dari file ini.";
                isLoadingMiniseed = false;
                return;
            }

            const actualStart = dataBuffer[0].t;
            const actualEnd = dataBuffer[dataBuffer.length - 1].t;

            historicalStartMs = actualStart;
            historicalEndMs = actualEnd;
            isHistoricalMode = true;
            timeOffsetMs = 0;

            if (waveformChart) waveformChart.jumpToHistoricalEnd();

            logMessages += `${new Date().toLocaleString()} : MiniSEED file loaded "${file.name}" (${dataBuffer.length} pts | ${new Date(actualStart).toISOString()} ~ ${new Date(actualEnd).toISOString()})\n`;
        } catch (err: any) {
            miniseedError = `Error: ${err.message}`;
            console.error(err);
        } finally {
            isLoadingMiniseed = false;
            // Reset file input so the same file can be re-loaded
            input.value = "";
        }
    }

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
            // Jangan proses data live saat historical mode aktif
            if (isDemoMode || isDemoPsychoMode || isHistoricalMode) {
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
    <div
        class="flex no-snapshot fixed right-2 translate-y-0 top-2 left-0 right-0 m-auto flex-row justify-center items-center z-5 gap-2 pointer-events-none"
        style="width:fit-content"
    >
        <a
            class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
            href="/">HOME</a
        >
        <a
            class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
            href="/status-ui">STATION STATUS</a
        >
    </div>
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
                        <!-- Hidden file input for miniseed upload -->
                        <input
                            bind:this={miniseedFileInput}
                            type="file"
                            accept=".mseed,.miniseed,.ms,application/octet-stream"
                            class="hidden"
                            on:change={loadMiniseedFile}
                        />
                        <div class="flex flex-col gap-2 w-full">
                            <button
                                class="ews-btn ews-btn-primary"
                                on:click={() => (isSettingsOpen = true)}
                                >SETTING</button
                            >
                            <button
                                id="load-miniseed-btn"
                                class="ews-btn ews-btn-danger {isLoadingMiniseed
                                    ? 'opacity-60 cursor-not-allowed'
                                    : 'cursor-pointer'}"
                                on:click={() =>
                                    !isLoadingMiniseed &&
                                    miniseedFileInput.click()}
                                disabled={isLoadingMiniseed}
                                title="Load local MiniSEED file"
                            >
                                {#if isLoadingMiniseed}
                                    <span class="animate-spin inline-block mr-1"
                                        >⟳</span
                                    > LOADING...
                                {:else}
                                    LOAD MINISEED
                                {/if}
                            </button>
                            <button
                                id="connect-esp32-btn"
                                class="ews-btn {isEspConnected
                                    ? 'ews-btn-danger'
                                    : 'ews-btn-primary'} cursor-pointer"
                                on:click={connectEsp32}
                            >
                                {isEspConnected
                                    ? "ESP32 CONNECTED"
                                    : "CONNECT ESP32"}
                            </button>
                            {#if miniseedFileName && !isLoadingMiniseed}
                                <div
                                    class="text-xs text-center truncate px-1"
                                    style="color: #fa0; opacity: 0.75;"
                                    title={miniseedFileName}
                                >
                                    📼 {miniseedFileName}
                                </div>
                            {/if}
                            {#if miniseedError}
                                <div
                                    class="text-xs text-red-400 text-center px-1 break-words"
                                >
                                    {miniseedError}
                                </div>
                            {/if}
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
                    {historicalStartMs}
                    {historicalEndMs}
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
                    {#if isHistoricalMode}
                        <span class="text-yellow-400 text-xs font-bold"
                            >HISTORICAL MODE</span
                        >
                        <button
                            class="bg-orange-950 border hover:bg-orange-800 text-white text-xs lg:text-md px-1 lg:px-3 py-0 lg:py-1 rounded cursor-pointer transition-colors"
                            style="border-color: #fa0;"
                            on:click={clearHistoricalMode}
                        >
                            Back to Live
                        </button>
                    {:else if timeOffsetMs > 0}
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
                    <!-- Historical Data Filter -->
                    <div class="flex flex-col gap-2">
                        <p
                            class="text-orange-500 font-bold uppercase tracking-widest text-sm mb-1"
                        >
                            Historical Data (FDSN DataSelect):
                        </p>
                        <div class="flex flex-col gap-2">
                            <div class="flex flex-col gap-1">
                                <label
                                    for="hist-start-time"
                                    class="text-orange-400 text-xs uppercase tracking-widest"
                                    >Start Time (UTC)</label
                                >
                                <input
                                    id="hist-start-time"
                                    type="datetime-local"
                                    bind:value={startTimeInput}
                                    class="bg-black border border-orange-700 text-orange-300 px-2 py-1 text-sm w-full focus:outline-none focus:border-orange-400"
                                    style="color-scheme: dark;"
                                    step="1"
                                />
                            </div>
                            <div class="flex flex-col gap-1">
                                <label
                                    for="hist-end-time"
                                    class="text-orange-400 text-xs uppercase tracking-widest"
                                    >End Time (UTC)</label
                                >
                                <input
                                    id="hist-end-time"
                                    type="datetime-local"
                                    bind:value={endTimeInput}
                                    class="bg-black border border-orange-700 text-orange-300 px-2 py-1 text-sm w-full focus:outline-none focus:border-orange-400"
                                    style="color-scheme: dark;"
                                    step="1"
                                />
                            </div>
                            {#if historyError}
                                <p class="text-red-400 text-xs">
                                    {historyError}
                                </p>
                            {/if}
                            <div class="flex gap-2">
                                <button
                                    class="ews-btn ews-btn-primary flex-1 flex items-center justify-center gap-2"
                                    on:click={loadHistoricalData}
                                    disabled={isLoadingHistory}
                                >
                                    {#if isLoadingHistory}
                                        <span class="animate-spin">⟳</span> Memuat...
                                    {:else}
                                        Load Historical Data
                                    {/if}
                                </button>
                                {#if isHistoricalMode}
                                    <button
                                        class="border border-orange-700 hover:bg-orange-950 text-orange-400 text-sm px-3 py-1"
                                        on:click={() => {
                                            clearHistoricalMode();
                                            isSettingsOpen = false;
                                        }}
                                    >
                                        ✕ Clear
                                    </button>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <hr class="border-orange-900 my-2" />

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
