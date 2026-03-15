/**
 * Fades out an audio element over a specified duration and then pauses it.
 * @param audioElement The HTMLAudioElement to fade out.
 * @param duration The duration of the fade in milliseconds.
 */
export function fadeOutAudio(audioElement: HTMLAudioElement, duration: number) {
  let fadeInterval = 50;
  let step = audioElement.volume / (duration / fadeInterval);
  let fadeAudio = setInterval(() => {
    if (audioElement.volume > step) {
      audioElement.volume -= step;
    } else {
      audioElement.volume = 0;
      audioElement.pause();
      clearInterval(fadeAudio);
    }
  }, fadeInterval);
}
