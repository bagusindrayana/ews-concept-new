<script lang="ts">
    import type { Snippet } from "svelte";

    let {
        children,
        className = "",
        variant = "pointy",
        hexWidth,
        hexHeight,
        gap = 4
    }: {
        children: Snippet;
        className?: string;
        variant?: "pointy" | "flat";
        hexWidth?: number;
        hexHeight?: number;
        gap?: number;
    } = $props();

    // Svelte Action for Responsive Honeycomb Grid
    function honeycombLayout(node: HTMLElement) {
        let ro: ResizeObserver;
        let mo: MutationObserver;

        function layout() {
            const containerWidth = node.clientWidth;
            if (!containerWidth) return;

            const childElements = Array.from(node.children) as HTMLElement[];
            if (childElements.length === 0) return;

            node.style.position = "relative";
            node.style.display = "block";

            const isFlat = variant === "flat";
            const w = hexWidth ?? (isFlat ? 83 : 72);
            const h = hexHeight ?? (isFlat ? 72 : 83);

            if (!isFlat) {
                // Pointy (Variant 1)
                const rowOffsetTop = -14;
                const itemFullWidth = w + gap;

                let maxCols = Math.floor((containerWidth + gap) / itemFullWidth);
                if (maxCols < 1) maxCols = 1;

                let isOffset = false;
                let currentCol = 0;
                let currentRow = 0;

                for (let i = 0; i < childElements.length; i++) {
                    let child = childElements[i];
                    let colsInThisRow = isOffset
                        ? Math.max(1, maxCols - 1)
                        : maxCols;

                    let x = currentCol * itemFullWidth;
                    if (isOffset) {
                        x += w / 2 + gap / 2;
                    }

                    let y = currentRow * (h + rowOffsetTop);

                    child.style.position = "absolute";
                    child.style.left = `${x}px`;
                    child.style.top = `${y}px`;
                    child.style.margin = "0";
                    child.style.width = `${w}px`;
                    child.style.height = `${h}px`;

                    currentCol++;
                    if (currentCol >= colsInThisRow) {
                        currentCol = 0;
                        isOffset = !isOffset;
                        currentRow++;
                    }
                }

                let totalHeight = 0;
                if (currentCol > 0) {
                    totalHeight =
                        currentRow * (h + rowOffsetTop) + h;
                } else {
                    totalHeight =
                        (currentRow - 1) * (h + rowOffsetTop) +
                        h;
                }
                node.style.height = `${totalHeight}px`;

            } else {
                // Flat (Variant 2)
                const colAdvanceX = w * 0.75 + gap;
                const rowAdvanceY = h + gap;

                let maxCols = Math.floor((containerWidth - w) / colAdvanceX) + 1;
                if (containerWidth < w) maxCols = 1;

                let currentCol = 0;
                let currentRow = 0;
                let maxBottom = 0;

                for (let i = 0; i < childElements.length; i++) {
                    let child = childElements[i];

                    let x = currentCol * colAdvanceX;
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

                    const bottom = y + h;
                    if (bottom > maxBottom) maxBottom = bottom;

                    currentCol++;
                    if (currentCol >= maxCols) {
                        currentCol = 0;
                        currentRow++;
                    }
                }

                node.style.height = `${maxBottom}px`;
            }
        }

        // Delay initial layout to next tick to ensure styles are computed
        setTimeout(layout, 0);

        ro = new ResizeObserver(layout);
        ro.observe(node);

        mo = new MutationObserver(layout);
        mo.observe(node, { childList: true });

        return {
            destroy() {
                if (ro) ro.disconnect();
                if (mo) mo.disconnect();
            },
        };
    }
</script>

<div class="hex-honeycomb {className}" use:honeycombLayout>
    {@render children()}
</div>
