<script lang="ts">
    import { serialStore } from "$lib/stores/serialStore";
    import { fade } from "svelte/transition";
    import StripeBar from "./StripeBar.svelte";

    let status = $derived($serialStore.status);
    let error = $derived($serialStore.error);

    const statusProps = {
        connected: {
            color: "green",
            label: "LINKED",
            loop: true,
            reverse: false,
        },
        disconnected: {
            color: "",
            label: "LINK ESP32",
            loop: false,
            reverse: false,
        },
        unsupported: {
            color: "red",
            label: "NO SERIAL",
            loop: false,
            reverse: false,
        },
        connecting: {
            color: "blue",
            label: "LINKING...",
            loop: true,
            reverse: true,
        },
    };

    async function handleConnect() {
        if (status === "connected") {
            await serialStore.disconnect();
        } else {
            await serialStore.connect();
        }
    }
</script>

<div class="flex flex-col items-start no-snapshot">
    <button
        onclick={handleConnect}
        disabled={status === "unsupported" || status === "connecting"}
        class="ews-btn ews-btn-primary w-full"
    >
        {statusProps[status].label}
    </button>

    {#if status === "connected"}
        <button
            onclick={() => serialStore.testConnection()}
            class="ews-btn ews-btn-danger w-full"
        >
            TEST BEEP / HEARTBEAT
        </button>
    {/if}

    {#if error}
        <div
            transition:fade
            class="bg-red-950/80 border border-red-500/50 text-red-400 px-3 py-1 text-[10px] font-mono uppercase"
        >
            ERROR: {error}
        </div>
    {/if}
</div>
