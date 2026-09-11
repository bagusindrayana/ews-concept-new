<script lang="ts">
  import type { InfoTsunami } from "$lib/types";
  import { onMount } from "svelte";
  import HexShape from "./HexShape.svelte";
  import StripeBar from "./StripeBar.svelte";
  import HexGrid from "./HexGrid.svelte";

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
    // divs = generateDiv(window.screen.width + window.screen.width / 2);
    // divs = generateDiv(
    //   Math.max(window.screen.width + 10, window.screen.height + 10),
    // );
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
    class="fixed w-[110%] top-[-50px] left-[-50px]"
    style="background-color:rgba(0, 0, 0, 0.7)"
  >
    <HexGrid variant="flat" align="center">
      {#each { length: Math.max(window.screen.width + 10, window.screen.height + 10) / 2 } as _, hexIndex}
        <div
          class="w-full h-full cursor-pointer select-none relative opacity-0 show-pop-up"
          style="animation-delay: {hexIndex * 5}ms;"
        >
          <!-- <HexShape
            clipContent={true}
            className="w-full h-full transition-all duration-150 hover:brightness-125"
          >
            <div
              class="w-full h-full flex flex-col items-center justify-center text-center text-black px-4"
            >
              <span
                class="text-[11px] sm:text-xs font-black uppercase tracking-wide leading-tight truncate max-w-full"
              >
                N/A
              </span>
            </div>
          </HexShape> -->
          <img src="/images/warning_hex_red.png" alt="" />
        </div>
      {/each}
    </HexGrid>
  </div>
  <div
    class="fixed m-auto top-0 left-0 right-0 bottom-0 flex justify-center"
    id="tsunami-warning"
    style="z-index: 99;"
  >
    <!-- <div class="w-full h-full bg-black" style="z-index: 1;">
      <div id="bg-tsunami">
        <div class="hex-bg">
          {#each divs as div}
            <div style={div.style}>
              <img src="/images/warning_hex_red.png" alt="" />
            </div>
          {/each}
        </div>
      </div>
      
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
          class="w-11/12 md:w-3/4 overflow-hidden bg-black relative rounded flex justify-center items-center opacity-0 show-pop-up animation-delay-2"
        >
          <div
            class="absolute w-full h-2 m-auto top-0 left-0 right-0 overflow-hidden"
          >
            <StripeBar color="red" loop={true} className="w-full h-2"
            ></StripeBar>
          </div>
          <div
            class="absolute w-full h-2 m-auto bottom-0 left-0 right-0 overflow-hidden"
          >
            <StripeBar
              color="red"
              loop={true}
              reverse={true}
              className="w-full h-2"
            ></StripeBar>
          </div>
          <div
            class="absolute w-2 h-full m-auto top-0 bottom-0 left-0 overflow-hidden"
          >
            <StripeBar
              color="red"
              orientation="vertical"
              reverse={true}
              loop={true}
              className="w-2 h-full"
            ></StripeBar>
          </div>
          <div
            class="absolute w-2 h-full m-auto top-0 bottom-0 right-0 overflow-hidden"
          >
            <StripeBar
              color="red"
              orientation="vertical"
              loop={true}
              className="w-2 h-full"
            ></StripeBar>
          </div>
          <div class="w-full h-full p-6">
            <div class="bordered-red p-2 text-center w-full mb-2">
              <div class="overflow-hidden relative">
                <StripeBar loop={true} reverse={true} duration={20}></StripeBar>
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
                  <StripeBar loop={true} reverse={true} duration={20}
                  ></StripeBar>
                  <div
                    class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
                  >
                    <p class="p-1 bg-black font-bold text-xs uppercase">
                      {infoTsunami.level ?? "-"}
                    </p>
                  </div>
                </div>
              </div>
              {#if infoTsunami.message?.trim() != "" && infoTsunami.message?.trim() != undefined}
                <div
                  class="infoTsunamiAlert ews-card-content p-1 lg:p-2 custom-scrollbar h-[180px]"
                >
                  <p
                    class="text-xs ews-text break-words text-ellipsis line-clamp-10"
                    style="font-size: 8px;"
                  >
                    {infoTsunami.message}
                  </p>
                </div>
              {/if}
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
