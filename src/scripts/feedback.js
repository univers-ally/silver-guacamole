import { el } from "./dom.js";

const toastBox = el("toast");
let toastTimer;

export function toast(message) {
  toastBox.textContent = message;
  toastBox.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastBox.classList.remove("show"), 2200);
}

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const CONFETTI_COLORS = ["#F26A1B", "#E8A700", "#2E8B57", "#3B82F6", "#E11D48"];

export function confetti(button) {
  if (reducedMotion.matches) return;
  button.classList.add("burst");
  for (let i = 0; i < 18; i++) {
    const piece = document.createElement("i");
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 60;
    piece.className = "confetti";
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.setProperty("--dx", Math.cos(angle) * distance + "px");
    piece.style.setProperty("--dy", Math.sin(angle) * distance + 50 + "px");
    piece.addEventListener("animationend", () => piece.remove());
    button.appendChild(piece);
  }
}
