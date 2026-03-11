<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let container: HTMLDivElement;

    let seis: any;
    
    // Data point structure
    interface DataPoint {
        t: number; // timestamp in MS
        v: number; // amplitude value
    }
    
    // Buffer to hold our waveform data points
    let dataBuffer: DataPoint[] = [];
    
    // Zoom/Scale factor for Y-axis (Amplitude)
    let zoomLevel = 0.005;
    const MIN_ZOOM = 0.0001;
    const MAX_ZOOM = 0.1;

    // Responsive Canvas dimensions
    let width = 1200;
    let height = 300;
    
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

    function resizeCanvas() {
        if (!container || !canvas) return;
        
        const rect = container.getBoundingClientRect();
        width = rect.width;
        
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
        canvas.style.cursor = 'grabbing';
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
        canvas.style.cursor = 'grab';
    }

    function formatTime(ms: number) {
        const d = new Date(ms);
        const hh = d.getHours().toString().padStart(2, '0');
        const mm = d.getMinutes().toString().padStart(2, '0');
        const ss = d.getSeconds().toString().padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    function draw() {
        if (!ctx || !canvas) return;

        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, width, height);

        if (dataBuffer.length === 0) {
            // Draw empty state
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText("Menunggu Data...", width/2, height/2);
            return;
        }

        const latestTime = dataBuffer[dataBuffer.length - 1].t;
        // The right edge of the screen represents (latestTime - timeOffsetMs)
        const rightEdgeTime = latestTime - timeOffsetMs;
        const leftEdgeTime = rightEdgeTime - timeWindowMs;

        // Draw grid lines & Labels
        ctx.strokeStyle = '#374151'; // Tailwind gray-700
        ctx.lineWidth = 1;
        ctx.fillStyle = '#9CA3AF'; // Tailwind gray-400
        ctx.font = '10px "Inter", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        ctx.beginPath();
        
        // Y-Axis (Amplitude)
        const yGridStep = height / 6;
        for (let y = 0; y <= height; y += yGridStep) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            
            if (y !== height / 2) { 
                const realValue = (height / 2 - y) / zoomLevel;
                ctx.fillText(Math.round(realValue).toString(), width - 10, y - 8);
            }
        }
        
        // X-Axis (Time)
        const xGridStep = width / 8; // 8 vertical grid lines
        for (let x = 0; x <= width; x += xGridStep) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            
            // Map pixel X to timestamp
            // Screen is leftEdgeTime (x=0) to rightEdgeTime (x=width)
            const timeAtX = leftEdgeTime + (x / width) * timeWindowMs;
            
            ctx.textAlign = 'center';
            ctx.fillText(formatTime(timeAtX), x, height - 10);
        }
        ctx.stroke();

        // Draw center baseline (Zero amplitude)
        ctx.strokeStyle = '#6B7280'; // Tailwind gray-500
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        
        // Draw 0 label
        ctx.textAlign = 'right';
        ctx.fillStyle = '#D1D5DB';
        ctx.fillText("0", width - 10, height / 2 - 8);

        // Filter and Draw Waveform Points
        // We only draw points that fall within or slightly outside our visible time window
        const visiblePoints = dataBuffer.filter(p => p.t >= leftEdgeTime - 1000 && p.t <= rightEdgeTime + 1000);

        if (visiblePoints.length > 0) {
            ctx.strokeStyle = '#10B981'; // Tailwind emerald-500
            ctx.lineWidth = 1.5; // Slightly thinner for dense data
            ctx.lineJoin = 'round';
            ctx.beginPath();

            visiblePoints.forEach((p, i) => {
                // Map time to X pixel
                // x = 0 is leftEdgeTime, x = width is rightEdgeTime
                const timeRatio = (p.t - leftEdgeTime) / timeWindowMs;
                const x = timeRatio * width;
                
                const y = height / 2 - (p.v * zoomLevel);

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });

            ctx.stroke();
        }
    }

    onMount(async () => {
        if (!browser) return;

        ctx = canvas.getContext("2d")!;
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        // Add drag events
        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove); // Window catches fast drags
        window.addEventListener('mouseup', handleMouseUp);

        // Default cursor
        canvas.style.cursor = 'grab';

        seis = await import("seisplotjs");

        const ws = new WebSocket("ws://localhost:8080");
        ws.binaryType = "arraybuffer";

        ws.onmessage = (e) => {
            const dataBufferIncoming = e.data;

            try {
                const mseedData = dataBufferIncoming.slice(8);
                const records = seis.miniseed.parseDataRecords(mseedData);

                records.forEach((r: any) => {
                    const samples = r.decompress();
                    
                    // Parse start time. Seisplotjs records usually have .header.start
                    // which is a moment or luxon date object.
                    let startTimeMs = Date.now();
                    if (r.header && r.header.start) {
                        try {
                            startTimeMs = r.header.start.valueOf(); // Gets milliseconds
                        } catch (e) {
                            console.warn("Could not parse record start time, falling back to Date.now()");
                        }
                    }
                    
                    // Determine sample rate multiplier
                    // r.header.sampleRate is usually samples per second (Hz)
                    let msPerSample = nominalSampleRateMs;
                    if (r.header && r.header.sampleRate) {
                        msPerSample = 1000 / r.header.sampleRate;
                    }
                    
                    for (let i = 0; i < samples.length; i++) {
                        dataBuffer.push({
                            t: startTimeMs + (i * msPerSample),
                            v: samples[i]
                        });
                    }
                });
                
                // Sort buffer just in case packets arrived out of order
                dataBuffer.sort((a, b) => a.t - b.t);
                
                // Trim old data based on MAX_BUFFER_MS
                const latestTime = dataBuffer[dataBuffer.length - 1].t;
                const cutoffTime = latestTime - MAX_BUFFER_MS;
                
                // Find index of first element that is >= cutoffTime
                let trimIndex = 0;
                while (trimIndex < dataBuffer.length && dataBuffer[trimIndex].t < cutoffTime) {
                    trimIndex++;
                }
                
                if (trimIndex > 0) {
                    dataBuffer = dataBuffer.slice(trimIndex);
                }

                // Smoothly pull viewport back to realtime if not exploring history
                if (!isDragging && timeOffsetMs === 0) {
                    draw();
                } else if (!isDragging && timeOffsetMs > 0) {
                    // Slight auto-scroll to follow new data if we are panned (optional)
                    // timeOffsetMs += (samples.length * msPerSample);
                    draw();
                }
            } catch (err) {
                console.error("Error parsing miniSEED data:", err);
            }
        };
        
        (window as any)._mseedWs = ws;
        
        // Setup animation frame for smooth continuous drawing even between packets
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
        window.removeEventListener('resize', resizeCanvas);
        if (canvas) {
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('mousedown', handleMouseDown);
        }
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        
        if ((window as any)._mseedWs) {
            (window as any)._mseedWs.close();
        }
        if ((window as any)._mseedAnimId) {
            cancelAnimationFrame((window as any)._mseedAnimId);
        }
    });
</script>

<div class="p-4 md:p-6 bg-gray-950 min-h-screen text-white flex flex-col items-center justify-center">
    <div class="w-full max-w-6xl flex flex-col items-center">
        <h1 class="text-2xl md:text-3xl font-bold mb-2 tracking-wide text-emerald-400">Live Seismic Waveform</h1>
        <p class="text-gray-400 text-sm mb-6 flex flex-wrap justify-center items-center gap-4">
            <span class="flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                Pan: Click & Drag
            </span>
            <span class="flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                Navigate: Horizontal Scroll
            </span>
        </p>

        <div bind:this={container} class="w-full relative overflow-hidden rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.1)] ring-1 ring-gray-800 bg-gray-900 group">
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <canvas bind:this={canvas} {width} {height} class="block w-full touch-none select-none"></canvas>
            
            <div class="absolute top-4 left-4 flex flex-col gap-1">
                <div class="text-xs font-mono text-gray-400 bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-gray-700 pointer-events-none transition-opacity">
                    Zoom (Y): {zoomLevel.toFixed(4)}x
                </div>
                {#if timeOffsetMs > 0}
                    <button 
                        on:click={() => timeOffsetMs = 0}
                        class="text-xs font-mono text-blue-400 bg-blue-900/30 hover:bg-blue-900/60 px-2 py-1 rounded backdrop-blur-sm border border-blue-800/50 cursor-pointer transition-colors text-left"
                    >
                        &rarr; Back to Live
                    </button>
                {/if}
            </div>

            <div class="absolute top-4 right-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-gray-700">
                <span class="relative flex h-2.5 w-2.5">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full {timeOffsetMs === 0 ? 'bg-emerald-400' : 'bg-yellow-400'} opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2.5 w-2.5 {timeOffsetMs === 0 ? 'bg-emerald-500' : 'bg-yellow-500'}"></span>
                </span>
                <span class="text-xs font-bold {timeOffsetMs === 0 ? 'text-emerald-400' : 'text-yellow-400'} tracking-wider">
                    {timeOffsetMs === 0 ? 'LIVE' : 'HISTORY'}
                </span>
            </div>
        </div>
    </div>
</div>
