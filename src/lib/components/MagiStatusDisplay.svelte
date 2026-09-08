<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { mapStore, DATA_SOURCES, type DataSource } from "$lib/stores/mapStore.svelte";
    import Modal from "$lib/components/Modal.svelte";
    import HexGrid from "$lib/components/HexGrid.svelte";
    import HexShape from "$lib/components/HexShape.svelte";

    let {
        onSourcesChange,
        sourceErrors = {},
        isMelchiorActive = false,
        isBalthasarActive = false,
        isCasparActive = false,
    }: {
        onSourcesChange?: () => void;
        sourceErrors?: Record<string, string>;
        isMelchiorActive: boolean;
        isBalthasarActive: boolean;
        isCasparActive: boolean;
    } = $props();

    let showSourceModal = $state(false);

    // Slot 1: Melchior 1 (Bottom Right)
    // Slot 2: Balthasar 2 (Top Center)
    // Slot 3: Caspar 3 (Bottom Left)
    let melchiorSource = $derived(mapStore.dataSources[0] as DataSource | undefined);
    let balthasarSource = $derived(mapStore.dataSources[1] as DataSource | undefined);
    let casparSource = $derived(mapStore.dataSources[2] as DataSource | undefined);

    let activeCount = $derived(mapStore.dataSources.length);

    const COLOR_ACTIVE = "#00dfa2";
    const COLOR_INACTIVE = "#e60026";
    const COLOR_ORANGE = "#ff7700";
    const COLOR_CYAN = "#00f0ff";

    interface Block {
        x: number;
        y: number;
        w: number;
        h: number;
        delay: number;
        accent: string;
    }

    interface TextSlice {
        x: number;
        y: number;
        w: number;
        h: number;
        delay: number;
        duration: number;
    }

    interface PodState {
        baseColor: string;
        fromColor: string;
        toColor: string;
        isTransitioning: boolean;
        key: number;
        blocks: Block[];
        textSlices: TextSlice[];
    }

    let balthasarState = $state<PodState>({
        baseColor: isBalthasarActive ? COLOR_ACTIVE : COLOR_INACTIVE,
        fromColor: isBalthasarActive ? COLOR_ACTIVE : COLOR_INACTIVE,
        toColor: isBalthasarActive ? COLOR_ACTIVE : COLOR_INACTIVE,
        isTransitioning: false,
        key: 0,
        blocks: [],
        textSlices: [],
    });

    let casparState = $state<PodState>({
        baseColor: isCasparActive ? COLOR_ACTIVE : COLOR_INACTIVE,
        fromColor: isCasparActive ? COLOR_ACTIVE : COLOR_INACTIVE,
        toColor: isCasparActive ? COLOR_ACTIVE : COLOR_INACTIVE,
        isTransitioning: false,
        key: 0,
        blocks: [],
        textSlices: [],
    });

    let melchiorState = $state<PodState>({
        baseColor: isMelchiorActive ? COLOR_ACTIVE : COLOR_INACTIVE,
        fromColor: isMelchiorActive ? COLOR_ACTIVE : COLOR_INACTIVE,
        toColor: isMelchiorActive ? COLOR_ACTIVE : COLOR_INACTIVE,
        isTransitioning: false,
        key: 0,
        blocks: [],
        textSlices: [],
    });

    const POD_CONFIGS = {
        balthasar: {
            bounds: { minX: 360, minY: 36, width: 280, height: 304 },
            textBounds: { x: 380, y: 160, width: 240, height: 80 },
            dir: "balthasar" as const,
        },
        caspar: {
            bounds: { minX: 55, minY: 255, width: 340, height: 310 },
            textBounds: { x: 90, y: 400, width: 270, height: 90 },
            dir: "caspar" as const,
        },
        melchior: {
            bounds: { minX: 605, minY: 255, width: 340, height: 310 },
            textBounds: { x: 640, y: 400, width: 270, height: 90 },
            dir: "melchior" as const,
        },
    };

    const timeouts: Record<string, any> = {};

    function generatePodGlitch(
        bounds: { minX: number; minY: number; width: number; height: number },
        dirType: "balthasar" | "caspar" | "melchior",
        fromColor: string,
        toColor: string
    ): Block[] {
        const blockSize = 14;
        const cols = Math.ceil(bounds.width / blockSize);
        const rows = Math.ceil(bounds.height / blockSize);
        const blocks: Block[] = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = bounds.minX + c * blockSize;
                const y = bounds.minY + r * blockSize;

                let dist = 0;
                if (dirType === "caspar") {
                    // Top-left to bottom-right (like in reference image)
                    dist = (c / cols) * 0.6 + (r / rows) * 0.4;
                } else if (dirType === "melchior") {
                    // Top-right to bottom-left
                    dist = ((cols - c) / cols) * 0.6 + (r / rows) * 0.4;
                } else {
                    // Balthasar: Top-center downwards
                    dist = (r / rows) * 0.65 + (Math.abs(c - cols / 2) / (cols / 2)) * 0.35;
                }

                // Deterministic pseudo-random noise for pixelated cluster wave
                const noise = ((Math.sin(c * 23.45 + r * 67.89) * 43758.5453) % 1 + 1) % 1;
                const delay = dist * 0.42 + noise * 0.26; // max ~0.68s

                // Rectangular wide pixel chunks like in Eva screenshot
                const isWide = noise > 0.76 && c < cols - 1;
                const w = isWide ? blockSize * 2 : blockSize;
                const h = blockSize;

                // Leading edge accent colors: cyan, dark glitch, white flash
                let accent = "#00f0ff";
                if (noise > 0.62) accent = "#000000";
                else if (noise < 0.18) accent = "#ffffff";
                else if (noise > 0.45 && noise <= 0.62) accent = "#092736";

                blocks.push({
                    x,
                    y,
                    w,
                    h,
                    delay: Number(delay.toFixed(3)),
                    accent,
                });
            }
        }
        return blocks;
    }

    function generateTextSlices(textBounds: { x: number; y: number; width: number; height: number }): TextSlice[] {
        const slices: TextSlice[] = [];
        const count = 7;
        for (let i = 0; i < count; i++) {
            const sliceY = textBounds.y + Math.random() * (textBounds.height - 8);
            const sliceH = 3 + Math.random() * 7;
            const sliceW = 35 + Math.random() * (textBounds.width - 35);
            const sliceX = textBounds.x + Math.random() * (textBounds.width - sliceW);
            const delay = 0.05 + Math.random() * 0.45;
            const duration = 0.18 + Math.random() * 0.25;

            slices.push({
                x: Math.round(sliceX),
                y: Math.round(sliceY),
                w: Math.round(sliceW),
                h: Math.round(sliceH),
                delay: Number(delay.toFixed(3)),
                duration: Number(duration.toFixed(3)),
            });
        }
        return slices;
    }

    function triggerGlitch(podId: "balthasar" | "caspar" | "melchior", targetActive: boolean) {
        const stateMap = {
            balthasar: balthasarState,
            caspar: casparState,
            melchior: melchiorState,
        };
        const state = stateMap[podId];
        const targetColor = targetActive ? COLOR_ACTIVE : COLOR_INACTIVE;
        const currentBase = state.baseColor;

        // If replaying while already at targetColor, animate from the opposite color for maximum visual impact
        const fromColor = currentBase === targetColor ? (targetActive ? COLOR_INACTIVE : COLOR_ACTIVE) : currentBase;

        state.fromColor = fromColor;
        state.toColor = targetColor;
        state.baseColor = fromColor; // show fromColor underneath as blocks pop in
        state.key += 1;

        const config = POD_CONFIGS[podId];
        state.blocks = generatePodGlitch(config.bounds, config.dir, fromColor, targetColor);
        state.textSlices = generateTextSlices(config.textBounds);
        state.isTransitioning = true;

        if (timeouts[podId]) clearTimeout(timeouts[podId]);
        timeouts[podId] = setTimeout(() => {
            state.isTransitioning = false;
            state.baseColor = targetColor;
            state.blocks = [];
            state.textSlices = [];
        }, 850);
    }

    export function replayPodGlitch(podId: "balthasar" | "caspar" | "melchior") {
        const isCurrentlyActive = podId === "balthasar" ? isBalthasarActive : podId === "caspar" ? isCasparActive : isMelchiorActive;
        triggerGlitch(podId, isCurrentlyActive);
    }

    function handlePodClick(podId: "balthasar" | "caspar" | "melchior") {
        replayPodGlitch(podId);
    }

    let prevActive = $state({
        balthasar: isBalthasarActive,
        caspar: isCasparActive,
        melchior: isMelchiorActive,
    });

    $effect(() => {
        // Track balthasar
        if (isBalthasarActive !== prevActive.balthasar) {
            prevActive.balthasar = isBalthasarActive;
            triggerGlitch("balthasar", isBalthasarActive);
        }
        // Track caspar
        if (isCasparActive !== prevActive.caspar) {
            prevActive.caspar = isCasparActive;
            triggerGlitch("caspar", isCasparActive);
        }
        // Track melchior
        if (isMelchiorActive !== prevActive.melchior) {
            prevActive.melchior = isMelchiorActive;
            triggerGlitch("melchior", isMelchiorActive);
        }
    });

    onMount(() => {
        // Boot reveal sequence with dramatic stagger
        setTimeout(() => {
            if (isBalthasarActive) triggerGlitch("balthasar", true);
            setTimeout(() => {
                if (isCasparActive) triggerGlitch("caspar", true);
            }, 180);
            setTimeout(() => {
                if (isMelchiorActive) triggerGlitch("melchior", true);
            }, 360);
        }, 300);
    });

    onDestroy(() => {
        Object.values(timeouts).forEach(clearTimeout);
    });

    function handleToggleSource(id: string) {
        mapStore.toggleDataSource(id);
        onSourcesChange?.();
    }
</script>

<div class="relative w-full max-w-4xl mx-auto my-3 px-2 select-none">
    <!-- Evangelion MAGI System Display (Faithful to Gambar 2) -->
    <div class="magi-svg-wrapper relative w-full bg-black overflow-hidden">
        <svg
            viewBox="0 0 1000 605"
            class="w-full h-auto block"
            preserveAspectRatio="xMidYMid meet"
        >
            <defs>
                <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                <!-- Pod Clip Paths -->
                <clipPath id="clip-pod-balthasar">
                    <polygon points="360,36 640,36 640,265 565,340 435,340 360,265" />
                </clipPath>

                <clipPath id="clip-pod-caspar">
                    <polygon points="55,255 285,255 395,365 395,565 55,565" />
                </clipPath>

                <clipPath id="clip-pod-melchior">
                    <polygon points="715,255 945,255 945,565 605,565 605,365" />
                </clipPath>
            </defs>

            <!-- Background -->
            <rect x="0" y="0" width="1000" height="605" fill="#000000" />

            <!-- Outer Double Orange Border Frame -->
            <rect
                x="24"
                y="20"
                width="952"
                height="565"
                fill="none"
                stroke={COLOR_ORANGE}
                stroke-width="4.5"
            />
            <rect
                x="32"
                y="28"
                width="936"
                height="549"
                fill="none"
                stroke={COLOR_ORANGE}
                stroke-width="1.5"
            />

            <!-- ======================================================= -->
            <!-- LEFT HUD PANEL: Kanji + Cyan Circuit + Monospace Telemetry -->
            <!-- ======================================================= -->
            <g id="left-hud">
                <!-- Japanese Kanji 地震観測所 -->
                <text
                    x="70"
                    y="95"
                    fill={COLOR_ORANGE}
                    font-size="46"
                    font-weight="900"
                    letter-spacing="2"
                    font-family="'Hiragino Kaku Gothic ProN', 'Meiryo', 'Yu Gothic', sans-serif"
                >地震観測所</text>

                <!-- Cyan Circuit Ribbon Tracks -->
                <g stroke={COLOR_CYAN} stroke-width="2.5" fill="none" opacity="0.95" filter="url(#cyan-glow)">
                    <path d="M 52 38 L 332 38" />
                    <path d="M 52 44 L 332 44" />
                    <path d="M 52 106 L 332 106" />
                    <path d="M 52 112 L 332 112" />
                </g>

                <!-- Monospace Code Telemetry Block -->
                <g fill={COLOR_ORANGE} font-family="'Roboto Condensed', monospace" font-size="15" font-weight="700" letter-spacing="1.5">
                    <text x="110" y="152" font-size="20">CODE:473</text>
                    <text x="110" y="174">FILE MAGI_SYS</text>
                    <text x="110" y="192">EXTENTION:3720</text>
                    <text x="110" y="210">EX_MODE:OFF</text>
                    <text x="110" y="228">PRIORITY:AAB</text>
                </g>
            </g>

            <!-- ======================================================= -->
            <!-- RIGHT HUD PANEL: Kanji + Cyan Circuit + Status Box -->
            <!-- ======================================================= -->
            <g id="right-hud">
                <!-- Japanese Kanji 地震観測所 -->
                <text
                    x="680"
                    y="95"
                    fill={COLOR_ORANGE}
                    font-size="46"
                    font-weight="900"
                    letter-spacing="2"
                    font-family="'Hiragino Kaku Gothic ProN', 'Meiryo', 'Yu Gothic', sans-serif"
                >地震観測所</text>

                <!-- Cyan Circuit Ribbon Tracks -->
                <g stroke={COLOR_CYAN} stroke-width="2.5" fill="none" opacity="0.95" filter="url(#cyan-glow)">
                    <path d="M 660 38 L 940 38" />
                    <path d="M 660 44 L 940 44" />
                    <path d="M 660 106 L 940 106" />
                    <path d="M 660 112 L 940 112" />
                </g>

                <!-- Status Box: 調整中 (Under Adjustment) / 正常稼働 (Normal Operation) -->
                <g transform="translate(712, 145)">
                    <rect x="0" y="0" width="180" height="74" fill="#000000" stroke={COLOR_ORANGE} stroke-width="3" />
                    <rect x="5" y="5" width="170" height="64" fill="none" stroke={COLOR_ORANGE} stroke-width="1.5" />
                    <text
                        x="90"
                        y="48"
                        fill={COLOR_ORANGE}
                        font-size="34"
                        font-weight="900"
                        text-anchor="middle"
                        letter-spacing="5"
                        font-family="'Hiragino Kaku Gothic ProN', 'Meiryo', 'Yu Gothic', sans-serif"
                    >
                        {activeCount === 3 ? "正常稼働" : "調整中"}
                    </text>
                </g>
            </g>

            <!-- ======================================================= -->
            <!-- CONDUIT BRIDGES (Mathematically seamless diagonal bridges) -->
            <!-- ======================================================= -->
            <g id="conduits">
                <!-- Diagonal Bridge: Balthasar 2 lower-left to Caspar 3 upper-right -->
                <polygon
                    points="386,291 404,309 372,342 354,324"
                    fill={COLOR_ORANGE}
                />

                <!-- Diagonal Bridge: Balthasar 2 lower-right to Melchior 1 upper-left -->
                <polygon
                    points="614,291 596,309 628,342 646,324"
                    fill={COLOR_ORANGE}
                />

                <line
                    x1="395"
                    y1="445"
                    x2="605"
                    y2="445"
                    stroke={COLOR_ORANGE}
                    stroke-width="20"
                />
            </g>

            <!-- ======================================================= -->
            <!-- CENTRAL NEXUS: "MAGI" -->
            <!-- ======================================================= -->
            <g id="magi-nexus">
                <text
                    x="500"
                    y="400"
                    fill={COLOR_ORANGE}
                    font-size="38"
                    font-weight="900"
                    text-anchor="middle"
                    letter-spacing="6"
                    font-family="'Times New Roman', Times, Georgia, serif"
                >MAGI</text>
            </g>

            <!-- ======================================================= -->
            <!-- POD 2: BALTHASAR • 2 (Top Center) -->
            <!-- ======================================================= -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <g
                id="pod-balthasar"
                class="cursor-pointer transition-all duration-150 hover:brightness-110"
                onclick={() => handlePodClick("balthasar")}
            >
                <!-- Base Pod Polygon & Glitch Matrix (Inside ClipPath) -->
                <g clip-path="url(#clip-pod-balthasar)">
                    <polygon
                        points="360,36 640,36 640,265 565,340 435,340 360,265"
                        fill={balthasarState.baseColor}
                    />

                    {#if balthasarState.isTransitioning}
                        <g class="glitch-blocks-layer" style="--from-color: {balthasarState.fromColor}; --to-color: {balthasarState.toColor};">
                            {#each balthasarState.blocks as block, i (balthasarState.key + '-b-' + i)}
                                <rect
                                    x={block.x}
                                    y={block.y}
                                    width={block.w}
                                    height={block.h}
                                    class="glitch-block"
                                    style="animation-delay: {block.delay}s; --block-accent: {block.accent};"
                                />
                            {/each}
                        </g>
                    {/if}
                </g>

                <!-- Text & Text Glitch Effects (Inside ClipPath) -->
                <g clip-path="url(#clip-pod-balthasar)">
                    {#if balthasarState.isTransitioning}
                        <!-- Cyan RGB Glitch Ghost -->
                        <text
                            x="502"
                            y="189"
                            fill="#00f0ff"
                            opacity="0.7"
                            font-size="38"
                            font-weight="900"
                            text-anchor="middle"
                            letter-spacing="1"
                            font-family="'Roboto Condensed', Impact, sans-serif"
                            class="pointer-events-none"
                        >
                            BALTHASAR • 2
                        </text>
                    {/if}

                    <g 
                    class={balthasarState.isTransitioning ? "pod-text-glitching" : ""}
                    >
                        <!-- Pod Title: BALTHASAR • 2 -->
                        <text
                            x="500"
                            y="190"
                            fill="#000000"
                            font-size="38"
                            font-weight="900"
                            text-anchor="middle"
                            letter-spacing="1"
                            font-family="'Roboto Condensed', Impact, sans-serif"
                        >
                            BALTHASAR • 2
                        </text>

                        <!-- Data Source Subtitle -->
                        <text
                            x="500"
                            y="226"
                            fill="#000000"
                            font-size="18"
                            font-weight="800"
                            text-anchor="middle"
                            letter-spacing="1"
                            font-family="'Roboto Condensed', monospace"
                        >
                            {#if isBalthasarActive}
                                {balthasarSource?.name || "ACTIVE"}
                            {:else}
                                [ OFFLINE ]
                            {/if}
                        </text>
                    </g>

                    <!-- Glitch Horizontal Scanline Slices -->
                    {#if balthasarState.isTransitioning}
                        {#each balthasarState.textSlices as slice, i (balthasarState.key + '-ts-b-' + i)}
                            <rect
                                x={slice.x}
                                y={slice.y}
                                width={slice.w}
                                height={slice.h}
                                class="glitch-text-slice"
                                style="animation-delay: {slice.delay}s; animation-duration: {slice.duration}s;"
                            />
                        {/each}
                    {/if}
                </g>

                <!-- Razor-Sharp Orange Pod Frame (On Top) -->
                <polygon
                    points="360,36 640,36 640,265 565,340 435,340 360,265"
                    fill="none"
                    stroke={COLOR_ORANGE}
                    stroke-width="3.5"
                />
            </g>

            <!-- ======================================================= -->
            <!-- POD 3: CASPAR • 3 (Bottom Left) -->
            <!-- ======================================================= -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <g
                id="pod-caspar"
                class="cursor-pointer transition-all duration-150 hover:brightness-110"
                onclick={() => handlePodClick("caspar")}
            >
                <!-- Base Pod Polygon & Glitch Matrix (Inside ClipPath) -->
                <g clip-path="url(#clip-pod-caspar)">
                    <polygon
                        points="55,255 285,255 395,365 395,565 55,565"
                        fill={casparState.baseColor}
                    />

                    {#if casparState.isTransitioning}
                        <g class="glitch-blocks-layer" style="--from-color: {casparState.fromColor}; --to-color: {casparState.toColor};">
                            {#each casparState.blocks as block, i (casparState.key + '-c-' + i)}
                                <rect
                                    x={block.x}
                                    y={block.y}
                                    width={block.w}
                                    height={block.h}
                                    class="glitch-block"
                                    style="animation-delay: {block.delay}s; --block-accent: {block.accent};"
                                />
                            {/each}
                        </g>
                    {/if}
                </g>

                <!-- Text & Text Glitch Effects (Inside ClipPath) -->
                <g clip-path="url(#clip-pod-caspar)">
                    {#if casparState.isTransitioning}
                        <!-- Cyan RGB Glitch Ghost -->
                        <text
                            x="227"
                            y="434"
                            fill="#00f0ff"
                            opacity="0.7"
                            font-size="44"
                            font-weight="900"
                            text-anchor="middle"
                            letter-spacing="1.5"
                            font-family="'Roboto Condensed', Impact, sans-serif"
                            class="pointer-events-none"
                        >
                            CASPAR • 3
                        </text>
                    {/if}

                    <g class={casparState.isTransitioning ? "pod-text-glitching" : ""}>
                        <!-- Pod Title: CASPAR • 3 -->
                        <text
                            x="225"
                            y="435"
                            fill="#000000"
                            font-size="44"
                            font-weight="900"
                            text-anchor="middle"
                            letter-spacing="1.5"
                            font-family="'Roboto Condensed', Impact, sans-serif"
                        >
                            CASPAR • 3
                        </text>

                        <!-- Data Source Subtitle -->
                        <text
                            x="225"
                            y="476"
                            fill="#000000"
                            font-size="20"
                            font-weight="800"
                            text-anchor="middle"
                            letter-spacing="1"
                            font-family="'Roboto Condensed', monospace"
                        >
                            {#if isCasparActive}
                                {casparSource?.name || "ACTIVE"}
                            {:else}
                                [ OFFLINE ]
                            {/if}
                        </text>
                    </g>

                    <!-- Glitch Horizontal Scanline Slices -->
                    {#if casparState.isTransitioning}
                        {#each casparState.textSlices as slice, i (casparState.key + '-ts-c-' + i)}
                            <rect
                                x={slice.x}
                                y={slice.y}
                                width={slice.w}
                                height={slice.h}
                                class="glitch-text-slice"
                                style="animation-delay: {slice.delay}s; animation-duration: {slice.duration}s;"
                            />
                        {/each}
                    {/if}
                </g>

                <!-- Razor-Sharp Orange Pod Frame (On Top) -->
                <polygon
                    points="55,255 285,255 395,365 395,565 55,565"
                    fill="none"
                    stroke={COLOR_ORANGE}
                    stroke-width="3.5"
                />
            </g>

            <!-- ======================================================= -->
            <!-- POD 1: MELCHIOR • 1 (Bottom Right) -->
            <!-- ======================================================= -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <g
                id="pod-melchior"
                class="cursor-pointer transition-all duration-150 hover:brightness-110"
                onclick={() => handlePodClick("melchior")}
            >
                <!-- Base Pod Polygon & Glitch Matrix (Inside ClipPath) -->
                <g clip-path="url(#clip-pod-melchior)">
                    <polygon
                        points="715,255 945,255 945,565 605,565 605,365"
                        fill={melchiorState.baseColor}
                    />

                    {#if melchiorState.isTransitioning}
                        <g class="glitch-blocks-layer" style="--from-color: {melchiorState.fromColor}; --to-color: {melchiorState.toColor};">
                            {#each melchiorState.blocks as block, i (melchiorState.key + '-m-' + i)}
                                <rect
                                    x={block.x}
                                    y={block.y}
                                    width={block.w}
                                    height={block.h}
                                    class="glitch-block"
                                    style="animation-delay: {block.delay}s; --block-accent: {block.accent};"
                                />
                            {/each}
                        </g>
                    {/if}
                </g>

                <!-- Text & Text Glitch Effects (Inside ClipPath) -->
                <g clip-path="url(#clip-pod-melchior)">
                    {#if melchiorState.isTransitioning}
                        <!-- Cyan RGB Glitch Ghost -->
                        <text
                            x="777"
                            y="434"
                            fill="#00f0ff"
                            opacity="0.7"
                            font-size="44"
                            font-weight="900"
                            text-anchor="middle"
                            letter-spacing="1.5"
                            font-family="'Roboto Condensed', Impact, sans-serif"
                            class="pointer-events-none"
                        >
                            MELCHIOR • 1
                        </text>
                    {/if}

                    <g class={melchiorState.isTransitioning ? "pod-text-glitching" : ""}>
                        <!-- Pod Title: MELCHIOR • 1 -->
                        <text
                            x="775"
                            y="435"
                            fill="#000000"
                            font-size="44"
                            font-weight="900"
                            text-anchor="middle"
                            letter-spacing="1.5"
                            font-family="'Roboto Condensed', Impact, sans-serif"
                        >
                            MELCHIOR • 1
                        </text>

                        <!-- Data Source Subtitle -->
                        <text
                            x="775"
                            y="476"
                            fill="#000000"
                            font-size="20"
                            font-weight="800"
                            text-anchor="middle"
                            letter-spacing="1"
                            font-family="'Roboto Condensed', monospace"
                        >
                            {#if isMelchiorActive}
                                {melchiorSource?.name || "ACTIVE"}
                            {:else}
                                [ OFFLINE ]
                            {/if}
                        </text>
                    </g>

                    <!-- Glitch Horizontal Scanline Slices -->
                    {#if melchiorState.isTransitioning}
                        {#each melchiorState.textSlices as slice, i (melchiorState.key + '-ts-m-' + i)}
                            <rect
                                x={slice.x}
                                y={slice.y}
                                width={slice.w}
                                height={slice.h}
                                class="glitch-text-slice"
                                style="animation-delay: {slice.delay}s; animation-duration: {slice.duration}s;"
                            />
                        {/each}
                    {/if}
                </g>

                <!-- Razor-Sharp Orange Pod Frame (On Top) -->
                <polygon
                    points="715,255 945,255 945,565 605,565 605,365"
                    fill="none"
                    stroke={COLOR_ORANGE}
                    stroke-width="3.5"
                />
            </g>
        </svg>
    </div>
</div>

<style>
    .magi-container {
        filter: drop-shadow(0 0 15px rgba(255, 119, 0, 0.15));
    }

    @keyframes magiBlockReveal {
        0% {
            opacity: 0;
            fill: var(--from-color, #e60026);
        }
        12% {
            opacity: 1;
            fill: #000000;
        }
        28% {
            opacity: 1;
            fill: var(--block-accent, #00f0ff);
        }
        45% {
            opacity: 1;
            fill: #0d0406;
        }
        68% {
            opacity: 1;
            fill: var(--to-color, #00dfa2);
        }
        100% {
            opacity: 1;
            fill: var(--to-color, #00dfa2);
        }
    }

    :global(.glitch-block) {
        opacity: 0;
        animation-name: magiBlockReveal;
        animation-duration: 0.32s;
        animation-timing-function: steps(3, end);
        animation-fill-mode: forwards;
    }

    @keyframes magiTextSlice {
        0% {
            opacity: 0;
            transform: scaleX(0.2);
        }
        20% {
            opacity: 1;
            transform: scaleX(1) translateX(-3px);
        }
        40% {
            opacity: 0.2;
            transform: translateX(4px);
        }
        60% {
            opacity: 1;
            transform: translateX(-2px);
        }
        80% {
            opacity: 0.3;
            transform: translateX(2px);
        }
        100% {
            opacity: 0;
            transform: scaleX(0);
        }
    }

    :global(.glitch-text-slice) {
        fill: #000000;
        animation-name: magiTextSlice;
        animation-timing-function: steps(2, end);
        animation-fill-mode: forwards;
    }

    @keyframes magiTextJitter {
        0%, 100% {
            transform: translate(0, 0);
        }
        15% {
            transform: translate(-3px, 1px);
        }
        30% {
            transform: translate(2px, -1px);
        }
        50% {
            transform: translate(-2px, 0);
        }
        70% {
            transform: translate(3px, 1px);
        }
        85% {
            transform: translate(-1px, -1px);
        }
    }

    /* :global(.pod-text-glitching) {
        animation: magiTextJitter 0.5s steps(4) infinite;
    } */
</style>

