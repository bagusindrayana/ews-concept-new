<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
    title?: Snippet;
    footer?: Snippet;
    className?: string;
    borderColor?: string;
    onToggle?: () => void;
  }

  let { children, title, footer, className = "", onToggle }: Props = $props();
  let open = $state(false);
</script>

<div class="card bordered-red {className}" class:open>
  {#if title}
    <div
      class="card-header bordered-red-bottom"
      onclick={() => {
        open = !open;
        onToggle?.();
      }}
    >
      {@render title()}
    </div>
  {/if}
  <div class="card-content p-2 custom-scrollbar">
    {@render children()}
  </div>
  {#if footer}
    <div class="card-footer bordered-red-top">
      {@render footer()}
    </div>
  {/if}
</div>
