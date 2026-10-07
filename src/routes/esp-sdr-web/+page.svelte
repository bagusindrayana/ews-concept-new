<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import Card from "$lib/components/Card.svelte";
  import StripeBar from "$lib/components/StripeBar.svelte";
  import HexGrid from "$lib/components/HexGrid.svelte";
  import HexShape from "$lib/components/HexShape.svelte";
  import RangeSlider from "$lib/components/RangeSlider.svelte";
  import SdrSpectrumChart from "$lib/components/SdrSpectrumChart.svelte";
  import SdrWaterfallChart from "$lib/components/SdrWaterfallChart.svelte";
  import {
    EspSdrDriver,
    type CaptureConfig,
    type SpectrumFrame,
    type LogEntry,
    type EspDeviceInfo,
    type EspDeviceStats
  } from "$lib/esp-sdr/radioDriver";
  import Icon from "@iconify/svelte";

  // Connection & Driver State (keep driver instance outside Svelte state tracking)
  let driver: EspSdrDriver | null = null;
  let isSimulating = $state(false);
  let driverIdentity = $state("");
  let hasSpec = $state(false);
  let connectionStatus = $state<"disconnected" | "connecting" | "connected" | "streaming" | "error">("disconnected");
  let isWebSerialSupported = $state(true);
  let latestFrame = $state<SpectrumFrame | null>(null);
  let waterfallRef: { clear: () => void } | null = null;
  let deviceInfo = $state<EspDeviceInfo | null>(null);
  let deviceStats = $state<EspDeviceStats | null>(null);
  let isHardwareModalOpen = $state(false);

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
  let isSettingsOpen = $state(false);

  // Sliders state (matching Home filter RangeSlider)
  let ceilingDbfs = $state(-20);

  $effect(() => {
    if (ceilingDbfs <= config.floor + 10) {
      ceilingDbfs = config.floor + 10;
    }
    config.range = Math.max(10, Math.min(140, ceilingDbfs - config.floor));
  });

  // Grid Kotak-Kotak Persegi Panjang Presets
  const channelPresets = [
    { ch: "CH 1", freq: 2412 },
    { ch: "CH 2", freq: 2417 },
    { ch: "CH 3", freq: 2422 },
    { ch: "CH 4", freq: 2427 },
    { ch: "CH 5", freq: 2432 },
    { ch: "CH 6", freq: 2437 },
    { ch: "CH 7", freq: 2442 },
    { ch: "CH 8", freq: 2447 },
    { ch: "CH 9", freq: 2452 },
    { ch: "CH 10", freq: 2457 },
    { ch: "CH 11", freq: 2462 },
    { ch: "CH 12", freq: 2467 },
    { ch: "CH 13", freq: 2472 },
    { ch: "5.5G", freq: 5500 }
  ];

  const ratePresets = [
    { label: "80M", rate: 80000000 },
    { label: "40M", rate: 40000000 },
    { label: "20M", rate: 20000000 },
    { label: "16M", rate: 16000000 },
    { label: "10M", rate: 10000000 },
    { label: "8M",  rate: 8000000 },
    { label: "4M",  rate: 4000000 }
  ];

  const fftPresets = [
    { label: "256", bins: 256 },
    { label: "512", bins: 512 },
    { label: "1024", bins: 1024 },
    { label: "2048", bins: 2048 },
    { label: "4096", bins: 4096 }
  ];

  const baudPresets = [
    { label: "2.0M", baud: 2000000 },
    { label: "1.0M", baud: 1000000 },
    { label: "921k", baud: 921600 },
    { label: "115k", baud: 115200 }
  ];

  function resetFilters() {
    config.frequency = 2412;
    config.rate = 80000000;
    config.fft = 2048;
    config.gainMode = "HARDWARE";
    config.gain = 40;
    config.traceAvg = 0.3;
    config.floor = -100;
    ceilingDbfs = -20;
    config.range = 80;
    addLog("info", "Filter settings reset to defaults.");
  }

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
      if (driver) {
        driverIdentity = driver.identity || "";
        hasSpec = driver.hasSpec;
      }
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
      isSimulating = false;
      addLog("success", "Device safely disconnected.");
    } catch (err: any) {
      addLog("error", `Disconnect error: ${err.message}`);
    }
  }

  function handleToggleSimulation() {
    if (!driver) return;
    if (driver.isSimulating) {
      driver.stopSimulation();
      isSimulating = false;
      addLog("info", "Simulation stopped.");
    } else {
      addLog("info", "Starting synthetic 2.4 GHz WiFi simulation stream...");
      driver.startSimulation(config);
      isSimulating = true;
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
    if (driver && driver.isConnected && !driver.isStreaming) {
      driver.tune(config.frequency, config.bandwidth).catch((err: any) => {
        addLog("error", `Tune failed (${f} MHz): ${err.message}`);
      });
    }
    addLog("info", `Selected frequency: ${f} MHz`);
  }

  function handleFftChange(bins: number) {
    config.fft = bins;
    // On ESP32 hardware on-chip SPEC mode, 80 MS/s only supports 256 bins!
    // If user selects 1024 or 2048 at 80 MS/s, auto-adjust sample rate to 40 MS/s
    if (driver?.isConnected && !driver?.isSimulating && config.rate === 80000000 && bins > 256) {
      config.rate = 40000000;
      addLog("info", `Sample rate adjusted to 40 MS/s to support FFT ${bins} bins (ESP32 on-chip DSP profile).`);
    }
    addLog("info", `FFT Resolution set to ${bins} Bins`);
  }

  function handleRateChange(rate: number) {
    config.rate = rate;
    // On ESP32 hardware on-chip SPEC mode, 80 MS/s only supports 256 bins!
    if (driver?.isConnected && !driver?.isSimulating && rate === 80000000 && config.fft > 256) {
      config.fft = 256;
      addLog("info", `FFT clamped to 256 Bins for 80 MS/s (ESP32 on-chip DSP profile).`);
    }
    addLog("info", `Sample Rate set to ${rate / 1e6} MS/s`);
  }

  // Update hardware & driver on any configuration parameter change
  $effect(() => {
    const c = {
      frequency: config.frequency,
      rate: config.rate,
      fft: config.fft,
      bandwidth: config.bandwidth,
      gainMode: config.gainMode,
      gain: config.gain,
      maxHold: config.maxHold,
      dcMode: config.dcMode
    };

    untrack(() => {
      if (driver) {
        if (driver.isStreaming || driver.isSimulating) {
          driver.updateConfig(c);
        } else if (driver.isConnected) {
          driver.tune(c.frequency, c.bandwidth).catch((err: any) => {
            addLog("error", `Tune failed (${c.frequency} MHz): ${err.message}`);
          });
        }
      }
    });
  });

  let unhandledRejectionListener: ((event: PromiseRejectionEvent) => void) | null = null;
  let globalErrorListener: ((event: ErrorEvent) => void) | null = null;

  onMount(() => {
    // Intercept uncaught async/promise errors and route them to log container
    unhandledRejectionListener = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason?.message || (typeof reason === "string" ? reason : "Unhandled Promise Rejection");
      addLog("error", `Uncaught async error: ${message}`);
      event.preventDefault(); // Prevents "Uncaught (in promise)" stack trace from dumping in browser console
    };

    globalErrorListener = (event: ErrorEvent) => {
      if (event.message) {
        addLog("error", `System error: ${event.message}`);
      }
    };

    window.addEventListener("unhandledrejection", unhandledRejectionListener);
    window.addEventListener("error", globalErrorListener);

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
      if (driver) {
        driverIdentity = driver.identity || "";
        hasSpec = driver.hasSpec;
        isSimulating = driver.isSimulating;
      }
      if (status === "disconnected") {
        isSimulating = false;
      }
    };

    driver.onDeviceInfo = (info) => {
      deviceInfo = info;
    };

    driver.onStats = (stats) => {
      deviceStats = stats;
    };

    driver.onConfigAdjusted = (adj) => {
      config.rate = adj.rate;
      config.fft = adj.fft;
    };

    if (!isWebSerialSupported) {
      addLog("warn", "WebSerial is NOT supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera.");
    } else {
      addLog("info", "System ready. WebSerial API available. Ready to connect ESP32 SDR or run Demo Simulation.");
    }
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      if (unhandledRejectionListener) {
        window.removeEventListener("unhandledrejection", unhandledRejectionListener);
      }
      if (globalErrorListener) {
        window.removeEventListener("error", globalErrorListener);
      }
    }
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
  <div class="w-full flex flex-wrap items-center justify-center gap-2 mb-3">
    <div class="flex items-center gap-2">
      <a class="ews-btn ews-btn-primary" href="/">HOME</a>
      <a class="ews-btn ews-btn-primary" href="/status-ui">STATION</a>
      <a class="ews-btn ews-btn-primary" href="/status-map">STATION MAP</a>
      <a class="ews-btn ews-btn-primary " href="/magi">MAGI</a>
    </div>

   
  </div>

  <!-- Page Banner Title -->
  <div class="w-full mb-3 text-center p-1 z-10 bordered flex justify-center items-center relative overflow-hidden bg-black min-h-[58px]">
    <div class="w-full overflow-hidden">
      <StripeBar loop={true} duration={25} color="orange"></StripeBar>
    </div>
    <div class="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
      <h1 class="text-lg md:text-xl font-black font-mono tracking-widest text-[#fa0] uppercase bg-black">
        ESP-WebSDR
      </h1>
     
    </div>
  </div>

  <div class="w-full flex flex-col gap-3">
    <!-- LAYOUT 30 / 70: Bagian Kiri (30%), Bagian Kanan (70%) -->
    <div class="w-full flex flex-col lg:flex-row gap-3 items-start">
      <!-- BAGIAN KIRI (30%): RECEIVER INFORMATION, RF CHANNELS & PRESETS, RECEIVER FILTERS & GAIN -->
      <div class="w-full lg:w-[30%] flex flex-col gap-3 shrink-0">
        <!-- 1. RECEIVER INFORMATION (Gambar 1 STATION INFORMATION style) -->
        <Card className="border-[#fa0]/40 flex flex-col">
          {#snippet title()}
            <div class="flex items-center justify-between w-full font-mono font-bold text-[#fa0] px-1">
              <div class="flex items-center gap-2">
                
                <span>RECEIVER INFORMATION</span>
              </div>
              <span class="text-[11px] text-red-500 font-semibold">{connectionStatus.toUpperCase()}</span>
            </div>
          {/snippet}

          <div class="flex flex-col gap-2 p-2">
            <!-- Decal badge + Info table -->
            <div class="w-full flex flex-row gap-2">
              <div class="badge ews-title bordered flex justify-between w-2/5 shrink-0 self-stretch min-h-[100px] bg-black">
                <div class="flex flex-col items-center justify-between p-1 w-full select-none">
                  <div class="text -characters text-2xl md:text-3xl font-black tracking-wider text-orange">ESP</div>
                  <div class="text text-2xl md:text-3xl font-black text-orange">
                    {deviceInfo?.connected ? (deviceInfo.chipFamily === 'ESP32' ? '32' : (deviceInfo.chipFamily || 'SDR')) : 'SDR'}
                  </div>
                  <!-- <div class="text-[8px] font-mono uppercase tracking-widest px-1 py-0.5 rounded border {deviceInfo?.connected ? (deviceInfo.simulated ? 'border-[#fa0]/40 text-[#fa0] bg-[#fa0]/10' : 'border-[#37c964]/40 text-[#37c964] bg-[#37c964]/10') : 'border-[#22333d] text-neutral-500'}">
                    {deviceInfo?.connected ? (deviceInfo.simulated ? 'DEMO' : (deviceInfo.chipFamily || 'ONLINE')) : 'OFFLINE'}
                  </div> -->
                </div>
                <div class="decal h-full">
                  <StripeBar className="w-full h-full" size={"100%"} orientation="vertical" color="orange" loop={false} />
                </div>
              </div>

              <div class="bordered p-1.5 w-3/5 text-[9px] font-mono leading-tight flex flex-col justify-between overflow-x-hidden select-text">
                <table class="w-full">
                  <tbody>
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">CHIP</td>
                      <td class="text-right py-[1.5px] font-bold truncate max-w-[125px]" title={deviceInfo?.chipModel || driverIdentity || "ESP32-SDR"}>
                        {#if deviceInfo?.connected}
                          <span class="{deviceInfo.simulated ? 'text-[#fa0]' : 'text-red'} flex items-center justify-end gap-1">
                            {deviceInfo.chipModel}
                          </span>
                        {:else}
                          <span class="text-neutral-500">OFFLINE</span>
                        {/if}
                      </td>
                    </tr>
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">ARCH</td>
                      <td class="text-right py-[1.5px] text-white font-semibold truncate max-w-[125px]" title={deviceInfo?.chipArch || "Espressif 32-bit SoC"}>
                        {#if deviceInfo?.connected}
                          <span class="{deviceInfo.simulated ? 'text-[#fa0]' : 'text-red'}">{deviceInfo.chipArch.split('@')[0].replace('Xtensa®', 'Xtensa').replace('32-bit Single-Core', 'Single-Core').replace('32-bit Dual-Band', 'Dual-Band').trim()}</span>
                          
                        {:else}
                          <span class="text-neutral-500">OFFLINE</span>
                        {/if}
                      </td>
                    </tr>
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">FIRM</td>
                      <td class="text-right py-[1.5px] text-[#fa0] font-bold truncate max-w-[125px]" title={deviceInfo?.rawIdentity || "ESP-SDR v6"}>
                        {#if deviceInfo?.connected}
                          {deviceInfo.rawIdentity || deviceInfo.firmware}
                        {:else}
                          <span class="text-neutral-500">OFFLINE</span>
                        {/if}
                      </td>
                    </tr>
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">USB/BRIDGE</td>
                      <td class="text-right py-[1.5px] text-[#fa0] font-bold truncate max-w-[125px]" title="{deviceInfo?.usbVendor || 'USB'} · {deviceInfo?.usbProduct || 'Serial'}">
                        {#if deviceInfo?.connected}
                          {deviceInfo.usbProduct.split(' ')[0]} ({deviceInfo.usbVidHex.slice(2)}:{deviceInfo.usbPidHex.slice(2)})
                        {:else}
                          <span class="text-neutral-500">AUTO-DETECT</span>
                        {/if}
                      </td>
                    </tr>
                   <!-- <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">LINK/BAUD</td>
                      <td class="text-right py-[1.5px] text-[#fa0] font-bold">
                        {deviceInfo?.transport || 'UART'} {baudRate / 1e6} MBaud
                      </td>
                    </tr>
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">BUFFER</td>
                      <td class="text-right py-[1.5px] text-neutral-300 font-bold">
                        {deviceInfo?.maxSamples ? `${deviceInfo.maxSamples.toLocaleString()} spl` : '16,380 spl'}
                      </td>
                    </tr> -->
                    <!-- <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">RF RANGE</td>
                      <td class="text-right py-[1.5px] text-neutral-300 font-bold">
                        {deviceInfo?.tuneRange ? `${deviceInfo.tuneRange[0]}-${deviceInfo.tuneRange[1]} MHz` : '2400-2484 MHz'}
                      </td>
                    </tr> -->
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">CAPS</td>
                      <td class="text-right py-[1.5px] font-bold flex items-center justify-end gap-1">
                        {#if deviceInfo?.hasSpec}
                          <span class="text-[#37c964]">SPEC</span>
                        {/if}
                        {#if deviceInfo?.hasSpecN}
                          <span class="text-[#1e8bb5]">SPECN</span>
                        {/if}
                        {#if deviceInfo?.hasGain}
                          <span class="text-[#fa0]">GAIN</span>
                        {/if}
                        {#if !deviceInfo?.connected}
                          <span class="text-neutral-500">SPEC GAIN</span>
                        {/if}
                      </td>
                    </tr>
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">FREQ/SPAN</td>
                      <td class="text-right py-[1.5px] text-[#fa0] font-bold">
                        {config.frequency}M / {config.rate / 1e6}M
                      </td>
                    </tr>
                    <!-- <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">CPU CORES</td>
                      <td class="text-right py-[1.5px] font-mono font-bold">
                        {#if connectionStatus === "streaming"}
                          <span class="text-white">C0: <span class="text-[#37c964]">{deviceStats?.core0Load ?? 0}%</span> · C1: <span class="text-[#fa0]">{deviceStats?.core1Load ?? 0}%</span></span>
                        {:else if deviceInfo?.connected}
                          <span class="text-neutral-400">STANDBY</span>
                        {:else}
                          <span class="text-neutral-500">OFFLINE</span>
                        {/if}
                      </td>
                    </tr> -->
                    <!-- <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">FREE HEAP</td>
                      <td class="text-right py-[1.5px] font-bold">
                        {#if connectionStatus === "streaming" && deviceStats?.heapFree}
                          <span class="text-[#37c964]">{Math.round(deviceStats.heapFree / 1024)} KB</span>
                        {:else if deviceInfo?.connected}
                          <span class="text-neutral-400">~280 KB</span>
                        {:else}
                          <span class="text-neutral-500">---</span>
                        {/if}
                      </td>
                    </tr> -->
                    <!-- <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold">FFT SPEED</td>
                      <td class="text-right py-[1.5px] font-bold">
                        {#if connectionStatus === "streaming"}
                          <span class="text-[#fa0]">{deviceStats?.fftsPerSec || (latestFrame?.fps ? latestFrame.fps * 8 : 0)}/s ({latestFrame?.fps || 0} fps)</span>
                        {:else if deviceInfo?.connected}
                          <span class="text-neutral-400">IDLE</span>
                        {:else}
                          <span class="text-neutral-500">---</span>
                        {/if}
                      </td>
                    </tr> -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Primary Banner Bar -->
            <!-- <div class="p-1.5 bg-primary w-full text-center text-black font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5">
              <Icon icon="lucide:cpu" width="14" height="14" />
              <span>{deviceInfo?.chipModel ? `${deviceInfo.chipModel} SDR RF TRANSCEIVER` : "ESPRESSIF ESP-SDR RF TRANSCEIVER"}</span>
              {#if deviceInfo?.connected}
                <span class="inline-block w-2 h-2 rounded-full {deviceInfo.simulated ? 'bg-amber-950' : 'bg-green-950'} animate-ping"></span>
              {/if}
            </div> -->

            <!-- Inspect Full Registers Button -->
            <button
              type="button"
              class="p-1.5 ews-btn ews-btn-primary w-full text-center text-black font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5"
              disabled={!deviceInfo?.connected}
              onclick={() => (isHardwareModalOpen = true)}
            >
              {#if deviceInfo?.connected}
              <span>[VIEW FULL HARDWARE REGISTERS & LOGS]</span>
              {:else}
              <span>OFFLINE</span>
              {/if}
            </button>
          </div>

          {#snippet footer()}
            <!-- Action Buttons (Gambar 1 style: CONNECT, DEMO, CLEAR) -->
            <div class="grid grid-cols-3 gap-1.5 pt-1">
              {#if connectionStatus === "disconnected" || connectionStatus === "error"}
                <button
                  type="button"
                  class="ews-btn ews-btn-primary flex items-center justify-center gap-1 text-xs cursor-pointer"
                  onclick={handleConnect}
                  disabled={!isWebSerialSupported}
                >
                  CONNECT
                </button>
              {:else}
                <button
                  type="button"
                  class="ews-btn ews-btn-danger flex items-center justify-center gap-1 text-xs cursor-pointer"
                  onclick={handleDisconnect}
                >
                  DISCONNECT
                </button>
              {/if}

              <button
                type="button"
                class="ews-btn {isSimulating ? 'ews-btn-alert' : 'ews-btn-outline'} flex items-center justify-center gap-1 text-xs cursor-pointer"
                onclick={handleToggleSimulation}
              >
                {isSimulating ? "STOP" : "DEMO"}
              </button>

              <button
                type="button"
                class="ews-btn ews-btn-outline flex items-center justify-center gap-1 text-xs cursor-pointer"
                onclick={handleClearCharts}
              >
                CLEAR
              </button>
            </div>
          {/snippet}
        </Card>

        <!-- 2. RF CHANNELS & PRESETS (HexGrid Channels + Taller Orange/Red Rate & FFT Boxes) -->
        <Card className="border-[#fa0]/40 flex flex-col">
          {#snippet title()}
            <div class="flex items-center justify-between w-full font-mono font-bold text-[#fa0] px-1">
              <div class="flex items-center gap-2">
              
                <span>CHANNELS</span>
              </div>
              <span class="text-[11px] text-[#ff3b30] font-bold">{config.frequency} MHz</span>
            </div>
          {/snippet}

          <div class="flex flex-col gap-2.5 p-2">
            <!-- WiFi Channels HexGrid (Default Orange, Selected Red) -->
            <div class="flex flex-col gap-1">
             
              <div class="w-full py-1">
                <HexGrid
                  className="w-full"
                  variant="flat"
                  align="center"
                >
                  {#each channelPresets as preset, idx (preset.freq)}
                    <div
                      class="ews-hex-hive flat"
                      
                    >
                      <HexShape
                        clipContent={true}
                        color={config.frequency === preset.freq ? "red" : "orange"}
                        className={config.frequency === preset.freq ? "blink blink-fast drop-shadow-[0_0_8px_rgba(255,59,48,0.8)]" : ""}
                      >
                        <button
                          type="button"
                          class="w-full h-full cursor-pointer flex flex-col justify-center items-center {config.frequency === preset.freq ? 'text-white font-black' : 'text-black font-bold'}"
                          onclick={() => handlePreset(preset.freq)}
                        >
                          <div class="text-md leading-tight font-extrabold">{preset.ch}</div>
                          <div class="text-sm font-mono leading-none mt-0.5 opacity-80">{preset.freq}</div>
                        </button>
                      </HexShape>
                    </div>
                  {/each}
                </HexGrid>
              </div>
            </div>

            
          </div>

          {#snippet footer()}
            <div class="flex justify-between items-center w-full text-[10px] font-mono text-orange px-1">
              <span>BAUD RATE:</span>
              <div class="flex gap-1">
                {#each baudPresets as b}
                  <button
                    type="button"
                    class="px-1.5 py-0.5 rounded border text-[9px] transition-all cursor-pointer {baudRate === b.baud ? 'bg-[#fa0] text-black border-[#fa0] font-bold' : 'bg-[#0d1418] border-[#22333d] text-orange'}"
                    disabled={connectionStatus === "connected" || connectionStatus === "streaming"}
                    onclick={() => (baudRate = b.baud)}
                  >
                    {b.label}
                  </button>
                {/each}
              </div>
            </div>
          {/snippet}
        </Card>

        <!-- 3. RECEIVER FILTERS & GAIN (Button to Open Modal) -->
        <Card className="border-[#fa0]/40 flex flex-col">
          {#snippet title()}
            <div class="flex items-center justify-between w-full font-mono font-bold text-[#fa0] px-1">
              <div class="flex items-center gap-2">
                <span>FILTERS & SETTINGS</span>
              </div>
             
            </div>
          {/snippet}

          <div class="flex flex-col gap-2.5 p-2 font-mono">
            <!-- Active Settings Quick Display -->
            <div class="grid grid-cols-2 gap-1.5 text-xs">
              <div class="p-1.5 bg-[#0b1013] border border-[#22333d] rounded">
                <div class="text-[10px] text-orange">FFT BINS</div>
                <div class="text-[#fa0] font-bold text-[11px]">{config.fft} Bins</div>
              </div>
              <div class="p-1.5 bg-[#0b1013] border border-[#22333d] rounded">
                <div class="text-[10px] text-orange">SAMPLE RATE</div>
                <div class="text-[#fa0] font-bold text-[11px]">{config.rate / 1e6} MS/s</div>
              </div>
              <div class="p-1.5 bg-[#0b1013] border border-[#22333d] rounded">
                <div class="text-[10px] text-orange">dBFS RANGE</div>
                <div class="text-[#fa0] font-bold text-[11px]">{config.floor} → {ceilingDbfs} dBFS</div>
              </div>
              <div class="p-1.5 bg-[#0b1013] border border-[#22333d] rounded">
                <div class="text-[10px] text-orange">RX GAIN</div>
                <div class="text-[#fa0] font-bold text-[11px]">{config.gainMode === 'HARDWARE' ? 'AGC (Auto)' : `${config.gain} dB`}</div>
              </div>
              <div class="p-1.5 bg-[#0b1013] border border-[#22333d] rounded">
                <div class="text-[10px] text-orange">SMOOTHING</div>
                <div class="text-[#fa0] font-bold text-[11px]">{Math.round(config.traceAvg * 100)}%</div>
              </div>
              <div class="p-1.5 bg-[#0b1013] border border-[#22333d] rounded">
                <div class="text-[10px] text-orange">FREQUENCY</div>
                <div class="text-[#fa0] font-bold text-[11px]">{config.frequency} MHz</div>
              </div>
            </div>

            <!-- Tombol yang Membuka Modal (Sesuai Permintaan) -->
            <button
              type="button"
              class="ews-btn ews-btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs md:text-sm font-bold tracking-wider cursor-pointer"
              onclick={() => (isSettingsOpen = true)}
            >
              OPEN FILTERS & SETTINGS
            </button>
          </div>

          <!-- {#snippet footer()}
            <div class="flex justify-end w-full">
              <button
                type="button"
                class="text-[10px] text-[#fa0] hover:text-white uppercase font-mono tracking-wider underline cursor-pointer"
                onclick={resetFilters}
              >
                RESET DEFAULT FILTERS
              </button>
            </div>
          {/snippet} -->
        </Card>
      </div>

      <!-- BAGIAN KANAN (70%): Spectrum di Atas, Waterfall di Bawah -->
      <div class="w-full lg:w-[70%] flex flex-col gap-2.5 min-w-0">
        <!-- 1. Spectrum Waveform Monitor (Di Atas) -->
        <SdrSpectrumChart
          frame={latestFrame}
          waveformColor="#ff9900"
          floor={config.floor}
          range={config.range}
          showMaxHold={config.maxHold}
          centerFreqMhz={config.frequency}
          sampleRateHz={config.rate}
          bins={config.fft}
          modeName={latestFrame?.mode || (hasSpec ? "SPEC on-chip" : "Burst IQ")}
          deviceInfo={deviceInfo}
          deviceStats={deviceStats}
        />

        <!-- 2. Waterfall Spectrogram Monitor (Di Bawah) -->
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
            <span>ESP32 CONNECTION & HARDWARE LOG</span>
          </div>
          <div class="flex items-center gap-3 font-normal text-[11px]">
            <label class="flex items-center gap-1 cursor-pointer text-orange">
              <input type="checkbox" bind:checked={autoScrollLog} />
              Auto-scroll
            </label>
            <button
              type="button"
              class="text-orange hover:text-white transition-colors cursor-pointer"
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

{#if isSettingsOpen}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 select-none">
    <Card className="w-full max-w-2xl shadow-2xl border-[#fa0]">
      {#snippet title()}
        <div class="flex justify-between items-center w-full px-1">
          <div class="flex items-center gap-2">
            <Icon icon="lucide:sliders-horizontal" width="18" height="18" class="text-[#fa0]" />
            <p class="text-xl ews-title text-[#fa0]">SETTING RECEIVER & RF FILTERS</p>
          </div>
          <button
            class="text-[#fa0] hover:text-[#ff3b30] font-bold text-2xl px-2 cursor-pointer transition-colors"
            onclick={() => (isSettingsOpen = false)}
          >&times;</button>
        </div>
      {/snippet}

      

      <div class="flex flex-col gap-4 w-full p-3 font-mono text-xs">
        <!-- Sample Rate / Capture Span (Kotak Lebih Tinggi, Orange Default, Red Selected) -->
        <div class="flex flex-col gap-1.5 pt-2 border-t border-[#1c2930]">
          <div class="flex justify-between items-center text-[10px] font-mono text-orange uppercase px-1">
            <p class="text-[#fa0] font-bold uppercase tracking-widest text-xs">Sample Rate / Capture Span:</p>
            <span class="text-[#fa0] font-bold">{config.rate / 1e6} MS/s</span>
          </div>
          <div class="grid grid-cols-4 md:grid-cols-7 gap-1.5">
            {#each ratePresets as r}
              <button
                type="button"
                class="h-8 flex flex-col items-center justify-center font-mono text-[10px] transition-all cursor-pointer {config.rate === r.rate
                  ? 'bg-red text-white'
                  : 'bg-orange text-black hover:bg-[#fa0]/30 font-bold'}"
                onclick={() => handleRateChange(r.rate)}
              >
                <span class="leading-tight font-bold">{r.label}</span>
                <span class="text-[8px] opacity-80">{r.rate / 1e6}M</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- FFT Resolution & Hold (Kotak Lebih Tinggi, Orange Default, Red Selected) -->
        <div class="flex flex-col gap-1.5 pt-2 border-t border-[#1c2930]">
          <div class="flex justify-between items-center text-[10px] font-mono text-orange uppercase px-1">
            <p class="text-[#fa0] font-bold uppercase tracking-widest text-xs">FFT Resolution & Hold</p>
            <span class="text-[#fa0] font-bold">{config.fft} Bins</span>
          </div>
          <div class="grid grid-cols-3 md:grid-cols-6 gap-1.5">
            {#each fftPresets as f}
              <button
                type="button"
                class="h-8 flex flex-col items-center justify-center font-mono text-[10px] transition-all cursor-pointer {config.fft === f.bins
                  ? 'bg-red text-white'
                  : 'bg-orange text-black hover:bg-[#fa0]/30 font-bold'}"
                onclick={() => handleFftChange(f.bins)}
              >
                <span class="leading-tight font-bold">{f.label}</span>
                <span class="text-[8px] opacity-80">Bins</span>
              </button>
            {/each}
            <button
              type="button"
              class="h-8 flex flex-col items-center justify-center font-mono text-[10px] transition-all cursor-pointer {config.maxHold
                ? 'bg-red text-white'
                : 'bg-orange text-black hover:bg-[#fa0]/30 font-bold'}"
              onclick={() => {
                config.maxHold = !config.maxHold;
                addLog("info", `Max Hold: ${config.maxHold ? 'ENABLED' : 'DISABLED'}`);
              }}
            >
              <span class="leading-tight font-bold">MAX</span>
              <span class="text-[8px] opacity-80">{config.maxHold ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
        <!-- Section 1: Presets & Grid -->
        <!-- <div class="flex flex-col gap-2">
          <p class="text-[#fa0] font-bold uppercase tracking-widest text-xs">WiFi Channels & Frequency Band (Grid Select):</p>
          <div class="grid grid-cols-7 gap-1.5">
            {#each channelPresets as preset}
              <button
                type="button"
                class="py-1.5 px-1 rounded border font-mono text-center transition-all cursor-pointer {config.frequency === preset.freq ? 'bg-[#fa0] text-black border-[#fa0] font-bold shadow-[0_0_8px_#fa0]' : 'bg-[#0a0f12] border-[#22333d] text-[#b0bec5] hover:border-[#fa0]/70'}"
                onclick={() => handlePreset(preset.freq)}
              >
                <div class="font-bold">{preset.ch}</div>
                <div class="text-[9px] opacity-75">{preset.freq}M</div>
              </button>
            {/each}
          </div>
        </div> -->

        <hr class="border-[#22333d]" />

        <!-- Section 2: Sliders (Home Filter Style) -->
        <div class="flex flex-col gap-3">
          <p class="text-[#fa0] font-bold uppercase tracking-widest text-xs">DSP & Display Filters:</p>

          <div class="flex flex-col gap-1">
            <label class="font-bold flex justify-between uppercase" style="color:var(--orange)">
              <span>dBFS Dynamic Range</span>
              <span style="color:var(--red)">{config.floor} dBFS → {ceilingDbfs} dBFS</span>
            </label>
            <RangeSlider
              min={-140}
              max={0}
              step={5}
              bind:low={config.floor}
              bind:high={ceilingDbfs}
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-bold flex justify-between uppercase" style="color:var(--orange)">
              <span>RX Hardware Gain</span>
              <span style="color:var(--red)">{config.gainMode === 'HARDWARE' ? 'AGC (Auto)' : `${config.gain} dB`}</span>
            </label>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              bind:value={config.gain}
              disabled={config.gainMode === 'HARDWARE'}
              class="w-full accent-[#fa0] cursor-pointer {config.gainMode === 'HARDWARE' ? 'opacity-30' : ''}"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-bold flex justify-between uppercase" style="color:var(--orange)">
              <span>Trace Smoothing</span>
              <span style="color:var(--red)">{Math.round(config.traceAvg * 100)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="0.95"
              step="0.05"
              bind:value={config.traceAvg}
              class="w-full accent-[#fa0] cursor-pointer"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-bold flex justify-between uppercase" style="color:var(--orange)">
              <span>Center Frequency Fine-Tune</span>
              <span style="color:var(--red)">{config.frequency} MHz</span>
            </label>
            <input
              type="range"
              min="2400"
              max="2484"
              step="1"
              bind:value={config.frequency}
              class="w-full accent-[#fa0] cursor-pointer"
            />
          </div>
        </div>

        <hr class="border-[#22333d]" />

        <!-- Actions -->
        <div class="flex items-center justify-between pt-1">
          <button
            type="button"
            class="ews-btn ews-btn-outline text-xs cursor-pointer"
            onclick={resetFilters}
          >
            RESET DEFAULT
          </button>
          <button
            type="button"
            class="ews-btn ews-btn-primary text-xs cursor-pointer"
            onclick={() => (isSettingsOpen = false)}
          >
            APPLY & CLOSE
          </button>
        </div>
      </div>
    </Card>
  </div>
{/if}

{#if isHardwareModalOpen}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 select-none">
    <Card className="w-full max-w-2xl shadow-2xl border-[#fa0] max-h-[90vh] flex flex-col">
      {#snippet title()}
        <div class="flex justify-between items-center w-full px-1">
          <div class="flex items-center gap-2">
            <Icon icon="lucide:cpu" width="18" height="18" class="text-[#fa0]" />
            <p class="text-base md:text-lg ews-title text-[#fa0]">ESP32 HARDWARE REGISTERS & DEVICE SPECIFICATIONS</p>
          </div>
          <button
            class="text-[#fa0] hover:text-[#ff3b30] font-bold text-2xl px-2 cursor-pointer transition-colors"
            onclick={() => (isHardwareModalOpen = false)}
          >&times;</button>
        </div>
      {/snippet}

      <div class="flex flex-col gap-3.5 w-full p-3 font-mono text-xs overflow-y-auto custom-scrollbar">
        <!-- 1. Silicon Architecture & SoC Specs -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5 text-orange font-bold text-xs uppercase tracking-wider">
            <Icon icon="lucide:cpu" width="14" height="14" />
            <span>SoC Architecture & Firmware</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-1.5 bg-[#080d10] p-2.5 rounded border border-[#1c2930]">
            <div>
              <span class="text-[#546e7a] block text-[10px]">CHIP MODEL:</span>
              <span class="text-white font-bold">{deviceInfo?.chipModel || "ESP32"}</span>
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]">CHIP ARCHITECTURE:</span>
              <span class="text-white font-bold">{deviceInfo?.chipArch || "Espressif 32-bit SoC"}</span>
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]">FIRMWARE IDENTITY (INFO):</span>
              <span class="text-[#fa0] font-bold">{deviceInfo?.rawIdentity || driverIdentity || "ESP32SDR"}</span>
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]">PROTOCOL VERSION & BUFFER:</span>
              <span class="text-[#37c964] font-bold">
                {deviceInfo?.firmware || "ESP-SDR v6"} · Max {deviceInfo?.maxSamples.toLocaleString() || "16,380"} Samples
              </span>
            </div>
          </div>
        </div>

        <!-- 2. USB Interface & WebSerial Link -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5 text-orange font-bold text-xs uppercase tracking-wider">
            <Icon icon="lucide:usb" width="14" height="14" />
            <span>USB Controller & Serial Port</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-1.5 bg-[#080d10] p-2.5 rounded border border-[#1c2930]">
            <div>
              <span class="text-[#546e7a] block text-[10px]">USB VENDOR:</span>
              <span class="text-white font-bold">{deviceInfo?.usbVendor || "Generic USB"}</span>
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]">USB PRODUCT / CONTROLLER:</span>
              <span class="text-[#fa0] font-bold">{deviceInfo?.usbProduct || "Serial Port"}</span>
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]">HARDWARE USB VID : PID:</span>
              <span class="text-[#37c964] font-bold">{deviceInfo?.usbVidHex || "N/A"} : {deviceInfo?.usbPidHex || "N/A"}</span>
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]">SERIAL LINK & TRANSPORT:</span>
              <span class="text-[#1e8bb5] font-bold">
                {deviceInfo?.transport || "UART"} @ {baudRate / 1e6} MBaud (131,072 Byte Buffer)
              </span>
            </div>
          </div>
        </div>

        <!-- 3. RF Frontend & Capabilities -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5 text-orange font-bold text-xs uppercase tracking-wider">
            <Icon icon="lucide:radio" width="14" height="14" />
            <span>RF Frontend Capabilities</span>
          </div>
          <div class="bg-[#080d10] p-2.5 rounded border border-[#1c2930] flex flex-col gap-2">
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <span class="text-[#546e7a] block text-[10px]">TUNING RANGE:</span>
                <span class="text-white font-bold">
                  {deviceInfo?.tuneRange ? `${deviceInfo.tuneRange[0]} - ${deviceInfo.tuneRange[1]} MHz` : "2400 - 2484 MHz"}
                </span>
              </div>
              <div>
                <span class="text-[#546e7a] block text-[10px]">ON-CHIP HW FFT (SPEC):</span>
                <span class="{deviceInfo?.hasSpec ? 'text-[#37c964]' : 'text-neutral-500'} font-bold">
                  {deviceInfo?.hasSpec ? 'SUPPORTED' : 'NOT AVAILABLE'}
                </span>
              </div>
              <div>
                <span class="text-[#546e7a] block text-[10px]">VARIABLE FFT (SPECN):</span>
                <span class="{deviceInfo?.hasSpecN ? 'text-[#37c964]' : 'text-neutral-500'} font-bold">
                  {deviceInfo?.hasSpecN ? 'SUPPORTED' : 'FIXED BINS'}
                </span>
              </div>
              <div>
                <span class="text-[#546e7a] block text-[10px]">GAIN CONTROL (GAIN):</span>
                <span class="{deviceInfo?.hasGain ? 'text-[#37c964]' : 'text-neutral-500'} font-bold">
                  {deviceInfo?.hasGain ? 'HARDWARE AGC + MANUAL' : 'AUTO AGC'}
                </span>
              </div>
              <div>
                <span class="text-[#546e7a] block text-[10px]">ACTIVE RF CENTER:</span>
                <span class="text-[#fa0] font-bold">{config.frequency} MHz</span>
              </div>
              <div>
                <span class="text-[#546e7a] block text-[10px]">ACTIVE SPAN / RATE:</span>
                <span class="text-[#fa0] font-bold">{config.rate / 1e6} MS/s</span>
              </div>
            </div>

            <!-- Full Capability Tokens -->
            <div class="pt-1.5 border-t border-[#162127] flex flex-wrap items-center gap-1.5">
              <span class="text-[#546e7a] text-[10px]">REPORTED CAPS:</span>
              {#if deviceInfo?.caps && deviceInfo.caps.length > 0}
                {#each deviceInfo.caps as cap}
                  <span class="px-1.5 py-0.5 rounded text-[9.5px] bg-[#162127] border border-[#23353e] text-[#fa0] font-bold">
                    {cap}
                  </span>
                {/each}
              {:else}
                <span class="text-[#546e7a] text-[10px]">SPEC SPECN GAIN UARTBAUD</span>
              {/if}
            </div>
          </div>
        </div>

        <!-- 4. Real-time Telemetry & Performance -->
        {#if connectionStatus === "streaming"}
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-1.5 text-orange font-bold text-xs uppercase tracking-wider">
              <Icon icon="lucide:activity" width="14" height="14" />
              <span>Real-Time On-Chip Telemetry & Diagnostics</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-1.5 bg-[#080d10] p-2.5 rounded border border-[#1c2930]">
              <div class="bg-[#0e161b] p-1.5 rounded border border-[#1b2b34]">
                <span class="text-[#546e7a] block text-[9.5px]">CPU CORE 0 LOAD</span>
                <span class="text-[#fa0] font-bold text-sm">{deviceStats?.core0Load ?? 0}%</span>
              </div>
              <div class="bg-[#0e161b] p-1.5 rounded border border-[#1b2b34]">
                <span class="text-[#546e7a] block text-[9.5px]">CPU CORE 1 LOAD</span>
                <span class="text-[#fa0] font-bold text-sm">{deviceStats?.core1Load ?? 0}%</span>
              </div>
              <div class="bg-[#0e161b] p-1.5 rounded border border-[#1b2b34]">
                <span class="text-[#546e7a] block text-[9.5px]">FREE RAM HEAP</span>
                <span class="text-[#37c964] font-bold text-sm">
                  {deviceStats?.heapFree ? `${Math.round(deviceStats.heapFree / 1024)} KB` : "284 KB"}
                </span>
              </div>
              <div class="bg-[#0e161b] p-1.5 rounded border border-[#1b2b34]">
                <span class="text-[#546e7a] block text-[9.5px]">ON-CHIP FFT RATE</span>
                <span class="text-[#1e8bb5] font-bold text-sm">
                  {deviceStats?.fftsPerSec ? `${deviceStats.fftsPerSec} FFT/s` : `${(latestFrame?.fps || 40) * 8} FFT/s`}
                </span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex items-center justify-end pt-2 border-t border-[#1c2930]">
          <button
            type="button"
            class="ews-btn ews-btn-primary text-xs cursor-pointer px-4 py-1.5 font-bold"
            onclick={() => (isHardwareModalOpen = false)}
          >
            CLOSE INSPECTOR
          </button>
        </div>
      </div>
    </Card>
  </div>
{/if}
