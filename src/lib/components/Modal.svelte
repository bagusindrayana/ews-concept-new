<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    show = $bindable(false),
    title = "",
    variant = "medium",
    contentClass = "",
    children,
  }: {
    show: boolean;
    title?: string;
    variant?: "medium" | "large";
    contentClass?: string;
    children: Snippet;
  } = $props();

  function close() {
    show = false;
  }
</script>

{#if show}
  <div class="settings-modal-overlay" onclick={close} role="presentation">
    <div
      class="settings-modal ews-card bordered-red {variant === 'large' ? '!w-11/12 !max-w-4xl' : ''}"
      onclick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div class="ews-card-header bordered-red-bottom overflow-hidden">
        <div class="stripe-wrapper">
          <div class="stripe-bar loop-stripe-reverse anim-duration-20"></div>
          <div class="stripe-bar loop-stripe-reverse anim-duration-20"></div>
        </div>
        <div
          class="absolute top-0 bottom-0 left-0 right-0 flex justify-between items-center px-3"
        >
          <p class="p-1 bg-black font-bold text-sm ews-title text-3xl">
            {title}
          </p>
          <button
            class="bg-black px-2 py-1 cursor-pointer"
            style="color:#e60003"
            onclick={close}>X</button
          >
        </div>
      </div>
      <div class="ews-card-content {variant === 'large' ? 'p-4' : 'p-1 lg:p-2 p-4'} {contentClass}">
        {@render children()}
      </div>
    </div>
  </div>
{/if}
