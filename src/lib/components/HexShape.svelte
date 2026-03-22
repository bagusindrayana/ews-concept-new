<script lang="ts">
    import "../styles/components/HexShape.css";
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
    class="ews-hex-shape {flatTop ? 'flat-top' : ''} {color} {clipContent
        ? 'clip-content'
        : ''} {className}"
>
    <div
        class="inner-content"
        style={`--ews-hex-padding: ${paddingContent}px;`}
    >
        {#if children}
            {@render children()}
        {/if}
    </div>
</div>
