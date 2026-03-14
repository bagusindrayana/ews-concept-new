<script lang="ts">
  import type { TitikTsunami } from "./TitikTsunami";

  interface Props {
    alertTsunami: TitikTsunami;
  }

  let { alertTsunami }: Props = $props();

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

  let divs = $derived(
    generateDiv(window.screen.width + window.screen.width / 3),
  );
</script>

<div
  class="fixed m-auto top-0 left-0 right-0 bottom-0 flex justify-center"
  id="tsunami-warning"
>
  <div class="w-full h-full absolute -rotate-90">
    <div class="main" id="bg-tsunami">
      <div class="hex-bg">
        {#each divs as div}
          <div style={div.style}>
            <img src="/images/warning_hex_red.png" alt="" />
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="w-full flex flex-col items-center justify-center">
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
          <div class="w-2 h-full strip-bar-red strip-animation"></div>
        </div>
        <div
          class="absolute w-full h-2 m-auto bottom-0 left-0 right-0 overflow-hidden"
        >
          <div class="w-2 h-full strip-bar-red strip-animation-reverse"></div>
        </div>
        <div
          class="absolute w-2 h-full m-auto top-0 bottom-0 left-0 overflow-hidden"
        >
          <div
            class="w-2 h-full strip-bar-red-vertical loop-strip-vertical-reverse"
          ></div>
        </div>
        <div
          class="absolute w-2 h-full m-auto top-0 bottom-0 right-0 overflow-hidden"
        >
          <div
            class="w-2 h-full strip-bar-red-vertical loop-strip-vertical"
          ></div>
        </div>
        <div class="w-full h-full p-6">
          <div class="bordered-red p-2 text-center w-full mb-2">
            <div class="overflow-hidden relative">
              <div class="strip-wrapper">
                <div
                  class="strip-bar loop-strip-reverse anim-duration-20"
                ></div>
                <div
                  class="strip-bar loop-strip-reverse anim-duration-20"
                ></div>
              </div>
              <div
                class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
              >
                <p class="p-1 bg-black font-bold text-xs text-glow">
                  POTENSI TSUNAMI
                </p>
              </div>
            </div>
          </div>
          <div class="ews-card bordered-red w-full h-auto">
            <div class="ews-card-header bordered-red-bottom">
              <div class="overflow-hidden relative">
                <div class="strip-wrapper">
                  <div
                    class="strip-bar loop-strip-reverse anim-duration-20"
                  ></div>
                  <div
                    class="strip-bar loop-strip-reverse anim-duration-20"
                  ></div>
                </div>
                <div
                  class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
                >
                  <p class="p-1 bg-black font-bold text-xs text-glow uppercase">
                    {alertTsunami.infoTsunami.level}
                  </p>
                </div>
              </div>
            </div>
            <div class="ews-card-content p-1 lg:p-2 custom-scrollbar">
              <p class="text-xs">
                {alertTsunami.infoTsunami.message}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="absolute top-0 bottom-0 left-0 right-0">
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
