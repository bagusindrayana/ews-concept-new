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
    let selectedChannel: any;
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
            // Bersihkan data lama dari buffer setiap kali beralih ke mode demo
            dataBuffer.length = 0;

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
                    dataBuffer.splice(0, trimIndex);
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
    const dataBuffer: DataPoint[] = [];

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

    // To freeze the timeline when panning
    let frozenLatestTime = 0;

    // For panning logic
    let isDragging = false;
    let lastMouseX = 0;
    let initialPinchDistance = 0;
    let startedOnCanvas = false;

    // Buffer limit: only keep the last 5 minutes of data (300,000 ms)
    // to prevent memory issues.
    const MAX_BUFFER_MS = 300000;

    // Approximate sample rate if not available from miniseed record
    // Usually SeedLink gives 100Hz or 50Hz. Let's assume 100Hz (10ms per sample)
    const nominalSampleRateMs = 10;

    let logMessages = "";

    // Settings Modal State
    let isSettingsOpen = false;
    let selectedTimezone = 0; // 0: UTC, 7: WIB, 8: WITA, 9: WIT

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
            if (timeOffsetMs === 0) {
                frozenLatestTime = Date.now();
            }

            const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
            // Map pixels to milliseconds
            const msPerPixel = timeWindowMs / width;
            timeOffsetMs += delta * msPerPixel * 2;

            // Prevent panning into the future
            if (timeOffsetMs <= 0) {
                timeOffsetMs = 0;
                frozenLatestTime = 0;
            }
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

        if (timeOffsetMs === 0 && dx > 0) {
            frozenLatestTime = Date.now();
        }

        timeOffsetMs += dx * msPerPixel;

        if (timeOffsetMs <= 0) {
            timeOffsetMs = 0;
            frozenLatestTime = 0;
        }

        draw();
    }

    function handleMouseUp() {
        isDragging = false;
    }

    function handleTouchStart(e: TouchEvent) {
        startedOnCanvas = true;
        if (e.touches.length === 1) {
            isDragging = true;
            lastMouseX = e.touches[0].clientX;
        } else if (e.touches.length === 2) {
            isDragging = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDistance = Math.hypot(dx, dy);
        }
    }

    function handleTouchMove(e: TouchEvent) {
        if (!startedOnCanvas) return;

        if (e.cancelable) {
            e.preventDefault(); // Prevent page scrolling
        }

        if (isDragging && e.touches.length === 1) {
            const dx = e.touches[0].clientX - lastMouseX;
            lastMouseX = e.touches[0].clientX;

            const msPerPixel = timeWindowMs / width;
            // Negative dx means swiping left, so we move into the future.
            // Wait, moving right (dx > 0) means going back in time (increasing timeOffset)

            if (timeOffsetMs === 0 && dx > 0) {
                frozenLatestTime = Date.now();
            }

            timeOffsetMs += dx * msPerPixel;

            if (timeOffsetMs <= 0) {
                timeOffsetMs = 0;
                frozenLatestTime = 0;
            }

            draw();
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const currentDistance = Math.hypot(dx, dy);

            const diff = currentDistance - initialPinchDistance;

            if (Math.abs(diff) > 2) {
                const zoomStep = zoomLevel * 0.05 * (Math.abs(diff) / 5);
                if (diff > 0) {
                    zoomLevel = Math.min(MAX_ZOOM, zoomLevel + zoomStep);
                } else {
                    zoomLevel = Math.max(MIN_ZOOM, zoomLevel - zoomStep);
                }
                initialPinchDistance = currentDistance;
                draw();
            }
        }
    }

    function handleTouchEnd(e: TouchEvent) {
        if (!startedOnCanvas) return;

        if (e.touches.length < 2) {
            initialPinchDistance = 0;
        }
        if (e.touches.length === 0) {
            isDragging = false;
            startedOnCanvas = false;
        } else if (e.touches.length === 1) {
            isDragging = true;
            lastMouseX = e.touches[0].clientX;
        }
    }

    function formatTimeStr(ms: number) {
        // Apply timezone offset (selectedTimezone is in hours)
        const tzOffsetMs = selectedTimezone * 60 * 60 * 1000;
        const d = new Date(ms + tzOffsetMs);
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

        // Use real-time clock for smooth sliding instead of snapping to data points
        const latestTime =
            timeOffsetMs > 0 && frozenLatestTime > 0
                ? frozenLatestTime
                : Date.now();

        // The right edge of the screen represents (latestTime - timeOffsetMs)
        const rightEdgeTime = latestTime - timeOffsetMs;
        const leftEdgeTime = rightEdgeTime - timeWindowMs;

        const isMobile = width < 768;
        const leftPadding = isMobile ? 40 : 70;
        const bottomPadding = isMobile ? 30 : 40;
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
        ctx.font = isMobile
            ? 'bold 10px "Inter", sans-serif'
            : 'bold 14px "Inter", sans-serif';
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        for (let y = 0; y <= drawHeight; y += yGridStep) {
            // Ticks
            ctx.moveTo(leftPadding - (isMobile ? 4 : 8), y);
            ctx.lineTo(leftPadding, y);

            const actualValue = (drawHeight / 2 - y) / zoomLevel;
            // Format to integer since amplitude counts are generally large or zero
            ctx.fillText(
                Math.round(actualValue).toString(),
                leftPadding - (isMobile ? 6 : 10),
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
        ctx.font = isMobile
            ? 'bold 10px "Inter", sans-serif'
            : 'bold 12px "Inter", sans-serif';
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
            // ctx.shadowColor = "#ff3300";
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
                // ctx.shadowColor = "#ff3300";
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

        ctx = canvas.getContext("2d")!;

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        canvas.addEventListener("wheel", handleWheel, { passive: false });
        // Add drag events
        canvas.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mousemove", handleMouseMove); // Window catches fast drags
        window.addEventListener("mouseup", handleMouseUp);

        // Add touch events
        canvas.addEventListener("touchstart", handleTouchStart, {
            passive: false,
        });
        window.addEventListener("touchmove", handleTouchMove, {
            passive: false,
        });
        window.addEventListener("touchend", handleTouchEnd);
        window.addEventListener("touchcancel", handleTouchEnd);

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
                    dataBuffer.splice(0, trimIndex);
                }

                if (!isDragging && timeOffsetMs === 0) {
                    draw();
                } else if (!isDragging && timeOffsetMs > 0) {
                    draw();
                }

                logMessages += `New Data\n`;
            } catch (err) {
                console.log(e);
                console.error("Error parsing miniSEED data:", err);
                logMessages += `Error parsing miniSEED data: ${err}\n`;
                logMessages += `${text}\n`;
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
            canvas.removeEventListener("touchstart", handleTouchStart);
        }
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
        window.removeEventListener("touchcancel", handleTouchEnd);

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
    class="min-h-screen px-1 lg:px-0 py-1 lg:py-8 flex flex-col justify-center overflow-hidden font-mono relative gap-2"
>
    <div class="w-full flex flex-col-reverse lg:flex-row gap-2 justify-center">
        {#if stationData != null}
            <div class="flex flex-col gap-4 w-auto h-full items-stretch">
                <Card className=" w-full lg:w-md ">
                    {#snippet title()}
                        <p class="p-1 text-xl ews-title text-3xl">
                            STATION INFORMATION
                        </p>
                    {/snippet}
                    {#snippet children()}
                        <div class="w-full flex flex-row gap-2">
                            <div
                                class="badge ews-title text-3xl bordered flex justify-between mb-2 w-full"
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
                                        class="w-full h-full strip-bar-vertical loop-strip-vertical anim-duration-20"
                                    ></div>
                                    <div
                                        class="w-full h-full strip-bar-vertical loop-strip-vertical anim-duration-20"
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
                        <HexGrid variant="flat">
                            {#each listChannel as channel, channelIndex (channel["@attributes"]["code"])}
                                <div
                                    class="w-full h-full {channel['@attributes']
                                        .endDate == ''
                                        ? 'yellow glow-orange-small'
                                        : 'glow-red-small'}"
                                >
                                    <button
                                        class="w-full h-full cursor-pointer hex-hive bg-hex-flat opacity-0 show-pop-up {selectedChannel !=
                                            undefined &&
                                        selectedChannel != null &&
                                        selectedChannel['@attributes'].code ==
                                            channel['@attributes']['code']
                                            ? 'blink blink-fast'
                                            : ''} {channel['@attributes']
                                            .endDate == undefined ||
                                        channel['@attributes'].endDate == ''
                                            ? 'yellow '
                                            : ' '}"
                                        style="animation-delay: {Math.min(
                                            channelIndex * 50,
                                            1000,
                                        )}ms; width: 83px; height: 72px;"
                                        on:click={() => {
                                            selectedChannel = channel;
                                            const request = {
                                                net: data.networkCode ?? "GE",
                                                sta: data.stationCode ?? "GSI",
                                                cha: selectedChannel[
                                                    "@attributes"
                                                ].code,
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
                            <!-- <button
                                class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered p-1"
                                on:click={() => (isSettingsOpen = true)}
                            >
                                <div class="strip-wrapper">
                                    <div
                                        class="strip-bar anim-duration-20"
                                    ></div>
                                    <div
                                        class="strip-bar anim-duration-20"
                                    ></div>
                                </div>
                                <span
                                    class="absolute bg-black ews- px-2 py-1"
                                >
                                    SETTING
                                </span>
                            </button> -->
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
                        Y: AMPLITUDE (COUNTS) | X: TIME ({selectedTimezone === 0
                            ? "UTC"
                            : selectedTimezone === 7
                              ? "WIB"
                              : selectedTimezone === 8
                                ? "WITA"
                                : "WIT"})
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
                            on:click={() => {
                                timeOffsetMs = 0;
                                frozenLatestTime = 0;
                            }}
                        >
                            Resume Live
                        </button>
                    {/if}
                </div>
            </div>

            <div
                class="bordered-red p-2 overflow-y-auto h-24 text-primary text-xs"
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
                    <p class="p-1 text-xl ews-title text-3xl">
                        PENGATURAN CHART
                    </p>
                    <button
                        class="text-orange-500 hover:text-orange-300 font-bold text-2xl px-2"
                        on:click={() => (isSettingsOpen = false)}
                        >&times;</button
                    >
                </div>
            {/snippet}

            {#snippet children()}
                <div class="flex flex-col gap-6 w-full p-2">
                    <!-- Timezone Settings -->
                    <div class="flex flex-col gap-2">
                        <p
                            class="text-orange-500 font-bold uppercase tracking-widest text-sm mb-1"
                        >
                            Pilih Zona Waktu (X-Axis):
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
                            Pengujian Tampilan (Demo):
                        </p>
                        <button
                            class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered p-1"
                            on:click={toggleDemoData}
                        >
                            <div class="strip-wrapper">
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
                            <span class="absolute bg-black ews- px-2 py-1"
                                >⚠ DEMO DATA</span
                            >
                        </button>

                        <button
                            class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered p-1 mt-2"
                            on:click={toggleDemoPsycho}
                        >
                            <div class="strip-wrapper">
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
                            <span class="absolute bg-black ews- px-2 py-1"
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
        INI MERUPAKAN DESAIN KONSEP - DATA STASIUN DARI GEOFON
    </p>
</div>
