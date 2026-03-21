<script lang="ts">
  import type { InfoTsunami } from "$lib/types";
  import { onMount } from "svelte";
  import HexShape from "./HexShape.svelte";
  import StripeBar from "./StripeBar.svelte";

  interface Props {
    infoTsunami: InfoTsunami;
    closeInSecond?: number;
  }

  let { infoTsunami, closeInSecond = 0 }: Props = $props();

  function generateDiv(max: number) {
    let arrayDivs = [];
    for (let index = 0; index < max; index++) {
      arrayDivs.push({
        index,
        style: `animation-delay: ${index * 0.002}s`,
      });
    }
    return arrayDivs;
  }

  let divs = $state<any[]>([]);
  let close = $state(false);

  let locations = $state<any[]>([]);

  function parseMessage() {
    if (infoTsunami == undefined || infoTsunami.message == undefined) {
      return;
    }
    const match = infoTsunami.message.match(
      /telah terdeteksi di (.*?)(?=Ikuti arahan)/s,
    );

    if (match) {
      const data = match[1]
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v !== "");

      locations = data;
    } else {
      const match2 = infoTsunami.message.match(/lokasi:\s*(.*?WIB)/);

      if (match2) {
        locations = [match2[1]];
      }
    }
  }

  onMount(() => {
    divs = generateDiv(window.screen.width + window.screen.width / 3);
    parseMessage();

    if (closeInSecond && closeInSecond > 0) {
      setTimeout(() => {
        close = true;
      }, closeInSecond * 1000);
    }
  });
</script>

{#if !close}
  <div
    class="fixed m-auto top-0 left-0 right-0 bottom-0 flex justify-center"
    id="tsunami-warning"
    style="z-index: 99;"
  >
    <div class="w-full h-full absolute -rotate-90" style="z-index: 1;">
      <div id="bg-tsunami">
        <div class="hex-bg">
          {#each divs as div}
            <div style={div.style}>
              <img src="/images/warning_hex_red.png" alt="" />
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- random position  -->
    <!-- <div class="w-full h-full absolute" style="z-index: 2;">
      {#each locations as location, i}
        <div
          class="show-pop-up"
          style="position: absolute; top: {Math.floor(Math.random() * 10) *
            110}px; {i % 2 == 0 ? 'left' : 'right'}: {Math.floor(
            Math.random() * 10,
          ) * 110}px; animation-delay: {Math.floor(Math.random() * 10) * 0.1}s;"
        >
          <HexShape
            clipContent={true}
            color="red"
            className="h-[100px] relative"
          >
            <div
              class="flex justify-center items-center text-center absolute bg-black top-0 left-0 bottom-0 right-0"
            >
              <p
                class="text-xs ews-label text-danger w-[60%] break-all break-word"
              >
                {location}
              </p>
            </div>
          </HexShape>
        </div>
      {/each}
    </div> -->

    <div
      class="w-full flex flex-col items-center justify-center"
      style="z-index: 5;"
    >
      <div
        class="warning scale-75 md:scale-100 lg:scale-150 flex flex-col justify-center items-center"
      >
        <div
          class="long-hex h-[150px] flex flex-col justify-center opacity-0 show-pop-up animation-delay-1"
        >
          <div class="flex justify-evenly w-full items-center">
            <div
              class="warning-black opacity-0 blink animation-fast animation-delay-2"
            ></div>
            <div class="flex flex-col font-bold text-center text-black">
              <span class="text-xl">TSUNAMI</span>
              <span class="text-xs">Peringatan Dini Tsunami</span>
            </div>
            <div
              class="warning-black opacity-0 blink animation-fast animation-delay-2"
            ></div>
          </div>
        </div>
        <div
          class="w-3/4 overflow-hidden bg-black relative rounded flex justify-center items-center opacity-0 show-pop-up animation-delay-2"
        >
          <div
            class="absolute w-full h-2 m-auto top-0 left-0 right-0 overflow-hidden"
          >
            <div class="w-2 h-full stripe-bar-red stripe-animation"></div>
          </div>
          <div
            class="absolute w-full h-2 m-auto bottom-0 left-0 right-0 overflow-hidden"
          >
            <div
              class="w-2 h-full stripe-bar-red stripe-animation-reverse"
            ></div>
          </div>
          <div
            class="absolute w-2 h-full m-auto top-0 bottom-0 left-0 overflow-hidden"
          >
            <div
              class="w-2 h-full stripe-bar-red-vertical loop-stripe-vertical-reverse"
            ></div>
          </div>
          <div
            class="absolute w-2 h-full m-auto top-0 bottom-0 right-0 overflow-hidden"
          >
            <div
              class="w-2 h-full stripe-bar-red-vertical loop-stripe-vertical"
            ></div>
          </div>
          <div class="w-full h-full p-6">
            <div class="bordered-red p-2 text-center w-full mb-2">
              <div class="overflow-hidden relative">
                <div class="stripe-wrapper">
                  <div
                    class="stripe-bar loop-stripe-reverse anim-duration-20"
                  ></div>
                  <div
                    class="stripe-bar loop-stripe-reverse anim-duration-20"
                  ></div>
                </div>
                <div
                  class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
                >
                  <p class="p-1 bg-black font-bold text-xs">POTENSI TSUNAMI</p>
                </div>
              </div>
            </div>
            <div class="ews-card ews-card-red w-full h-auto">
              <div class="ews-card-header bordered-red-bottom">
                <div class="overflow-hidden relative">
                  <div class="stripe-wrapper">
                    <div
                      class="stripe-bar loop-stripe-reverse anim-duration-20"
                    ></div>
                    <div
                      class="stripe-bar loop-stripe-reverse anim-duration-20"
                    ></div>
                  </div>
                  <div
                    class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
                  >
                    <p class="p-1 bg-black font-bold text-xs uppercase">
                      {infoTsunami.level ?? "-"}
                    </p>
                  </div>
                </div>
              </div>
              <div class="ews-card-content p-1 lg:p-2 custom-scrollbar">
                <p class="text-xs ews-text" style="font-size: 8px;">
                  {infoTsunami.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="absolute top-0 bottom-0 left-0 right-0" style="z-index: 5;">
      <div class="z-20 absolute top-8 left-8 md:top-28 md:left-28 scale-150">
        <div
          class="p-1 bg-black rounded-xl opacity-0 show-pop-up animation-delay-2"
        >
          <div class="p-1 bordered-red">
            <div class="warning-tsunami-yellow"></div>
          </div>
        </div>
      </div>

      <div
        class="z-20 absolute bottom-8 left-8 md:bottom-28 md:left-28 scale-150"
      >
        <div
          class="p-1 bg-black rounded-xl opacity-0 show-pop-up"
          style="animation-delay: 2.5s"
        >
          <div class="p-1 bordered-red">
            <div class="warning-tsunami-yellow"></div>
          </div>
        </div>
      </div>

      <div class="z-20 absolute top-8 right-8 md:top-28 md:right-28 scale-150">
        <div
          class="p-1 bg-black rounded-xl opacity-0 show-pop-up"
          style="animation-delay: 3s"
        >
          <div class="p-1 bordered-red">
            <div class="warning-tsunami-yellow"></div>
          </div>
        </div>
      </div>

      <div
        class="z-20 absolute bottom-8 right-8 md:bottom-28 md:right-28 scale-150"
      >
        <div
          class="p-1 bg-black rounded-xl opacity-0 show-pop-up"
          style="animation-delay: 3.5s"
        >
          <div class="p-1 bordered-red">
            <div class="warning-tsunami-yellow"></div>
          </div>
        </div>
      </div>

      <div
        class="z-20 absolute h-28 m-auto bottom-0 top-0 right-16 md:right-1/4 hidden md:block scale-150"
      >
        <div
          class="p-1 bg-black rounded-xl opacity-0 show-pop-up"
          style="animation-delay: 2s"
        >
          <div class="p-1 bordered-red">
            <div class="warning-tsunami-yellow"></div>
          </div>
        </div>
      </div>

      <div
        class="z-20 absolute h-28 m-auto bottom-0 top-0 left-16 md:left-1/4 hidden md:block scale-150"
      >
        <div
          class="p-1 bg-black rounded-xl opacity-0 show-pop-up"
          style="animation-delay: 2.5s"
        >
          <div class="p-1 bordered-red">
            <div class="warning-tsunami-yellow"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
