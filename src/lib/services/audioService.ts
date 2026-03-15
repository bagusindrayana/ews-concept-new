import { fadeOutAudio } from "$lib/utils/audio";

export const SOUNDS = {
  DANGER: "/sounds/siren-alarm-96503.mp3",
  SMALL_EARTHQUAKE: "/sounds/wrong-answer-129254.mp3",
  TSUNAMI_ALERT: "/sounds/security-alarm-80493.mp3",
  ALERT_NOTIFICATION: "/sounds/alert-109578.wav",
  SECURITY_ALARM: "/sounds/security-alarm-63578.wav",
};

export const VOICES = {
  GEMPABUMI: "/voice/gempabumi.wav",
  TERDETEKSI: "/voice/terdeteksi.wav",
  POTENSI: "/voice/potensi.wav",
  EVAKUASI: "/voice/evakuasi.wav",
  INFORMASI: "/voice/informasi.wav",
};

export class AudioService {
  /**
   * Plays the alert sequence for an earthquake.
   */
  playEarthquakeSequence(audioDangerElement?: HTMLAudioElement) {
    const bgNotif = new Audio(SOUNDS.ALERT_NOTIFICATION);
    bgNotif.volume = 0.3;
    bgNotif.loop = true;
    bgNotif.play();

    setTimeout(() => {
      if (audioDangerElement) {
        audioDangerElement.play();
      } else {
         const danger = new Audio(SOUNDS.DANGER);
         danger.play();
      }
      
      setTimeout(() => {
        new Audio(VOICES.GEMPABUMI).play();
      }, 2000);
      
      setTimeout(() => fadeOutAudio(bgNotif, 2000), 6000);
    }, 2000);
  }

  /**
   * Plays the alert sequence for a tsunami.
   */
  playTsunamiSequence(level: string) {
    const bgNotif = new Audio(SOUNDS.SECURITY_ALARM);
    bgNotif.volume = 0.3;
    bgNotif.loop = true;
    bgNotif.play();

    const notif = new Audio(SOUNDS.TSUNAMI_ALERT);
    notif.loop = true;
    notif.play();

    setTimeout(() => {
      new Audio(VOICES.TERDETEKSI).play();
      setTimeout(() => {
        new Audio(`/voice/${level.toLowerCase()}.wav`).play();
        setTimeout(() => {
          new Audio(VOICES.POTENSI).play();
          if (level.toUpperCase() === "AWAS") {
            setTimeout(() => {
              new Audio(VOICES.EVAKUASI).play();
              setTimeout(() => {
                fadeOutAudio(notif, 1000);
                fadeOutAudio(bgNotif, 1000);
              }, 4000);
            }, 6000);
          } else {
            setTimeout(() => {
              new Audio(VOICES.INFORMASI).play();
              setTimeout(() => {
                fadeOutAudio(notif, 1000);
                fadeOutAudio(bgNotif, 1000);
              }, 4000);
            }, 6000);
          }
        }, 5000);
      }, 5000);
    }, 2000);
  }
}
