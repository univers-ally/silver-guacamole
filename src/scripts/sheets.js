import { el, delegate } from "./dom.js";

export function openSheet(sheet) {
  if (sheet.open) return;
  sheet.showModal();
  document.body.classList.add("locked");
  sheet.querySelector(".close")?.focus();
}

export function setUpSheets() {
  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("click", event => {
      if (dialog.id === "lightbox" || event.target === dialog || event.target.closest(".close"))
        dialog.close();
    });
    dialog.addEventListener("close", () => {
      if (!document.querySelector("dialog[open]")) document.body.classList.remove("locked");
    });
  }
}

export function setUpLightbox() {
  const lightbox = el("lightbox");
  const image = lightbox.querySelector("img");
  delegate(document.body, ".shot", shot => {
    const source = shot.querySelector("img");
    const figcaption = shot.closest("figure")?.querySelector("figcaption");
    const caption = figcaption
      ? figcaption.textContent.trim()
      : (shot.getAttribute("aria-label") || "").replace(/^Open screenshot(?::| of)\s*/, "");
    image.src = source.src;
    image.alt = source.alt || caption;
    lightbox.setAttribute("aria-label", caption || "Screenshot");
    openSheet(lightbox);
  });
}
