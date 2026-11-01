import { saveSettings } from "./settings.js";

/** Teacher controls on the idle screen: pupil name, boy/girl, number of questions. */
export function initSetup(settings, { onAvatar, onStart, onSpeed }) {
  const root = document.getElementById("setup");
  const name = document.getElementById("pupil-name");
  const rounds = document.getElementById("rounds");
  const buttons = [...root.querySelectorAll("[data-avatar]")];

  const showAvatar = () => buttons.forEach((b) => b.classList.toggle("on", b.dataset.avatar === settings.avatar));
  showAvatar();
  for (const b of buttons) {
    b.addEventListener("click", () => {
      settings.avatar = b.dataset.avatar;
      saveSettings(settings);
      showAvatar();
      onAvatar();
    });
  }

  rounds.value = settings.rounds;
  rounds.addEventListener("change", () => {
    settings.rounds = Math.min(52, Math.max(1, Math.round(Number(rounds.value)) || settings.rounds));
    rounds.value = settings.rounds;
    saveSettings(settings);
  });

  const speed = document.getElementById("speed");
  speed.value = settings.speed;
  speed.addEventListener("input", () => {
    settings.speed = Number(speed.value);
    saveSettings(settings);
    onSpeed();
  });

  // Typing must not trigger the "T" shortcut or start the game.
  root.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && e.target === name) onStart();
  });
  document.getElementById("start").addEventListener("click", onStart);

  return {
    root,
    get pupilName() {
      return name.value.trim();
    },
    clearName() {
      name.value = "";
    },
  };
}
