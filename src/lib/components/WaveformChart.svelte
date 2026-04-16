<script context="module" lang="ts">
    // Data point structure
    export interface DataPoint {
        t: number; // timestamp in MS
        v: number; // amplitude value
    }
</script>

<script lang="ts">
    import "../styles/components/WaveformChart.css";
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";

    export let waveformData: DataPoint[] = [];

    // Colors
    export let backgroundColor: string = "#000000";
    export let gridColor: string = "#33cc55";
    export let axesColor: string = "#fa0";
    export let waveformColor: string = "#ff9900";
    export let psychoWaveformColor: string = "#ff9900";
    export let emptyTextColor: string = "#fa0";

    // Zoom/Scale factor for Y-axis (Amplitude)
    export let zoomLevel: number = 0.05;
    export const MIN_ZOOM: number = 0.0001;
    export const MAX_ZOOM: number = 0.1;

    // Time View Window
    export let timeWindowMs: number = 20000;
    export let timeOffsetMs: number = 0;

    // Horizontal (X-axis / time) zoom limits in milliseconds
    export const MIN_TIME_WINDOW_MS: number = 2000;   // 2 seconds minimum
    export const MAX_TIME_WINDOW_MS: number = 300000; // 5 minutes maximum

    // Timezone
    export let selectedTimezone: number = 0; // 0: UTC, 7: WIB, 8: WITA, 9: WIT

    // Demo Psycho mode
    export let isDemoPsychoMode: boolean = false;
    export let psychoPoints: { nx: number; ny: number }[] = [];

    // Historical mode: set both to non-zero to activate
    // When active, live loop pauses and X-axis is fixed to this range
    export let historicalStartMs: number = 0;
    export let historicalEndMs: number = 0;

    // Method to resume viewing live data
    export function resumeLive() {
        timeOffsetMs = 0;
        frozenLatestTime = 0;
    }

    // Jump to the end of the historical range (right edge = endTime)
    export function jumpToHistoricalEnd() {
        timeOffsetMs = 0;
        frozenLatestTime = 0;
        draw();
    }

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let container: HTMLDivElement;

    let width = 1200;
    let height = 600;

    let frozenLatestTime = 0;

    // Automatically freeze live mode if timeOffsetMs is increased externally
    $: if (timeOffsetMs > 0 && frozenLatestTime === 0 && historicalStartMs === 0) {
        frozenLatestTime = Date.now();
    }
    let isDragging = false;
    let lastMouseX = 0;
    let initialPinchDistance = 0;
    let startedOnCanvas = false;

    let animId: number;

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

        const isHistoricalMode = historicalStartMs > 0 && historicalEndMs > 0;
        const isMobile = width < 768;
        const leftPadding = isMobile ? 40 : 70;
        const drawWidth = width - leftPadding;

        // CTRL + Scroll → Horizontal Zoom (X-axis / Time Window)
        if (e.ctrlKey && e.deltaY !== 0) {
            const oldWindow = timeWindowMs;
            const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15; // zoom out / zoom in
            const newWindow = Math.min(
                MAX_TIME_WINDOW_MS,
                Math.max(MIN_TIME_WINDOW_MS, oldWindow * zoomFactor)
            );

            // Anchor zoom to mouse cursor X position on the time axis
            const mouseXOnCanvas = e.offsetX - leftPadding;
            const cursorRatio = Math.max(0, Math.min(1, mouseXOnCanvas / drawWidth));

            // Determine the time under the cursor before zoom
            let rightEdgeBefore: number;
            if (isHistoricalMode) {
                rightEdgeBefore = historicalEndMs - timeOffsetMs;
            } else {
                const latestTime =
                    timeOffsetMs > 0 && frozenLatestTime > 0 ? frozenLatestTime : Date.now();
                rightEdgeBefore = latestTime - timeOffsetMs;
            }
            const leftEdgeBefore = rightEdgeBefore - oldWindow;
            const timeUnderCursor = leftEdgeBefore + cursorRatio * oldWindow;

            // After zoom, the right edge must remain so that timeUnderCursor stays at cursorRatio
            // newRightEdge = timeUnderCursor + (1 - cursorRatio) * newWindow
            const newRightEdge = timeUnderCursor + (1 - cursorRatio) * newWindow;

            timeWindowMs = newWindow;

            if (isHistoricalMode) {
                timeOffsetMs = historicalEndMs - newRightEdge;
                const maxOffset = (historicalEndMs - historicalStartMs) - newWindow;
                if (timeOffsetMs < 0) timeOffsetMs = 0;
                if (maxOffset > 0 && timeOffsetMs > maxOffset) timeOffsetMs = maxOffset;
            } else {
                // Freeze the live clock at the current "right edge" reference point
                if (frozenLatestTime === 0 && timeOffsetMs === 0) {
                    frozenLatestTime = Date.now();
                }
                const refTime = frozenLatestTime > 0 ? frozenLatestTime : Date.now();
                timeOffsetMs = refTime - newRightEdge;
                if (timeOffsetMs <= 0) {
                    timeOffsetMs = 0;
                    frozenLatestTime = 0;
                }
            }

            draw();
            return; // Don't run other scroll handlers on CTRL+scroll
        }

        // Vertical Scroll (Y-Axis Zoom) — no modifier key
        if (e.deltaY !== 0 && !e.shiftKey && !e.ctrlKey) {
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
            if (!isHistoricalMode && timeOffsetMs === 0) {
                frozenLatestTime = Date.now();
            }

            const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
            // Map pixels to milliseconds
            const msPerPixel = timeWindowMs / width;
            timeOffsetMs += delta * msPerPixel * 2;

            // Prevent panning into the future (live) or past the start (historical)
            if (isHistoricalMode) {
                const maxOffset = (historicalEndMs - historicalStartMs) - timeWindowMs;
                if (timeOffsetMs < 0) timeOffsetMs = 0;
                if (maxOffset > 0 && timeOffsetMs > maxOffset) timeOffsetMs = maxOffset;
            } else {
                if (timeOffsetMs <= 0) {
                    timeOffsetMs = 0;
                    frozenLatestTime = 0;
                }
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
        const isHistoricalMode = historicalStartMs > 0 && historicalEndMs > 0;

        // Moving right (dx > 0) means going back in time (increasing timeOffset)
        if (!isHistoricalMode && timeOffsetMs === 0 && dx > 0) {
            frozenLatestTime = Date.now();
        }

        // Drag left = positive dx = go earlier in time (increase offset)
        timeOffsetMs -= dx * msPerPixel;

        if (isHistoricalMode) {
            const maxOffset = (historicalEndMs - historicalStartMs) - timeWindowMs;
            if (timeOffsetMs < 0) timeOffsetMs = 0;
            if (maxOffset > 0 && timeOffsetMs > maxOffset) timeOffsetMs = maxOffset;
        } else {
            if (timeOffsetMs <= 0) {
                timeOffsetMs = 0;
                frozenLatestTime = 0;
            }
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
            const isHistoricalMode = historicalStartMs > 0 && historicalEndMs > 0;

            if (!isHistoricalMode && timeOffsetMs === 0 && dx > 0) {
                frozenLatestTime = Date.now();
            }

            // Drag right (dx > 0) = scroll into the past (increase offset)
            timeOffsetMs -= dx * msPerPixel;

            if (isHistoricalMode) {
                const maxOffset = (historicalEndMs - historicalStartMs) - timeWindowMs;
                if (timeOffsetMs < 0) timeOffsetMs = 0;
                if (maxOffset > 0 && timeOffsetMs > maxOffset) timeOffsetMs = maxOffset;
            } else {
                if (timeOffsetMs <= 0) {
                    timeOffsetMs = 0;
                    frozenLatestTime = 0;
                }
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

        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        if (waveformData.length === 0 && !isDemoPsychoMode) {
            // Draw empty state
            ctx.fillStyle = emptyTextColor;
            ctx.font = 'bold 16px "Inter", sans-serif';
            ctx.textAlign = "center";
            ctx.fillText("WAITING FOR SIGNAL...", width / 2, height / 2);
            return;
        }

        // Determine right/left edge: historical mode uses fixed range, live mode uses Date.now()
        const isHistoricalMode = historicalStartMs > 0 && historicalEndMs > 0;

        let rightEdgeTime: number;
        let leftEdgeTime: number;

        if (isHistoricalMode) {
            // In historical mode, the right edge starts at endTime and user scrolls left
            rightEdgeTime = historicalEndMs - timeOffsetMs;
            leftEdgeTime = rightEdgeTime - timeWindowMs;
        } else {
            // Live mode: smooth sliding clock
            const latestTime =
                timeOffsetMs > 0 && frozenLatestTime > 0
                    ? frozenLatestTime
                    : Date.now();
            rightEdgeTime = latestTime - timeOffsetMs;
            leftEdgeTime = rightEdgeTime - timeWindowMs;
        }

        const isMobile = width < 768;
        const leftPadding = isMobile ? 40 : 70;
        const bottomPadding = isMobile ? 30 : 40;
        const drawWidth = width - leftPadding;
        const drawHeight = height - bottomPadding;

        // X-Axis Grid inside graph area (Neon Green with Crosshairs)
        ctx.strokeStyle = gridColor;
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
        ctx.strokeStyle = axesColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(leftPadding, 0);
        ctx.lineTo(leftPadding, drawHeight);

        ctx.fillStyle = axesColor;
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

        // Bottom Ruler (Time/Ticks) — Adaptive intervals
        ctx.strokeStyle = axesColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, drawHeight);
        ctx.lineTo(width, drawHeight);
        ctx.stroke();

        ctx.fillStyle = axesColor;
        ctx.font = isMobile
            ? 'bold 10px "Inter", sans-serif'
            : 'bold 12px "Inter", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        ctx.strokeStyle = axesColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const pixelsPerMs = drawWidth / timeWindowMs;

        // ── Adaptive tick intervals ──────────────────────────────────────────
        // Each entry: [windowThreshold_ms, majorInterval_ms, minorInterval_ms, labelFormat]
        // labelFormat: 'hms' = HH:MM:SS, 'hm' = HH:MM, 'hmd' = HH:MM + date
        type LabelFmt = 'hms' | 'hm';
        const tickTable: [number, number, number, LabelFmt][] = [
            [      3_000,    500,     100, 'hms'], // < 3 s   → major 0.5s, minor 0.1s
            [      8_000,  1_000,     250, 'hms'], // < 8 s   → major 1s,   minor 0.25s
            [     20_000,  2_000,     500, 'hms'], // < 20 s  → major 2s,   minor 0.5s
            [     45_000,  5_000,   1_000, 'hms'], // < 45 s  → major 5s,   minor 1s
            [     90_000, 10_000,   2_000, 'hms'], // < 90 s  → major 10s,  minor 2s
            [    180_000, 20_000,   5_000, 'hms'], // < 3 min → major 20s,  minor 5s
            [    360_000, 60_000,  15_000, 'hms'], // < 6 min → major 1min, minor 15s
            [    900_000, 120_000, 30_000, 'hms'], // < 15 min→ major 2min, minor 30s
            [  1_800_000, 300_000, 60_000, 'hm' ], // < 30 min→ major 5min, minor 1min
            [  3_600_000, 600_000,120_000, 'hm' ], // < 1 hr  → major 10min,minor 2min
            [  7_200_000,1_200_000,300_000,'hm' ], // < 2 hr  → major 20min,minor 5min
            [ 18_000_000,3_600_000,900_000,'hm' ], // < 5 hr  → major 1hr,  minor 15min
        ];

        let majorMs = 3_600_000;   // default ≥ 5 hr
        let minorMs = 900_000;
        let labelFmt: LabelFmt = 'hm';

        for (const [threshold, maj, min, fmt] of tickTable) {
            if (timeWindowMs < threshold) {
                majorMs = maj;
                minorMs = min;
                labelFmt = fmt;
                break;
            }
        }

        // Helper: format a timestamp for the label
        function formatLabel(ms: number): string {
            const tzOffsetMs = selectedTimezone * 60 * 60 * 1000;
            const d = new Date(ms + tzOffsetMs);
            const hh = String(d.getUTCHours()).padStart(2, '0');
            const mm = String(d.getUTCMinutes()).padStart(2, '0');
            const ss = String(d.getUTCSeconds()).padStart(2, '0');
            return labelFmt === 'hms' ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
        }

        // Draw minor ticks (no label)
        const minorStart = Math.floor(leftEdgeTime / minorMs) * minorMs;
        for (let t = minorStart; t <= rightEdgeTime; t += minorMs) {
            // Skip positions that will be covered by a major tick
            if (t % majorMs === 0) continue;
            const x = leftPadding + (t - leftEdgeTime) * pixelsPerMs;
            if (x >= leftPadding && x <= width) {
                ctx.moveTo(x, drawHeight);
                ctx.lineTo(x, drawHeight + 8);
            }
        }

        // Draw major ticks + labels
        const majorStart = Math.floor(leftEdgeTime / majorMs) * majorMs;
        for (let t = majorStart; t <= rightEdgeTime; t += majorMs) {
            const x = leftPadding + (t - leftEdgeTime) * pixelsPerMs;
            if (x >= leftPadding && x <= width) {
                ctx.moveTo(x, drawHeight);
                ctx.lineTo(x, drawHeight + 18);
                ctx.fillText(formatLabel(t), x, drawHeight + 20);
            }
        }

        ctx.stroke();

        // Draw the waveform line
        if (isDemoPsychoMode) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(leftPadding, 0, drawWidth, drawHeight);
            ctx.clip();

            ctx.strokeStyle = psychoWaveformColor;
            ctx.shadowBlur = 12;
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
            const visiblePoints = waveformData.filter(
                (p) =>
                    p.t >= leftEdgeTime - 1000 && p.t <= rightEdgeTime + 1000,
            );

            if (visiblePoints.length > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(leftPadding, 0, drawWidth, drawHeight);
                ctx.clip();

                ctx.strokeStyle = waveformColor;
                ctx.shadowBlur = 12;
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

    onMount(() => {
        if (!browser) return;

        ctx = canvas.getContext("2d")!;

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        canvas.addEventListener("wheel", handleWheel, { passive: false });
        canvas.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        canvas.addEventListener("touchstart", handleTouchStart, {
            passive: false,
        });
        window.addEventListener("touchmove", handleTouchMove, {
            passive: false,
        });
        window.addEventListener("touchend", handleTouchEnd);
        window.addEventListener("touchcancel", handleTouchEnd);

        function updateLoop() {
            const isHistoricalMode = historicalStartMs > 0 && historicalEndMs > 0;
            // In historical mode, we don't need continuous re-draws based on clock;
            // draw() is called on user interaction. But we still run the loop
            // at a low rate so panning/dragging still works smoothly.
            if (!isDragging || isHistoricalMode) {
                draw();
            }
            animId = requestAnimationFrame(updateLoop);
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
        window.addEventListener("touchcancel", handleTouchEnd);

        if (animId) {
            cancelAnimationFrame(animId);
        }
    });

    // Handle incoming data/props changes to trigger draw if needed,
    // although updateLoop is already calling draw() repeatedly.
</script>

<div bind:this={container} class="ews-waveform-chart-wrapper">
    <!-- Slot for putting overlays on top of canvas if needed -->
    <slot></slot>
    <canvas bind:this={canvas} class="ews-waveform-chart-canvas"></canvas>
</div>
