<script lang="ts">
    import "../styles/components/StripeBar.css";
    import type { Snippet } from "svelte";

    interface Props {
        children?: Snippet;
        className?: string;
        color?: string;
        orientation?: string;
        loop?: boolean;
        reverse?: boolean;
        duration?: number;
        size?: string;
    }

    let {
        children,
        className = "",
        color = "",
        orientation = "",
        loop = false,
        reverse = false,
        duration = 10,
        size = "30px",
    }: Props = $props();
</script>

<div style="overflow: hidden;" class={className}>
    <div
        class="ews-stripe-wrapper {orientation}"
        style="{orientation == 'vertical' ? 'width' : 'height'}: {size};"
    >
        <div
            class="ews-stripe-bar {color} {orientation} {loop
                ? 'loop-stripe'
                : ''}{orientation ? '-' + orientation : ''} {reverse
                ? 'reverse'
                : ''} anim-duration-{duration}"
        ></div>
        <div
            class="ews-stripe-bar {color} {orientation} {loop
                ? 'loop-stripe'
                : ''}{orientation ? '-' + orientation : ''} {reverse
                ? 'reverse'
                : ''} anim-duration-{duration}"
        ></div>
    </div>
    {#if children}
        {@render children()}
    {/if}
</div>
