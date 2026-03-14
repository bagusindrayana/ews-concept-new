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

<div class="ews-card bordered-red {className}" class:open>
  {#if title}
    <div
      class="ews-card-header bordered-red-bottom"
      onclick={() => {
        open = !open;
        onToggle?.();
      }}
    >
      {@render title()}
    </div>
  {/if}
  <div class="ews-card-content p-1 lg:p-2 custom-scrollbar">
    {@render children()}
  </div>
  {#if footer}
    <div class="ews-card-footer bordered-red-top">
      {@render footer()}
    </div>
  {/if}
</div>
