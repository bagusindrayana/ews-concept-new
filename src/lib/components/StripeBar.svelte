<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        children?: Snippet;
        className?: string;
        color?: string;
        orientation?: string;
        loop?: boolean;
        reverse?: boolean;
        duration?: number;
    }

    let {
        children,
        className = "",
        color = "",
        orientation = "",
        loop = false,
        reverse = false,
        duration = 10,
    }: Props = $props();
</script>

<div class="overflow-hidden {className}">
    <div class="stripe-wrapper {orientation}">
        <div
            class="stripe-bar {color} {orientation} {loop
                ? 'loop-stripe'
                : ''}{orientation ? '-' + orientation : ''} {reverse
                ? 'reverse'
                : ''} anim-duration-{duration}"
        ></div>
        <div
            class="stripe-bar {color} {orientation} {loop
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
