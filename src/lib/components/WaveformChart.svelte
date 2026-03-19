<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";

    // Data point structure
    export interface DataPoint {
        t: number; // timestamp in MS
        v: number; // amplitude value
    }

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

    // Timezone
    export let selectedTimezone: number = 0; // 0: UTC, 7: WIB, 8: WITA, 9: WIT

    // Demo Psycho mode
    export let isDemoPsychoMode: boolean = false;
    export let psychoPoints: { nx: number; ny: number }[] = [];

    // Method to resume viewing live data
    export function resumeLive() {
        timeOffsetMs = 0;
        frozenLatestTime = 0;
    }

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let container: HTMLDivElement;

    let width = 1200;
    let height = 600;

    let frozenLatestTime = 0;
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

        // Bottom Ruler (Time/Ticks)
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
            if (!isDragging) {
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

<div bind:this={container} class="w-full h-full relative cursor-crosshair">
    <!-- Slot for putting overlays on top of canvas if needed -->
    <slot></slot>
    <canvas
        bind:this={canvas}
        class="absolute inset-0 block w-full h-full touch-none"
        style="z-index: 0;"
    ></canvas>
</div>
