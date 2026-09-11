<script lang="ts">
  import type { InfoTsunami } from "$lib/types";
  import { onMount, onDestroy } from "svelte";
  import StripeBar from "./StripeBar.svelte";
  import HexGrid, { type HexRevealVariant } from "./HexGrid.svelte";

  interface Props {
    infoTsunami: InfoTsunami;
    closeInSecond?: number;
    onClose?: () => void;
    revealVariant?: HexRevealVariant | string;
  }

  let {
    infoTsunami,
    closeInSecond = 10,
    onClose,
    revealVariant = "diagonal-top-left",
  }: Props = $props();

  let isClosing = $state(false);
  let isDestroyed = $state(false);
  let locations = $state<string[]>([]);

  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let exitTimer: ReturnType<typeof setTimeout> | null = null;

  function parseMessage() {
    if (!infoTsunami || !infoTsunami.message) {
      return;
    }
    const match = infoTsunami.message.match(
      /telah terdeteksi di (.*?)(?=Ikuti arahan)/s,
    );

    if (match) {
      locations = match[1]
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v !== "");
    } else {
      const match2 = infoTsunami.message.match(/lokasi:\s*(.*?WIB)/);
      if (match2) {
        locations = [match2[1]];
      }
    }
  }

  export function dismiss() {
    if (isClosing || isDestroyed) return;
    isClosing = true;

    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    exitTimer = setTimeout(() => {
      isDestroyed = true;
      onClose?.();
    }, 1200);
  }

  // Svelte out transition for when parent unmounts the component
  function tsunamiExit(node: HTMLElement, { duration = 1200 } = {}) {
    isClosing = true;
    return {
      duration,
      tick(t: number) {
        // Keeps node rendered until transition finishes
      },
    };
  }

  onMount(() => {
    parseMessage();

    if (closeInSecond && closeInSecond > 0) {
      closeTimer = setTimeout(() => {
        dismiss();
      }, closeInSecond * 1000);
    }
  });

  onDestroy(() => {
    if (closeTimer) clearTimeout(closeTimer);
    if (exitTimer) clearTimeout(exitTimer);
  });
</script>

{#if !isDestroyed}
  <div
    class="tsunami-alert-container fixed inset-0 pointer-events-none select-none"
    style="z-index: 99;"
    out:tsunamiExit={{ duration: 1200 }}
  >
    <!-- Dark Backdrop Overlay -->
    <div
      class="fixed inset-0 transition-opacity duration-1000 pointer-events-auto"
      class:opacity-0={isClosing}
      style="background-color:rgba(0, 0, 0, 0.7); z-index: 1;"
    ></div>

    <!-- Background Hex Grid -->
    <div
      class="fixed w-[110%] top-[-50px] left-[-50px] pointer-events-auto"
      style="z-index: 2;"
    >
      <HexGrid
        variant="flat"
        align="center"
        {revealVariant}
        reverse={isClosing}
        revealMaxDelay={800}
        revealDuration={300}
      >
        {#each { length: Math.max(window.screen.width / 2 + 10, window.screen.height / 2 + 10) / 2 } as _}
          <div class="w-full h-full cursor-pointer select-none relative">
            <img src="/images/warning_hex_red.png" alt="" />
          </div>
        {/each}
      </HexGrid>
    </div>

    <!-- Center Warning Modal -->
    <div
      class="fixed m-auto top-0 left-0 right-0 bottom-0 flex justify-center pointer-events-auto"
      id="tsunami-warning"
      style="z-index: 99;"
    >
      <div
        class="w-full flex flex-col items-center justify-center"
        style="z-index: 5;"
      >
        <div
          class="warning scale-75 md:scale-100 lg:scale-150 flex flex-col justify-center items-center transition-transform duration-300"
        >
          <!-- TSUNAMI Header Badge -->
          <div
            class="long-hex h-[150px] flex flex-col justify-center {isClosing
              ? 'close-pop-up'
              : 'opacity-0 show-pop-up animation-delay-1'}"
            style={isClosing ? "animation-delay: 150ms;" : ""}
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

          <!-- Main Alert Card -->
          <div
            class="w-11/12 md:w-3/4 overflow-hidden bg-black relative rounded flex justify-center items-center {isClosing
              ? 'close-pop-up'
              : 'opacity-0 show-pop-up animation-delay-2'}"
            style={isClosing ? "animation-delay: 0ms;" : ""}
          >
            <!-- Border Stripes -->
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

            <!-- Card Content -->
            <div class="w-full h-full p-6">
              <div class="bordered-red p-2 text-center w-full mb-2">
                <div class="overflow-hidden relative">
                  <StripeBar loop={true} reverse={true} duration={20}
                  ></StripeBar>
                  <div
                    class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
                  >
                    <p class="p-1 bg-black font-bold text-xs">
                      POTENSI TSUNAMI
                    </p>
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

      <!-- Surrounding Warning Badges -->
      <div
        class="absolute top-0 bottom-0 left-0 right-0 pointer-events-none"
        style="z-index: 5;"
      >
        <!-- Top Left Badge -->
        <div class="z-20 absolute top-8 left-8 md:top-28 md:left-28 scale-150">
          <div
            class="p-1 bg-black rounded-xl {isClosing
              ? 'close-pop-up'
              : 'opacity-0 show-pop-up animation-delay-2'}"
            style={isClosing ? "animation-delay: 150ms;" : ""}
          >
            <div class="p-1 bordered-red">
              <div class="warning-tsunami-yellow"></div>
            </div>
          </div>
        </div>

        <!-- Bottom Left Badge -->
        <div
          class="z-20 absolute bottom-8 left-8 md:bottom-28 md:left-28 scale-150"
        >
          <div
            class="p-1 bg-black rounded-xl {isClosing
              ? 'close-pop-up'
              : 'opacity-0 show-pop-up'}"
            style={isClosing
              ? "animation-delay: 100ms;"
              : "animation-delay: 2.5s;"}
          >
            <div class="p-1 bordered-red">
              <div class="warning-tsunami-yellow"></div>
            </div>
          </div>
        </div>

        <!-- Top Right Badge -->
        <div
          class="z-20 absolute top-8 right-8 md:top-28 md:right-28 scale-150"
        >
          <div
            class="p-1 bg-black rounded-xl {isClosing
              ? 'close-pop-up'
              : 'opacity-0 show-pop-up'}"
            style={isClosing
              ? "animation-delay: 80ms;"
              : "animation-delay: 3s;"}
          >
            <div class="p-1 bordered-red">
              <div class="warning-tsunami-yellow"></div>
            </div>
          </div>
        </div>

        <!-- Bottom Right Badge -->
        <div
          class="z-20 absolute bottom-8 right-8 md:bottom-28 md:right-28 scale-150"
        >
          <div
            class="p-1 bg-black rounded-xl {isClosing
              ? 'close-pop-up'
              : 'opacity-0 show-pop-up'}"
            style={isClosing
              ? "animation-delay: 0ms;"
              : "animation-delay: 3.5s;"}
          >
            <div class="p-1 bordered-red">
              <div class="warning-tsunami-yellow"></div>
            </div>
          </div>
        </div>

        <!-- Mid Right Badge -->
        <div
          class="z-20 absolute h-28 m-auto bottom-0 top-0 right-16 md:right-1/4 hidden md:block scale-150"
        >
          <div
            class="p-1 bg-black rounded-xl {isClosing
              ? 'close-pop-up'
              : 'opacity-0 show-pop-up'}"
            style={isClosing
              ? "animation-delay: 50ms;"
              : "animation-delay: 2s;"}
          >
            <div class="p-1 bordered-red">
              <div class="warning-tsunami-yellow"></div>
            </div>
          </div>
        </div>

        <!-- Mid Left Badge -->
        <div
          class="z-20 absolute h-28 m-auto bottom-0 top-0 left-16 md:left-1/4 hidden md:block scale-150"
        >
          <div
            class="p-1 bg-black rounded-xl {isClosing
              ? 'close-pop-up'
              : 'opacity-0 show-pop-up'}"
            style={isClosing
              ? "animation-delay: 120ms;"
              : "animation-delay: 2.5s;"}
          >
            <div class="p-1 bordered-red">
              <div class="warning-tsunami-yellow"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
