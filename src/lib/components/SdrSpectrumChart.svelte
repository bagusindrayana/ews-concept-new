<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SpectrumFrame } from "$lib/esp-sdr/radioDriver";

  interface Props {
    frame: SpectrumFrame | null;
    backgroundColor?: string; // Default #000000 (same as WaveformChart)
    gridColor?: string; // Default #33cc55 (neon green, same as WaveformChart)
    axesColor?: string; // Default #fa0 (orange, same as WaveformChart)
    waveformColor?: string; // Default #ff9900 (orange, same as WaveformChart)
    emptyTextColor?: string; // Default #fa0
    floor?: number; // dBFS floor, default -100
    range?: number; // dBFS range, default 80
    showMaxHold?: boolean;
    centerFreqMhz?: number;
    sampleRateHz?: number;
    bins?: number;
    modeName?: string;
    enableGlow?: boolean;
    showGradientArea?: boolean;
    deviceInfo?: any;
    deviceStats?: any;
  }

  let {
    frame = null,
    backgroundColor = "#000000",
    gridColor = "#33cc55",
    axesColor = "#fa0",
    waveformColor = "#ff9900",
    emptyTextColor = "#fa0",
    floor = -100,
    range = 80,
    showMaxHold = true,
    centerFreqMhz = 2412,
    sampleRateHz = 80000000,
    bins = 2048,
    modeName = "SPEC on-chip",
    enableGlow = true,
    showGradientArea = true,
    deviceInfo = null,
    deviceStats = null,
  }: Props = $props();

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;

  let width = $state(800);
  let height = $state(320);

  let mouseX = $state<number | null>(null);
  let mouseY = $state<number | null>(null);
  let cursorText = $state("");

  let resizeObserver: ResizeObserver | null = null;
  let animId: number = 0;

  function fmtHz(hz: number): string {
    if (Math.abs(hz) >= 1e9) return (hz / 1e9).toFixed(6) + " GHz";
    if (Math.abs(hz) >= 1e6) return (hz / 1e6).toFixed(3) + " MHz";
    if (Math.abs(hz) >= 1e3) return (hz / 1e3).toFixed(1) + " kHz";
    return hz.toFixed(0) + " Hz";
  }

  function draw() {
    if (!ctx || !canvas || width <= 0 || height <= 0) return;

    const dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      2,
    );

    const isMobile = width < 768;
    const leftPadding = isMobile ? 45 : 70;
    const bottomPadding = isMobile ? 32 : 44;
    const rightPadding = isMobile ? 12 : 24;
    const topPadding = 16;
    const drawWidth = Math.max(10, width - leftPadding - rightPadding);
    const drawHeight = Math.max(10, height - bottomPadding - topPadding);

    const curCenterMhz = frame ? frame.frequency : centerFreqMhz;
    const curRateHz = frame ? frame.rate : sampleRateHz;
    const curCenterHz = curCenterMhz * 1e6;
    const curSpanHz = curRateHz;
    const topDbfs = floor + range;

    // 1. Draw jet black background (same as WaveformChart)
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (!frame && (!frame || frame.sequence === 0)) {
      ctx.fillStyle = emptyTextColor;
      ctx.font = 'bold 16px "Inter", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("WAITING FOR SIGNAL...", width / 2, height / 2);
      return;
    }

    // 2. Draw Neon Green Grid with Crosshairs (Exact replica of WaveformChart / EVANGELION style)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const xGridDivs = 8;
    const yGridDivs = 12; // 12 divisions like Evangelion in WaveformChart
    const xGridStep = drawWidth / xGridDivs;
    const yGridStep = drawHeight / yGridDivs;

    for (
      let xPos = leftPadding;
      xPos <= leftPadding + drawWidth + 0.1;
      xPos += xGridStep
    ) {
      ctx.moveTo(xPos, topPadding);
      ctx.lineTo(xPos, topPadding + drawHeight);

      // Draw crosshairs on the vertical grid lines (length: 10px)
      for (
        let yPos = topPadding;
        yPos <= topPadding + drawHeight + 0.1;
        yPos += yGridStep
      ) {
        ctx.moveTo(xPos - 5, yPos);
        ctx.lineTo(xPos + 5, yPos);
      }

      // Draw floating crosshairs between the vertical lines (shifted by half grid step)
      if (xPos + xGridStep <= leftPadding + drawWidth + 0.1) {
        const midX = xPos + xGridStep / 2;
        for (
          let yPos = topPadding + yGridStep / 2;
          yPos <= topPadding + drawHeight;
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

    // 3. Draw Left Label Ruler (Amplitude / dBFS in Orange #fa0, exact WaveformChart style)
    ctx.strokeStyle = axesColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftPadding, topPadding);
    ctx.lineTo(leftPadding, topPadding + drawHeight);

    ctx.fillStyle = axesColor;
    ctx.font = isMobile
      ? 'bold 10px "Inter", sans-serif'
      : 'bold 14px "Inter", sans-serif';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    // Draw ticks & dBFS values along left axis
    const numYDivs = 4;
    for (let i = 0; i <= numYDivs; i++) {
      const y = topPadding + (i * drawHeight) / numYDivs;
      const dbVal = Math.round(topDbfs - (i * range) / numYDivs);

      ctx.moveTo(leftPadding - (isMobile ? 4 : 8), y);
      ctx.lineTo(leftPadding, y);

      ctx.fillText(dbVal.toString(), leftPadding - (isMobile ? 6 : 10), y);
    }
    ctx.stroke();

    // Unit indicator at top left of ruler
    ctx.font = isMobile
      ? 'bold 9px "Inter", sans-serif'
      : 'bold 11px "Inter", sans-serif';
    ctx.textAlign = "right";
    ctx.fillText("dBFS", leftPadding - (isMobile ? 6 : 10), topPadding - 8);

    // 4. Draw Bottom Ruler (Frequency in MHz in Orange #fa0, exact WaveformChart style)
    ctx.strokeStyle = axesColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, topPadding + drawHeight);
    ctx.lineTo(width, topPadding + drawHeight);

    ctx.fillStyle = axesColor;
    ctx.font = isMobile
      ? 'bold 10px "Inter", sans-serif'
      : 'bold 12px "Inter", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const numMajorTicks = isMobile ? 4 : 8;
    const f0 = (curCenterHz - curSpanHz / 2) / 1e6;
    const spanMhz = curSpanHz / 1e6;
    const stepMhz = spanMhz / numMajorTicks;

    for (let i = 0; i <= numMajorTicks; i++) {
      const fMhz = f0 + i * stepMhz;
      const x = leftPadding + (i * drawWidth) / numMajorTicks;

      // Major tick
      ctx.moveTo(x, topPadding + drawHeight);
      ctx.lineTo(x, topPadding + drawHeight + 16);
      ctx.fillText(fMhz.toFixed(1), x, topPadding + drawHeight + 18);

      // Minor tick
      if (i < numMajorTicks) {
        const midX = x + drawWidth / (numMajorTicks * 2);
        ctx.moveTo(midX, topPadding + drawHeight);
        ctx.lineTo(midX, topPadding + drawHeight + 8);
      }
    }
    ctx.stroke();

    // Frequency unit label on top right
    ctx.font = isMobile
      ? 'bold 9px "Inter", sans-serif'
      : 'bold 11px "Inter", sans-serif';
    ctx.textAlign = "right";
    ctx.fillText("FREQ (MHz)", leftPadding + drawWidth, topPadding - 8);

    // 5. Center LO Marker (Dashed orange vertical line + triangle marker)
    const centerPx = leftPadding + drawWidth / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 170, 0, 0.45)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(centerPx, topPadding);
    ctx.lineTo(centerPx, topPadding + drawHeight);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = axesColor;
    ctx.beginPath();
    ctx.moveTo(centerPx - 5, topPadding + drawHeight);
    ctx.lineTo(centerPx + 5, topPadding + drawHeight);
    ctx.lineTo(centerPx, topPadding + drawHeight + 7);
    ctx.closePath();
    ctx.fill();

    // 6. Draw Waveform Trace (Glowing Seismograph / Oscilloscope Line)
    if (frame && frame.spectrum && frame.spectrum.length > 0) {
      const spec = frame.spectrum;
      const len = spec.length;

      ctx.save();
      ctx.beginPath();
      ctx.rect(leftPadding, topPadding, drawWidth, drawHeight);
      ctx.clip();

      // Subtle gradient area fill beneath curve
      if (showGradientArea) {
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = leftPadding + (i / (len - 1)) * drawWidth;
          const normY = 1 - (spec[i] - floor) / range;
          const y =
            topPadding + Math.max(0, Math.min(drawHeight, normY * drawHeight));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(leftPadding + drawWidth, topPadding + drawHeight);
        ctx.lineTo(leftPadding, topPadding + drawHeight);
        ctx.closePath();

        const grad = ctx.createLinearGradient(
          0,
          topPadding,
          0,
          topPadding + drawHeight,
        );
        grad.addColorStop(0, "rgba(255, 153, 0, 0.25)");
        grad.addColorStop(1, "rgba(255, 153, 0, 0.01)");
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Max Hold trace (golden crisp line, zero shadowBlur for mobile performance)
      if (showMaxHold && frame.maxHoldSpectrum) {
        const mh = frame.maxHoldSpectrum;
        ctx.strokeStyle = "#e6b969";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = leftPadding + (i / (len - 1)) * drawWidth;
          const normY = 1 - (mh[i] - floor) / range;
          const y =
            topPadding + Math.max(0, Math.min(drawHeight, normY * drawHeight));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Live waveform line (crisp, solid vector stroke, zero shadowBlur for mobile performance)
      ctx.strokeStyle = waveformColor;
      ctx.lineWidth = len <= 256 ? 1.8 : 2.0;
      ctx.lineJoin = len <= 256 ? "miter" : "round";
      ctx.beginPath();

      for (let i = 0; i < len; i++) {
        const x = leftPadding + (i / (len - 1)) * drawWidth;
        const normY = 1 - (spec[i] - floor) / range;
        const y =
          topPadding + Math.max(0, Math.min(drawHeight, normY * drawHeight));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // For coarse FFT (256 bins or less), render small discrete vertex points on active bins
      // This visually emphasizes the simpler, stepped resolution!
      if (len <= 256) {
        ctx.fillStyle = waveformColor;
        for (let i = 0; i < len; i += 2) {
          if (spec[i] > floor + 18) {
            const x = leftPadding + (i / (len - 1)) * drawWidth;
            const normY = 1 - (spec[i] - floor) / range;
            const y = topPadding + Math.max(0, Math.min(drawHeight, normY * drawHeight));
            ctx.fillRect(x - 1, y - 1, 2.5, 2.5);
          }
        }
      }
      ctx.restore();

      // Update Cursor coordinate readout
      if (
        mouseX !== null &&
        mouseX >= leftPadding &&
        mouseX <= leftPadding + drawWidth
      ) {
        const frac = (mouseX - leftPadding) / drawWidth;
        const idx = Math.max(0, Math.min(len - 1, Math.floor(frac * len)));
        const hoverHz = curCenterHz + (frac - 0.5) * curSpanHz;
        const hoverDbfs = spec[idx];
        cursorText = `${(hoverHz / 1e6).toFixed(5)} MHz · ${hoverDbfs.toFixed(1)} dBFS`;

        // Crosshairs following mouse
        ctx.save();
        ctx.strokeStyle = "rgba(255, 170, 0, 0.4)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(mouseX, topPadding);
        ctx.lineTo(mouseX, topPadding + drawHeight);
        if (
          mouseY !== null &&
          mouseY >= topPadding &&
          mouseY <= topPadding + drawHeight
        ) {
          ctx.moveTo(leftPadding, mouseY);
          ctx.lineTo(leftPadding + drawWidth, mouseY);
        }
        ctx.stroke();
        ctx.restore();
      } else {
        cursorText = `${(frame.peakHz / 1e6).toFixed(5)} MHz · ${frame.peakDbfs.toFixed(1)} dBFS`;
      }
    } else {
      cursorText = `${curCenterMhz.toFixed(5)} MHz`;
    }
  }

  function resizeCanvas() {
    if (!container || !canvas) return;
    const rect = container.getBoundingClientRect();
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    // Cap DPR to 1 on mobile to avoid 4x-9x pixel fill rate lag on Android
    const dpr = isMobile ? 1 : Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1.5);

    width = Math.floor(rect.width);
    height = 325;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    }

    draw();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    draw();
  }

  function handleMouseLeave() {
    mouseX = null;
    mouseY = null;
    draw();
  }

  let lastDrawTime = 0;
  let lastRenderedSeq = -1;

  onMount(() => {
    resizeCanvas();
    resizeObserver = new ResizeObserver(() => resizeCanvas());
    if (container) resizeObserver.observe(container);

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    // 30 FPS throttle on mobile (33ms) to save CPU/GPU; 60 FPS (16ms) on desktop
    const minInterval = isMobile ? 33 : 16;

    const loop = (timestamp: number) => {
      animId = requestAnimationFrame(loop);
      if (timestamp - lastDrawTime < minInterval) return;

      // Skip redrawing static frames when no frame update or mouse interaction occurred
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

  // Derived measurement bar values
  let activeCenter = $derived(
    frame ? frame.frequency * 1e6 : centerFreqMhz * 1e6,
  );
  let activeSpan = $derived(frame ? frame.rate : sampleRateHz);
  let activeBins = $derived(frame ? frame.spectrum.length : bins);
  let rbwHz = $derived(1.44 * (activeSpan / activeBins));
</script>

<div
  bind:this={container}
  class="w-full flex flex-col bg-black border-2 border-[#fa0] rounded overflow-hidden shadow-2xl select-none"
>
  <!-- Chart Header Bar (Evangelion Style with Neon Border) -->
  <div
    class="flex items-center justify-between px-3 py-1.5 bg-[#080808] border-b-2 border-[#fa0] text-xs font-mono"
  >
    <div class="flex items-center gap-2">
      <span class="text-[#fa0] font-black tracking-wider uppercase"
        >SPECTRUM WAVEFORM MONITOR</span
      >
      {#if showMaxHold}
        <span
          class="text-[10px] text-[#e6b969] px-1.5 py-0.2 bg-[#e6b969]/10 rounded border border-[#e6b969]/40"
        >
          MAX HOLD
        </span>
      {/if}
    </div>
    <div class="text-[#fa0] font-bold font-mono tracking-wide">
      {cursorText}
    </div>
  </div>

  <!-- Spectrum Main Canvas with WaveformChart Aesthetics -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative w-full cursor-crosshair bg-black"
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
  >
    <canvas bind:this={canvas} class="block w-full"></canvas>

    <!-- top left -->
    <div
      class="absolute right-auto top-4 lg:right-0 lg:top-6 left-4 lg:left-24 pointer-events-none z-5 max-w-100 flex flex-col justify-center items-end lg:items-start gap-1"
    >
      <div
        class="rounded-sm bordered text-3xl bg-black/60 shadow-lg h-10 text-center flex justify-center items-center px-1"
      >
        <div class="font-bold md:text-3xl uppercase ews-title">
          {deviceInfo?.connected ? deviceInfo.chipFamily : "OFFLINE"}
        </div>
      </div>

      {#if deviceInfo != null && deviceInfo?.connected}
        <div class="font-bold tracking-widest text-sm md:text-xl ews-title">
          BUFFER : {deviceInfo?.maxSamples
            ? `${deviceInfo.maxSamples.toLocaleString()} spl`
            : "16,380 spl"}
        </div>

        <div class="font-bold tracking-widest text-sm md:text-xl ews-title">
          RF RANGE : {deviceInfo?.tuneRange
            ? `${deviceInfo.tuneRange[0]}-${deviceInfo.tuneRange[1]} MHz`
            : "2400-2484 MHz"}
        </div>
      {/if}
    </div>

    <!-- Top Right -->
    <div
      class="absolute bottom-16 lg:bottom-auto top-auto lg:top-10 md:top-4 right-2 lg:right-16 pointer-events-none flex flex-col items-end z-5"
    >
      <div class="rounded-lg p-1 inline-block bg-black/60 shadow-lg">
        <div class="bordered px-3 py-1 flex flex-col text-3xl">
          {#if frame != null}
            <div
              class="font-bold text-[10px] md:text-sm tracking-widest leading-none mb-1 ews-title"
            >
              FFT SPEED:
            </div>
            <div
              class="font-bold text-lg md:text-xl tracking-widest leading-none text-right ews-title"
            >
              <span class="text-[#fa0]"
                >{deviceStats?.fftsPerSec || (frame?.fps ? frame.fps * 8 : 0)}/s
                ({frame?.fps || 0} fps)</span
              >
            </div>
          {:else}
            <div class="font-bold md:text-3xl uppercase ews-title">OFFLINE</div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Measurement Specs Row (Evangelion Monospace Palette) -->
  <div
    class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-1.5 bg-[#050505] border-t border-[#fa0]/40 text-[11px] font-mono text-[#8a9ba3]"
  >
    <div>
      <span class="text-[#fa0]">START:</span>
      <b class="text-red">{fmtHz(activeCenter - activeSpan / 2)}</b>
    </div>
    <div>
      <span class="text-[#fa0]">CENTER:</span>
      <b class="text-red">{fmtHz(activeCenter)}</b>
    </div>
    <div>
      <span class="text-[#fa0]">SPAN:</span>
      <b class="text-red">{fmtHz(activeSpan)}</b>
    </div>
    <div>
      <span class="text-[#fa0]">STOP:</span>
      <b class="text-red">{fmtHz(activeCenter + activeSpan / 2)}</b>
    </div>
    <div>
      <span class="text-[#fa0]">RBW:</span>
      <b class="text-red">{fmtHz(rbwHz)}</b>
    </div>
    <div>
      <span class="text-[#fa0]">BINS:</span>
      <b class="text-red">{activeBins}</b>
    </div>
    <div>
      <span class="text-[#fa0]">REF:</span>
      <b class="text-red">{floor + range} dBFS</b>
    </div>
    <div>
      <span class="text-[#fa0]">DIV:</span>
      <b class="text-red">{range / 4} dB</b>
    </div>
    <div>
      <span class="text-[#fa0]">DET:</span> <b class="text-red">AVERAGE</b>
    </div>
    <div>
      <span class="text-[#fa0]">MODE:</span> <b class="text-red">{modeName}</b>
    </div>
  </div>
</div>
