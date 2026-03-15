<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        children?: Snippet;
        className?: string;
        color?: string;
        flatTop?: boolean;
        clipContent?: boolean;
        paddingContent?: number;
    }

    let {
        children,
        className = "",
        color = "",
        flatTop = true,
        clipContent = false,
        paddingContent = 10,
    }: Props = $props();
</script>

<div
    class="hex-shape {flatTop ? 'flat-top' : ''} {color} {clipContent
        ? 'clip-content'
        : ''} flex flex-col justify-center items-center {className}"
>
    <div class="inner-content" style={`--hex-padding: ${paddingContent}px;`}>
        {#if children}
            {@render children()}
        {/if}
    </div>
</div>
