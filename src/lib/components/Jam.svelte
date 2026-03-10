<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { DateTime } from 'luxon';

  interface Props {
    timeZone?: string;
  }

  let { timeZone }: Props = $props();

  let readableTime = $state('');

  function calculateClock() {
    let dt = DateTime.now();
    if (dt) {
      dt = dt.setZone(timeZone || 'local');
    }
    return dt.toFormat('HH:mm:ss');
  }

  let interval: ReturnType<typeof setInterval>;

  onMount(() => {
    readableTime = calculateClock();
    interval = setInterval(() => {
      readableTime = calculateClock();
    }, 1000);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });
</script>

{readableTime}
