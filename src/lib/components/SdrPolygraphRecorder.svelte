<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SpectrumFrame } from "$lib/esp-sdr/radioDriver";

  interface Props {
    frame: SpectrumFrame | null;
    centerFreqMhz?: number;
    sampleRateHz?: number;
    floor?: number;          // Minimum dBFS (default -100)
    ceilingDbfs?: number;    // Maximum dBFS (default +10)
    safetyDbfs?: number;     // Level for SAFETY threshold (default 0)
    stepMhz?: number;        // Step size per channel in MHz (default 10)
    numChannels?: number;    // Total channels (supports 1, 5, 6, 8, 11, etc.)
    initialSpeed?: number;   // Scroll speed in px/s (default 50)
    initialGain?: number;    // Waveform deflection gain (default 1.0)
    isConnected?: boolean;   // Live connection status from ESP32
  }

  let {
    frame = null,
    centerFreqMhz = 2412,
    sampleRateHz = 80000000,
    floor = -100,
    ceilingDbfs = 10,
    safetyDbfs = 0,
    stepMhz = 10,
    numChannels = $bindable(11),
    initialSpeed = 50,
    initialGain = 1.0,
    isConnected = false,
  }: Props = $props();

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;

  let width = $state(760);
  let height = $state(320);

  // User interactive controls
  let isRunning = $state(true);
  let speed = $state(initialSpeed); // px/sec
  let gain = $state(initialGain);
  let hasBreach = $state(false);
  let hoveredChannel = $state<number | null>(null);

  let mouseX = $state<number | null>(null);
  let mouseY = $state<number | null>(null);

  const FIXED_HEIGHT = 320;
  const STEP_Y = 2.0;             // Vertical distance in pixels per history sample
  const MAX_HISTORY = 260;         // History sample depth per channel
  const MAX_CHANNELS = 32;

  // History ring buffer: supports up to 32 channels without dynamic reallocation
  let history = Array.from({ length: MAX_CHANNELS }, () => new Float32Array(MAX_HISTORY));
  const channelPowers = new Float32Array(MAX_CHANNELS).fill(floor);
  const channelBreaches = new Uint8Array(MAX_CHANNELS).fill(0);
  const channelPhases = new Float32Array(MAX_CHANNELS).fill(0);



  let scrollAccumulator = 0;
  let lastTime = performance.now();
  let animId = 0;
  let resizeObserver: ResizeObserver | null = null;

  function resizeCanvas() {
    if (!container || !canvas) return;
    const rect = container.getBoundingClientRect();
    const newWidth = Math.floor(rect.width);
    if (newWidth <= 0) return;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const dpr = isMobile ? 1 : Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1.5);
    width = newWidth;
    height = FIXED_HEIGHT;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = "100%";
    canvas.style.height = `${FIXED_HEIGHT}px`;

    ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  }

  function handleMouseLeave() {
    mouseX = null;
    mouseY = null;
    hoveredChannel = null;
  }

  function pushHistorySample(ch: number, deflection: number) {
    const buf = history[ch];
    // Fast native memory copy instead of manual JS for-loop
    buf.copyWithin(1, 0, MAX_HISTORY - 1);
    buf[0] = deflection;
  }

  function draw() {
    if (!ctx || !canvas || width <= 0 || height <= 0) return;

    const now = performance.now();
    const dt = Math.min(0.08, (now - lastTime) / 1000);
    lastTime = now;

    // Support any channel count from 1 to 25!
    const curChannels = Math.max(1, Math.min(MAX_CHANNELS, numChannels));

    // 1. Compute frequency bins grouped by 10 MHz around center
    const roundedCenter = Math.round(centerFreqMhz / stepMhz) * stepMhz;
    const startOffset = -Math.floor((curChannels - 1) / 2);
    const bucketFreqs: number[] = [];
    for (let i = 0; i < curChannels; i++) {
      bucketFreqs.push(roundedCenter + (startOffset + i) * stepMhz);
    }

    // 2. Live spectrum extraction or Disconnected Straight Line
    const isLive = isConnected && frame !== null && frame.spectrum && frame.spectrum.length > 0;
    let anyBreach = false;

    if (isLive && frame) {
      const f = frame;
      const n = f.spectrum.length;
      const curCenter = f.frequency;
      const curRate = f.rate;
      const centerHz = curCenter * 1e6;
      const spanHz = curRate;
      const binWidthHz = spanHz / n;
      const halfSpanMhz = (spanHz / 1e6) / 2;
      const minCapMhz = curCenter - halfSpanMhz;
      const maxCapMhz = curCenter + halfSpanMhz;

      for (let b = 0; b < curChannels; b++) {
        const bFreq = bucketFreqs[b];
        const bMin = bFreq - stepMhz / 2;
        const bMax = bFreq + stepMhz / 2;

        let maxVal = -150;
        let count = 0;

        if (bMax >= minCapMhz && bMin <= maxCapMhz) {
          const startBin = Math.max(0, Math.floor((bMin * 1e6 - (centerHz - spanHz / 2)) / binWidthHz));
          const endBin = Math.min(n - 1, Math.ceil((bMax * 1e6 - (centerHz - spanHz / 2)) / binWidthHz));

          for (let i = startBin; i <= endBin; i++) {
            if (f.spectrum[i] > maxVal) {
              maxVal = f.spectrum[i];
            }
            count++;
          }
        }

        if (count === 0 || maxVal <= floor + 1) {
          maxVal = floor;
        }

        channelPowers[b] = maxVal;
        const isBreached = maxVal >= safetyDbfs;
        channelBreaches[b] = isBreached ? 1 : 0;
        if (isBreached) anyBreach = true;
      }
    } else {
      // Disconnected / Stopped: Clean floor values, NO fake random simulation!
      for (let b = 0; b < curChannels; b++) {
        channelPowers[b] = floor;
        channelBreaches[b] = 0;
      }
    }
    hasBreach = anyBreach;

    // 3. Layout geometry
    const isMobile = width < 600;
    const rulerWidth = isMobile ? 24 : 32;
    const rightMargin = 4;
    const plotWidth = Math.max(10, width - rulerWidth - rightMargin);

    // If only 1 channel, center it cleanly with attractive column width
    const colWidth = curChannels === 1
      ? Math.min(plotWidth * 0.45, 200)
      : plotWidth / curChannels;
    const yLaser = 114; // Horizontal laser reference stylus line (px from top)

    // 4. Update polygraph history buffer when running (continuous paper feed)
    if (isRunning) {
      scrollAccumulator += speed * dt;

      while (scrollAccumulator >= STEP_Y) {
        scrollAccumulator -= STEP_Y;

        for (let ch = 0; ch < curChannels; ch++) {
          if (!isLive) {
            // DISCONNECTED / STOPPED: EXACT STRAIGHT LINE (0 deflection, no random values!)
            pushHistorySample(ch, 0);
          } else {
            // CONNECTED: Real measured RF power
            const pwr = channelPowers[ch];
            const maxLaneDeflection = (colWidth * 0.30) * gain;

            if (pwr <= floor + 2) {
              // Below/at noise floor: straight line
              pushHistorySample(ch, 0);
            } else {
              // Actual RF energy received above noise floor:
              const norm = Math.max(0, Math.min(1.0, (pwr - floor) / (ceilingDbfs - floor)));
              channelPhases[ch] += 0.25;
              // Deflection proportional to real signal power
              const defl = Math.sin(channelPhases[ch]) * (norm * maxLaneDeflection);
              const limit = colWidth * 0.36;
              pushHistorySample(ch, Math.max(-limit, Math.min(limit, defl)));
            }
          }
        }
      }
    }

    // =========================================================================
    // 5. RENDER BACKGROUND & CRIMSON STRIPES (EVANGELION MAGI PARTIAL-WIDTH STRIPES)
    // =========================================================================
    // Base pitch black paper background
    ctx.fillStyle = "#020101";
    ctx.fillRect(0, 0, width, height);

    // Partial-width red bars between channels (matching reference UI Image 2)
    // The red bar does NOT fill the entire channel width, but only a partial vertical strip (~38% of channel width)
    const redBarWidth = Math.max(8, Math.round(colWidth * 0.38));

    if (curChannels === 1) {
      // Single channel mode: centered black lane flanked by red vertical bars
      const colX = rulerWidth + (plotWidth - colWidth) / 2;
      ctx.fillStyle = "#2a0508";
      ctx.fillRect(Math.max(rulerWidth, colX - redBarWidth), 0, redBarWidth, height);
      ctx.fillRect(colX + colWidth, 0, redBarWidth, height);

      ctx.strokeStyle = "rgba(180, 20, 25, 0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colX, 0); ctx.lineTo(colX, height);
      ctx.moveTo(colX + colWidth, 0); ctx.lineTo(colX + colWidth, height);
      ctx.stroke();

      const cx = colX + colWidth / 2;
      ctx.strokeStyle = "rgba(255, 60, 30, 0.08)";
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, 0); ctx.lineTo(cx, height);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Multi-channel mode: draw red vertical bars at the boundaries between each channel
      ctx.fillStyle = "#2a0508";
      // Ruler edge red stripe
      ctx.fillRect(rulerWidth, 0, Math.round(redBarWidth / 2), height);

      // Far right edge red stripe
      const totalPlotRight = rulerWidth + curChannels * colWidth;
      ctx.fillRect(totalPlotRight - Math.round(redBarWidth / 2), 0, Math.round(redBarWidth / 2), height);

      // Red vertical bars centered at the boundary between every channel pair
      for (let ch = 1; ch < curChannels; ch++) {
        const boundaryX = rulerWidth + ch * colWidth;
        const rx = Math.round(boundaryX - redBarWidth / 2);

        ctx.fillStyle = "#2a0508";
        ctx.fillRect(rx, 0, redBarWidth, height);

        ctx.strokeStyle = "rgba(180, 20, 25, 0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx, 0);
        ctx.lineTo(rx, height);
        ctx.moveTo(rx + redBarWidth, 0);
        ctx.lineTo(rx + redBarWidth, height);
        ctx.stroke();
      }

      // Centerlines and breach highlights down each channel
      for (let ch = 0; ch < curChannels; ch++) {
        const colX = rulerWidth + ch * colWidth;
        const cx = colX + colWidth / 2;
        const isBreached = channelBreaches[ch] === 1;

        if (isBreached) {
          ctx.fillStyle = "rgba(255, 0, 30, 0.12)";
          ctx.fillRect(colX, 0, colWidth, height);
        }

        ctx.strokeStyle = "rgba(255, 60, 30, 0.08)";
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // =========================================================================
    // 6. LEFT MICROMETER INSTRUMENT RULER (CRISP AMBER SCALE, NO BLUR)
    // =========================================================================
    ctx.strokeStyle = "#ff5500";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(rulerWidth - 3, 0);
    ctx.lineTo(rulerWidth - 3, height);
    ctx.stroke();

    ctx.font = "bold 8px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let y = 0; y < height; y += 5) {
      const isMajor = y % 25 === 0;
      const isMedium = y % 10 === 0;
      const tickLen = isMajor ? 8 : isMedium ? 5 : 3;

      ctx.strokeStyle = isMajor ? "#ff6600" : "rgba(255, 85, 0, 0.65)";
      ctx.beginPath();
      ctx.moveTo(rulerWidth - 3, y);
      ctx.lineTo(rulerWidth - 3 - tickLen, y);
      ctx.stroke();

      if (isMajor && !isMobile && y >= 20) {
        const idx = Math.floor(y / 25);
        ctx.fillStyle = "#ff6600";
        ctx.fillText(`${idx < 10 ? "-0" + idx : "-" + idx}`, rulerWidth - 11, y);
      }
    }

    // =========================================================================
    // 7. CHANNEL LABELS & ROTATED TYPOGRAPHY (EVANGELION MAGI STYLE - UPPER HEADER)
    // =========================================================================
    let hoveredIdx: number | null = null;

    for (let ch = 0; ch < curChannels; ch++) {
      const colX = curChannels === 1
        ? rulerWidth + (plotWidth - colWidth) / 2
        : rulerWidth + ch * colWidth;
      const cx = colX + colWidth / 2;
      const freq = bucketFreqs[ch];
      const isCenter = freq === roundedCenter;
      const isBreached = channelBreaches[ch] === 1;

      // Mouse hover detection
      if (mouseX !== null && mouseY !== null) {
        if (mouseX >= colX && mouseX < colX + colWidth) {
          hoveredIdx = ch;
        }
      }

      const isHovered = hoveredIdx === ch;
      const chStr = ch < 10 ? `0${ch}` : `${ch}`;

      // 1. Bold Amber Channel Number right above the red laser line (00, 01, 02...)
      ctx.font = "900 13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = isBreached
        ? "#ff0033"
        : isCenter
        ? "#ff9900"
        : isHovered
        ? "#ffffff"
        : "#e64a19";
      ctx.fillText(chStr, cx, yLaser - 12);

      // 2. Rotated Vertical Frequency Text directly in the upper header zone
      // e.g. "2390 MHz" running upwards, completely clear of the green trace lines
      ctx.save();
      ctx.translate(cx, yLaser - 26);
      ctx.rotate(-Math.PI / 2);
      ctx.font = "900 10px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isBreached
        ? "#ff0033"
        : isCenter
        ? "#ffaa00"
        : isHovered
        ? "#ffffff"
        : "rgba(255, 120, 30, 0.9)";
      ctx.fillText(`${freq} MHz`, 0, 0);
      ctx.restore();

      // 4. Negative coordinates at the bottom of the track (matching Image 2: -00, -01, -02...)
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = isCenter ? "#ff9900" : "#a83515";
      ctx.fillText(`-${chStr}`, cx, height - 6);
    }
    hoveredChannel = hoveredIdx;

    // =========================================================================
    // 8. CRISP PHOSPHOR GREEN POLYGRAPH TRACE LINES (SOLID, NO BLUR/BLOOM)
    // =========================================================================
    for (let ch = 0; ch < curChannels; ch++) {
      const colX = curChannels === 1
        ? rulerWidth + (plotWidth - colWidth) / 2
        : rulerWidth + ch * colWidth;
      const cx = colX + colWidth / 2;
      const isBreached = channelBreaches[ch] === 1;
      const buf = history[ch];

      ctx.save();
      ctx.lineWidth = isBreached ? 2.0 : 1.7;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = isBreached ? "#ff0033" : "#33ff66";

      ctx.beginPath();
      let started = false;

      // Draw through the history points from laser line downwards
      for (let i = 0; i < MAX_HISTORY; i++) {
        const ptY = yLaser + i * STEP_Y + scrollAccumulator;
        if (ptY > height - 12) break;

        const ptX = cx + buf[i];

        if (!started) {
          ctx.moveTo(ptX, ptY);
          started = true;
        } else {
          ctx.lineTo(ptX, ptY);
        }
      }

      ctx.stroke();
      ctx.restore();

      // Live needle stylus dot at the laser line (crisp, solid, no blur)
      const liveX = cx + buf[0];
      ctx.fillStyle = isBreached ? "#ff0033" : "#ffffff";
      ctx.beginPath();
      ctx.arc(liveX, yLaser, 2.0, 0, Math.PI * 2);
      ctx.fill();
    }

    // =========================================================================
    // 9. CRISP HORIZONTAL RED LASER REFERENCE SCANLINE (SOLID, NO BLUR)
    // =========================================================================
    ctx.strokeStyle = "#ff1a2b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rulerWidth - 3, yLaser);
    ctx.lineTo(width - rightMargin, yLaser);
    ctx.stroke();

    // =========================================================================
    // 10. INTERACTIVE HOVER TOOLTIP (SOLID, NO BLUR)
    // =========================================================================
    if (hoveredIdx !== null) {
      const hCh = hoveredIdx;
      const hFreq = bucketFreqs[hCh];
      const hPwr = channelPowers[hCh];
      const isOver = hPwr >= safetyDbfs;
      const colX = curChannels === 1
        ? rulerWidth + (plotWidth - colWidth) / 2
        : rulerWidth + hCh * colWidth;

      const tipW = 145;
      const tipH = 50;
      let tipX = colX + colWidth / 2 - tipW / 2;
      tipX = Math.max(rulerWidth + 4, Math.min(width - rightMargin - tipW - 4, tipX));
      const tipY = height - tipH - 12;

      ctx.save();
      ctx.fillStyle = "rgba(10, 2, 4, 0.96)";
      ctx.strokeStyle = isOver ? "#ff0033" : "#ff9900";
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.roundRect(tipX, tipY, tipW, tipH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      ctx.fillStyle = "#ff9900";
      ctx.font = "bold 9px monospace";
      ctx.fillText(`CH-${hCh < 10 ? "0" + hCh : hCh}: ${hFreq} MHz`, tipX + 8, tipY + 13);

      ctx.fillStyle = isOver ? "#ff3333" : "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText(isLive ? `PWR: ${hPwr.toFixed(1)} dBFS` : `STATUS: STANDBY (0 dBFS)`, tipX + 8, tipY + 26);

      ctx.fillStyle = isOver ? "#ff0033" : isLive ? "#33ff66" : "#888888";
      ctx.font = "bold 8.5px monospace";
      ctx.fillText(
        !isLive
          ? "DISCONNECTED (FLAT LINE)"
          : isOver
          ? "⚠ THRESHOLD EXCEEDED"
          : `SAFE (${(safetyDbfs - hPwr).toFixed(1)} dB margin)`,
        tipX + 8,
        tipY + 38
      );
      ctx.restore();
    }
  }

  let lastDrawTime = 0;

  onMount(() => {
    resizeCanvas();
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const entryW = Math.floor(entry.contentRect.width);
        if (entryW > 0 && Math.abs(entryW - width) > 1) {
          resizeCanvas();
        }
      }
    });
    if (container) resizeObserver.observe(container);

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const minInterval = isMobile ? 33 : 16;

    const loop = (timestamp: number) => {
      animId = requestAnimationFrame(loop);
      if (timestamp - lastDrawTime < minInterval) return;
      lastDrawTime = timestamp;
      draw();
    };
    animId = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect();
    if (animId) cancelAnimationFrame(animId);
  });
</script>

<div
  bind:this={container}
  class="sdr-polygraph-container relative w-full bg-[#020101] border border-[#3d0a0e] rounded select-none overflow-hidden font-mono text-xs flex flex-col"
  style="height: 355px; min-height: 355px; max-height: 355px;"
>
  <!-- Interactive Canvas Viewport (Fixed Height, No blur) -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="relative w-full overflow-hidden bg-[#020101]" style="height: 320px;">
    <canvas
      bind:this={canvas}
      class="block cursor-crosshair"
      style="width: 100%; height: 320px;"
      onmousemove={handleMouseMove}
      onmouseleave={handleMouseLeave}
    ></canvas>
  </div>

  <!-- Bottom Telemetry & Controls Toolbar with Channels Adjuster -->
  <div
    class="px-2.5 py-1 bg-[#060203] border-t border-[#26070a] flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-neutral-400"
  >
    
    <!-- Right Side Status -->
    <div class="flex items-center gap-2.5 font-mono">
      <span>CENTER: <strong class="text-[#ff9900]">{centerFreqMhz} MHz</strong></span>
      
    </div>
  </div>
</div>
