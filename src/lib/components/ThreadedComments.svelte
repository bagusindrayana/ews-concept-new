<script module lang="ts">
  export type ThreadTone = "normal" | "danger" | "muted";
</script>

<script lang="ts">
  // import { fade } from "svelte/transition";

  type ThreadVariant = "spine" | "threaded";

  interface ThreadItem {
    id: string;
    label: string;
    level?: number;
    tone?: ThreadTone;
    collapsed?: boolean;
    children?: ThreadItem[];
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
    expandable?: boolean;
    onToggle?: (id: string, collapsed: boolean) => void;
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
        children: [
          {
            id: "thread-1-1",
            label: "Operator Verification Note",
            level: 2,
            tone: "muted",
          },
          {
            id: "thread-1-2",
            label: "Follow-up Action Detail",
            level: 3,
            tone: "muted",
          },
        ],
      },
      {
        id: "thread-2",
        label: "Secondary Discussion",
        level: 1,
        tone: "muted",
        children: [
          {
            id: "thread-2-1",
            label: "Nested Reply A",
            level: 2,
            tone: "normal",
          },
          {
            id: "thread-2-2",
            label: "Nested Reply B",
            level: 2,
            tone: "muted",
            children: [
              {
                id: "thread-2-2-1",
                label: "Deep Nested Reply",
                level: 3,
                tone: "muted",
              },
            ],
          },
        ],
      },
      {
        id: "thread-3",
        label: "Final Comment",
        level: 1,
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
    expandable = true,
    onToggle,
  }: Props = $props();

  let collapsedIds = $state(new Set<string>());

  function toggleCollapse(id: string) {
    const newCollapsed = new Set(collapsedIds);
    if (newCollapsed.has(id)) {
      newCollapsed.delete(id);
    } else {
      newCollapsed.add(id);
    }
    collapsedIds = newCollapsed;
    onToggle?.(id, collapsedIds.has(id));
  }

  function flattenItems(
    itemList: ThreadItem[],
    parentCollapsed = false,
  ): (ThreadItem & { parentCollapsed?: boolean })[] {
    const result: (ThreadItem & { parentCollapsed?: boolean })[] = [];
    for (const item of itemList) {
      const isCollapsed = collapsedIds.has(item.id) || parentCollapsed;
      result.push({ ...item, parentCollapsed });
      if (item.children && item.children.length > 0 && !isCollapsed) {
        result.push(...flattenItems(item.children, isCollapsed));
      }
    }
    return result;
  }

  function hasChildren(item: ThreadItem): boolean {
    return !!(item.children && item.children.length > 0);
  }

  function getChildCount(item: ThreadItem): number {
    if (!item.children || item.children.length === 0) return 0;
    let count = item.children.length;
    for (const child of item.children) {
      count += getChildCount(child);
    }
    return count;
  }

  const rowStep = $derived(rowHeight + gap);
  const rootX = $derived(indent);

  const resolvedItems = $derived.by(() =>
    items.length > 0 ? items : defaultItemsByVariant[variant],
  );

  const normalizedItems = $derived.by(() => {
    const items = resolvedItems.map((item, index) => ({
      id: item.id || `threaded-item-${index + 1}`,
      label: item.label || `Item ${index + 1}`,
      level: Math.max(1, Math.floor(item.level ?? 1)),
      tone: item.tone ?? ("muted" as ThreadTone),
      collapsed: item.collapsed ?? false,
      children: item.children,
    }));
    return flattenItems(items);
  });

  const maxLevel = $derived.by(() =>
    normalizedItems.reduce((acc, item) => Math.max(acc, item.level ?? 1), 1),
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

  function getParentIndex(index: number) {
    const currentLevel = normalizedItems[index].level ?? 0;
    for (let i = index - 1; i >= 0; i--) {
      if ((normalizedItems[i].level ?? 0) < currentLevel) {
        return i;
      }
    }
    return -1;
  }

  function animateLine(
    node: SVGLineElement,
    params = { duration: 350, delay: 0 },
  ) {
    const length = Math.hypot(
      (node.x2?.baseVal?.value ?? 0) - (node.x1?.baseVal?.value ?? 0),
      (node.y2?.baseVal?.value ?? 0) - (node.y1?.baseVal?.value ?? 0),
    );

    node.style.strokeDasharray = String(length);
    node.style.strokeDashoffset = String(length);
    node.style.opacity = "0";

    const anim = node.animate(
      [
        { strokeDashoffset: length, opacity: 0 },
        { strokeDashoffset: 0, opacity: 1 },
      ],
      {
        duration: params.duration,
        delay: params.delay,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        fill: "forwards",
      },
    );

    return {
      destroy() {
        anim.cancel();
      },
    };
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
        <!-- <line
          class="connector-line vertical-main"
          x1={2}
          y1={getRowCenter(0)}
          x2={2}
          y2={getRowCenter(normalizedItems.length - 1) + rowHeight / 2 - 2}
          use:animateLine={{ duration: 400, delay: 0 }}
        ></line> -->
        {#if normalizedItems.length > 1 && variant === "spine"}
          {#each normalizedItems as item, index (`${item.id}-${index}-horizontal`)}
            {#if index < normalizedItems.length - 1}
              <line
                class="connector-line vertical-main"
                data-index={index}
                data-length={normalizedItems.length}
                x1={2}
                y1={getRowCenter(index)}
                x2={2}
                y2={getRowCenter(index + 1)}
                use:animateLine={{ duration: 400, delay: 100 * index }}
              ></line>
            {/if}
            <line
              class="connector-line horizontal"
              x1={2}
              y1={getRowCenter(index)}
              x2={getNodeX(item.level ?? 1)}
              y2={getRowCenter(index)}
              use:animateLine={{ duration: 400, delay: 100 * index }}
            ></line>
          {/each}
        {/if}

        {#if variant === "threaded"}
          {#each normalizedItems as item, index (`${item.id}-${index}`)}
            {#if index < normalizedItems.length - 1}
              {@const nextItem = normalizedItems[index + 1]}
              {@const isParent = (nextItem.level ?? 1) >= (item.level ?? 1)}

              <line
                class="connector-line vertical-main"
                data-index={index}
                data-length={normalizedItems.length}
                x1={2}
                y1={getRowCenter(index)}
                x2={2}
                y2={getRowCenter(index + 1)}
                use:animateLine={{ duration: 400, delay: 100 * index }}
              ></line>
              {#if !isParent && item.children != undefined && item.children?.length > 0 && item.collapsed}
                <line
                  class="connector-line horizontal-1"
                  x1={2}
                  y1={getRowCenter(index)}
                  x2={getNodeX(item.level ?? 1) + 2}
                  y2={getRowCenter(index)}
                  data-level={item.level}
                  use:animateLine={{ duration: 400, delay: 100 * index }}
                ></line>
              {/if}
            {/if}
          {/each}

          {#each normalizedItems as item, index (`${item.id}-${index}-horizontal`)}
            {#if index > 0 && getParentIndex(index) >= 0}
              <line
                class="connector-line vertical-2"
                data-index={index}
                data-index-parent={getParentIndex(index)}
                data-length={normalizedItems.length}
                data-offset-y={rowStep * index}
                x1={((item.level ?? 1) - 1) * rootX + 2}
                y1={getRowCenter(index) -
                  rowStep * (index - getParentIndex(index))}
                x2={((item.level ?? 1) - 1) * rootX + 2}
                y2={getRowCenter(index + 1) - rowStep}
                use:animateLine={{ duration: 400, delay: 100 * index }}
              ></line>
            {/if}

            <line
              class="connector-line horizontal-2"
              x1={((item.level ?? 1) - 1) * rootX + 2}
              y1={getRowCenter(index)}
              x2={getNodeX(item.level ?? 1) + 2}
              y2={getRowCenter(index)}
              data-level={item.level}
              use:animateLine={{ duration: 400, delay: 100 * index }}
            ></line>
          {/each}
        {/if}
      </svg>

      {#each normalizedItems as item, index (item.id)}
        {@const isCollapsed = collapsedIds.has(item.id)}
        {@const hasKids = hasChildren(item)}
        {@const childCount = getChildCount(item)}
        <div
          class="threaded-node-wrap"
          style:top={`${index * rowStep}px`}
          style:left={`${getNodeX(item.level ?? 1)}px`}
          style:height={`${rowHeight}px`}
          style:right={"0"}
          class:collapsed={isCollapsed}
          class:has-children={hasKids && expandable}
        >
          <div
            class="threaded-node {item.tone}"
            class:is-collapsed={isCollapsed}
          >
            {#if expandable && hasKids}
              <button
                class="expand-toggle"
                onclick={() => toggleCollapse(item.id)}
                aria-label={isCollapsed ? "Expand" : "Collapse"}
              >
                <span class="toggle-icon" class:collapsed={isCollapsed}>
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path
                      d="M4.5 5.5l3.5 3.5 3.5-3.5"
                      stroke="currentColor"
                      stroke-width="1.5"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                {#if isCollapsed}
                  <span class="child-count">{childCount}</span>
                {/if}
              </button>
            {/if}
            <span class="node-label">{item.label}</span>
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
    transition:
      height 0.25s ease,
      width 0.25s ease;
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
    transition: all 0.25s ease;
  }

  .threaded-node-wrap {
    position: absolute;
    display: flex;
    align-items: center;
    transition:
      opacity 0.25s ease,
      transform 0.25s ease,
      top 0.25s ease,
      left 0.25s ease;
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

  .expand-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px;
    margin-right: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    cursor: pointer;
    color: inherit;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .expand-toggle:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .toggle-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    transition: transform 0.2s ease;
  }

  .toggle-icon svg {
    width: 12px;
    height: 12px;
  }

  .toggle-icon.collapsed {
    transform: rotate(-90deg);
  }

  .child-count {
    font-size: 0.6rem;
    font-weight: 600;
    padding: 0 4px;
    background: rgba(var(--glow-rgb), 0.3);
    border-radius: 8px;
    letter-spacing: 0;
  }

  .node-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .threaded-node-wrap.collapsed {
    opacity: 0.5;
  }

  .threaded-node.is-collapsed {
    font-style: italic;
  }

  .ews-threaded-comments:not(.primary) .expand-toggle {
    background: rgba(255, 255, 255, 0.05);
  }

  .ews-threaded-comments.neutral .child-count {
    background: rgba(226, 231, 236, 0.2);
  }

  .ews-threaded-comments.danger .child-count {
    background: rgba(var(--danger-glow-rgb), 0.3);
  }

  @media (max-width: 768px) {
    .threaded-node {
      font-size: 0.65rem;
      letter-spacing: 0.05em;
    }
  }
</style>
