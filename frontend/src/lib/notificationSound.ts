import { useNotificationSettingsStore } from "@/store/notificationSettingsStore";

const MESSAGE_SOUND_URL = "/sounds/message-in.mp3";

let audio: HTMLAudioElement | null = null;
let unlocked = false;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(MESSAGE_SOUND_URL);
    audio.preload = "auto";
  }
  return audio;
}

function applyVolume(element: HTMLAudioElement): void {
  element.volume = useNotificationSettingsStore.getState().volume;
}

/** Required once after a user gesture so autoplay policies allow playback. */
export function unlockNotificationSound(): void {
  if (unlocked) return;

  const element = getAudio();
  applyVolume(element);
  const previousVolume = element.volume;
  element.volume = 0;

  void element
    .play()
    .then(() => {
      element.pause();
      element.currentTime = 0;
      element.volume = previousVolume;
      unlocked = true;
    })
    .catch(() => {
      applyVolume(element);
    });
}

export function playMessageNotificationSound(): void {
  const { volume } = useNotificationSettingsStore.getState();
  if (!unlocked || volume <= 0) return;

  const element = getAudio();
  applyVolume(element);
  element.currentTime = 0;
  void element.play().catch(() => {});
}

export function previewNotificationSound(): void {
  unlockNotificationSound();

  const { volume } = useNotificationSettingsStore.getState();
  if (!unlocked || volume <= 0) return;

  const element = getAudio();
  applyVolume(element);
  element.currentTime = 0;
  void element.play().catch(() => {});
}
