<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    /** Gap antar item (px) */
    gap?: number;
    /** Kecepatan scroll: pixel per detik */
    speed?: number;
    /** Arah scroll: 'left' = normal, 'right' = reverse */
    direction?: "left" | "right";
    /** Pause saat hover */
    pauseOnHover?: boolean;
    /** Class tambahan untuk wrapper luar */
    className?: string;
    children?: import("svelte").Snippet;
  }

  let {
    gap = 24,
    speed = 80,
    direction = "left",
    pauseOnHover = false,
    className = "",
    children,
  }: Props = $props();

  let containerEl: HTMLDivElement;
  let trackEl: HTMLDivElement;
  let animFrame: number;
  let offset = 0;
  let cloneCount = $state(1);
  let singleWidth = 0;
  let lastTime: number | null = null;
  let paused = false;

  /**
   * Hitung berapa kali child perlu di-clone agar track selalu lebih lebar dari container,
   * termasuk gap antar item.
   */
  function calcClones() {
    if (!containerEl || !trackEl) return;
    const containerW = containerEl.getBoundingClientRect().width;
    // Ambil lebar satu "set" original items (slot pertama)
    const firstSet = trackEl.querySelector<HTMLElement>(".scroll-set");
    if (!firstSet) return;
    singleWidth = firstSet.getBoundingClientRect().width + gap;
    // Kloning minimal agar total lebar > 2x container (agar seamless loop)
    const needed = Math.ceil((containerW * 2) / singleWidth) + 1;
    cloneCount = Math.max(needed, 2);
  }

  function tick(ts: number) {
    if (!paused) {
      if (lastTime !== null) {
        const dt = (ts - lastTime) / 1000;
        offset += speed * dt;
        if (singleWidth > 0 && offset >= singleWidth) {
          offset -= singleWidth;
        }
      }
      lastTime = ts;
    } else {
      lastTime = ts; // reset agar tidak jump saat resume
    }

    if (trackEl) {
      const sign = direction === "right" ? 1 : -1;
      trackEl.style.transform = `translateX(${sign * offset}px)`;
    }
    animFrame = requestAnimationFrame(tick);
  }

  onMount(() => {
    // Hitung clone setelah render awal
    calcClones();
    // Tunggu $state update (clones dirender), lalu hitung ulang
    requestAnimationFrame(() => {
      calcClones();
      animFrame = requestAnimationFrame(tick);
    });

    const ro = new ResizeObserver(() => {
      calcClones();
      offset = 0;
      lastTime = null;
    });
    ro.observe(containerEl);

    return () => {
      cancelAnimationFrame(animFrame);
      ro.disconnect();
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="infinite-scroll-container {className}"
  bind:this={containerEl}
  onmouseenter={() => { if (pauseOnHover) paused = true; }}
  onmouseleave={() => { if (pauseOnHover) paused = false; }}
>
  <div
    class="infinite-scroll-track"
    bind:this={trackEl}
    style="gap: {gap}px;"
  >
    <!--
      Render (1 + cloneCount) sets: index 0 adalah original,
      sisanya adalah clone agar container selalu penuh.
    -->
    {#each { length: 1 + cloneCount } as _, i}
      <div class="scroll-set" aria-hidden={i > 0 ? "true" : undefined}>
        {@render children?.()}
      </div>
    {/each}
  </div>
</div>

<style>
  .infinite-scroll-container {
    overflow: hidden;
    width: 100%;
    position: relative;
  }

  .infinite-scroll-track {
    display: flex;
    flex-wrap: nowrap;
    will-change: transform;
  }

  .scroll-set {
    display: flex;
    flex-shrink: 0;
    align-items: center;
  }
</style>
