<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Card from "$lib/components/Card.svelte";
  import StripeBar from "$lib/components/StripeBar.svelte";
  import SdrSpectrumChart from "$lib/components/SdrSpectrumChart.svelte";
  import SdrWaterfallChart from "$lib/components/SdrWaterfallChart.svelte";
  import {
    EspSdrDriver,
    type CaptureConfig,
    type SpectrumFrame,
    type LogEntry
  } from "$lib/esp-sdr/radioDriver";
  import Icon from "@iconify/svelte";

  // Connection & Driver State
  let driver = $state<EspSdrDriver | null>(null);
  let connectionStatus = $state<"disconnected" | "connecting" | "connected" | "streaming" | "error">("disconnected");
  let isWebSerialSupported = $state(true);
  let latestFrame = $state<SpectrumFrame | null>(null);
  let waterfallRef: { clear: () => void } | null = null;

  // SDR Configuration
  let config = $state<CaptureConfig>({
    frequency: 2412,
    rate: 80000000,
    bits: 10,
    fft: 2048,
    bandwidth: 20,
    gainMode: "HARDWARE",
    gain: 40,
    maxHold: false,
    dcMode: "raw",
    traceAvg: 0.3,
    floor: -100,
    range: 80
  });

  // UI state
  let baudRate = $state(2000000);
  let autoScrollLog = $state(true);
  let logContainer: HTMLDivElement | null = null;
  let logs = $state<LogEntry[]>([]);

  // Frequency presets
  const freqPresets = [
    { label: "2.4 GHz (CH 1)", freq: 2412 },
    { label: "CH 6", freq: 2437 },
    { label: "CH 11", freq: 2462 },
    { label: "5.5 GHz", freq: 5500 }
  ];

  function addLog(type: LogEntry["type"], message: string) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}`;
    const entry: LogEntry = {
      id: Date.now() + Math.random(),
      timestamp: timeStr,
      type,
      message
    };
    logs = [...logs.slice(-300), entry]; // Keep last 300 entries

    if (autoScrollLog && logContainer) {
      setTimeout(() => {
        if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
      }, 20);
    }
  }

  async function handleConnect() {
    if (!driver) return;
    try {
      addLog("info", `Initiating WebSerial connection at ${baudRate / 1e6} MBaud...`);
      await driver.connect(baudRate);
      if (driver.isConnected) {
        addLog("success", "Connection handshake completed! Starting RF spectrum stream...");
        await driver.startStream(config);
      }
    } catch (err: any) {
      addLog("error", `Failed to connect: ${err.message}`);
    }
  }

  async function handleDisconnect() {
    if (!driver) return;
    try {
      addLog("info", "Disconnecting ESP-SDR...");
      await driver.disconnect();
      addLog("success", "Device safely disconnected.");
    } catch (err: any) {
      addLog("error", `Disconnect error: ${err.message}`);
    }
  }

  function handleToggleSimulation() {
    if (!driver) return;
    if (driver.isSimulating) {
      driver.stopSimulation();
      addLog("info", "Simulation stopped.");
    } else {
      addLog("info", "Starting synthetic 2.4 GHz WiFi simulation stream...");
      driver.startSimulation(config);
    }
  }

  function handleClearCharts() {
    latestFrame = null;
    waterfallRef?.clear();
    driver?.resetMaxHold();
    addLog("info", "Spectrum & Waterfall display buffers cleared.");
  }

  function handleClearLogs() {
    logs = [];
    addLog("info", "Log console cleared.");
  }

  function handlePreset(f: number) {
    config.frequency = f;
    if (driver && driver.isConnected) {
      driver.tune(config.frequency, config.bandwidth);
    }
    addLog("info", `Selected frequency: ${f} MHz`);
  }

  // Update hardware tuning on parameter change
  $effect(() => {
    const f = config.frequency;
    const bw = config.bandwidth;
    if (driver && driver.isConnected && driver.isStreaming) {
      driver.tune(f, bw);
    }
  });

  $effect(() => {
    const gm = config.gainMode;
    const g = config.gain;
    if (driver && driver.isConnected && driver.isStreaming) {
      driver.setGain(gm, g);
    }
  });

  onMount(() => {
    isWebSerialSupported = EspSdrDriver.isSupported();

    driver = new EspSdrDriver();
    driver.onLog = (entry) => {
      logs = [...logs.slice(-300), entry];
      if (autoScrollLog && logContainer) {
        setTimeout(() => {
          if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
        }, 20);
      }
    };

    driver.onFrame = (frame) => {
      latestFrame = frame;
    };

    driver.onStatusChange = (status) => {
      connectionStatus = status;
    };

    if (!isWebSerialSupported) {
      addLog("warn", "WebSerial is NOT supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera.");
    } else {
      addLog("info", "System ready. WebSerial API available. Ready to connect ESP32 SDR or run Demo Simulation.");
    }
  });

  onDestroy(() => {
    if (driver) {
      driver.disconnect();
    }
  });
</script>

<svelte:head>
  <title>ESP-WebSDR · EWS Receiver</title>
</svelte:head>

<div class="min-h-screen bg-black text-[#e2e8eb] py-3 px-2 md:px-4 lg:px-6 flex flex-col items-center w-full">
  <!-- Top Navigation Header -->
  <div class="w-full flex flex-wrap items-center justify-between gap-2 mb-3">
    <div class="flex items-center gap-2">
      <a class="ews-btn ews-btn-primary ews-btn-sm" href="/">HOME</a>
      <a class="ews-btn ews-btn-primary ews-btn-sm" href="/realtime">REALTIME</a>
      <a class="ews-btn ews-btn-primary ews-btn-sm" href="/status-map">MAP</a>
      <a class="ews-btn ews-btn-primary ews-btn-sm" href="/magi">MAGI</a>
    </div>

    <!-- Status badge -->
    <div class="flex items-center gap-2 font-mono text-xs">
      <span class="text-[#8ba0ab]">STATUS:</span>
      {#if connectionStatus === "streaming"}
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#37c964]/20 border border-[#37c964] text-[#37c964] font-bold animate-pulse">
          <span class="w-2 h-2 rounded-full bg-[#37c964]"></span>
          {driver?.isSimulating ? "DEMO SIMULATION" : "STREAMING (LIVE)"}
        </span>
      {:else if connectionStatus === "connected"}
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#37c964]/10 border border-[#37c964]/60 text-[#37c964] font-bold">
          <span class="w-2 h-2 rounded-full bg-[#37c964]"></span>
          CONNECTED
        </span>
      {:else if connectionStatus === "connecting"}
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#1e8bb5]/20 border border-[#1e8bb5] text-[#1e8bb5] font-bold animate-pulse">
          <span class="w-2 h-2 rounded-full bg-[#1e8bb5]"></span>
          LINKING...
        </span>
      {:else if connectionStatus === "error"}
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-red-950 border border-red-500 text-red-400 font-bold">
          <span class="w-2 h-2 rounded-full bg-red-500"></span>
          ERROR
        </span>
      {:else}
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-400 font-medium">
          <span class="w-2 h-2 rounded-full bg-neutral-500"></span>
          DISCONNECTED
        </span>
      {/if}
    </div>
  </div>

  <!-- Page Banner Title -->
  <div class="w-full mb-3 text-center p-1 z-10 bordered flex justify-center items-center relative overflow-hidden bg-black min-h-[58px]">
    <div class="w-full overflow-hidden opacity-75">
      <StripeBar loop={true} duration={25} color="orange"></StripeBar>
    </div>
    <div class="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
      <h1 class="text-lg md:text-xl font-black font-mono tracking-widest text-[#fa0] uppercase bg-black/95 px-4 py-0.5 border-x border-[#fa0]/50 shadow-[0_0_15px_rgba(255,170,0,0.3)]">
        ESP-WebSDR
      </h1>
     
    </div>
  </div>

  <div class="w-full flex flex-col gap-3">
    <!-- Top Control Bar Card -->
    <Card className="border-[#fa0]/40">
      {#snippet title()}
        <div class="flex items-center justify-between w-full font-mono text-xs font-bold text-[#fa0] px-1">
          <div class="flex items-center gap-2">
            <Icon icon="lucide:radio" width="16" height="16" />
            <span>CONNECTION & RECEIVER CONTROLS</span>
          </div>
          {#if driver?.identity}
            <span class="text-[11px] text-[#e0a040] font-normal truncate max-w-xs">
              CHIP: {driver.identity}
            </span>
          {/if}
        </div>
      {/snippet}

      <div class="flex flex-col gap-3 p-2 font-mono">
        <!-- Row 1: Action Buttons -->
        <div class="flex flex-wrap items-center gap-2">
          {#if connectionStatus === "disconnected" || connectionStatus === "error"}
            <button
              class="ews-btn ews-btn-primary flex items-center gap-1.5 cursor-pointer"
              onclick={handleConnect}
              disabled={!isWebSerialSupported}
            >
              <Icon icon="lucide:plug" width="16" height="16" />
              CONNECT ESP32
            </button>
          {:else}
            <button
              class="ews-btn ews-btn-danger flex items-center gap-1.5 cursor-pointer"
              onclick={handleDisconnect}
            >
              <Icon icon="lucide:power-off" width="16" height="16" />
              DISCONNECT
            </button>
          {/if}

          <button
            class="ews-btn {driver?.isSimulating ? 'ews-btn-alert' : 'ews-btn-outline'} flex items-center gap-1.5 cursor-pointer"
            onclick={handleToggleSimulation}
          >
            <Icon icon="lucide:play" width="16" height="16" />
            {driver?.isSimulating ? "STOP DEMO" : "DEMO SIMULATION"}
          </button>

          <button
            class="ews-btn ews-btn-ghost flex items-center gap-1.5 cursor-pointer"
            onclick={handleClearCharts}
          >
            <Icon icon="lucide:trash-2" width="14" height="14" />
            CLEAR TRACE
          </button>

          <!-- Baud rate select -->
          <div class="flex items-center gap-1.5 text-xs text-[#8a9ba3] ml-auto">
            <span>Baud:</span>
            <select
              bind:value={baudRate}
              disabled={connectionStatus === "connected" || connectionStatus === "streaming"}
              class="bg-[#11181c] border border-[#23333b] text-[#cfd8dc] px-2 py-1 rounded text-xs focus:outline-none focus:border-[#37c964]"
            >
              <option value={2000000}>2.0 MBaud</option>
              <option value={1000000}>1.0 MBaud</option>
              <option value={921600}>921.6 kBaud</option>
              <option value={115200}>115.2 kBaud</option>
            </select>
          </div>
        </div>

        <!-- Row 2: Frequency & SDR Controls -->
        <div class="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2 border-t border-[#1a252b] text-xs">
          <!-- Center Frequency -->
          <div class="flex flex-col gap-1">
            <label for="sdr-freq" class="text-[#8a9ba3] flex justify-between">
              <span>Center Frequency</span>
              <span class="text-[#fa0] font-bold">{config.frequency} MHz</span>
            </label>
            <input
              id="sdr-freq"
              type="number"
              min="100"
              max="6000"
              step="1"
              bind:value={config.frequency}
              class="bg-[#11181c] border border-[#23333b] text-[#e2e8eb] px-2 py-1 rounded focus:outline-none focus:border-[#fa0]"
            />
            <div class="flex flex-wrap gap-1 mt-1">
              {#each freqPresets as preset}
                <button
                  type="button"
                  class="px-1.5 py-0.5 bg-[#172227] hover:bg-[#203138] text-[10px] text-[#b0bec5] rounded cursor-pointer transition-colors"
                  onclick={() => handlePreset(preset.freq)}
                >
                  {preset.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Sample Rate -->
          <div class="flex flex-col gap-1">
            <label for="sdr-rate" class="text-[#8a9ba3]">Sample Rate / Span</label>
            <select
              id="sdr-rate"
              bind:value={config.rate}
              class="bg-[#11181c] border border-[#23333b] text-[#e2e8eb] px-2 py-1.5 rounded focus:outline-none focus:border-[#37c964]"
            >
              <option value={80000000}>80 MS/s · 80 MHz</option>
              <option value={40000000}>40 MS/s · 40 MHz</option>
              <option value={20000000}>20 MS/s · 20 MHz</option>
              <option value={10000000}>10 MS/s · 10 MHz</option>
              <option value={8000000}>8 MS/s · 8 MHz</option>
              <option value={4000000}>4 MS/s · 4 MHz</option>
            </select>
            <span class="text-[10px] text-[#60737d]">RF capture span</span>
          </div>

          <!-- FFT Bins -->
          <div class="flex flex-col gap-1">
            <label for="sdr-fft" class="text-[#8a9ba3]">FFT Resolution</label>
            <select
              id="sdr-fft"
              bind:value={config.fft}
              class="bg-[#11181c] border border-[#23333b] text-[#e2e8eb] px-2 py-1.5 rounded focus:outline-none focus:border-[#37c964]"
            >
              <option value={512}>512 Bins</option>
              <option value={1024}>1024 Bins</option>
              <option value={2048}>2048 Bins (Default)</option>
              <option value={4096}>4096 Bins</option>
            </select>
            <div class="flex items-center gap-2 mt-1">
              <label class="flex items-center gap-1 cursor-pointer text-[10px] text-[#b0bec5]">
                <input type="checkbox" bind:checked={config.maxHold} />
                Max Hold
              </label>
            </div>
          </div>

          <!-- Gain Control -->
          <div class="flex flex-col gap-1">
            <div class="text-[#8a9ba3] flex justify-between">
              <span>RX Gain</span>
              <span class="text-[#e0a040]">
                {config.gainMode === "HARDWARE" ? "AGC" : `Manual (${config.gain})`}
              </span>
            </div>
            <div class="flex gap-1">
              <button
                type="button"
                class="flex-1 py-1 text-xs rounded border transition-colors cursor-pointer {config.gainMode === 'HARDWARE' ? 'bg-[#37c964]/20 border-[#37c964] text-[#37c964]' : 'bg-[#11181c] border-[#23333b] text-[#8a9ba3]'}"
                onclick={() => (config.gainMode = "HARDWARE")}
              >
                AGC
              </button>
              <button
                type="button"
                class="flex-1 py-1 text-xs rounded border transition-colors cursor-pointer {config.gainMode === 'MANUAL' ? 'bg-[#e0a040]/20 border-[#e0a040] text-[#e0a040]' : 'bg-[#11181c] border-[#23333b] text-[#8a9ba3]'}"
                onclick={() => (config.gainMode = "MANUAL")}
              >
                Manual
              </button>
            </div>
            {#if config.gainMode === "MANUAL"}
              <input
                type="range"
                min="0"
                max="60"
                step="1"
                bind:value={config.gain}
                class="w-full mt-1 accent-[#e0a040]"
              />
            {/if}
          </div>

          <!-- Trace Average & Scale -->
          <div class="flex flex-col gap-1">
            <label for="sdr-avg" class="text-[#8a9ba3]">Trace Smoothing</label>
            <select
              id="sdr-avg"
              bind:value={config.traceAvg}
              class="bg-[#11181c] border border-[#23333b] text-[#e2e8eb] px-2 py-1.5 rounded focus:outline-none focus:border-[#37c964]"
            >
              <option value={0}>Off (Raw)</option>
              <option value={0.3}>Short (Fast)</option>
              <option value={0.65}>Medium</option>
              <option value={0.9}>High (Smooth)</option>
            </select>
            <span class="text-[10px] text-[#60737d]">
              Scale: {config.floor} to {config.floor + config.range} dBFS
            </span>
          </div>
        </div>
      </div>
    </Card>

    <!-- 2 Kolom: Spectrum di Kiri, Waterfall di Kanan -->
    <div class="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
      <!-- Kolom Kiri: Spectrum Chart -->
      <div class="w-full min-w-0 flex flex-col">
        <SdrSpectrumChart
          frame={latestFrame}
          waveformColor="#ff9900"
          floor={config.floor}
          range={config.range}
          showMaxHold={config.maxHold}
          centerFreqMhz={config.frequency}
          sampleRateHz={config.rate}
          bins={config.fft}
          modeName={latestFrame?.mode || (driver?.hasSpec ? "SPEC on-chip" : "Burst IQ")}
        />
      </div>

      <!-- Kolom Kanan: Waterfall Chart -->
      <div class="w-full min-w-0 flex flex-col">
        <SdrWaterfallChart
          bind:this={waterfallRef}
          frame={latestFrame}
          floor={config.floor}
          range={config.range}
          isConnected={connectionStatus === "connected" || connectionStatus === "streaming"}
        />
      </div>
    </div>

    <!-- Connection & Hardware Diagnostic Log Terminal Card (Full Width) -->
    <Card className="border-[#1e8bb5]/40 w-full">
      {#snippet title()}
        <div class="flex items-center justify-between w-full font-mono text-xs font-bold text-[#1e8bb5] px-1">
          <div class="flex items-center gap-2">
            <Icon icon="lucide:terminal" width="16" height="16" />
            <span>ESP32 CONNECTION & HARDWARE LOG</span>
          </div>
          <div class="flex items-center gap-3 font-normal text-[11px]">
            <label class="flex items-center gap-1 cursor-pointer text-[#8a9ba3]">
              <input type="checkbox" bind:checked={autoScrollLog} />
              Auto-scroll
            </label>
            <button
              type="button"
              class="text-[#8a9ba3] hover:text-white transition-colors cursor-pointer"
              onclick={handleClearLogs}
            >
              Clear
            </button>
            <span class="text-[#546e7a]">({logs.length} entries)</span>
          </div>
        </div>
      {/snippet}

      <div
        bind:this={logContainer}
        class="bg-[#05080a] p-3 font-mono text-[11px] h-48 overflow-y-auto rounded border border-[#162127] flex flex-col gap-1 select-text scroll-smooth"
      >
        {#if logs.length === 0}
          <div class="text-[#546e7a] italic">
            No connection log messages yet. Click "CONNECT ESP32" or "DEMO SIMULATION" to begin.
          </div>
        {:else}
          {#each logs as log (log.id)}
            <div class="flex items-start gap-2 leading-relaxed">
              <span class="text-[#546e7a] shrink-0 font-medium">[{log.timestamp}]</span>
              {#if log.type === "success"}
                <span class="px-1 py-0.2 rounded text-[10px] bg-[#37c964]/20 text-[#37c964] font-bold shrink-0">
                  OK
                </span>
                <span class="text-[#a5d6a7]">{log.message}</span>
              {:else if log.type === "error"}
                <span class="px-1 py-0.2 rounded text-[10px] bg-red-950 text-red-400 font-bold shrink-0">
                  ERR
                </span>
                <span class="text-red-300 font-medium">{log.message}</span>
              {:else if log.type === "warn"}
                <span class="px-1 py-0.2 rounded text-[10px] bg-amber-950 text-amber-400 font-bold shrink-0">
                  WARN
                </span>
                <span class="text-amber-200">{log.message}</span>
              {:else if log.type === "rx"}
                <span class="px-1 py-0.2 rounded text-[10px] bg-purple-950 text-purple-300 font-bold shrink-0">
                  RX
                </span>
                <span class="text-purple-200">{log.message}</span>
              {:else}
                <span class="px-1 py-0.2 rounded text-[10px] bg-[#1e8bb5]/20 text-[#1e8bb5] font-bold shrink-0">
                  INFO
                </span>
                <span class="text-[#b0bec5]">{log.message}</span>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </Card>
  </div>
</div>
