<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import Card from "$lib/components/Card.svelte";
    import { xmlToJson } from "$lib/xmlUtils";

    import type { PageData } from "./$types";

    import { PUBLIC_WEBSOCKET_URL } from "$env/static/public";
    import HexGrid from "$lib/components/HexGrid.svelte";

    export let data: PageData;
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let container: HTMLDivElement;

    let seis: any;

    let stationData: any;
    let selectedChannel: string = "";
    let listChannel: any[] = [];

    let ws: WebSocket;

    let isDemoMode = false;
    let demoInterval: ReturnType<typeof setInterval>;
    let demoPhase = 0;

    let isDemoPsychoMode = false;
    let psychoInterval: ReturnType<typeof setInterval>;
    let psychoPoints: { nx: number; ny: number }[] = [];

    // --- PENGATURAN KEKUSUTAN (TANGLE SETTINGS) ---
    // Ubah angka-angka di bawah ini untuk mengatur tingkat kekusutan
    const PSYCHO_JUMP_SIZE = 0.3; // Semakin besar, semakin lebar zigzag/lompatannya (misal: 0.2 halus, 0.8 kasar)
    const PSYCHO_MAX_POINTS = 300; // Semakin besar, semakin tebal dan padat benang kusut di dalam kotak (misal: 300 sepi, 1000 penuh)
    const PSYCHO_POINTS_PER_TICK = 10; // Kecepatan gerak/animasi garis baru
    // ----------------------------------------------

    function toggleDemoData() {
        isDemoMode = !isDemoMode;
        if (isDemoMode) {
            demoInterval = setInterval(() => {
                const now = Date.now();
                const samplesToGenerate = 4;
                const msPerSample = 10;

                for (let i = 0; i < samplesToGenerate; i++) {
                    demoPhase += 0.1;
                    const noise = (Math.random() - 0.5) * 500;
                    const primaryWave = Math.sin(demoPhase) * 3000;
                    const secondaryWave = Math.cos(demoPhase * 0.5) * 1000;
                    const spike =
                        Math.random() > 0.98
                            ? (Math.random() - 0.5) * 10000
                            : 0;

                    dataBuffer.push({
                        t: now - (samplesToGenerate - i - 1) * msPerSample,
                        v: primaryWave + secondaryWave + noise + spike,
                    });
                }

                dataBuffer.sort((a, b) => a.t - b.t);

                const cutoffTime = now - MAX_BUFFER_MS;
                let trimIndex = 0;
                while (
                    trimIndex < dataBuffer.length &&
                    dataBuffer[trimIndex].t < cutoffTime
                ) {
                    trimIndex++;
                }
                if (trimIndex > 0) {
                    dataBuffer = dataBuffer.slice(trimIndex);
                }
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

    // Buffer to hold our waveform data points
    let dataBuffer: DataPoint[] = [];

    // Zoom/Scale factor for Y-axis (Amplitude)
    let zoomLevel = 0.05;
    const MIN_ZOOM = 0.0001;
    const MAX_ZOOM = 0.1;

    // Responsive Canvas dimensions
    let width = 1200;
    let height = 600;

    // Time View Window (how many milliseconds are visible on screen)
    // E.g., 10000ms = 10 seconds of data on screen at once
    let timeWindowMs = 20000;

    // Horizontal offset (for panning backwards in time)
    // 0 means looking at the latest data. > 0 means looking back in time.
    let timeOffsetMs = 0;

    // For panning logic
    let isDragging = false;
    let lastMouseX = 0;

    // Buffer limit: only keep the last 5 minutes of data (300,000 ms)
    // to prevent memory issues.
    const MAX_BUFFER_MS = 300000;

    // Approximate sample rate if not available from miniseed record
    // Usually SeedLink gives 100Hz or 50Hz. Let's assume 100Hz (10ms per sample)
    const nominalSampleRateMs = 10;

    let logMessages = "";

    function resizeCanvas() {
        if (!container || !canvas) return;

        const rect = container.getBoundingClientRect();
        width = rect.width;
        height = rect.height;

        canvas.width = width;
        canvas.height = height;

        draw();
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();

        // Vertical Scroll (Y-Axis Zoom)
        if (e.deltaY !== 0 && !e.shiftKey) {
            const zoomStep = zoomLevel * 0.1; // 10% change
            if (e.deltaY < 0) {
                zoomLevel = Math.min(MAX_ZOOM, zoomLevel + zoomStep);
            } else {
                zoomLevel = Math.max(MIN_ZOOM, zoomLevel - zoomStep);
            }
        }

        // Horizontal Scroll with Shift key or Trackpad horizontal scroll (Pan Time)
        // Also allow horizontal wheel events (deltaX)
        if (e.deltaX !== 0 || (e.deltaY !== 0 && e.shiftKey)) {
            const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
            // Map pixels to milliseconds
            const msPerPixel = timeWindowMs / width;
            timeOffsetMs += delta * msPerPixel * 2;

            // Prevent panning into the future
            if (timeOffsetMs < 0) timeOffsetMs = 0;
        }

        draw();
    }

    // Mouse Dragging for Panning
    function handleMouseDown(e: MouseEvent) {
        isDragging = true;
        lastMouseX = e.clientX;
    }

    function handleMouseMove(e: MouseEvent) {
        if (!isDragging) return;

        const dx = e.clientX - lastMouseX;
        lastMouseX = e.clientX;

        // Map pixel drag to time change
        const msPerPixel = timeWindowMs / width;
        // Moving right (dx > 0) means going back in time (increasing timeOffset)
        timeOffsetMs += dx * msPerPixel;

        if (timeOffsetMs < 0) timeOffsetMs = 0;

        draw();
    }

    function handleMouseUp() {
        isDragging = false;
    }

    function formatTimeStr(ms: number) {
        const d = new Date(ms);
        return d.toISOString().substring(11, 19); // HH:MM:SS
    }

    function draw() {
        if (!ctx || !canvas) return;

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, width, height);

        if (dataBuffer.length === 0 && !isDemoPsychoMode) {
            // Draw empty state
            ctx.fillStyle = "#fa0";
            ctx.font = 'bold 16px "Inter", sans-serif';
            ctx.textAlign = "center";
            ctx.fillText("WAITING FOR SIGNAL...", width / 2, height / 2);
            return;
        }

        const latestTime = dataBuffer.length > 0 ? dataBuffer[dataBuffer.length - 1].t : Date.now();
        // The right edge of the screen represents (latestTime - timeOffsetMs)
        const rightEdgeTime = latestTime - timeOffsetMs;
        const leftEdgeTime = rightEdgeTime - timeWindowMs;

        const leftPadding = 70;
        const bottomPadding = 40;
        const drawWidth = width - leftPadding;
        const drawHeight = height - bottomPadding;

        // X-Axis Grid inside graph area (Neon Green with Crosshairs)
        ctx.strokeStyle = "#33cc55";
        ctx.lineWidth = 1;
        ctx.beginPath();

        const xGridStep = drawWidth / 8;
        const yGridStep = drawHeight / 12; // 12 divisions like the EVANGELION reference

        for (let xPos = leftPadding; xPos <= width; xPos += xGridStep) {
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, drawHeight);

            // Draw crosshairs on the lines
            for (let yPos = 0; yPos <= drawHeight; yPos += yGridStep) {
                // Crosshairs length: 10px
                ctx.moveTo(xPos - 5, yPos);
                ctx.lineTo(xPos + 5, yPos);
            }

            // Draw floating crosshairs between the vertical lines (shifted by half a grid step)
            // Only draw if we're not on the very last vertical line to prevent drawing outside the right edge
            if (xPos + xGridStep <= width) {
                const midX = xPos + xGridStep / 2;
                for (
                    let yPos = yGridStep / 2;
                    yPos <= drawHeight;
                    yPos += yGridStep
                ) {
                    ctx.moveTo(midX - 5, yPos);
                    ctx.lineTo(midX + 5, yPos);
                    ctx.moveTo(midX, yPos - 5);
                    ctx.lineTo(midX, yPos + 5);
                }
            }
        }
        ctx.stroke();

        // Left Label Ruler (Amplitude)
        ctx.strokeStyle = "#fa0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(leftPadding, 0);
        ctx.lineTo(leftPadding, drawHeight);

        ctx.fillStyle = "#fa0";
        ctx.font = 'bold 14px "Inter", sans-serif';
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        for (let y = 0; y <= drawHeight; y += yGridStep) {
            // Ticks
            ctx.moveTo(leftPadding - 8, y);
            ctx.lineTo(leftPadding, y);

            const actualValue = (drawHeight / 2 - y) / zoomLevel;
            // Format to integer since amplitude counts are generally large or zero
            ctx.fillText(
                Math.round(actualValue).toString(),
                leftPadding - 10,
                y,
            );
        }
        ctx.stroke();

        // Bottom Ruler (Time/Ticks)
        ctx.strokeStyle = "#fa0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, drawHeight);
        ctx.lineTo(width, drawHeight);
        ctx.stroke();

        ctx.fillStyle = "#fa0";
        ctx.font = 'bold 12px "Inter", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        ctx.strokeStyle = "#fa0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const pixelsPerMs = drawWidth / timeWindowMs;

        // Find the first integer second within our visible window
        const startSecond = Math.floor(leftEdgeTime / 1000);
        const endSecond = Math.ceil(rightEdgeTime / 1000);

        for (let sec = startSecond; sec <= endSecond; sec++) {
            const timeAtTick = sec * 1000;
            const x = leftPadding + (timeAtTick - leftEdgeTime) * pixelsPerMs;

            if (x >= leftPadding && x <= width) {
                let tickLen = 6;
                // Every 10 seconds is a major tick
                if (sec % 10 === 0) {
                    tickLen = 20;
                    let timeLabel = formatTimeStr(timeAtTick);
                    ctx.fillText(timeLabel, x, drawHeight + 22);
                } else if (sec % 5 === 0) {
                    tickLen = 12;
                } else if (sec % 1 === 0) {
                    tickLen = 6;
                }

                ctx.moveTo(x, drawHeight);
                ctx.lineTo(x, drawHeight + tickLen);

                // Minor ticks every 0.25 sec
                for (let minor = 1; minor < 4; minor++) {
                    const minorX = x + minor * 0.25 * 1000 * pixelsPerMs;
                    if (minorX > leftPadding && minorX <= width) {
                        ctx.moveTo(minorX, drawHeight);
                        ctx.lineTo(minorX, drawHeight + 4);
                    }
                }
            }
        }
        ctx.stroke();

        // Draw the waveform line
        if (isDemoPsychoMode) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(leftPadding, 0, drawWidth, drawHeight);
            ctx.clip();

            ctx.strokeStyle = "#ff9900"; // Bright orange
            ctx.shadowBlur = 12;
            ctx.shadowColor = "#ff3300";
            ctx.lineWidth = 2.5;
            ctx.lineJoin = "round";

            ctx.beginPath();

            const startX = leftPadding;
            const boundingBoxLeft = leftPadding + drawWidth * 0.3;
            const boundingBoxRight = leftPadding + drawWidth * 0.55;
            const boundingBoxTop = drawHeight * 0.1;
            const boundingBoxBottom = drawHeight * 0.9;
            const boxWidth = boundingBoxRight - boundingBoxLeft;
            const boxHeight = boundingBoxBottom - boundingBoxTop;

            ctx.moveTo(startX, drawHeight - 2);
            ctx.bezierCurveTo(
                leftPadding + drawWidth * 0.15,
                drawHeight,
                leftPadding + drawWidth * 0.25,
                drawHeight * 0.1,
                boundingBoxLeft,
                boundingBoxTop,
            );

            if (psychoPoints.length > 0) {
                // Menggunakan quadraticCurveTo agar garis terlihat lebih melengkung/mulus (seperti benang)
                const firstPx =
                    boundingBoxLeft +
                    boxWidth / 2 +
                    (psychoPoints[0].nx * boxWidth) / 2;
                const firstPy =
                    boundingBoxTop +
                    boxHeight / 2 +
                    (psychoPoints[0].ny * boxHeight) / 2;
                ctx.lineTo(firstPx, firstPy);

                for (let i = 1; i < psychoPoints.length - 1; i++) {
                    const px =
                        boundingBoxLeft +
                        boxWidth / 2 +
                        (psychoPoints[i].nx * boxWidth) / 2;
                    const py =
                        boundingBoxTop +
                        boxHeight / 2 +
                        (psychoPoints[i].ny * boxHeight) / 2;
                    const nextPx =
                        boundingBoxLeft +
                        boxWidth / 2 +
                        (psychoPoints[i + 1].nx * boxWidth) / 2;
                    const nextPy =
                        boundingBoxTop +
                        boxHeight / 2 +
                        (psychoPoints[i + 1].ny * boxHeight) / 2;

                    const midX = (px + nextPx) / 2;
                    const midY = (py + nextPy) / 2;

                    ctx.quadraticCurveTo(px, py, midX, midY);
                }

                const lastPx =
                    boundingBoxLeft +
                    boxWidth / 2 +
                    (psychoPoints[psychoPoints.length - 1].nx * boxWidth) / 2;
                const lastPy =
                    boundingBoxTop +
                    boxHeight / 2 +
                    (psychoPoints[psychoPoints.length - 1].ny * boxHeight) / 2;
                ctx.lineTo(lastPx, lastPy);

                ctx.lineTo(boundingBoxRight, drawHeight * 0.4);

                let stairX = boundingBoxRight;
                let stairY = drawHeight * 0.4;

                stairX += drawWidth * 0.05;
                ctx.lineTo(stairX, stairY);
                stairY += drawHeight * 0.2;
                ctx.lineTo(stairX, stairY);

                stairX += drawWidth * 0.05;
                ctx.lineTo(stairX, stairY);
                stairY += drawHeight * 0.2;
                ctx.lineTo(stairX, stairY);

                stairX += drawWidth * 0.05;
                ctx.lineTo(stairX, stairY);
                stairY = drawHeight - 2;
                ctx.lineTo(stairX, stairY);

                ctx.lineTo(width, stairY);
            }

            ctx.stroke();
            ctx.restore();
        } else {
            const visiblePoints = dataBuffer.filter(
                (p) =>
                    p.t >= leftEdgeTime - 1000 && p.t <= rightEdgeTime + 1000,
            );

            if (visiblePoints.length > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(leftPadding, 0, drawWidth, drawHeight);
                ctx.clip();

                ctx.strokeStyle = "#ff9900"; // Bright orange
                ctx.shadowBlur = 12;
                ctx.shadowColor = "#ff3300";
                ctx.lineWidth = 2.5;
                ctx.lineJoin = "round";
                ctx.beginPath();

                visiblePoints.forEach((p, i) => {
                    const timeRatio = (p.t - leftEdgeTime) / timeWindowMs;
                    const x = leftPadding + timeRatio * drawWidth;

                    const y = drawHeight / 2 - p.v * zoomLevel;

                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });

                ctx.stroke();
                ctx.restore();
            }
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
                const activeChannel = listChannel.find(
                    (item) =>
                        item["@attributes"].endDate == undefined ||
                        item["@attributes"].endDate == "",
                );

                if (activeChannel != undefined) {
                    selectedChannel = activeChannel["@attributes"].code;
                } else {
                    selectedChannel =
                        listChannel[listChannel.length - 1]["@attributes"].code;
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

        ctx = canvas.getContext("2d")!;

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        canvas.addEventListener("wheel", handleWheel, { passive: false });
        // Add drag events
        canvas.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mousemove", handleMouseMove); // Window catches fast drags
        window.addEventListener("mouseup", handleMouseUp);

        const stationPromise = loadDataStation(
            data.networkCode ?? "GE",
            data.stationCode ?? "GSI",
        );

        seis = await import("seisplotjs");
        await stationPromise;

        const wsUrl = PUBLIC_WEBSOCKET_URL || "ws://localhost:8080";
        ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
            const request = {
                net: data.networkCode ?? "GE",
                sta: data.stationCode ?? "GSI",
                cha: selectedChannel,
            };
            ws.send(JSON.stringify(request));
        };

        ws.onmessage = (e) => {
            const dataBufferIncoming = e.data;

            const buffer = dataBufferIncoming; // ArrayBuffer

            const decoder = new TextDecoder("utf-8");
            const text = decoder.decode(buffer);

            // console.log(text);
            if (text == "OK") {
                logMessages += `Server OK\n`;
                return;
            }

            try {
                const mseedData = dataBufferIncoming.slice(8);
                const records = seis.miniseed.parseDataRecords(mseedData);

                records.forEach((r: any) => {
                    const samples = r.decompress();

                    const mean =
                        samples.reduce((sum: number, v: number) => sum + v, 0) /
                        samples.length;
                    const demeaned = samples.map((v: number) => v - mean);

                    let startTimeMs = Date.now();
                    if (r.header && r.header.start) {
                        try {
                            startTimeMs = r.header.start.valueOf();
                        } catch (e) {
                            console.warn("Could not parse record start time");
                        }
                    }

                    let msPerSample = nominalSampleRateMs;
                    if (r.header && r.header.sampleRate) {
                        msPerSample = 1000 / r.header.sampleRate;
                    }

                    // for (let i = 0; i < samples.length; i++) {
                    //     dataBuffer.push({
                    //         t: startTimeMs + i * msPerSample,
                    //         v: samples[i],
                    //     });
                    // }

                    for (let i = 0; i < demeaned.length; i++) {
                        dataBuffer.push({
                            t: startTimeMs + i * msPerSample,
                            v: demeaned[i],
                        });
                    }
                });

                dataBuffer.sort((a, b) => a.t - b.t);

                const latestTime = dataBuffer[dataBuffer.length - 1].t;
                const cutoffTime = latestTime - MAX_BUFFER_MS;

                let trimIndex = 0;
                while (
                    trimIndex < dataBuffer.length &&
                    dataBuffer[trimIndex].t < cutoffTime
                ) {
                    trimIndex++;
                }

                if (trimIndex > 0) {
                    dataBuffer = dataBuffer.slice(trimIndex);
                }

                if (!isDragging && timeOffsetMs === 0) {
                    draw();
                } else if (!isDragging && timeOffsetMs > 0) {
                    draw();
                }
            } catch (err) {
                console.log(e);
                console.error("Error parsing miniSEED data:", err);
                logMessages += `Error parsing miniSEED data: ${err}\n`;
            }
        };

        (window as any)._mseedWs = ws;

        function updateLoop() {
            if (!isDragging) {
                draw();
            }
            (window as any)._mseedAnimId = requestAnimationFrame(updateLoop);
        }
        updateLoop();
    });

    onDestroy(() => {
        if (!browser) return;
        window.removeEventListener("resize", resizeCanvas);
        if (canvas) {
            canvas.removeEventListener("wheel", handleWheel);
            canvas.removeEventListener("mousedown", handleMouseDown);
        }
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        if ((window as any)._mseedWs) {
            (window as any)._mseedWs.close();
        }
        if ((window as any)._mseedAnimId) {
            cancelAnimationFrame((window as any)._mseedAnimId);
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
    class="min-h-screen py-8 flex flex-col justify-center overflow-hidden font-mono relative gap-2"
>
    <div
        class="w-full flex flex-col-reverse md:flex-row gap-2 justify-center px-4 md:px-0"
    >
        {#if stationData != null}
            <div class="flex flex-col gap-4 w-auto h-full items-stretch">
                <Card className="w-full md:w-md ">
                    {#snippet title()}
                        <p class="p-1 text-xl text-glow label">
                            STATION INFORMATION
                        </p>
                    {/snippet}
                    {#snippet children()}
                        <div class="w-full flex flex-col md:flex-row gap-2">
                            <div
                                class="badge label bordered flex justify-between mb-2 w-full"
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
                                        class="w-full h-full strip-bar-vertical"
                                    ></div>
                                </div>
                            </div>
                            <div class="bordered p-2 w-full">
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
                        <div class="flex justify-center w-full label-small">
                            <span>{stationData.Network["Description"]}</span>
                        </div>
                    {/snippet}
                </Card>

                <Card className="w-full md:w-md h-full grow ">
                    {#snippet title()}
                        <p class="p-1 text-xl text-glow label">
                            STATION CHANNEL
                        </p>
                    {/snippet}
                    {#snippet children()}
                        <HexGrid variant="flat">
                            {#each listChannel as channel, channelIndex}
                                <div
                                    class="w-full h-full {channel['@attributes']
                                        .endDate == ''
                                        ? 'yellow glow-orange-small '
                                        : 'glow-red-small '}"
                                >
                                    <button
                                        class="w-full h-full cursor-pointer hex-hive bg-hex-flat opacity-0 show-pop-up {selectedChannel ==
                                        channel['@attributes']['code']
                                            ? 'blink blink-fast'
                                            : ''} {channel['@attributes']
                                            .endDate == undefined ||
                                        channel['@attributes'].endDate == ''
                                            ? 'yellow '
                                            : ' '}"
                                        style="animation-delay: {channelIndex *
                                            50}ms; width: 83px; height: 72px;"
                                        on:click={() => {
                                            selectedChannel =
                                                channel["@attributes"]["code"];
                                            const request = {
                                                net: data.networkCode ?? "GE",
                                                sta: data.stationCode ?? "GSI",
                                                cha: selectedChannel,
                                            };
                                            if (
                                                ws &&
                                                ws.readyState === WebSocket.OPEN
                                            ) {
                                                ws.send(
                                                    JSON.stringify(request),
                                                );
                                            }
                                        }}
                                    >
                                        <div
                                            class="w-full h-full flex justify-center items-center text-black text-center"
                                        >
                                            {channel["@attributes"]["code"]}
                                        </div>
                                    </button>
                                </div>
                            {/each}
                        </HexGrid>
                        <!-- <div class="bordered p-1 w-full flex flex-col gap-1 mt-2">
                        {#each stationData.Network["Station"].Channel as channel, channelIndex}
                            <div
                                class="bg-primary w-full p-1 flex justify-center items-center text-center text-black"
                            >
                                {channel["@attributes"]["code"]}
                            </div>
                        {/each}
                    </div> -->
                    {/snippet}

                    {#snippet footer()}
                        <div class="flex flex-col gap-2 w-full">
                            <button
                                class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered p-1"
                                on:click={toggleDemoData}
                                ><div class="strip-wrapper">
                                    <div
                                        class="strip-bar anim-duration-20 {isDemoMode
                                            ? 'loop-strip-reverse'
                                            : ''}"
                                    ></div>
                                    <div
                                        class="strip-bar anim-duration-20 {isDemoMode
                                            ? 'loop-strip-reverse'
                                            : ''}"
                                    ></div>
                                </div>
                                <span
                                    class="absolute bg-black ews-text-glow px-2 py-1"
                                    >⚠ DEMO DATA</span
                                ></button
                            >

                            <button
                                class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered p-1"
                                on:click={toggleDemoPsycho}
                                ><div class="strip-wrapper">
                                    <div
                                        class="strip-bar-red anim-duration-20 {isDemoPsychoMode
                                            ? 'loop-strip-reverse'
                                            : ''}"
                                    ></div>
                                    <div
                                        class="strip-bar-red anim-duration-20 {isDemoPsychoMode
                                            ? 'loop-strip-reverse'
                                            : ''}"
                                    ></div>
                                </div>
                                <span
                                    class="absolute bg-black ews-text-glow px-2 py-1"
                                    >⚠ DEMO PSYCHOGRAPHIC DATA</span
                                ></button
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
                    class="absolute top-4 md:top-12 left-4 md:left-24 pointer-events-none text-glow z-5 max-w-100"
                >
                    <div
                        class="rounded-sm bordered label bg-black/60 shadow-lg h-10 text-center flex justify-center items-center"
                    >
                        <div class="font-bold md:text-3xl uppercase">
                            {isDemoPsychoMode
                                ? "PSYCHOGRAPHIC DISPLAY"
                                : "SEISMIC WAVEFORM"}
                        </div>
                    </div>
                    <div
                        class="font-bold mt-1 tracking-widest text-sm md:text-xl drop-shadow-[0_0_5px_rgba(255,102,0,1)]"
                    >
                        {isDemoPsychoMode
                            ? "Phase 4 Link"
                            : "CHANNEL : " + selectedChannel}
                    </div>
                </div>

                <!-- Top Right -->
                <div
                    class="absolute top-18 md:top-4 right-4 md:right-16 pointer-events-none flex flex-col items-end z-5"
                >
                    <div
                        class="rounded-lg p-1 inline-block bg-black/60 shadow-lg"
                    >
                        <div class="bordered px-3 py-1 flex flex-col label">
                            <div
                                class="font-bold text-[10px] md:text-sm tracking-widest leading-none mb-1"
                            >
                                STATION:
                            </div>
                            <div
                                class="font-bold text-2xl md:text-4xl tracking-widest leading-none text-right"
                                style="color: #ff9900; text-shadow: 0 0 10px #fa0;"
                            >
                                {stationData != null
                                    ? `${stationData.Network["@attributes"]["code"]} ${stationData.Network.Station["@attributes"]["code"]}`
                                    : "LOADING..."}
                            </div>
                        </div>
                    </div>
                    <div
                        class="font-bold text-[8px] md:text-xs tracking-widest text-right mt-1 bg-black/60 px-1 drop-shadow-[0_0_5px_rgba(255,102,0,1)]"
                        style="color: #fa0;"
                    >
                        Y: AMPLITUDE (COUNTS) | X: TIME (UTC)
                    </div>
                </div>

                <div
                    bind:this={container}
                    class="w-full h-full relative cursor-crosshair"
                >
                    <canvas
                        bind:this={canvas}
                        class="absolute inset-0 block w-full h-full touch-none"
                    ></canvas>
                </div>
            </div>

            <!-- Controls below -->
            <div
                class="flex justify-between items-center text-xs uppercase tracking-widest px-2"
                style="color: #fa0;"
            >
                <div class="flex items-center gap-4 flex-wrap">
                    <span>Pan: Click & Drag</span>
                    <span class="hidden md:inline">|</span>
                    <span>Zoom Y: Wheel</span>
                    <span class="hidden md:inline">|</span>
                    <span>Nav: Shift+Wheel</span>
                    <span class="hidden md:inline">|</span>
                    <span>Zoom: {zoomLevel.toFixed(4)}x</span>
                </div>
                <div class="flex items-center gap-4 h-4">
                    {#if timeOffsetMs > 0}
                        <button
                            class="bg-orange-950 border hover:bg-orange-800 text-white px-3 py-1 rounded cursor-pointer transition-colors"
                            style="border-color: #fa0;"
                            on:click={() => (timeOffsetMs = 0)}
                        >
                            &rarr; Resume Live
                        </button>
                    {/if}
                    <div class="flex items-center gap-2">
                        <span class="relative flex h-3 w-3">
                            <span
                                class="animate-ping absolute inline-flex h-full w-full rounded-full {timeOffsetMs ===
                                0
                                    ? 'bg-orange-500'
                                    : 'bg-yellow-500'} opacity-75"
                            ></span>
                            <span
                                class="relative inline-flex rounded-full h-3 w-3 {timeOffsetMs ===
                                0
                                    ? 'bg-orange-600'
                                    : 'bg-yellow-600'}"
                            ></span>
                        </span>
                        <span
                            class="font-bold {timeOffsetMs === 0
                                ? 'text-orange-500'
                                : 'text-yellow-500'}"
                        >
                            {timeOffsetMs === 0 ? "LIVE" : "HISTORY"}
                        </span>
                    </div>
                </div>
            </div>

            <div class="bordered-red p-2 overflow-y-auto h-24 text-primary">
                <pre>{logMessages}</pre>
            </div>
        </div>
    </div>
</div>
<div
    class="fixed m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center overlay-bg text-center z-5"
    id="loading-screen"
>
    <span class="loader"></span>
    <p class="my-2 red-color p-2">
        INI MERUPAKAN DESAIN KONSEP - DATA STASIUN DARI GEOFON
    </p>
</div>
