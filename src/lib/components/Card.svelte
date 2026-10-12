<script lang="ts">
  import "../styles/components/Card.css";
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
    title?: Snippet;
    footer?: Snippet;
    className?: string;
    borderColor?: string;
    onToggle?: () => void;
  }

  let { children, title, footer, className = "", borderColor, onToggle }: Props = $props();
  let open = $state(false);
</script>

<div class="ews-card {className} bordered-{borderColor}" class:open>
  {#if title}
    <div 
      class="ews-card-header bordered-{borderColor}-bottom"
      onclick={() => {
        open = !open;
        onToggle?.();
      }}
    >
      {@render title()}
    </div>
  {/if}
  <div class="ews-card-content">
    {@render children()}
  </div>
  {#if footer}
    <div class="ews-card-footer">
      {@render footer()}
    </div>
  {/if}
</div>
