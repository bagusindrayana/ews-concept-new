<script lang="ts">
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
      [any, { side: "left" | "right"; branchIndex: number; index: number; delay: number }]
    >;
    connectorContent?: Snippet<
      [any, { side: "left" | "right"; branchIndex: number; index: number; delay: number }]
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

<div
  class="inline-flex h-auto justify-center gap-4 w-full px-4 overflow-none relative"
>
  {#each chunkedItems as branchItems, branchIndex}
    <div class="relative py-4 lg:py-10 flex flex-col gap-4">
      <!-- Central Spine -->
      <div
        class="absolute h-auto left-1/2 top-0 bottom-0 w-1 bg-primary transform -translate-x-1/2 z-0 line-central"
        style="animation-delay: {branchIndex * 200}ms;"
      ></div>

      <!-- Iterate in pairs essentially by grouping them two by two -->
      <div class="grid grid-cols-2 relative z-10">
        {#each branchItems as item, index}
          {@const side = index % 2 === 0 ? "left" : "right"}
          {@const delay = (branchIndex + 1) * (index + 1) * 10}
          
          <svelte:element
            this={getHref ? "a" : "div"}
            href={getHref?.(item)}
            class="{side === 'left'
              ? 'flex flex-grow justify-end items-center relative pr-0 col-start-1 node'
              : 'flex justify-start items-center relative pl-0 col-start-2 w-auto node-flip'}"
          >
            {#if side === "left"}
              <div class="relative flex parent-node">
                {@render nodeContent(item, { side, branchIndex, index, delay })}
              </div>
              <div class="w-24 flex justify-end relative line">
                <div
                  class="h-[2px] w-24 bg-primary z-0 line-node"
                  style="animation-delay: {delay}ms;"
                ></div>
                {#if connectorContent}
                  <div
                    class="font-bold text-xs uppercase absolute left-2 z-10 text-left top-1 fade-in animation-delay-5 text-primary"
                  >
                    {@render connectorContent(item, { side, branchIndex, index, delay })}
                  </div>
                {/if}
              </div>
            {:else}
              <div class="w-24 flex justify-start relative">
                <div
                  class="h-[2px] w-24 bg-primary z-0 line-node"
                  style="animation-delay: {delay}ms;"
                ></div>
                {#if connectorContent}
                  <div
                    class="font-bold text-xs uppercase absolute z-10 right-2 text-right top-1 fade-in animation-delay-5 text-primary"
                  >
                    {@render connectorContent(item, { side, branchIndex, index, delay })}
                  </div>
                {/if}
              </div>
              <div class="relative flex parent-node flip">
                {@render nodeContent(item, { side, branchIndex, index, delay })}
              </div>
            {/if}
          </svelte:element>
        {/each}
      </div>
    </div>
  {/each}
</div>
