<script lang="ts">
  import { onMount } from "svelte";
  import StripeBar from "./StripeBar.svelte";
  import InfiniteScroll from "./InfiniteScroll.svelte";

  interface GempaBumiAlertProps {
    magnitudo?: number;
    kedalaman?: string;
    show?: boolean;
    closeInSecond?: number;
  }

  let {
    magnitudo = 0,
    kedalaman = "",
    show = false,
    closeInSecond = 0,
  }: GempaBumiAlertProps = $props();
  let close = $state(false);

  onMount(() => {
    const notif = new Audio("/sounds/system-notification-199277.mp3");
    notif.play();

    setTimeout(() => {
      const warning = new Audio("/sounds/error-call-to-attention-129258.mp3");
      warning.play();
    }, 1000);

    if (closeInSecond) {
      setTimeout(() => {
        close = true;
      }, closeInSecond * 1000);
    }
  });
</script>

{#if !close && show}
  <div
    class="absolute m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center"
    style="z-index: 99;"
  >
    <div
      class="fixed m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center overlay-bg"
    ></div>
    <div
      class="warning scale-75 md:scale-150 flex flex-col justify-center items-center"
    >
      <div
        class="long-hex h-[150px] flex flex-col justify-center opacity-0 show-pop-up animation-delay-1"
      >
        <div class="flex justify-evenly w-full items-center">
          <div
            class="warning-black opacity-0 blink animation-fast animation-delay-2"
          ></div>
          <div class="flex flex-col font-bold text-center text-black">
            <span class="text-xl">WARNING</span>
            <span class="text-xs">Gempa Bumi Terdeteksi</span>
          </div>
          <div
            class="warning-black opacity-0 blink animation-fast animation-delay-2"
          ></div>
        </div>
      </div>
      <div class="w-full flex justify-between">
        <div class="warning-black-hex -mt-20 show-pop-up"></div>
        <div class="warning-black-hex -mt-20 show-pop-up"></div>
      </div>
      <div class="w-full flex justify-center info">
        <div
          class="h-[80px] -mt-10 -mr-2 opacity-0 show-pop-up"
          style="animation-delay: 2s;"
        >
          <div
            class="basic-hex flex flex-col justify-center items-center text-primary"
          >
            <p class="text-xl">{magnitudo}</p>
            <p style="font-size: 10px;">MAGNITUDO</p>
          </div>
        </div>
        <div
          class="h-[80px] mt-2 opacity-0 show-pop-up"
          style="animation-delay: 2.2s;"
        >
          <div class="basic-hex"></div>
        </div>
        <div
          class="h-[80px] -mt-10 -ml-2 opacity-0 show-pop-up"
          style="animation-delay: 2.4s;"
        >
          <div
            class="basic-hex flex flex-col justify-center items-center text-primary"
          >
            <p class="text-xl">{kedalaman}</p>
            <p style="font-size: 10px;">KEDALAMAN</p>
          </div>
        </div>
      </div>
      <div class="w-full flex justify-between show-pop-up">
        <div
          class="warning-yellow -mt-24 ml-6 opacity-0 blink animation-delay-2"
        ></div>
        <div
          class="warning-yellow -mt-24 mr-6 opacity-0 blink animation-delay-2"
        ></div>
      </div>
    </div>
    <!-- <div class="absolute top-0">
      <StripeBar loop={true} reverse={true} duration={20}></StripeBar>
    </div>
    <div class="absolute bottom-0">
      <StripeBar loop={true} duration={20}></StripeBar>
    </div> -->

    <div class="flex w-full absolute top-0 left-0 right-0" style="z-index: 2;">
      <StripeBar className="my-2 " size="100px"></StripeBar>
      <StripeBar className="my-2 -scale-x-100 " size="100px"></StripeBar>
      <div
        class="absolute top-0 left-0 bottom-0 right-0 flex items-center justify-center text-center"
      >
        <div class="p-1 bg-black rounded-lg w-full">
          <div class="bordered-red bg-black p-2 w-full text-primary">
            <InfiniteScroll speed={100} gap={48}>
              {#snippet children()}
                <div class="flex flex-col text-center px-4">
                  <b class="text-3xl" style="line-height: 0.8;">EARTHQUAKE</b>
                </div>
              {/snippet}
            </InfiniteScroll>
          </div>
        </div>
      </div>
    </div>

    <div
      class="flex w-full absolute bottom-0 left-0 right-0"
      style="z-index: 2;"
    >
      <StripeBar className="my-2 " size="100px"></StripeBar>
      <StripeBar className="my-2 -scale-x-100 " size="100px"></StripeBar>
      <div
        class="absolute top-0 left-0 bottom-0 right-0 flex items-center justify-center text-center"
      >
        <div class="p-1 bg-black rounded-lg w-full">
          <div class="bordered-red bg-black p-2 w-full text-primary">
            <InfiniteScroll speed={100} gap={48} direction="right">
              {#snippet children()}
                <div class="flex flex-col text-center px-4">
                  <b class="text-3xl" style="line-height: 0.8;">EARTHQUAKE</b>
                </div>
              {/snippet}
            </InfiniteScroll>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
