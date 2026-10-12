<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import Card from "$lib/components/Card.svelte";
  import StripeBar from "$lib/components/StripeBar.svelte";
  import HexGrid from "$lib/components/HexGrid.svelte";
  import HexShape from "$lib/components/HexShape.svelte";
  import RangeSlider from "$lib/components/RangeSlider.svelte";
  import SdrSpectrumChart from "$lib/components/SdrSpectrumChart.svelte";
  import SdrWaterfallChart from "$lib/components/SdrWaterfallChart.svelte";
  import SdrSegmentedBarChart from "$lib/components/SdrSegmentedBarChart.svelte";
  import SdrPolygraphRecorder from "$lib/components/SdrPolygraphRecorder.svelte";
  import {
    EspSdrDriver,
    SerialConnection,
    type CaptureConfig,
    type SpectrumFrame,
    type LogEntry,
    type EspDeviceInfo,
    type EspDeviceStats,
  } from "$lib/esp-sdr/radioDriver";
  import Icon from "@iconify/svelte";

  // Connection & Driver State (keep driver instance outside Svelte state tracking)
  let driver: EspSdrDriver | null = null;
  let isSimulating = $state(false);
  let driverIdentity = $state("");
  let hasSpec = $state(false);
  let connectionStatus = $state<
    "disconnected" | "connecting" | "connected" | "streaming" | "error"
  >("disconnected");
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
    range: 80,
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
    { ch: "5.5G", freq: 5500 },
  ];

  const ratePresets = [
    { label: "80M", rate: 80000000 },
    { label: "40M", rate: 40000000 },
    { label: "20M", rate: 20000000 },
    { label: "16M", rate: 16000000 },
    { label: "10M", rate: 10000000 },
    { label: "8M", rate: 8000000 },
    { label: "4M", rate: 4000000 },
  ];

  const fftPresets = [
    { label: "256", bins: 256 },
    { label: "512", bins: 512 },
    { label: "1024", bins: 1024 },
    { label: "2048", bins: 2048 },
    { label: "4096", bins: 4096 },
  ];

  const baudPresets = [
    { label: "2.0M", baud: 2000000 },
    { label: "1.0M", baud: 1000000 },
    { label: "921k", baud: 921600 },
    { label: "115k", baud: 115200 },
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
      message,
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
      const mode =
        SerialConnection.defaultTransport() === "webusb"
          ? "WebUSB"
          : "WebSerial";
      addLog(
        "info",
        `Initiating ${mode} connection at ${baudRate / 1e6} MBaud...`,
      );
      await driver.connect(baudRate);
      if (driver) {
        driverIdentity = driver.identity || "";
        hasSpec = driver.hasSpec;
      }
      if (driver.isConnected) {
        addLog(
          "success",
          "Connection handshake completed! Starting RF spectrum stream...",
        );
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
    if (
      driver?.isConnected &&
      !driver?.isSimulating &&
      config.rate === 80000000 &&
      bins > 256
    ) {
      config.rate = 40000000;
      addLog(
        "info",
        `Sample rate adjusted to 40 MS/s to support FFT ${bins} bins (ESP32 on-chip DSP profile).`,
      );
    }
    addLog("info", `FFT Resolution set to ${bins} Bins`);
  }

  function handleRateChange(rate: number) {
    config.rate = rate;
    // On ESP32 hardware on-chip SPEC mode, 80 MS/s only supports 256 bins!
    if (
      driver?.isConnected &&
      !driver?.isSimulating &&
      rate === 80000000 &&
      config.fft > 256
    ) {
      config.fft = 256;
      addLog(
        "info",
        `FFT clamped to 256 Bins for 80 MS/s (ESP32 on-chip DSP profile).`,
      );
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
      dcMode: config.dcMode,
    };

    untrack(() => {
      if (driver) {
        if (driver.isStreaming || driver.isSimulating) {
          driver.updateConfig(c);
        } else if (driver.isConnected) {
          driver.tune(c.frequency, c.bandwidth).catch((err: any) => {
            addLog("error", `Tune failed (${c.frequency} MHz): ${err.message}`);
          });
          if (driver.hasGain) {
            driver.setGain(c.gainMode, c.gain).catch((err: any) => {
              addLog("error", `Gain update failed: ${err.message}`);
            });
          }
        }
      }
    });
  });

  let unhandledRejectionListener:
    | ((event: PromiseRejectionEvent) => void)
    | null = null;
  let globalErrorListener: ((event: ErrorEvent) => void) | null = null;

  onMount(() => {
    // Intercept uncaught async/promise errors and route them to log container
    unhandledRejectionListener = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason?.message ||
        (typeof reason === "string" ? reason : "Unhandled Promise Rejection");
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

    let lastMobileFrameTime = 0;
    driver.onFrame = (frame) => {
      // Throttle Svelte reactivity state assignment on mobile to ~30 FPS (33ms) to prevent main thread starvation
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        const now = performance.now();
        if (now - lastMobileFrameTime < 33) return;
        lastMobileFrameTime = now;
      }
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
      addLog(
        "warn",
        "Neither WebSerial nor WebUSB is supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera over HTTPS/localhost.",
      );
    } else {
      const mode =
        SerialConnection.defaultTransport() === "webusb"
          ? "WebUSB (Mobile Mode)"
          : "WebSerial";
      addLog(
        "info",
        `System ready. ${mode} interface available. Ready to connect ESP32 SDR or run Demo Simulation.`,
      );
    }
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      if (unhandledRejectionListener) {
        window.removeEventListener(
          "unhandledrejection",
          unhandledRejectionListener,
        );
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

<div
  class="min-h-screen bg-black text-[#e2e8eb] py-3 px-2 md:px-4 lg:px-6 flex flex-col items-center w-full"
>
  <!-- Top Navigation Header -->
  <div class="w-full flex flex-wrap items-center justify-center gap-2 mb-3">
    <div class="flex items-center gap-2">
      <a class="ews-btn ews-btn-primary" href="/">HOME</a>
      <a class="ews-btn ews-btn-primary" href="/status-ui">STATION</a>
      <a class="ews-btn ews-btn-primary" href="/status-map">STATION MAP</a>
      <a class="ews-btn ews-btn-primary" href="/magi">MAGI</a>
    </div>
  </div>

  <!-- Page Banner Title -->
  <div
    class="w-full mb-3 text-center p-1 z-10 bordered flex justify-center items-center relative overflow-hidden bg-black min-h-[58px]"
  >
    <div class="w-full overflow-hidden">
      <StripeBar loop={deviceInfo?.connected} duration={25} color="orange"></StripeBar>
    </div>
    <div
      class="absolute inset-0 flex flex-col justify-center items-center pointer-events-none"
    >
      <h1
        class="text-lg md:text-xl font-black tracking-widest text-[#fa0] uppercase bg-black"
      >
        ESP-WebSDR
      </h1>
    </div>
  </div>

  <div class="w-full flex flex-col gap-3">
    <div class="w-full flex flex-col lg:flex-row gap-2 justify-center">
     
      <div class="w-full flex flex-col gap-2 min-w-0">
        <!-- 1. RECEIVER INFORMATION (Gambar 1 STATION INFORMATION style) -->
        <Card className="border-[#fa0]/40 flex flex-col">
          {#snippet title()}
            <div
              class="flex items-center justify-between w-full font-bold text-[#fa0] px-1"
            >
              <div class="flex items-center gap-2">
                <span>RECEIVER INFORMATION</span>
              </div>
              <span class="text-[11px] text-red-500 font-semibold"
                >{connectionStatus.toUpperCase()}</span
              >
            </div>
          {/snippet}

          <div class="flex flex-col gap-2 p-2">
            <!-- Decal badge + Info table -->
            <div class="w-full flex flex-row gap-2">
              <div
                class="badge ews-title bordered flex justify-between w-2/5 shrink-0 self-stretch min-h-[100px] bg-black"
              >
                <div
                  class="flex flex-col items-center justify-between p-1 w-full select-none"
                >
                  <div
                    class="text -characters  font-black tracking-wider text-orange"
                  >
                    ESP
                  </div>
                  <div class="text font-black text-orange">
                    {deviceInfo?.connected
                      ? deviceInfo.chipFamily === "ESP32"
                        ? "32"
                        : deviceInfo.chipFamily || "SDR"
                      : "SDR"}
                  </div>
                  <!-- <div class="text-[8px] uppercase tracking-widest px-1 py-0.5 rounded border {deviceInfo?.connected ? (deviceInfo.simulated ? 'border-[#fa0]/40 text-[#fa0] bg-[#fa0]/10' : 'border-[#37c964]/40 text-[#37c964] bg-[#37c964]/10') : 'border-[#22333d] text-neutral-500'}">
                    {deviceInfo?.connected ? (deviceInfo.simulated ? 'DEMO' : (deviceInfo.chipFamily || 'ONLINE')) : 'OFFLINE'}
                  </div> -->
                </div>
                <div class="decal h-full">
                  <StripeBar
                    className="w-full h-full"
                    size={"100%"}
                    orientation="vertical"
                    color="orange"
                    loop={false}
                  />
                </div>
              </div>

              <div
                class="bordered p-1.5 w-3/5 text-[9px] leading-tight flex flex-col justify-between overflow-x-hidden select-text"
              >
                <table class="w-full">
                  <tbody style="font-size: 12px !important;">
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold"
                        >CHIP</td
                      >
                      <td
                        class="text-right py-[1.5px] font-bold truncate max-w-[125px]"
                        title={deviceInfo?.chipModel ||
                          driverIdentity ||
                          "ESP32-SDR"}
                      >
                        {#if deviceInfo?.connected}
                          <span
                            class="{deviceInfo.simulated
                              ? 'text-[#fa0]'
                              : 'text-red'} flex items-center justify-end gap-1"
                          >
                            {deviceInfo.chipModel}
                          </span>
                        {:else}
                          <span class="text-neutral-500">OFFLINE</span>
                        {/if}
                      </td>
                    </tr>
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold"
                        >ARCH</td
                      >
                      <td
                        class="text-right py-[1.5px] text-white font-semibold truncate max-w-[125px]"
                        title={deviceInfo?.chipArch || "Espressif 32-bit SoC"}
                      >
                        {#if deviceInfo?.connected}
                          <span
                            class={deviceInfo.simulated
                              ? "text-[#fa0]"
                              : "text-red"}
                            >{deviceInfo.chipArch
                              .split("@")[0]
                              .replace("Xtensa®", "Xtensa")
                              .replace("32-bit Single-Core", "Single-Core")
                              .replace("32-bit Dual-Band", "Dual-Band")
                              .trim()}</span
                          >
                        {:else}
                          <span class="text-neutral-500">OFFLINE</span>
                        {/if}
                      </td>
                    </tr>
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold"
                        >FIRM</td
                      >
                      <td
                        class="text-right py-[1.5px] text-[#fa0] font-bold truncate max-w-[125px]"
                        title={deviceInfo?.rawIdentity || "ESP-SDR v6"}
                      >
                        {#if deviceInfo?.connected}
                          {deviceInfo.rawIdentity || deviceInfo.firmware}
                        {:else}
                          <span class="text-neutral-500">OFFLINE</span>
                        {/if}
                      </td>
                    </tr>
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold"
                        >USB/BRIDGE</td
                      >
                      <td
                        class="text-right py-[1.5px] text-[#fa0] font-bold truncate max-w-[125px]"
                        title="{deviceInfo?.usbVendor ||
                          'USB'} · {deviceInfo?.usbProduct || 'Serial'}"
                      >
                        {#if deviceInfo?.connected}
                          {deviceInfo.usbProduct.split(" ")[0]} ({deviceInfo.usbVidHex.slice(
                            2,
                          )}:{deviceInfo.usbPidHex.slice(2)})
                        {:else}
                          <span class="text-neutral-500">AUTO-DETECT</span>
                        {/if}
                      </td>
                    </tr>
                 
                    <tr>
                      <td class="text-left py-[1.5px] text-orange font-semibold"
                        >CAPS</td
                      >
                      <td
                        class="text-right py-[1.5px] font-bold flex items-center justify-end gap-1"
                      >
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
                      <td class="text-left py-[1.5px] text-orange font-semibold"
                        >RX GAIN</td
                      >
                      <td class="text-right py-[1.5px] font-bold {config.gainMode === 'MANUAL' ? 'text-red' : 'text-[#fa0]'}">
                        {config.gainMode === 'MANUAL' ? `MANUAL (${config.gain} dB)` : 'AGC (AUTO)'}
                      </td>
                    </tr>
                   
                  </tbody>
                </table>
              </div>
            </div>

        
            <!-- Inspect Full Registers Button -->
            <button
              type="button"
              class="p-1.5 ews-btn ews-btn-primary w-full text-center text-black font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5"
              disabled={!deviceInfo?.connected}
              onclick={() => (isHardwareModalOpen = true)}
            >
              {#if deviceInfo?.connected}
                <span>HARDWARE INFO</span>
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
                class="ews-btn {isSimulating
                  ? 'ews-btn-alert'
                  : 'ews-btn-outline'} flex items-center justify-center gap-1 text-xs cursor-pointer"
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

        <Card className="border-[#fa0]/40 flex flex-col">
          {#snippet title()}
            <div
              class="flex items-center justify-between w-full font-bold text-[#fa0] px-1"
            >
              <div class="flex items-center gap-2">
                <span>FFT</span>
              </div>
              <span class="text-[11px] text-[#ff3b30] font-bold"
                >{config.fft} Bins</span
              >
            </div>
          {/snippet}

          <div class="flex flex-col gap-2.5 p-2">
            <div class="flex flex-col gap-1">
              <div class="w-full py-1">
                <HexGrid
                  className="w-full"
                  variant="flat"
                  align="center"
                  revealVariant="random"
                >
                  {#each fftPresets as fp}
                    <div class="ews-hex-hive flat">
                      <HexShape
                        clipContent={true}
                        color={config.fft === fp.bins ? "red" : "orange"}
                        className={config.fft === fp.bins
                          ? "blink blink-fast"
                          : ""}
                      >
                        <button
                          type="button"
                          class="w-full h-full cursor-pointer flex flex-col justify-center items-center {config.rate ===
                          fp.bins
                            ? 'text-white font-black'
                            : 'text-black font-bold'}"
                          onclick={() => handleFftChange(fp.bins)}
                        >
                          <div class="text-md leading-tight font-extrabold">
                            {fp.bins}
                          </div>
                        </button>
                      </HexShape>
                    </div>
                  {/each}
                </HexGrid>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-[#fa0]/40 flex flex-col">
          {#snippet title()}
            <div
              class="flex items-center justify-between w-full font-bold text-[#fa0] px-1"
            >
              <div class="flex items-center gap-2">
                <span>SAMPLE RATE</span>
              </div>
              <span class="text-[11px] text-[#ff3b30] font-bold"
                >{config.rate / 1e6} MS/s</span
              >
            </div>
          {/snippet}

          <div class="flex flex-col gap-2.5 p-2">
            <div class="flex flex-col gap-1">
              <div class="w-full py-1">
                <HexGrid className="w-full" variant="flat" align="center">
                  {#each ratePresets as rp, idx}
                    <div class="ews-hex-hive flat">
                      <HexShape
                        clipContent={true}
                        color={config.rate === rp.rate ? "red" : "orange"}
                        className={config.rate === rp.rate
                          ? "blink blink-fast"
                          : ""}
                      >
                        <button
                          type="button"
                          class="w-full h-full cursor-pointer flex flex-col justify-center items-center {config.rate ===
                          rp.rate
                            ? 'text-black font-black'
                            : 'text-black font-bold'}"
                          onclick={() => handleRateChange(rp.rate)}
                        >
                          <div class="text-md leading-tight font-extrabold">
                            {rp.label}
                          </div>
                        </button>
                      </HexShape>
                    </div>
                  {/each}
                </HexGrid>
              </div>
            </div>
          </div>
        </Card>

        <!-- 3. RECEIVER FILTERS & GAIN (Button to Open Modal) -->
        <Card className="border-[#fa0]/40 flex flex-col">
          {#snippet title()}
            <div
              class="flex items-center justify-between w-full font-bold text-[#fa0] px-1"
            >
              <div class="flex items-center gap-2">
                <span>FILTERS & SETTINGS</span>
              </div>
            </div>
          {/snippet}

          <div class="flex flex-col gap-2.5 p-2 font-mono">

            <button
              type="button"
              class="ews-btn ews-btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs md:text-sm font-bold tracking-wider cursor-pointer"
              onclick={() => (isSettingsOpen = true)}
            >
              OPEN FILTERS & SETTINGS
            </button>
          </div>

        
        </Card>
      </div>

      <!-- BAGIAN KANAN (70%): Spectrum di Atas, Waterfall di Bawah -->
      <div class="w-full flex flex-col gap-2 min-w-[50%]">
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
          modeName={latestFrame?.mode ||
            (hasSpec ? "SPEC on-chip" : "Burst IQ")}
          {deviceInfo}
          {deviceStats}
        />

        <!-- 2. Waterfall Spectrogram Monitor (Di Bawah) -->
        <SdrWaterfallChart
          bind:this={waterfallRef}
          frame={latestFrame}
          floor={config.floor}
          range={config.range}
          isConnected={connectionStatus === "connected" ||
            connectionStatus === "streaming"}
        />
      </div>
      <div class="w-full flex flex-col gap-2">
        

        <!-- 4. RF Band Segmented Bar Monitor (EVANGELION HUD / SAFETY LINE STYLE) -->
        <Card className="border-[#ff2200]/40 flex flex-col">
          {#snippet title()}
            <div
              class="flex items-center justify-between w-full font-bold text-[#ff2200] px-1"
            >
              <div class="flex items-center gap-2">
                <span>RF BAND</span>
              </div>
              <div
                class="flex items-center gap-2 text-[10px] text-neutral-400 font-normal"
              >
                <span class="text-[#fa0] font-bold"
                  >CF: {config.frequency} MHz</span
                >
                <span>•</span>
                <span>±50M (10M/BAR)</span>
              </div>
            </div>
          {/snippet}

          <div class="p-2 flex flex-col gap-2">
            <SdrSegmentedBarChart
              frame={latestFrame}
              centerFreqMhz={config.frequency}
              sampleRateHz={config.rate}
              floor={config.floor}
              ceilingDbfs={10}
              safetyDbfs={0}
              stepMhz={10}
              numBars={7}
              numSegments={24}
              showSafetyBadge={false}
            />
          </div>
        </Card>

        <!-- 5. Continuous Multi-Track Polygraph Recorder (Evangelion MAGI / Seismograph Style) -->
        <Card className="border-[#ff2200]/40 flex flex-col">
          {#snippet title()}
            <div
              class="flex items-center justify-between w-full font-bold text-[#ff2200] px-1"
            >
              <div class="flex items-center gap-2">
                <span>RF POLYGRAPH</span>
              </div>
              <div
                class="flex items-center gap-2 text-[10px] text-neutral-400 font-normal"
              >
                <span class="text-[#fa0] font-bold"
                  >CF: {config.frequency} MHz</span
                >
                <span>•</span>
                <span>±30M~±50M (10M/CH)</span>
               
              </div>
            </div>
          {/snippet}

          <div class="p-2 flex flex-col gap-2">
            <SdrPolygraphRecorder
              frame={latestFrame}
              centerFreqMhz={config.frequency}
              sampleRateHz={config.rate}
              floor={config.floor}
              ceilingDbfs={10}
              safetyDbfs={0}
              stepMhz={10}
              numChannels={7}
              isConnected={connectionStatus === "connected" ||
                connectionStatus === "streaming"}
            />
          </div>
        </Card>

       
      </div>
    </div>
    <div class="w-full">
       <!-- Connection & Hardware Diagnostic Log Terminal Card (Full Width) -->
        <Card className="border-[#1e8bb5]/40 w-full">
          {#snippet title()}
            <div
              class="flex items-center justify-between w-full text-xs font-bold text-[#1e8bb5] px-1"
            >
              <div class="flex items-center gap-2">
                <span>ESP32 CONNECTION & HARDWARE LOG</span>
              </div>
              <div class="flex items-center gap-3 font-normal text-[11px]">
                <label
                  class="flex items-center gap-1 cursor-pointer text-orange"
                >
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
            class="bg-[#05080a] p-3 text-[11px] h-48 overflow-y-auto rounded border border-[#162127] flex flex-col gap-1 select-text scroll-smooth"
          >
            {#if logs.length === 0}
              <div class="text-[#546e7a] italic">
                No connection log messages yet. Click "CONNECT ESP32" or "DEMO
                SIMULATION" to begin.
              </div>
            {:else}
              {#each logs as log (log.id)}
                <div class="flex items-start gap-2 leading-relaxed">
                  <span class="text-[#546e7a] shrink-0 font-medium"
                    >[{log.timestamp}]</span
                  >
                  {#if log.type === "success"}
                    <span
                      class="px-1 py-0.2 rounded text-[10px] bg-[#37c964]/20 text-[#37c964] font-bold shrink-0"
                    >
                      OK
                    </span>
                    <span class="text-[#a5d6a7]">{log.message}</span>
                  {:else if log.type === "error"}
                    <span
                      class="px-1 py-0.2 rounded text-[10px] bg-red-950 text-red-400 font-bold shrink-0"
                    >
                      ERR
                    </span>
                    <span class="text-red-300 font-medium">{log.message}</span>
                  {:else if log.type === "warn"}
                    <span
                      class="px-1 py-0.2 rounded text-[10px] bg-amber-950 text-amber-400 font-bold shrink-0"
                    >
                      WARN
                    </span>
                    <span class="text-amber-200">{log.message}</span>
                  {:else if log.type === "rx"}
                    <span
                      class="px-1 py-0.2 rounded text-[10px] bg-purple-950 text-purple-300 font-bold shrink-0"
                    >
                      RX
                    </span>
                    <span class="text-purple-200">{log.message}</span>
                  {:else}
                    <span
                      class="px-1 py-0.2 rounded text-[10px] bg-[#1e8bb5]/20 text-[#1e8bb5] font-bold shrink-0"
                    >
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
</div>

{#if isSettingsOpen}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 select-none"
  >
    <Card className="w-full max-w-2xl shadow-2xl border-[#fa0]">
      {#snippet title()}
        <div class="flex justify-between items-center w-full px-1">
          <div class="flex items-center gap-2">
            <Icon
              icon="lucide:sliders-horizontal"
              width="18"
              height="18"
              class="text-[#fa0]"
            />
            <p class="text-xl ews-title text-[#fa0]">
              SETTING RECEIVER & RF FILTERS
            </p>
          </div>
          <button
            class="text-[#fa0] hover:text-[#ff3b30] font-bold text-2xl px-2 cursor-pointer transition-colors"
            onclick={() => (isSettingsOpen = false)}>&times;</button
          >
        </div>
      {/snippet}

      <div class="flex flex-col gap-4 w-full p-3 text-xs">
        <!-- Sample Rate / Capture Span (Kotak Lebih Tinggi, Orange Default, Red Selected) -->
        <div class="flex flex-col gap-1.5 pt-2 border-t border-[#1c2930]">
          <div
            class="flex justify-between items-center text-[10px] text-orange uppercase px-1"
          >
            <p class="text-[#fa0] font-bold uppercase tracking-widest text-xs">
              Sample Rate / Capture Span:
            </p>
            <span class="text-[#fa0] font-bold">{config.rate / 1e6} MS/s</span>
          </div>
          <div class="grid grid-cols-4 md:grid-cols-7 gap-1.5">
            {#each ratePresets as r}
              <button
                type="button"
                class="h-8 flex flex-col items-center justify-center text-[10px] transition-all cursor-pointer {config.rate ===
                r.rate
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
          <div
            class="flex justify-between items-center text-[10px] text-orange uppercase px-1"
          >
            <p class="text-[#fa0] font-bold uppercase tracking-widest text-xs">
              FFT Resolution & Hold
            </p>
            <span class="text-[#fa0] font-bold">{config.fft} Bins</span>
          </div>
          <div class="grid grid-cols-3 md:grid-cols-6 gap-1.5">
            {#each fftPresets as f}
              <button
                type="button"
                class="h-8 flex flex-col items-center justify-center text-[10px] transition-all cursor-pointer {config.fft ===
                f.bins
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
              class="h-8 flex flex-col items-center justify-center text-[10px] transition-all cursor-pointer {config.maxHold
                ? 'bg-red text-white'
                : 'bg-orange text-black hover:bg-[#fa0]/30 font-bold'}"
              onclick={() => {
                config.maxHold = !config.maxHold;
                addLog(
                  "info",
                  `Max Hold: ${config.maxHold ? "ENABLED" : "DISABLED"}`,
                );
              }}
            >
              <span class="leading-tight font-bold">MAX</span>
              <span class="text-[8px] opacity-80"
                >{config.maxHold ? "ON" : "OFF"}</span
              >
            </button>
          </div>
        </div>

        <hr class="border-[#22333d]" />

        <!-- Section 2: Sliders (Home Filter Style) -->
        <div class="flex flex-col gap-3">
          <p class="text-[#fa0] font-bold uppercase tracking-widest text-xs">
            DSP & Display Filters:
          </p>

          <div class="flex flex-col gap-1">
            <label
              class="font-bold flex justify-between uppercase"
              style="color:var(--orange)"
            >
              <span>dBFS Dynamic Range</span>
              <span style="color:var(--red)"
                >{config.floor} dBFS → {ceilingDbfs} dBFS</span
              >
            </label>
            <RangeSlider
              min={-140}
              max={0}
              step={5}
              bind:low={config.floor}
              bind:high={ceilingDbfs}
            />
          </div>

          <!-- RX Gain Mode -->
          <div class="flex flex-col gap-1">
            <div class="settings-item">
              <div class="flex flex-col">
                <span class="text-sm font-semibold uppercase tracking-wider" style="color:var(--orange)">RX Gain Mode</span>
                <span class="text-[10px] text-neutral-400">
                  {config.gainMode === 'HARDWARE' ? 'AGC (Automatic Hardware Gain)' : 'Manual Gain Index Control'}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="text-xs font-bold px-2 py-0.5 rounded transition-all cursor-pointer {config.gainMode === 'HARDWARE' ? 'bg-[#fa0] text-black shadow-sm' : 'bg-transparent text-neutral-400 hover:text-white'}"
                  onclick={() => {
                    config.gainMode = 'HARDWARE';
                    addLog('info', 'RX Gain Mode: AGC (Automatic Hardware Gain)');
                  }}
                >
                  AGC
                </button>
                <label class="toggle-switch" title="Toggle between AGC and Manual Gain">
                  <input
                    type="checkbox"
                    checked={config.gainMode === 'MANUAL'}
                    onchange={(e) => {
                      config.gainMode = e.currentTarget.checked ? 'MANUAL' : 'HARDWARE';
                      addLog('info', `RX Gain Mode: ${config.gainMode === 'MANUAL' ? 'MANUAL' : 'AGC (Automatic)'}`);
                    }}
                  />
                  <span class="toggle-slider"></span>
                </label>
                <button
                  type="button"
                  class="text-xs font-bold px-2 py-0.5 rounded transition-all cursor-pointer {config.gainMode === 'MANUAL' ? 'bg-red text-white shadow-sm' : 'bg-transparent text-neutral-400 hover:text-white'}"
                  onclick={() => {
                    config.gainMode = 'MANUAL';
                    addLog('info', `RX Gain Mode: MANUAL (Gain Index: ${config.gain})`);
                  }}
                >
                  MANUAL
                </button>
              </div>
            </div>
          </div>

          <!-- Manual Gain Index Slider -->
          <div class="flex flex-col gap-1">
            <label
              for="rx-manual-gain-slider"
              class="font-bold flex justify-between uppercase"
              style="color:var(--orange)"
            >
              <span>Manual Gain Index</span>
              <span style="color:var(--red)"
                >{config.gainMode === "HARDWARE"
                  ? "AGC (Auto)"
                  : `${config.gain} dB`}</span
              >
            </label>
            <input
              id="rx-manual-gain-slider"
              type="range"
              min="0"
              max="60"
              step="1"
              bind:value={config.gain}
              disabled={config.gainMode !== "MANUAL"}
              class="w-full accent-[#fa0] {config.gainMode === 'MANUAL'
                ? 'cursor-pointer opacity-100'
                : 'cursor-not-allowed opacity-30'}"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label
              class="font-bold flex justify-between uppercase"
              style="color:var(--orange)"
            >
              <span>Trace Smoothing</span>
              <span style="color:var(--red)"
                >{Math.round(config.traceAvg * 100)}%</span
              >
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
            <label
              class="font-bold flex justify-between uppercase"
              style="color:var(--orange)"
            >
              <span>Center Frequency Fine-Tune</span>
              <span style="color:var(--red)">{config.frequency} MHz</span>
            </label>
            <input
              type="range"
              min="100"
              max="5500"
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
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 select-none"
  >
    <Card
      className="w-full max-w-2xl shadow-2xl border-[#fa0] max-h-[90vh] flex flex-col"
    >
      {#snippet title()}
        <div class="flex justify-between items-center w-full px-1">
          <div class="flex items-center gap-2">
            <Icon
              icon="lucide:cpu"
              width="18"
              height="18"
              class="text-[#fa0]"
            />
            <p class="text-base md:text-lg ews-title text-[#fa0]">
              ESP32 HARDWARE REGISTERS & DEVICE SPECIFICATIONS
            </p>
          </div>
          <button
            class="text-[#fa0] hover:text-[#ff3b30] font-bold text-2xl px-2 cursor-pointer transition-colors"
            onclick={() => (isHardwareModalOpen = false)}>&times;</button
          >
        </div>
      {/snippet}

      <div
        class="flex flex-col gap-3.5 w-full p-3 text-xs overflow-y-auto custom-scrollbar"
      >
        <!-- 1. Silicon Architecture & SoC Specs -->
        <div class="flex flex-col gap-1.5">
          <div
            class="flex items-center gap-1.5 text-orange font-bold text-xs uppercase tracking-wider"
          >
            <Icon icon="lucide:cpu" width="14" height="14" />
            <span>SoC Architecture & Firmware</span>
          </div>
          <div
            class="grid grid-cols-1 md:grid-cols-2 gap-1.5 bg-[#080d10] p-2.5 rounded border border-[#1c2930]"
          >
            <div>
              <span class="text-[#546e7a] block text-[10px]">CHIP MODEL:</span>
              <span class="text-white font-bold"
                >{deviceInfo?.chipModel || "ESP32"}</span
              >
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]"
                >CHIP ARCHITECTURE:</span
              >
              <span class="text-white font-bold"
                >{deviceInfo?.chipArch || "Espressif 32-bit SoC"}</span
              >
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]"
                >FIRMWARE IDENTITY (INFO):</span
              >
              <span class="text-[#fa0] font-bold"
                >{deviceInfo?.rawIdentity || driverIdentity || "ESP32SDR"}</span
              >
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]"
                >PROTOCOL VERSION & BUFFER:</span
              >
              <span class="text-[#37c964] font-bold">
                {deviceInfo?.firmware || "ESP-SDR v6"} · Max {deviceInfo?.maxSamples.toLocaleString() ||
                  "16,380"} Samples
              </span>
            </div>
          </div>
        </div>

        <!-- 2. USB Interface & WebSerial Link -->
        <div class="flex flex-col gap-1.5">
          <div
            class="flex items-center gap-1.5 text-orange font-bold text-xs uppercase tracking-wider"
          >
            <Icon icon="lucide:usb" width="14" height="14" />
            <span>USB Controller & Serial Port</span>
          </div>
          <div
            class="grid grid-cols-1 md:grid-cols-2 gap-1.5 bg-[#080d10] p-2.5 rounded border border-[#1c2930]"
          >
            <div>
              <span class="text-[#546e7a] block text-[10px]">USB VENDOR:</span>
              <span class="text-white font-bold"
                >{deviceInfo?.usbVendor || "Generic USB"}</span
              >
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]"
                >USB PRODUCT / CONTROLLER:</span
              >
              <span class="text-[#fa0] font-bold"
                >{deviceInfo?.usbProduct || "Serial Port"}</span
              >
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]"
                >HARDWARE USB VID : PID:</span
              >
              <span class="text-[#37c964] font-bold"
                >{deviceInfo?.usbVidHex || "N/A"} : {deviceInfo?.usbPidHex ||
                  "N/A"}</span
              >
            </div>
            <div>
              <span class="text-[#546e7a] block text-[10px]"
                >SERIAL LINK & TRANSPORT:</span
              >
              <span class="text-[#1e8bb5] font-bold">
                {deviceInfo?.transport || "UART"} @ {baudRate / 1e6} MBaud (131,072
                Byte Buffer)
              </span>
            </div>
          </div>
        </div>

        <!-- 3. RF Frontend & Capabilities -->
        <div class="flex flex-col gap-1.5">
          <div
            class="flex items-center gap-1.5 text-orange font-bold text-xs uppercase tracking-wider"
          >
            <Icon icon="lucide:radio" width="14" height="14" />
            <span>RF Frontend Capabilities</span>
          </div>
          <div
            class="bg-[#080d10] p-2.5 rounded border border-[#1c2930] flex flex-col gap-2"
          >
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <span class="text-[#546e7a] block text-[10px]"
                  >TUNING RANGE:</span
                >
                <span class="text-white font-bold">
                  {deviceInfo?.tuneRange
                    ? `${deviceInfo.tuneRange[0]} - ${deviceInfo.tuneRange[1]} MHz`
                    : "2400 - 2484 MHz"}
                </span>
              </div>
              <div>
                <span class="text-[#546e7a] block text-[10px]"
                  >ON-CHIP HW FFT (SPEC):</span
                >
                <span
                  class="{deviceInfo?.hasSpec
                    ? 'text-[#37c964]'
                    : 'text-neutral-500'} font-bold"
                >
                  {deviceInfo?.hasSpec ? "SUPPORTED" : "NOT AVAILABLE"}
                </span>
              </div>
              <div>
                <span class="text-[#546e7a] block text-[10px]"
                  >VARIABLE FFT (SPECN):</span
                >
                <span
                  class="{deviceInfo?.hasSpecN
                    ? 'text-[#37c964]'
                    : 'text-neutral-500'} font-bold"
                >
                  {deviceInfo?.hasSpecN ? "SUPPORTED" : "FIXED BINS"}
                </span>
              </div>
              <div>
                <span class="text-[#546e7a] block text-[10px]"
                  >GAIN CONTROL (GAIN):</span
                >
                <span
                  class="{deviceInfo?.hasGain
                    ? 'text-[#37c964]'
                    : 'text-neutral-500'} font-bold"
                >
                  {deviceInfo?.hasGain ? "HARDWARE AGC + MANUAL" : "AUTO AGC"}
                </span>
              </div>
              <div>
                <span class="text-[#546e7a] block text-[10px]"
                  >ACTIVE RF CENTER:</span
                >
                <span class="text-[#fa0] font-bold">{config.frequency} MHz</span
                >
              </div>
              <div>
                <span class="text-[#546e7a] block text-[10px]"
                  >ACTIVE SPAN / RATE:</span
                >
                <span class="text-[#fa0] font-bold"
                  >{config.rate / 1e6} MS/s</span
                >
              </div>
            </div>

            <!-- Full Capability Tokens -->
            <div
              class="pt-1.5 border-t border-[#162127] flex flex-wrap items-center gap-1.5"
            >
              <span class="text-[#546e7a] text-[10px]">REPORTED CAPS:</span>
              {#if deviceInfo?.caps && deviceInfo.caps.length > 0}
                {#each deviceInfo.caps as cap}
                  <span
                    class="px-1.5 py-0.5 rounded text-[9.5px] bg-[#162127] border border-[#23353e] text-[#fa0] font-bold"
                  >
                    {cap}
                  </span>
                {/each}
              {:else}
                <span class="text-[#546e7a] text-[10px]"
                  >SPEC SPECN GAIN UARTBAUD</span
                >
              {/if}
            </div>
          </div>
        </div>

        <!-- 4. Real-time Telemetry & Performance -->
        {#if connectionStatus === "streaming"}
          <div class="flex flex-col gap-1.5">
            <div
              class="flex items-center gap-1.5 text-orange font-bold text-xs uppercase tracking-wider"
            >
              <Icon icon="lucide:activity" width="14" height="14" />
              <span>Real-Time On-Chip Telemetry & Diagnostics</span>
            </div>
            <div
              class="grid grid-cols-2 md:grid-cols-4 gap-1.5 bg-[#080d10] p-2.5 rounded border border-[#1c2930]"
            >
              <div class="bg-[#0e161b] p-1.5 rounded border border-[#1b2b34]">
                <span class="text-[#546e7a] block text-[9.5px]"
                  >CPU CORE 0 LOAD</span
                >
                <span class="text-[#fa0] font-bold text-sm"
                  >{deviceStats?.core0Load ?? 0}%</span
                >
              </div>
              <div class="bg-[#0e161b] p-1.5 rounded border border-[#1b2b34]">
                <span class="text-[#546e7a] block text-[9.5px]"
                  >CPU CORE 1 LOAD</span
                >
                <span class="text-[#fa0] font-bold text-sm"
                  >{deviceStats?.core1Load ?? 0}%</span
                >
              </div>
              <div class="bg-[#0e161b] p-1.5 rounded border border-[#1b2b34]">
                <span class="text-[#546e7a] block text-[9.5px]"
                  >FREE RAM HEAP</span
                >
                <span class="text-[#37c964] font-bold text-sm">
                  {deviceStats?.heapFree
                    ? `${Math.round(deviceStats.heapFree / 1024)} KB`
                    : "284 KB"}
                </span>
              </div>
              <div class="bg-[#0e161b] p-1.5 rounded border border-[#1b2b34]">
                <span class="text-[#546e7a] block text-[9.5px]"
                  >ON-CHIP FFT RATE</span
                >
                <span class="text-[#1e8bb5] font-bold text-sm">
                  {deviceStats?.fftsPerSec
                    ? `${deviceStats.fftsPerSec} FFT/s`
                    : `${(latestFrame?.fps || 40) * 8} FFT/s`}
                </span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Actions -->
        <div
          class="flex items-center justify-end pt-2 border-t border-[#1c2930]"
        >
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
