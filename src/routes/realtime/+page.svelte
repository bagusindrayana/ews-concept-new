<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import Card from "$lib/components/Card.svelte";

    import type { PageData } from "./$types";

    export let data: PageData;
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let container: HTMLDivElement;

    let seis: any;

    let stationData: any;

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

    interface XmlAttributes {
        [key: string]: string;
    }

    interface JsonNode {
        "@attributes"?: XmlAttributes;
        "#text"?: string;
        [key: string]:
            | JsonNode
            | JsonNode[]
            | string
            | XmlAttributes
            | null
            | undefined;
    }

    type JsonValue = JsonNode | JsonNode[] | string | null;

    function xmlToJson(xmlString: string): Record<string, JsonValue> {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");

        const parseError = xmlDoc.querySelector("parsererror");
        if (parseError) {
            throw new Error("Invalid XML: " + parseError.textContent);
        }

        function nodeToJson(node: Element): JsonValue {
            const obj: JsonNode = {};

            // Handle attributes
            if (node.attributes && node.attributes.length > 0) {
                obj["@attributes"] = {};
                for (const attr of Array.from(node.attributes)) {
                    (obj["@attributes"] as XmlAttributes)[attr.name] =
                        attr.value;
                }
            }

            // Handle child nodes
            for (const child of Array.from(node.childNodes)) {
                // Text node
                if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent?.trim();
                    if (text) {
                        obj["#text"] = text;
                    }
                    continue;
                }

                // Element node
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const childElement = child as Element;
                    const childJson = nodeToJson(childElement);
                    const nodeName = childElement.nodeName;

                    if (obj[nodeName] === undefined) {
                        obj[nodeName] = childJson;
                    } else if (Array.isArray(obj[nodeName])) {
                        (obj[nodeName] as JsonNode[]).push(
                            childJson as JsonNode,
                        );
                    } else {
                        obj[nodeName] = [
                            obj[nodeName] as JsonNode,
                            childJson as JsonNode,
                        ];
                    }
                }
            }

            // If only #text, return the value directly
            if (Object.keys(obj).length === 1 && obj["#text"] !== undefined) {
                return obj["#text"];
            }

            // If empty node
            if (Object.keys(obj).length === 0) {
                return null;
            }

            return obj;
        }

        const root = xmlDoc.documentElement;
        return { [root.nodeName]: nodeToJson(root) };
    }

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

        if (dataBuffer.length === 0) {
            // Draw empty state
            ctx.fillStyle = "#fa0";
            ctx.font = 'bold 16px "Inter", sans-serif';
            ctx.textAlign = "center";
            ctx.fillText("WAITING FOR SIGNAL...", width / 2, height / 2);
            return;
        }

        const latestTime = dataBuffer[dataBuffer.length - 1].t;
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
        const visiblePoints = dataBuffer.filter(
            (p) => p.t >= leftEdgeTime - 1000 && p.t <= rightEdgeTime + 1000,
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

    function loadDataStation(network: string, station: string) {
        const url = `https://geofon.gfz-potsdam.de/fdsnws/station/1/query?network=${network}&station=${station}&level=response&format=xml`;

        fetch(url)
            .then((response) => {
                if (!response.ok)
                    throw new Error("Gagal mengambil data jaringan");
                // 1. Ubah response dari server menjadi String Teks
                return response.text();
            })
            .then((xmlString) => {
                stationData = xmlToJson(xmlString).FDSNStationXML;
                console.log(stationData);
            })
            .catch((error) => {
                console.error("Terjadi kesalahan:", error);
            });
    }

    onMount(async () => {
        if (!browser) return;

        console.log(data);
        if (data.networkCode == "" || data.stationCode == "") {
            return;
        }

        loadDataStation(data.networkCode ?? "GE", data.stationCode ?? "GSI");

        // ctx = canvas.getContext("2d")!;

        // resizeCanvas();
        // window.addEventListener("resize", resizeCanvas);

        // canvas.addEventListener("wheel", handleWheel, { passive: false });
        // // Add drag events
        // canvas.addEventListener("mousedown", handleMouseDown);
        // window.addEventListener("mousemove", handleMouseMove); // Window catches fast drags
        // window.addEventListener("mouseup", handleMouseUp);

        // seis = await import("seisplotjs");

        // const ws = new WebSocket("ws://localhost:8080");
        // ws.binaryType = "arraybuffer";

        // ws.onopen = () => {
        //     const request = {
        //         net: data.networkCode ?? "GE",
        //         sta: data.stationCode ?? "GSI",
        //         cha: "BHZ",
        //     };
        //     ws.send(JSON.stringify(request));
        // };

        // ws.onmessage = (e) => {
        //     const dataBufferIncoming = e.data;

        //     try {
        //         const mseedData = dataBufferIncoming.slice(8);
        //         const records = seis.miniseed.parseDataRecords(mseedData);

        //         records.forEach((r: any) => {
        //             const samples = r.decompress();

        //             let startTimeMs = Date.now();
        //             if (r.header && r.header.start) {
        //                 try {
        //                     startTimeMs = r.header.start.valueOf(); // Gets milliseconds
        //                 } catch (e) {
        //                     console.warn("Could not parse record start time");
        //                 }
        //             }

        //             let msPerSample = nominalSampleRateMs;
        //             if (r.header && r.header.sampleRate) {
        //                 msPerSample = 1000 / r.header.sampleRate;
        //             }

        //             for (let i = 0; i < samples.length; i++) {
        //                 dataBuffer.push({
        //                     t: startTimeMs + i * msPerSample,
        //                     v: samples[i],
        //                 });
        //             }
        //         });

        //         dataBuffer.sort((a, b) => a.t - b.t);

        //         const latestTime = dataBuffer[dataBuffer.length - 1].t;
        //         const cutoffTime = latestTime - MAX_BUFFER_MS;

        //         let trimIndex = 0;
        //         while (
        //             trimIndex < dataBuffer.length &&
        //             dataBuffer[trimIndex].t < cutoffTime
        //         ) {
        //             trimIndex++;
        //         }

        //         if (trimIndex > 0) {
        //             dataBuffer = dataBuffer.slice(trimIndex);
        //         }

        //         if (!isDragging && timeOffsetMs === 0) {
        //             draw();
        //         } else if (!isDragging && timeOffsetMs > 0) {
        //             draw();
        //         }
        //     } catch (err) {
        //         console.error("Error parsing miniSEED data:", err);
        //     }
        // };

        // (window as any)._mseedWs = ws;

        // function updateLoop() {
        //     if (!isDragging) {
        //         draw();
        //     }
        //     (window as any)._mseedAnimId = requestAnimationFrame(updateLoop);
        // }
        // updateLoop();
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
    });
</script>

<svelte:head>
    <title>Live Seismic Waveform - Psychographic</title>
</svelte:head>

<div
    class="min-h-screen py-8 flex justify-center items-start overflow-hidden font-mono relative gap-2"
>
    <div class="backgroundline absolute inset-0 pointer-events-none z-10"></div>
    <div class="scanline absolute inset-0 pointer-events-none z-10"></div>
    {#if stationData != null}
        <Card className="w-md mb-4">
            {#snippet title()}
                <p class="p-1 text-xl text-glow">STATION INFORMATION</p>
            {/snippet}
            {#snippet children()}
                <div class="w-full flex flex-col md:flex-row gap-2">
                    <div
                        class="badge label bordered flex justify-between mb-2 w-full lg:w-32"
                    >
                        <div class="flex flex-col items-center p-1">
                            <div class="text -characters">
                                {stationData.Network["@attributes"]["code"]}
                            </div>
                            <div class="text">
                                {stationData.Network.Station["@attributes"][
                                    "code"
                                ]}
                            </div>
                        </div>
                        <div class="decal">
                            <div class="w-full h-full strip-bar-vertical"></div>
                        </div>
                    </div>
                    <div class="bordered p-2 w-full">
                        <table class="w-full">
                            <tbody>
                                <tr>
                                    <td class="text-left p-0"> Site </td>
                                    <td class="text-right p-0">
                                        {stationData.Network.Station.Site.Name}
                                    </td>
                                </tr>
                                <tr>
                                    <td class="text-left p-0"> Elevation </td>
                                    <td class="text-right p-0">
                                        {stationData.Network.Station.Elevation}
                                    </td>
                                </tr>
                                <tr>
                                    <td class="text-left p-0"> Latitude </td>
                                    <td class="text-right p-0">
                                        {stationData.Network.Station.Latitude}
                                    </td>
                                </tr>
                                <tr>
                                    <td class="text-left p-0"> Longitude </td>
                                    <td class="text-right p-0">
                                        {stationData.Network.Station.Longitude}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            {/snippet}
            {#snippet footer()}
                <div class="flex justify-center w-full">
                    <span>{stationData.Network["Description"]}</span>
                </div>
            {/snippet}
        </Card>
    {/if}

    <div class="w-full max-w-7xl flex flex-col bordered p-1">
        <div
            class="relative w-full h-[75vh] border-b-4 border-l-4 bg-black overflow-hidden flex flex-col items-center"
            style="border-bottom-color: #fa0; border-left-color: #fa0;"
        >
            <!-- Top Left -->
            <div
                class="absolute top-4 left-4 md:left-24 z-10 pointer-events-none text-glow"
            >
                <div class="rounded p-1 inline-block bg-black/60 shadow-lg">
                    <div
                        class="font-bold text-xl md:text-3xl uppercase tracking-tighter px-2 py-0 rounded-sm mix-blend-screen bordered"
                    >
                        SEISMIC WAVEFORM
                    </div>
                </div>
                <div
                    class="font-bold mt-1 tracking-widest text-sm md:text-xl drop-shadow-[0_0_5px_rgba(255,102,0,1)]"
                >
                    CHANNEL: BHZ
                </div>
            </div>

            <!-- Top Right -->
            <div
                class="absolute top-4 right-4 md:right-16 z-10 pointer-events-none flex flex-col items-end"
            >
                <div class="rounded-lg p-1 inline-block bg-black/60 shadow-lg">
                    <div class="bordered px-3 py-1 flex flex-col">
                        <div
                            class="font-bold text-[10px] md:text-sm tracking-widest leading-none mb-1"
                        >
                            STATION:
                        </div>
                        <div
                            class="font-bold text-2xl md:text-4xl tracking-widest leading-none text-right"
                            style="color: #ff9900; text-shadow: 0 0 10px #fa0;"
                        >
                            GSI GE
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
            class="flex justify-between items-center mt-2 text-xs uppercase tracking-widest px-2"
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
    </div>
</div>
