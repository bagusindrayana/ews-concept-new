<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import WaveformChart from "$lib/components/WaveformChart.svelte";

    let frames: any[] = [];
    let currentFrameIndex = 0;
    let isPlaying = false;
    let isLoading = true;
    let interval: ReturnType<typeof setInterval>;

    // Props for WaveformChart
    let waveformChart: any;
    let psychoPoints: { nx: number; ny: number }[] = [];

    // Target FPS used during extraction
    const TARGET_FPS = 15;
    const MS_PER_FRAME = 1000 / TARGET_FPS;

    onMount(async () => {
        try {
            const response = await fetch("/bad_apple_frames_v4.json");
            if (response.ok) {
                frames = await response.json();
                isLoading = false;

                // Set initial frame
                if (frames.length > 0) {
                    psychoPoints = frames[0];
                }
            } else {
                console.error("Failed to fetch frames:", response.status);
            }
        } catch (error) {
            console.error("Failed to load Bad Apple frames:", error);
        }
    });

    function togglePlay() {
        if (isPlaying) {
            isPlaying = false;
            if (interval) clearInterval(interval);
        } else {
            if (frames.length === 0) return;
            isPlaying = true;

            // Restart if at end
            if (currentFrameIndex >= frames.length - 1) {
                currentFrameIndex = 0;
            }

            interval = setInterval(() => {
                if (currentFrameIndex < frames.length) {
                    psychoPoints = frames[currentFrameIndex];
                    currentFrameIndex++;
                } else {
                    isPlaying = false;
                    clearInterval(interval);
                }
            }, MS_PER_FRAME);
        }
    }

    onDestroy(() => {
        if (interval) clearInterval(interval);
    });
</script>

<svelte:head>
    <title>Bad Apple!! - Oscilloscope Mode</title>
</svelte:head>

<div
    class="w-full min-h-screen bg-black flex flex-col items-center justify-center p-4 lg:p-8 font-mono relative"
>
    <div class="flex flex-col items-center gap-6 w-full">
        <div class="w-full max-w-7xl flex flex-col bordered p-1 grow gap-3">
            <div
                class="relative w-full h-[75vh] border-b-4 border-l-4 bg-black overflow-hidden flex flex-col items-center"
                style="border-bottom-color: #fa0; border-left-color: #fa0;"
            >
                <!-- Top Left -->
                <div
                    class="absolute right-2 lg:right-0 lg:top-6 left-4 lg:left-24 pointer-events-none z-5 max-w-100 flex flex-col justify-center items-end lg:items-start gap-1"
                >
                    <div
                        class="rounded-sm bordered text-3xl bg-black/60 shadow-lg h-10 text-center flex justify-center items-center px-1"
                    >
                        <div class="font-bold md:text-3xl uppercase ews-title">
                            PSYCHOGRAPHIC DISPLAY
                        </div>
                    </div>
                    <div
                        class="font-bold mt-1 tracking-widest text-sm md:text-xl ews-title"
                    >
                        Phase 4 Link
                    </div>
                </div>

                <!-- Top Right -->
                <div
                    class="absolute bottom-16 lg:bottom-auto top-auto lg:top-18 md:top-4 right-2 lg:right-16 pointer-events-none flex flex-col items-end z-5"
                >
                    <div
                        class="rounded-lg p-1 inline-block bg-black/60 shadow-lg"
                    >
                        <div class="bordered px-3 py-1 flex flex-col text-3xl">
                            <div
                                class="font-bold text-[10px] md:text-sm tracking-widest leading-none mb-1 ews-title"
                            >
                                STATION:
                            </div>
                            <div
                                class="font-bold text-2xl md:text-4xl tracking-widest leading-none text-right ews-title"
                            >
                                BAD APPLE
                            </div>
                        </div>
                    </div>
                </div>

                <WaveformChart
                    bind:this={waveformChart}
                    waveformData={[]}
                    timeWindowMs={20000}
                    selectedTimezone={0}
                    isDemoPsychoMode={true}
                    {psychoPoints}
                    backgroundColor="#000000"
                    gridColor="#33cc55"
                    axesColor="#fa0"
                    waveformColor="#ff9900"
                    psychoWaveformColor="#ff9900"
                    emptyTextColor="#fa0"
                />
            </div>
        </div>

        <div class="flex gap-4 mt-2">
            <button
                class="px-10 py-3 bg-white text-black font-bold uppercase tracking-widest text-lg rounded hover:bg-gray-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                on:click={togglePlay}
                disabled={isLoading}
            >
                {isPlaying ? "PAUSE" : "PLAY VIDEO"}
            </button>
            <button
                class="px-6 py-3 bg-transparent border-2 border-white/50 text-white font-bold uppercase tracking-widest text-lg rounded hover:bg-white hover:text-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                on:click={() => {
                    currentFrameIndex = 0;
                    if (frames.length > 0) psychoPoints = frames[0];
                    if (isPlaying) togglePlay();
                }}
                disabled={isLoading}
            >
                RESTART
            </button>
        </div>
    </div>
</div>
