<script lang="ts">
    import "../styles/components/HexGrid.css";
    import type { Snippet } from "svelte";

    export type HexRevealVariant =
        | "diagonal"
        | "diagonal-top-left"
        | "diagonal-tl"
        | "diagonal-top-right"
        | "diagonal-tr"
        | "diagonal-bottom-left"
        | "diagonal-bl"
        | "diagonal-bottom-right"
        | "diagonal-br"
        | "left"
        | "right"
        | "top"
        | "bottom"
        | "random"
        | "center"
        | "tengah"
        | "none";

    interface HexGridProps {
        children: Snippet;
        className?: string;
        variant?: "pointy" | "flat";
        align?: "left" | "center" | "right";
        hexWidth?: number;
        hexHeight?: number;
        gap?: number;
        revealVariant?: HexRevealVariant | string;
        revealDuration?: number;
        revealMaxDelay?: number;
        revealStagger?: number;
        reverse?: boolean;
    }

    let {
        children,
        className = "",
        variant = "pointy",
        align = "left",
        hexWidth,
        hexHeight,
        gap = 4,
        revealVariant = "none",
        revealDuration = 300,
        revealMaxDelay = 800,
        revealStagger,
        reverse = false,
    }: HexGridProps = $props();

    interface LayoutOptions {
        variant: "pointy" | "flat";
        align: "left" | "center" | "right";
        hexWidth?: number;
        hexHeight?: number;
        gap: number;
        revealVariant?: string;
        revealDuration?: number;
        revealMaxDelay?: number;
        revealStagger?: number;
        reverse?: boolean;
    }

    // Svelte Action for Responsive Honeycomb Grid with Reveal Animation
    function honeycombLayout(node: HTMLElement, options: LayoutOptions) {
        let ro: ResizeObserver;
        let mo: MutationObserver;
        let currentOptions = { ...options };
        let lastVariant: string | undefined = undefined;
        let lastReverse: boolean | undefined = undefined;
        let lastWidth = 0;

        function layout() {
            const containerWidth = node.clientWidth;
            if (!containerWidth) return;

            const childElements = Array.from(node.children) as HTMLElement[];
            if (childElements.length === 0) return;

            node.style.position = "relative";
            node.style.display = "block";

            const isFlat = currentOptions.variant === "flat";
            const w = currentOptions.hexWidth ?? (isFlat ? 83 : 72);
            const h = currentOptions.hexHeight ?? (isFlat ? 72 : 83);
            const gridGap = currentOptions.gap;

            function getAlignOffset(rowWidth: number) {
                if (currentOptions.align === "center") {
                    return Math.max(0, (containerWidth - rowWidth) / 2);
                }
                if (currentOptions.align === "right") {
                    return Math.max(0, containerWidth - rowWidth);
                }
                return 0;
            }

            const childPositions: { child: HTMLElement; x: number; y: number }[] = [];

            if (!isFlat) {
                // Pointy (Variant 1)
                const rowOffsetTop = gridGap - 20;
                const itemFullWidth = w + gridGap;

                let maxCols = Math.floor((containerWidth + gridGap) / itemFullWidth);
                if (maxCols < 1) maxCols = 1;

                let isOffset = false;
                let currentCol = 0;
                let currentRow = 0;
                let rowAlignOffset = 0;

                for (let i = 0; i < childElements.length; i++) {
                    let child = childElements[i];
                    let colsInThisRow = isOffset ? Math.max(1, maxCols - 1) : maxCols;

                    if (currentCol === 0) {
                        const rowWidth =
                            (colsInThisRow - 1) * itemFullWidth +
                            w +
                            (isOffset ? w / 2 + gridGap / 2 : 0);
                        rowAlignOffset = getAlignOffset(rowWidth);
                    }

                    let x = currentCol * itemFullWidth + rowAlignOffset;
                    if (isOffset) {
                        x += w / 2 + gridGap / 2;
                    }

                    let y = currentRow * (h + rowOffsetTop);

                    child.style.position = "absolute";
                    child.style.left = `${x}px`;
                    child.style.top = `${y}px`;
                    child.style.margin = "0";
                    child.style.width = `${w}px`;
                    child.style.height = `${h}px`;

                    childPositions.push({ child, x, y });

                    currentCol++;
                    if (currentCol >= colsInThisRow) {
                        currentCol = 0;
                        isOffset = !isOffset;
                        currentRow++;
                    }
                }

                let totalHeight = 0;
                if (currentCol > 0) {
                    totalHeight = currentRow * (h + rowOffsetTop) + h;
                } else {
                    totalHeight = (currentRow - 1) * (h + rowOffsetTop) + h;
                }
                if (node.style.height !== `${totalHeight}px`) {
                    node.style.height = `${totalHeight}px`;
                }
            } else {
                // Flat (Variant 2)
                const colAdvanceX = w * 0.75 + gridGap;
                const rowAdvanceY = h + gridGap;

                let maxCols = Math.floor((containerWidth - w) / colAdvanceX) + 1;
                if (containerWidth < w) maxCols = 1;

                let currentCol = 0;
                let currentRow = 0;
                let maxBottom = 0;
                let rowAlignOffset = 0;

                for (let i = 0; i < childElements.length; i++) {
                    let child = childElements[i];

                    if (currentCol === 0) {
                        const rowWidth = (maxCols - 1) * colAdvanceX + w;
                        rowAlignOffset = getAlignOffset(rowWidth);
                    }

                    let x = currentCol * colAdvanceX + rowAlignOffset;
                    let y = currentRow * rowAdvanceY;

                    // Offset odd columns down
                    if (currentCol % 2 === 1) {
                        y += rowAdvanceY / 2;
                    }

                    child.style.position = "absolute";
                    child.style.left = `${x}px`;
                    child.style.top = `${y}px`;
                    child.style.margin = "0";
                    child.style.width = `${w}px`;
                    child.style.height = `${h}px`;

                    childPositions.push({ child, x, y });

                    const bottom = y + h;
                    if (bottom > maxBottom) maxBottom = bottom;

                    currentCol++;
                    if (currentCol >= maxCols) {
                        currentCol = 0;
                        currentRow++;
                    }
                }

                if (node.style.height !== `${maxBottom}px`) {
                    node.style.height = `${maxBottom}px`;
                }
            }

            // Apply reveal animations to children if enabled
            applyRevealAnimations(childPositions);
        }

        function applyRevealAnimations(
            childPositions: { child: HTMLElement; x: number; y: number }[],
        ) {
            const variantType = currentOptions.revealVariant?.toLowerCase().trim();
            if (!variantType || variantType === "none") {
                for (const { child } of childPositions) {
                    child.classList.remove("ews-hex-reveal-in", "ews-hex-reveal-out");
                    child.style.removeProperty("--hex-reveal-delay");
                    child.style.removeProperty("--hex-reveal-duration");
                }
                lastVariant = undefined;
                lastReverse = undefined;
                return;
            }

            // Detect if variant or reverse state actually changed
            const isStateChanged =
                variantType !== lastVariant || currentOptions.reverse !== lastReverse;

            lastVariant = variantType;
            lastReverse = currentOptions.reverse;

            const minX = Math.min(...childPositions.map((p) => p.x));
            const maxX = Math.max(...childPositions.map((p) => p.x));
            const minY = Math.min(...childPositions.map((p) => p.y));
            const maxY = Math.max(...childPositions.map((p) => p.y));
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            function getDistance(x: number, y: number, index: number): number {
                switch (variantType) {
                    // Diagonal Top-Left (default diagonal)
                    case "diagonal":
                    case "diagonal-top-left":
                    case "diagonal-tl":
                    case "top-left":
                    case "kiri-atas":
                    case "atas-kiri":
                    case "diagonal-kiri-atas":
                        return (x - minX) + (y - minY);

                    // Diagonal Top-Right
                    case "diagonal-top-right":
                    case "diagonal-tr":
                    case "top-right":
                    case "kanan-atas":
                    case "atas-kanan":
                    case "diagonal-kanan-atas":
                        return (maxX - x) + (y - minY);

                    // Diagonal Bottom-Left
                    case "diagonal-bottom-left":
                    case "diagonal-bl":
                    case "bottom-left":
                    case "kiri-bawah":
                    case "bawah-kiri":
                    case "diagonal-kiri-bawah":
                        return (x - minX) + (maxY - y);

                    // Diagonal Bottom-Right
                    case "diagonal-bottom-right":
                    case "diagonal-br":
                    case "bottom-right":
                    case "kanan-bawah":
                    case "bawah-kanan":
                    case "diagonal-kanan-bawah":
                        return (maxX - x) + (maxY - y);

                    // Center / Tengah
                    case "center":
                    case "centre":
                    case "tengah":
                    case "radial":
                        return Math.hypot(x - centerX, y - centerY);

                    // Directional
                    case "left":
                    case "kiri":
                        return x - minX;

                    case "right":
                    case "kanan":
                        return maxX - x;

                    case "top":
                    case "atas":
                        return y - minY;

                    case "bottom":
                    case "bawah":
                        return maxY - y;

                    // Random / Acak (Deterministic pseudo-random based on index to prevent flicker on resize)
                    case "random":
                    case "acak":
                        return Math.abs(Math.sin((index + 1) * 9301 + 49297) * 233280) % 1;

                    default:
                        return (x - minX) + (y - minY);
                }
            }

            const distances = childPositions.map((p, i) => getDistance(p.x, p.y, i));
            const dMin = Math.min(...distances);
            const dMax = Math.max(...distances);
            const dSpan = dMax - dMin || 1;

            const maxDelay = currentOptions.revealStagger
                ? dSpan * currentOptions.revealStagger
                : (currentOptions.revealMaxDelay ?? 800);

            const targetClass = currentOptions.reverse
                ? "ews-hex-reveal-out"
                : "ews-hex-reveal-in";

            for (let i = 0; i < childPositions.length; i++) {
                const { child } = childPositions[i];
                const isAlreadyInTargetState = child.classList.contains(targetClass);

                // If state has not changed and child is already animating/animated, DO NOT restart it!
                if (!isStateChanged && isAlreadyInTargetState) {
                    continue;
                }

                let norm = (distances[i] - dMin) / dSpan;

                // When reversing, invert delay order so the last elements to appear collapse first
                if (currentOptions.reverse) {
                    norm = 1 - norm;
                }

                const delay = Math.round(norm * maxDelay);

                child.style.setProperty("--hex-reveal-delay", `${delay}ms`);
                child.style.setProperty(
                    "--hex-reveal-duration",
                    `${currentOptions.revealDuration ?? 300}ms`,
                );

                // Clean up any legacy manual pop-up classes and delays
                child.classList.remove("opacity-0", "show-pop-up", "close-pop-up");
                if (child.style.animationDelay) {
                    child.style.animationDelay = "";
                }

                // Restart CSS animation only when state actually changed or first initialized
                child.classList.remove("ews-hex-reveal-in", "ews-hex-reveal-out");
                void child.offsetWidth;
                child.classList.add(targetClass);
            }
        }

        // Run initial layout
        layout();

        // Observe width changes only to avoid re-triggering on height adjustments
        ro = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width ?? node.clientWidth;
            if (Math.abs(width - lastWidth) >= 1) {
                lastWidth = width;
                layout();
            }
        });
        ro.observe(node);

        // Only observe child node addition/removal, not attribute/style mutations
        mo = new MutationObserver((mutations) => {
            let hasChildChange = false;
            for (const m of mutations) {
                if (
                    m.type === "childList" &&
                    (m.addedNodes.length > 0 || m.removedNodes.length > 0)
                ) {
                    hasChildChange = true;
                    break;
                }
            }
            if (hasChildChange) {
                layout();
            }
        });
        mo.observe(node, { childList: true });

        function areOptionsEqual(a: LayoutOptions, b: LayoutOptions) {
            return (
                a.variant === b.variant &&
                a.align === b.align &&
                a.hexWidth === b.hexWidth &&
                a.hexHeight === b.hexHeight &&
                a.gap === b.gap &&
                a.revealVariant === b.revealVariant &&
                a.revealDuration === b.revealDuration &&
                a.revealMaxDelay === b.revealMaxDelay &&
                a.revealStagger === b.revealStagger &&
                a.reverse === b.reverse
            );
        }

        return {
            update(newOptions: LayoutOptions) {
                // If options did not change (e.g. parent re-rendered), do not trigger layout
                if (areOptionsEqual(currentOptions, newOptions)) {
                    return;
                }
                currentOptions = { ...newOptions };
                layout();
            },
            destroy() {
                if (ro) ro.disconnect();
                if (mo) mo.disconnect();
            },
        };
    }
</script>

<div
    class="ews-hex-honeycomb {className}"
    use:honeycombLayout={{
        variant,
        align,
        hexWidth,
        hexHeight,
        gap,
        revealVariant,
        revealDuration,
        revealMaxDelay,
        revealStagger,
        reverse,
    }}
>
    {@render children()}
</div>
