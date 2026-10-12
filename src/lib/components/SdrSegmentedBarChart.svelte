<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SpectrumFrame } from "$lib/esp-sdr/radioDriver";

  interface Props {
    frame: SpectrumFrame | null;
    centerFreqMhz?: number;
    sampleRateHz?: number;
    floor?: number;       // Minimum dBFS (default -100)
    ceilingDbfs?: number; // Maximum dBFS (default +10, allowing headroom above 0 dBFS)
    safetyDbfs?: number;  // Level for SAFETY LINE (default 0)
    stepMhz?: number;     // Step size per bar in MHz (default 10)
    numBars?: number;     // Total bars (default 11, ±5 steps around center)
    numSegments?: number; // Number of LED segments per bar (default 24)
    showYellowCap?: boolean; // Highlight top segment in yellow (default true, snaps with bar)
    showSafetyBadge?: boolean; // Show or hide the [ SAFETY LINE ] badge and its left padding (default false)
  }

  let {
    frame = null,
    centerFreqMhz = 2412,
    sampleRateHz = 80000000,
    floor = -100,
    ceilingDbfs = 10,
    safetyDbfs = 0,
    stepMhz = 10,
    numBars = $bindable(11),
    numSegments = 24,
    showYellowCap = $bindable(true),
    showSafetyBadge = $bindable(false),
  }: Props = $props();

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;

  let width = $state(760);
  let height = $state(300);

  let mouseX = $state<number | null>(null);
  let mouseY = $state<number | null>(null);

  // Status for the bottom telemetry bar
  let hasBreach = $state(false);
  let centerBucketFreq = $state(2410);

  let resizeObserver: ResizeObserver | null = null;
  let animId: number = 0;

  // Pre-allocated non-reactive buffers (supports up to 64 bars without reallocating in 60 FPS loop)
  const MAX_BARS = 64;
  const animatedLevels = new Float32Array(MAX_BARS).fill(floor);
  const peakLevels = new Float32Array(MAX_BARS).fill(floor);
  let lastTime = performance.now();

  const FIXED_HEIGHT = 270;

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
  }

  function draw() {
    if (!ctx || !canvas || width <= 0 || height <= 0) return;

    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    const isMobile = width < 640;
    const isNarrow = width < 480;

    const axisX = 30;
    const badgeW = isMobile ? 64 : 80;
    const badgeH = 18;

    // Layout margins: compact padding if badge is hidden (bars start right next to Y-axis without gap)
    const leftPadding = showSafetyBadge ? (axisX + badgeW + 16) : (axisX + 14);
    const rightPadding = 18;
    const topPadding = 22;
    const bottomPadding = 42;

    const plotWidth = Math.max(10, width - leftPadding - rightPadding);
    const plotHeight = Math.max(10, height - topPadding - bottomPadding);

    // 1. Clear background (Pitch black CRT look)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    // Faint subtle CRT scanline effect
    ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }

    // Coordinates conversion
    const normSafety = Math.max(0, Math.min(1, (safetyDbfs - floor) / (ceilingDbfs - floor)));
    const ySafety = topPadding + plotHeight * (1 - normSafety);

    // 2. Compute Frequency Buckets: supports 1, 5, 6, 8, 11 or any count!
    const roundedCenter = Math.round(centerFreqMhz / stepMhz) * stepMhz;
    centerBucketFreq = roundedCenter;
    const totalBars = Math.max(1, Math.min(MAX_BARS, numBars));
    const startOffset = -Math.floor((totalBars - 1) / 2);
    const bucketFreqs: number[] = [];
    for (let i = 0; i < totalBars; i++) {
      bucketFreqs.push(roundedCenter + (startOffset + i) * stepMhz);
    }

    // 3. Process spectrum frame into target levels for each bucket
    const targetLevels = new Float32Array(totalBars);
    const f = frame;

    if (f && f.spectrum && f.spectrum.length > 0) {
      const n = f.spectrum.length;
      const curCenter = f.frequency;
      const curRate = f.rate;
      const centerHz = curCenter * 1e6;
      const spanHz = curRate;
      const binWidthHz = spanHz / n;
      const halfSpanMhz = (spanHz / 1e6) / 2;
      const minCapMhz = curCenter - halfSpanMhz;
      const maxCapMhz = curCenter + halfSpanMhz;

      for (let b = 0; b < totalBars; b++) {
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

        if (count === 0 || maxVal <= -140) {
          // Subtle baseline noise flutter if outside span
          maxVal = floor + (Math.sin(now * 0.003 + b) * 1.5 + Math.random() * 1.0);
        }

        targetLevels[b] = maxVal;
      }
    } else {
      // Disconnected / idle mode: gentle baseline noise floor
      for (let b = 0; b < totalBars; b++) {
        targetLevels[b] = floor + (Math.sin(now * 0.002 + b) * 1.5 + Math.random() * 1.0);
      }
    }

    // 4. Instant Ballistics (Snap immediately when level drops or rises)
    let anyOverSafety = false;
    for (let b = 0; b < totalBars; b++) {
      const target = targetLevels[b];
      // Instant snap so bars and peak marker track signal in real time!
      animatedLevels[b] = target;
      peakLevels[b] = target;

      if (animatedLevels[b] > safetyDbfs) {
        anyOverSafety = true;
      }
    }
    hasBreach = anyOverSafety;

    // 5. Draw Vertical Orange Y-Axis (Left)
    ctx.strokeStyle = "#ff9900";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(axisX, topPadding - 6);
    ctx.lineTo(axisX, topPadding + plotHeight + 6);
    ctx.stroke();

    // Draw Y-Axis Ticks & Labels
    const ticks = [10, 0, -20, -40, -60, -80, -100];
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const t of ticks) {
      const norm = (t - floor) / (ceilingDbfs - floor);
      const ty = topPadding + plotHeight * (1 - norm);

      // Tick notches
      ctx.beginPath();
      ctx.moveTo(axisX - 4, ty);
      ctx.lineTo(axisX + 4, ty);
      ctx.stroke();

      if (t !== safetyDbfs) {
        ctx.fillStyle = "#ff9900";
        ctx.fillText(t > 0 ? `+${t}` : `${t}`, axisX - 6, ty);
      }
    }

    // 6. Draw ±0 [ SAFETY LINE ] Horizontal Line (Direct from image)
    // ±0 Label on left of axis
    ctx.fillStyle = "#ff9900";
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText("±0", axisX - 6, ySafety);

    if (showSafetyBadge) {
      // Tick notch to badge
      ctx.beginPath();
      ctx.moveTo(axisX, ySafety);
      ctx.lineTo(axisX + 6, ySafety);
      ctx.stroke();

      // SAFETY LINE Rounded Pill Capsule
      const badgeX = axisX + 6;
      const badgeY = ySafety - badgeH / 2;

      ctx.save();
      ctx.strokeStyle = "#ff9900";
      ctx.lineWidth = 1.6;
      ctx.fillStyle = "#050302";

      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fill();
      ctx.stroke();

      // Badge text
      ctx.fillStyle = "#ff9900";
      ctx.font = `900 ${isMobile ? 8 : 9}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SAFETY LINE", badgeX + badgeW / 2, ySafety + 0.5);
      ctx.restore();

      // Horizontal line extending from badge across all bars
      ctx.save();
      ctx.strokeStyle = "#ff9900";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(badgeX + badgeW, ySafety);
      ctx.lineTo(width - rightPadding, ySafety);
      ctx.stroke();
      ctx.restore();
    } else {
      // Horizontal line extending directly from Y-axis across all bars
      ctx.save();
      ctx.strokeStyle = "#ff9900";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(axisX, ySafety);
      ctx.lineTo(width - rightPadding, ySafety);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Draw The Segmented Bars (Supports 1, 5, 6, 8, 11 or any count)
    const barGap = totalBars === 1 ? 0 : isNarrow ? 3 : isMobile ? 5 : 8;
    const barWidth = totalBars === 1
      ? Math.min(plotWidth * 0.45, 160)
      : Math.max(8, (plotWidth - (totalBars - 1) * barGap) / totalBars);
    const segGap = 2.4;
    const segHeight = Math.max(3, (plotHeight - (numSegments - 1) * segGap) / numSegments);

    let hoveredIndex: number | null = null;

    for (let b = 0; b < totalBars; b++) {
      const bx = totalBars === 1
        ? leftPadding + (plotWidth - barWidth) / 2
        : leftPadding + b * (barWidth + barGap);
      const curLevel = animatedLevels[b];
      const peakLevel = peakLevels[b];
      const freqMhz = bucketFreqs[b];
      const isCenter = freqMhz === roundedCenter;

      // Check mouse hover on column
      const isHovered =
        mouseX !== null &&
        mouseY !== null &&
        mouseX >= bx - barGap / 2 &&
        mouseX <= bx + barWidth + barGap / 2 &&
        mouseY >= topPadding &&
        mouseY <= topPadding + plotHeight + 35;

      if (isHovered) {
        hoveredIndex = b;
        ctx.fillStyle = "rgba(255, 153, 0, 0.08)";
        ctx.fillRect(bx - 2, topPadding - 2, barWidth + 4, plotHeight + 4);
      }

      // Calculate number of active lit segments for current level
      const clampedLevel = Math.max(floor, Math.min(ceilingDbfs, curLevel));
      const activeCount = Math.max(
        0,
        Math.min(
          numSegments,
          Math.floor(((clampedLevel - floor) / (ceilingDbfs - floor)) * numSegments)
        )
      );

      // Draw Stacked Segments for Bar b
      for (let s = 0; s < numSegments; s++) {
        const normS = s / (numSegments - 1);
        const sDbfs = floor + normS * (ceilingDbfs - floor);
        const sy = topPadding + plotHeight - (s + 1) * segHeight - s * segGap;

        const isLit = s < activeCount;
        const isTopCap = (s === activeCount - 1);
        const isAboveSafety = sDbfs >= safetyDbfs;

        if (isLit) {
          ctx.save();
          if (isTopCap && showYellowCap && activeCount > 1) {
            // Yellow cap strictly on topmost segment of active bar (snaps instantly with bar!)
            ctx.fillStyle = isAboveSafety ? "#ffcc00" : "#ffaa00";
          } else if (isAboveSafety) {
            // Alert crimson above safety line
            ctx.fillStyle = "#ff0033";
          } else {
            // Active glowing red LED brick
            ctx.fillStyle = "#ff2200";
          }
          ctx.beginPath();
          ctx.roundRect(bx, sy, barWidth, segHeight, 2);
          ctx.fill();
          ctx.restore();
        } else {
          // UNLIT SEGMENT SILHOUETTE (Faint gas-plasma matrix)
          ctx.fillStyle = "rgba(255, 34, 0, 0.05)";
          ctx.strokeStyle = "rgba(255, 34, 0, 0.12)";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.roundRect(bx, sy, barWidth, segHeight, 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // X-Axis Frequency Labels under each Bar
      const centerX = bx + barWidth / 2;

      // Center triangle indicator
      if (isCenter) {
        ctx.fillStyle = "#ff9900";
        ctx.beginPath();
        ctx.moveTo(centerX - 3.5, topPadding + plotHeight + 5);
        ctx.lineTo(centerX + 3.5, topPadding + plotHeight + 5);
        ctx.lineTo(centerX, topPadding + plotHeight + 2);
        ctx.closePath();
        ctx.fill();
      }

      // Frequency text
      ctx.textAlign = 'center';
      ctx.font = isCenter ? '900 10px monospace' : 'bold 9px monospace';
      ctx.fillStyle = isCenter ? "#ff9900" : isHovered ? "#ffffff" : "#8d9ea8";
      ctx.fillText(`${freqMhz}`, centerX, topPadding + plotHeight + 17);

      // dBFS readout text
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = curLevel > safetyDbfs ? "#ff3333" : isCenter ? "#ff9900" : "#556b77";
      ctx.fillText(curLevel > floor + 2 ? `${Math.round(curLevel)}` : "—", centerX, topPadding + plotHeight + 28);
    }

    // 8. Interactive Tooltip if hovering a bar
    if (hoveredIndex !== null) {
      const hb = hoveredIndex;
      const hFreq = bucketFreqs[hb];
      const hVal = animatedLevels[hb];
      const hPeak = peakLevels[hb];
      const isOver = hVal > safetyDbfs;

      const bx = totalBars === 1
        ? leftPadding + (plotWidth - barWidth) / 2
        : leftPadding + hb * (barWidth + barGap);
      const tipW = 145;
      const tipH = 56;
      let tipX = bx - tipW / 2 + barWidth / 2;
      tipX = Math.max(leftPadding, Math.min(width - rightPadding - tipW, tipX));
      const tipY = topPadding + 4;

      ctx.save();
      ctx.fillStyle = "rgba(6, 9, 12, 0.95)";
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
      ctx.fillText(`BAND: ${hFreq} MHz (±5M)`, tipX + 8, tipY + 14);

      ctx.fillStyle = isOver ? "#ff3333" : "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText(`PWR: ${hVal.toFixed(1)} dBFS`, tipX + 8, tipY + 28);

      ctx.fillStyle = isOver ? "#ff0033" : "#37c964";
      ctx.font = "bold 8.5px monospace";
      const statusText = isOver
        ? `⚠ OVER SAFETY (+${(hVal - safetyDbfs).toFixed(1)} dB)`
        : `SAFE (${(safetyDbfs - hVal).toFixed(1)} dB margin)`;
      ctx.fillText(statusText, tipX + 8, tipY + 42);
      ctx.restore();
    }
  }

    let lastDrawTime = 0;
    let lastRenderedSeq = -1;

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

        const frameChanged = frame && frame.sequence !== lastRenderedSeq;
        const mouseActive = mouseX !== null && mouseY !== null;
        if (!frameChanged && !mouseActive && timestamp - lastDrawTime < 250) {
          return;
        }

        lastDrawTime = timestamp;
        if (frame) lastRenderedSeq = frame.sequence;
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
  class="sdr-segmented-container relative w-full bg-[#000000] border border-[#2a1100] rounded select-none overflow-hidden font-mono text-xs flex flex-col"
  style="height: 305px; min-height: 305px; max-height: 305px;"
>
  <!-- Interactive Canvas with fixed height container -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="relative w-full overflow-hidden bg-black" style="height: 270px;">
    <canvas
      bind:this={canvas}
      class="block cursor-crosshair"
      style="width: 100%; height: 270px;"
      onmousemove={handleMouseMove}
      onmouseleave={handleMouseLeave}
    ></canvas>
  </div>

  <!-- Bottom Telemetry Status Strip with BARS Count Adjuster -->
  <div class="px-3 py-1.5 bg-[#030608] border-t border-[#1a120b] flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-400">
    

    <div class="flex items-center gap-3 font-mono">
      <span>CENTER: <strong class="text-[#ff9900]">{centerFreqMhz} MHz</strong></span>
      
    </div>
  </div>
</div>

<style>
  .sdr-segmented-container {
    box-shadow: inset 0 0 25px rgba(255, 34, 0, 0.05);
  }
</style>
