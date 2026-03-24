<script lang="ts">
    interface NetworkData {
        id: string;
        name: string;
        active_channel: number;
        inactive_channel: number;
        total_channel: number;
    }

    interface Props {
        title?: string;
        headerInfo?: { label: string; value: string }[];
        networks?: NetworkData[];
        className?: string;
    }

    let {
        title = "MENTAL TOXICITY LEVEL",
        headerInfo = [
            { label: "ELAPSED TIME", value: "120 min." },
            { label: "L.C.L. PURITY", value: "99.9999989%" },
        ],
        networks = [
            {
                id: "network-1",
                name: "NET 1",
                active_channel: 2,
                inactive_channel: 14,
                total_channel: 16,
            },
            {
                id: "network-2",
                name: "NET 2",
                active_channel: 22,
                inactive_channel: 7,
                total_channel: 29,
            },
            {
                id: "network-3",
                name: "NET 3",
                active_channel: 12,
                inactive_channel: 5,
                total_channel: 17,
            },
        ],
        className = "",
    }: Props = $props();

    // Total bars per row — always fills 100%
    const totalBars = 50;

    // Get inactive percentage
    function getInactivePercent(network: NetworkData): number {
        if (network.total_channel === 0) return 0;
        return (network.inactive_channel / network.total_channel) * 100;
    }

    // Color: continuous gradient from light blue/cyan to purple
    // based on bar position across the full 100% width
    function getBarColor(barIndex: number, network: NetworkData): string {
        const inactivePct = getInactivePercent(network);
        const fillBarsCount = Math.round((inactivePct / 100) * totalBars);

        // If the current bar index is greater than the percentage it should fill, hide it
        if (barIndex >= fillBarsCount) {
            return "transparent";
        }

        const t = barIndex / (totalBars - 1);
        // Hue: 190 (cyan/light blue) → 280 (purple)
        const hue = 190 + t * 90;
        // Saturation: 100% → 85%
        const sat = 100 - t * 15;
        // Lightness: 55% → 45%
        const light = 55 - t * 10;
        return `hsl(${hue}, ${sat}%, ${light}%)`;
    }

    function getSubjectIndex(idx: number): string {
        return idx.toString().padStart(2, "0");
    }

    // Caution position: where inactive ratio begins to be notable (e.g. >10%)
    // We show the caution marker at the percentage point where inactive begins
    function getInactiveStartPosition(network: NetworkData): number {
        if (network.total_channel === 0) return 100;
        return (network.active_channel / network.total_channel) * 100;
    }
</script>

<div class="ews-mtl-container w-full {className}">
    <!-- <div class="ews-mtl-header">
        <span class="ews-mtl-title">{title}</span>
        <div class="ews-mtl-info">
            {#each headerInfo as info}
                <div class="ews-mtl-info-row">
                    <span class="ews-mtl-info-label">{info.label}</span>
                    <span class="ews-mtl-info-separator">:</span>
                    <span class="ews-mtl-info-value">{info.value}</span>
                </div>
            {/each}
        </div>
    </div> -->
    <!-- Scale: 0% to 100% -->
    <div class="ews-mtl-scale">
        <div class="ews-mtl-scale-label-area"></div>
        <div class="ews-mtl-scale-bar">
            <div class="ews-mtl-scale-marks">
                <span class="ews-mtl-scale-mark" style="left: 0%">0%</span>
                <span class="ews-mtl-scale-mark" style="left: 25%">25%</span>
                <span class="ews-mtl-scale-mark" style="left: 50%">50%</span>
                <span class="ews-mtl-scale-mark" style="left: 75%">75%</span>
                <span class="ews-mtl-scale-mark" style="left: 100%">100%</span>
            </div>
            <!-- <div class="ews-mtl-zone-marks">
                <div class="ews-mtl-zone-caution">
                    <span class="ews-mtl-zone-bracket">&#x007B;</span>
                    <span class="ews-mtl-zone-text">CAUTION</span>
                    <span class="ews-mtl-zone-bracket">&#x007D;</span>
                </div>
                <div class="ews-mtl-zone-danger">
                    <span class="ews-mtl-zone-bracket">&#x007B;</span>
                    <span class="ews-mtl-zone-text">DANGER</span>
                </div>
            </div> -->
        </div>
    </div>

    <!-- Network Rows -->
    {#each networks as network, idx}
        {@const inactivePct = getInactivePercent(network)}
        {@const activeStart = getInactiveStartPosition(network)}
        <div class="flex flex-row-reverse gap-6">
            <div>
                <span class="ews-mtl-marker-bracket">|</span>
                <span class="ews-mtl-marker-label">DANGER</span>
                <span class="ews-mtl-marker-bracket">|</span>
            </div>
            <div>
                <span class="ews-mtl-marker-bracket">|</span>
                <span class="ews-mtl-marker-label">CAUTION</span>
                <span class="ews-mtl-marker-bracket">|</span>
            </div>
        </div>
        <div class="ews-mtl-subject-row">
            <div class="ews-mtl-subject-info">
                <span class="ews-mtl-subject-label">NETWORK</span>
                <span class="ews-mtl-subject-id"
                    >{network.name.toUpperCase()}</span
                >
                <!-- <span class="ews-mtl-subject-id">{getSubjectIndex(idx)}</span> -->
                <span class="ews-mtl-subject-name"
                    >{network.name.toUpperCase()}</span
                >
            </div>
            <div class="ews-mtl-bar-area">
                <div class="ews-mtl-bars">
                    {#each { length: totalBars } as _, i}
                        <div
                            class="ews-mtl-bar"
                            style="background-color: {getBarColor(i, network)};"
                        ></div>
                    {/each}
                </div>

                <!-- CAUTION marker at where inactive channels begin -->
                <!-- {#if network.inactive_channel > 0}
                    <div class="ews-mtl-row-marker" style="left: {activeStart}%">
                        <span class="ews-mtl-marker-bracket">|</span>
                        <span class="ews-mtl-marker-label">CAUTION</span>
                        <span class="ews-mtl-marker-bracket">|</span>
                    </div>
                {/if} -->

                <!-- <div class="ews-mtl-row-marker" style="left: 70%">
                    <span class="ews-mtl-marker-bracket">|</span>
                    <span class="ews-mtl-marker-label">CAUTION</span>
                    <span class="ews-mtl-marker-bracket">|</span>
                </div> -->

                <!-- Danger marker at the end -->
                <!-- <div class="ews-mtl-row-marker danger" style="left: 100%">
                    <span class="ews-mtl-marker-bracket">|</span>
                    <span class="ews-mtl-marker-label">DANGER</span>
                    <span class="ews-mtl-marker-bracket">|</span>
                </div> -->

                <!-- Inactive percentage and channel stats -->
                <!-- <div class="ews-mtl-channel-stats">
                    <span class="ews-mtl-inactive-pct"
                        >{Math.round(inactivePct)}%</span
                    >
                    <span class="ews-mtl-stat-detail"
                        >({network.inactive_channel}/{network.total_channel}
                        inactive)</span
                    >
                </div> -->
            </div>
        </div>
    {/each}
</div>

<style>
    .ews-mtl-container {
        position: relative;
        padding: 24px 28px;
        overflow: hidden;
    }

    /* Header */
    .ews-mtl-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 18px;
        flex-wrap: wrap;
        gap: 8px;
    }

    .ews-mtl-title {
        font-size: 1.4em;
        font-weight: bold;
        color: var(--red);
        /* text-shadow:
            0 0 8px rgba(255, 68, 34, 0.6),
            0 0 20px rgba(255, 68, 34, 0.3); */
        letter-spacing: 2px;
    }

    .ews-mtl-info {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
    }

    .ews-mtl-info-row {
        display: flex;
        gap: 6px;
        font-size: 0.8em;
        letter-spacing: 1px;
    }

    .ews-mtl-info-label {
        color: var(--orange);
        /* text-shadow: 0 0 6px rgba(255, 102, 51, 0.5); */
    }

    .ews-mtl-info-separator {
        color: var(--orange);
    }

    .ews-mtl-info-value {
        color: var(--orange);
        /* text-shadow: 0 0 6px rgba(255, 102, 51, 0.5); */
    }

    /* Scale */
    .ews-mtl-scale {
        display: flex;
        margin-bottom: 10px;
    }

    .ews-mtl-scale-label-area {
        width: 100px;
        flex-shrink: 0;
    }

    .ews-mtl-scale-bar {
        flex: 1;
        position: relative;
        min-height: 12px;
    }

    .ews-mtl-scale-marks {
        position: relative;
        height: 16px;
    }

    .ews-mtl-scale-mark {
        position: absolute;
        font-size: 0.7em;
        color: var(--orange);
        /* text-shadow: 0 0 4px rgba(255, 102, 51, 0.4); */
        transform: translateX(-50%);
        letter-spacing: 1px;
        white-space: nowrap;
    }

    .ews-mtl-scale-mark:first-child {
        transform: translateX(0);
    }

    .ews-mtl-scale-mark:last-child {
        transform: translateX(-100%);
    }

    .ews-mtl-zone-marks {
        position: relative;
        height: 18px;
        display: flex;
        gap: 20px;
        padding-left: 55%;
    }

    .ews-mtl-zone-caution {
        display: flex;
        align-items: center;
        font-size: 0.6em;
        color: var(--orange);
        /* text-shadow: 0 0 6px rgba(255, 136, 0, 0.5); */
        letter-spacing: 1px;
        white-space: nowrap;
    }

    .ews-mtl-zone-danger {
        display: flex;
        align-items: center;
        font-size: 0.6em;
        color: var(--red);
        /* text-shadow: 0 0 6px rgba(255, 51, 51, 0.5); */
        letter-spacing: 1px;
        white-space: nowrap;
    }

    .ews-mtl-zone-bracket {
        font-size: 1.2em;
    }

    .ews-mtl-zone-text {
        margin: 0 3px;
    }

    /* Subject / Network Rows */
    .ews-mtl-subject-row {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        position: relative;
    }

    .ews-mtl-subject-info {
        width: 100px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.15;
    }

    .ews-mtl-subject-label {
        font-size: 1em;
        color: var(--orange);
        /* text-shadow: 0 0 4px rgba(255, 68, 34, 0.5); */
        letter-spacing: 2px;
    }

    .ews-mtl-subject-id {
        font-size: 2.4em;
        font-weight: bold;
        color: var(--orange);
        /* text-shadow:
            0 0 10px rgba(255, 68, 34, 0.7),
            0 0 25px rgba(255, 68, 34, 0.3); */
        letter-spacing: 3px;
        line-height: 1;
    }

    .ews-mtl-subject-name {
        font-size: 1em;
        color: var(--orange);
        /* text-shadow: 0 0 4px rgba(255, 68, 34, 0.4); */
        letter-spacing: 1.5px;
    }

    /* Bar Area */
    .ews-mtl-bar-area {
        flex: 1;
        position: relative;
        height: 68px;
    }

    .ews-mtl-bars {
        display: flex;
        gap: 3px;
        height: 100%;
        align-items: stretch;
    }

    .ews-mtl-bar {
        flex: 1;
        min-width: 5px;
        border-radius: 1px;
        box-shadow: 0 0 3px rgba(0, 200, 220, 0.15);
    }

    /* Row zone markers */
    .ews-mtl-row-marker {
        position: absolute;
        top: -2px;
        display: flex;
        align-items: center;
        font-size: 0.55em;
        color: var(--orange);
        /* text-shadow: 0 0 5px rgba(255, 136, 0, 0.5); */
        transform: translateX(-50%);
        letter-spacing: 1px;
        white-space: nowrap;
        pointer-events: none;
    }

    .ews-mtl-row-marker.danger {
        color: var(--red);
        /* text-shadow: 0 0 5px rgba(255, 51, 51, 0.5); */
    }

    .ews-mtl-marker-bracket {
        font-size: 1.1em;
    }

    .ews-mtl-marker-label {
        margin: 0 2px;
    }

    /* Channel stats */
    .ews-mtl-channel-stats {
        position: absolute;
        bottom: 2px;
        right: 4px;
        font-size: 0.7em;
        letter-spacing: 1px;
        pointer-events: none;
        display: flex;
        align-items: baseline;
        gap: 6px;
    }

    .ews-mtl-inactive-pct {
        color: #cc44ff;
        text-shadow: 0 0 6px rgba(204, 68, 255, 0.5);
        font-weight: bold;
        font-size: 1.1em;
    }

    .ews-mtl-stat-detail {
        color: #888;
        font-size: 0.85em;
    }

    /* Responsive */
    @media (max-width: 600px) {
        .ews-mtl-container {
            padding: 14px 16px;
        }

        .ews-mtl-title {
            font-size: 0.95em;
        }

        .ews-mtl-subject-info {
            width: 70px;
        }

        .ews-mtl-subject-id {
            font-size: 1.6em;
        }

        .ews-mtl-scale-label-area {
            width: 70px;
        }

        .ews-mtl-bar-area {
            height: 54px;
        }

        .ews-mtl-bars {
            gap: 2px;
        }

        .ews-mtl-bar {
            min-width: 3px;
        }
    }
</style>
