<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { AffectedArea } from "$lib/types";

  interface Props {
    kota: AffectedArea;
    onClick?: (kota: AffectedArea) => void;
  }

  let { kota, onClick }: Props = $props();
  let finish = $state(false);
  let readableTime = $state("");

  let interval: ReturnType<typeof setInterval>;

  function calculateTimeLeft() {
    const currentDateTime = new Date();
    const arrivalDateTime = kota.timeArrival!;
    let timeLeft = +arrivalDateTime - +currentDateTime;

    if (timeLeft <= 0) {
      if (!finish) {
        finish = true;
      }
      return "00:00:00";
    } else {
      finish = false;
    }
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    const milliseconds = timeLeft % 1000;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${milliseconds.toString().padStart(2, "0")}`;
  }

  onMount(() => {
    finish = false;
    readableTime = calculateTimeLeft();
    interval = setInterval(() => {
      readableTime = calculateTimeLeft();
    }, 20);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });
</script>

{#if kota.hit}
  <audio id="error-{kota.distance}" class="hidden" autoplay>
    <source src="/sounds/error-2-126514.wav" type="audio/wav" />
  </audio>
{/if}

<div
  class="parallelogram flex justify-end {finish
    ? 'danger blink blink-fast'
    : ''}"
>
  <p style="font-size: 10px;">{kota.name}</p>
  <p
    class="time-countdown absolute top-0 -left-2 pl-4 bg-orange-500 w-20"
    style="font-size: 12px;"
    data-distance={kota.distance}
    data-time={kota.timeArrival}
  >
    {readableTime}
  </p>
</div>
