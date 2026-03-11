<script lang="ts">
  import { onMount } from "svelte";

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
            <span class="text-xl">PERINGATAN</span>
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
        <div class="h-[80px] -mt-10 -mr-2 opacity-0 show-pop-up">
          <div
            class="basic-hex flex flex-col justify-center items-center text-glow"
          >
            <p class="text-xl">{magnitudo}</p>
            <p style="font-size: 10px;">MAGNITUDO</p>
          </div>
        </div>
        <div class="h-[80px] mt-2 opacity-0 show-pop-up">
          <div class="basic-hex"></div>
        </div>
        <div class="h-[80px] -mt-10 -ml-2 opacity-0 show-pop-up">
          <div
            class="basic-hex flex flex-col justify-center items-center text-glow"
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
    <div class="strip top-0">
      <div class="strip-wrapper">
        <div class="strip-bar loop-strip-reverse"></div>
        <div class="strip-bar loop-strip-reverse"></div>
      </div>
    </div>
    <div class="strip bottom-0">
      <div class="strip-wrapper">
        <div class="strip-bar loop-strip"></div>
        <div class="strip-bar loop-strip"></div>
      </div>
    </div>
  </div>
{/if}
