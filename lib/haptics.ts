/**
 * A light "selection" tick. Android/Chrome: the Vibration API. iOS Safari has
 * no Vibration API, but since iOS 18 toggling a native `<input switch>` plays
 * the system selection haptic — so we keep one off-screen and click its label.
 * Silently does nothing where neither exists.
 */
let label: HTMLLabelElement | null = null;

export function hapticTick() {
  if (typeof window === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function" && navigator.vibrate(6)) return;
  } catch {
    /* ignore */
  }
  if (!label) {
    const box = document.createElement("div");
    box.setAttribute("aria-hidden", "true");
    box.style.cssText =
      "position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.id = "bpl-haptic-switch";
    input.tabIndex = -1;
    // clicking the label would otherwise move focus (closing the keyboard)
    input.addEventListener("focus", () => input.blur());
    label = document.createElement("label");
    label.htmlFor = input.id;
    box.append(input, label);
    document.body.append(box);
  }
  label.click();
}
