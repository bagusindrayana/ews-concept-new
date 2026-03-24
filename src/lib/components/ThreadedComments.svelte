<script lang="ts">
  type ThreadVariant = "spine" | "threaded";
  type ThreadTone = "normal" | "danger" | "muted";

  interface ThreadItem {
    id: string;
    label: string;
    level?: number;
    tone?: ThreadTone;
  }

  interface Props {
    items?: ThreadItem[];
    variant?: ThreadVariant;
    className?: string;
    nodeWidth?: number;
    rowHeight?: number;
    indent?: number;
    tone?: "neutral" | "primary" | "danger";
    gap?: number;
  }

  const defaultItemsByVariant: Record<ThreadVariant, ThreadItem[]> = {
    spine: [
      {
        id: "spine-1",
        label: "Primary Alert Message",
        level: 1,
        tone: "normal",
      },
      {
        id: "spine-2",
        label: "Operator Verification Note",
        level: 2,
        tone: "muted",
      },
      {
        id: "spine-3",
        label: "Follow-up Action Detail",
        level: 3,
        tone: "muted",
      },
    ],
    threaded: [
      {
        id: "thread-1",
        label: "Primary Alert Message",
        level: 1,
        tone: "normal",
      },
      {
        id: "thread-2",
        label: "Operator Verification Note",
        level: 1,
        tone: "muted",
      },
      {
        id: "thread-3",
        label: "Follow-up Action Detail",
        level: 2,
        tone: "muted",
      },
    ],
  };

  let {
    items = [],
    variant = "spine",
    className = "",
    nodeWidth = 280,
    rowHeight = 42,
    indent = 21,
    tone = "primary",
    gap = 16,
  }: Props = $props();

  const rowStep = $derived(rowHeight + gap);
  const rootX = $derived(indent);

  const resolvedItems = $derived.by(() =>
    items.length > 0 ? items : defaultItemsByVariant[variant],
  );

  const normalizedItems = $derived.by(() =>
    resolvedItems.map((item, index) => ({
      id: item.id || `threaded-item-${index + 1}`,
      label: item.label || `Item ${index + 1}`,
      level: Math.max(1, Math.floor(item.level ?? 1)),
      tone: item.tone ?? ("muted" as ThreadTone),
    })),
  );

  const maxLevel = $derived.by(() =>
    normalizedItems.reduce((acc, item) => Math.max(acc, item.level), 1),
  );

  const canvasHeight = $derived.by(() => {
    if (normalizedItems.length === 0) return rowHeight;
    return normalizedItems.length * rowStep - gap;
  });

  const canvasWidth = $derived.by(() => getNodeX(maxLevel) + nodeWidth + 8);

  function getDepthX(depth: number) {
    if (depth <= 0) return rootX;
    return rootX + depth * indent;
  }

  function getNodeX(level: number) {
    return getDepthX(level);
  }

  function getRowCenter(index: number) {
    return index * rowStep + rowHeight / 2;
  }

  function getHorizontalStartX(level: number) {
    if (variant === "spine") return rootX;
    return getDepthX(level - 1);
  }

  function getThreadedVerticalX(currentLevel: number, nextLevel: number) {
    if (nextLevel > currentLevel) return getDepthX(currentLevel);
    if (nextLevel === currentLevel) return getDepthX(currentLevel - 1);
    return getDepthX(nextLevel - 1);
  }
</script>

<div class="ews-threaded-comments {tone} {className}">
  <div class="threaded-scroll">
    <div
      class="threaded-canvas"
      style:height={`${canvasHeight}px`}
      style:width={`100%`}
    >
      <svg
        class="threaded-connectors"
        viewBox={`0 0 100% ${canvasHeight}`}
        role="presentation"
        aria-hidden="true"
      >
        {#if normalizedItems.length > 1 && variant === "spine"}
          <line
            class="connector-line"
            x1={rootX / 2}
            y1={getRowCenter(0)}
            x2={rootX / 2}
            y2={getRowCenter(normalizedItems.length - 1) + rowHeight / 2 - 2}
          ></line>
        {/if}

        {#if variant === "threaded"}
          {#each normalizedItems as item, index (item.id)}
            {#if index < normalizedItems.length - 1}
              {@const nextItem = normalizedItems[index + 1]}
              <line
                class="connector-line"
                x1={getThreadedVerticalX(item.level, nextItem.level) / 2}
                y1={getRowCenter(index)}
                x2={getThreadedVerticalX(item.level, nextItem.level) / 2}
                y2={getRowCenter(index + 1)}
              ></line>
            {/if}
          {/each}
        {/if}

        {#each normalizedItems as item, index (`${item.id}-horizontal`)}
          <line
            class="connector-line"
            x1={getHorizontalStartX(item.level) -
              getHorizontalStartX(item.level) / 2}
            y1={getRowCenter(index)}
            x2={getNodeX(item.level)}
            y2={getRowCenter(index)}
          ></line>
        {/each}
      </svg>

      {#each normalizedItems as item, index (item.id)}
        <div
          class="threaded-node-wrap"
          style:top={`${index * rowStep}px`}
          style:left={`${getNodeX(item.level)}px`}
          // style:width={`${nodeWidth}px`}
          style:height={`${rowHeight}px`}
          style:right={"0"}
        >
          <div class="threaded-node {item.tone}">
            <span>{item.label}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .ews-threaded-comments {
    --line-color: rgba(var(--glow-rgb), 0.85);
    --line-glow: rgba(var(--glow-rgb), 0.5);
    width: 100%;
  }

  .ews-threaded-comments.neutral {
    --line-color: rgba(226, 231, 236, 0.92);
    --line-glow: rgba(255, 255, 255, 0.3);
  }

  .ews-threaded-comments.primary {
    --line-color: rgba(var(--glow-rgb), 0.88);
    --line-glow: rgba(var(--glow-rgb), 0.45);
  }

  .ews-threaded-comments.danger {
    --line-color: rgba(var(--danger-glow-rgb), 0.9);
    --line-glow: rgba(var(--danger-glow-rgb), 0.45);
  }

  .threaded-scroll {
    width: 100%;
    /* overflow-x: auto;
    overflow-y: hidden; */
    padding-bottom: 4px;
  }

  .threaded-canvas {
    position: relative;
    min-width: 100%;
  }

  .threaded-connectors {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .connector-line {
    stroke: var(--line-color);
    stroke-width: 2;
    filter: drop-shadow(0 0 2px var(--line-glow));
  }

  .threaded-node-wrap {
    position: absolute;
    display: flex;
    align-items: center;
  }

  .threaded-node {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    padding: 0 14px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: linear-gradient(
      90deg,
      rgba(36, 36, 36, 0.98),
      rgba(62, 62, 62, 0.98)
    );
    border: 1px solid rgba(255, 255, 255, 0.16);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.65);
    color: #f4f4f4;
  }

  .threaded-node.normal {
    color: var(--text-color);
    border-color: rgba(var(--glow-rgb), 0.55);
    box-shadow:
      inset 0 0 0 1px rgba(var(--glow-rgb), 0.18),
      0 0 8px rgba(var(--glow-rgb), 0.12);
    background: linear-gradient(
      90deg,
      rgba(var(--glow-rgb), 0.1),
      rgba(var(--glow-rgb), 0.1)
    );
  }

  .threaded-node.danger {
    color: var(--danger-text-color);
    border-color: rgba(var(--danger-glow-rgb), 0.7);
    box-shadow:
      inset 0 0 0 1px rgba(var(--danger-glow-rgb), 0.2),
      0 0 8px rgba(var(--danger-glow-rgb), 0.14);
    background: linear-gradient(
      90deg,
      rgba(var(--danger-glow-rgb), 0.1),
      rgba(var(--danger-glow-rgb), 0.1)
    );
  }

  .threaded-node.muted {
    border-color: rgba(255, 255, 255, 0.2);
  }

  @media (max-width: 768px) {
    .threaded-node {
      font-size: 0.65rem;
      letter-spacing: 0.05em;
    }
  }
</style>
