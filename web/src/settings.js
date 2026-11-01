const KEY = "gesture-vision-settings";
const DEFAULTS = { avatar: "girl", rounds: 10, speed: 1, autoStart: false, sound: true, enterWidth: 0.14, showPreview: false, cameraId: "" };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode etc.: settings just won't persist */
  }
}

/** Wires the teacher panel. `onChange(settings, changedKey)` fires after every edit. */
export function initSettingsPanel(settings, { onChange }) {
  const panel = document.getElementById("settings");
  const set = (key, value) => {
    settings[key] = value;
    saveSettings(settings);
    onChange(settings, key);
  };

  const toggle = (open = panel.hidden) => {
    panel.hidden = !open;
  };
  document.getElementById("gear").addEventListener("click", () => toggle());
  document.getElementById("set-close").addEventListener("click", () => toggle(false));
  addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "t" && !e.target.matches("input, select")) toggle();
  });

  const dist = document.getElementById("set-distance");
  dist.value = settings.enterWidth;
  dist.addEventListener("input", () => set("enterWidth", Number(dist.value)));

  const sound = document.getElementById("set-sound");
  sound.checked = settings.sound;
  sound.addEventListener("change", () => set("sound", sound.checked));

  const auto = document.getElementById("set-auto");
  auto.checked = settings.autoStart;
  auto.addEventListener("change", () => set("autoStart", auto.checked));

  const preview = document.getElementById("set-preview");
  preview.checked = settings.showPreview;
  preview.addEventListener("change", () => set("showPreview", preview.checked));

  const cam = document.getElementById("set-camera");
  cam.addEventListener("change", () => set("cameraId", cam.value));

  return {
    /** Keeps the checkbox in step when sound is toggled from elsewhere (the in-game button). */
    syncSound: () => (sound.checked = settings.sound),
    /** Lists cameras; labels are only available after the user granted camera access. */
    async refreshCameras() {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      cam.replaceChildren(
        ...devices.map((d, i) => new Option(d.label || `Κάμερα ${i + 1}`, d.deviceId, false, d.deviceId === settings.cameraId)),
      );
    },
  };
}
