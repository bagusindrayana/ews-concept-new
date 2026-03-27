<script lang="ts">
  import "../styles/components/RibLayout.css";
  import { onMount, onDestroy } from "svelte";
  import type { Snippet } from "svelte";

  let {
    items = [],
    nodeContent,
    connectorContent,
    getHref,
  }: {
    items: any[];
    nodeContent: Snippet<
      [
        any,
        {
          side: "left" | "right";
          branchIndex: number;
          index: number;
          delay: number;
        },
      ]
    >;
    connectorContent?: Snippet<
      [
        any,
        {
          side: "left" | "right";
          branchIndex: number;
          index: number;
          delay: number;
        },
      ]
    >;
    getHref?: (item: any) => string;
  } = $props();

  let branchCount = $state(5);
  let windowWidth = $state(0);

  function getBranchCount(width: number): number {
    if (width < 768) return 1;
    if (width < 1024) return 2;
    if (width < 1300) return 4;
    return 5;
  }

  function handleResize() {
    windowWidth = typeof window !== "undefined" ? window.innerWidth : 0;
    branchCount = getBranchCount(windowWidth);
  }

  let chunkedItems = $derived.by(() => {
    if (items.length === 0) return [];
    const count = Math.max(1, branchCount);
    const result = [];
    const itemsPerBranch = Math.ceil(items.length / count);

    for (let i = 0; i < items.length; i += itemsPerBranch) {
      result.push(items.slice(i, i + itemsPerBranch));
    }
    return result;
  });

  onMount(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", handleResize);
    }
  });
</script>

<div class="ews-rib-layout">
  {#each chunkedItems as branchItems, branchIndex}
    <div class="ews-rib-layout__branch">
      <!-- Central Spine -->
      <div
        class="ews-rib-layout__spine line-central"
        style="animation-delay: {branchIndex * 200}ms;"
      ></div>

      <!-- Iterate in pairs essentially by grouping them two by two -->
      <div class="ews-rib-layout__grid">
        {#each branchItems as item, index}
          {@const side = index % 2 === 0 ? "left" : "right"}
          {@const delay = (branchIndex + 1) * (index + 1) * 10}

          <svelte:element
            this={getHref ? "a" : "div"}
            href={getHref?.(item)}
            class="ews-rib-layout__node {side === 'left'
              ? 'ews-rib-layout__node--left node'
              : 'ews-rib-layout__node--right node-flip'}"
          >
            {#if side === "left"}
              <div class="ews-rib-layout__node-content parent-node">
                {@render nodeContent(item, { side, branchIndex, index, delay })}
              </div>
              <div
                class="ews-rib-layout__connector-wrapper ews-rib-layout__connector-wrapper--left line"
              >
                <div
                  class="ews-rib-layout__connector-line line-node"
                  style="animation-delay: {delay}ms;"
                ></div>
                {#if connectorContent}
                  <div
                    class="ews-rib-layout__connector-text ews-rib-layout__connector-text--left fade-in animation-delay-5"
                  >
                    {@render connectorContent(item, {
                      side,
                      branchIndex,
                      index,
                      delay,
                    })}
                  </div>
                {/if}
              </div>
            {:else}
              <div
                class="ews-rib-layout__connector-wrapper ews-rib-layout__connector-wrapper--right"
              >
                <div
                  class="ews-rib-layout__connector-line line-node"
                  style="animation-delay: {delay}ms;"
                ></div>
                {#if connectorContent}
                  <div
                    class="ews-rib-layout__connector-text ews-rib-layout__connector-text--right fade-in animation-delay-5"
                  >
                    {@render connectorContent(item, {
                      side,
                      branchIndex,
                      index,
                      delay,
                    })}
                  </div>
                {/if}
              </div>
              <div
                class="ews-rib-layout__node-content ews-rib-layout__node-content--right parent-node flip"
              >
                {@render nodeContent(item, { side, branchIndex, index, delay })}
              </div>
            {/if}
          </svelte:element>
        {/each}
      </div>
    </div>
  {/each}
</div>
