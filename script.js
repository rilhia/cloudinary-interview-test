/**
 * Cloudinary Interview Test 
 * ------------------------
 * - Covers the tasks of creating "Text overlay", "Crop to square" and "Cartoonify" features to be triggered by buttons.
 * - Uses @cloudinary/url-gen to build transformation URLs from a simple state object.
 * - Enables a solid "look and feel" to deal with image resizing for "Crop to square"
 * - Added a feature to manually set the text to overlay and set it colour
 * - Added "Sepia", "Grayscale" and "AI Enhance" features.
 * - Added an image to video feature.
 */

// ------------------------------
// Imports (Cloudinary SDK)
// ------------------------------
import {
  Cloudinary,
  transformationStringFromObject
} from "https://cdn.jsdelivr.net/npm/@cloudinary/url-gen@1.21.0/+esm";
import { fill } from "https://cdn.jsdelivr.net/npm/@cloudinary/url-gen@1.21.0/actions/resize/+esm";

// ------------------------------
// Configuration
// ------------------------------
// Change these to your own Cloudinary cloud and public ID.
// NOTE: The code uses `${PUBLIC_ID}.mp4` when the Video toggle is on.
const CLOUD_NAME = "demo";
const PUBLIC_ID  = "sample";

// Standard frame sizes for the demo (container stays visible while media swaps)
const FRAME_WIDE   = { w: 500, h: 333 };
const FRAME_SQUARE = { w: 333, h: 333 };


// ------------------------------
// Cloudinary instance
// ------------------------------
const cld = new Cloudinary({ cloud: { cloudName: CLOUD_NAME } });


// ------------------------------
// Application state
// ------------------------------
// Boolean toggles control which transformations are applied.
// `textContent` and `textColor` store the dialog selections for the overlay.
const state = {
  // toggles
  text: false,
  square: false,
  toon: false,
  sepia: false,
  gray: false,
  video: false,
  enhance: false,

  // text overlay config
  textContent: "Hello World!",
  textColor: "#ffffff"
};


// ------------------------------
// Small DOM helpers
// ------------------------------
const $ = (selector) => document.querySelector(selector);

/** Mark a button (by data-effect) as active/inactive to reflect state */
function setButtonActive(effect, on) {
  const el = $(`.btn[data-effect="${effect}"]`);
  if (el) el.classList.toggle("active", !!on);
}

/** Reset all boolean toggles, keep the saved text/color values */
function resetToggles() {
  Object.keys(state).forEach((k) => {
    if (k === "textContent" || k === "textColor") return;
    state[k] = false;
  });
  document.querySelectorAll(".btn").forEach((b) => b.classList.remove("active"));
}

/** Convert a CSS hex color to Cloudinary's rgb:rrggbb format (or pass named colors through) */
function toCloudinaryColor(value) {
  if (value && value.startsWith("#")) return `rgb:${value.slice(1)}`;
  return value || "white";
}


// ------------------------------
// Build the asset to display
// ------------------------------
/**
 * Creates either an image URL or a video URL, based on state.
 * - For "video", we request `${PUBLIC_ID}.mp4` and add a zoom-pan effect.
 * - For image, we apply selected transformations in a well-defined order.
 * Returns: { type: "image"|"video", url: string, width: number }
 */
function buildAsset() {
  const useSquare = state.square;
  const frame = useSquare ? FRAME_SQUARE : FRAME_WIDE;

  // We intentionally use image delivery for both cases:
  // - When `video` is ON: we request `${PUBLIC_ID}.mp4` and add e_zoompan (Cloudinary serves MP4)
  // - When `video` is OFF: we request the plain image public_id
  const asset = state.video ? cld.image(PUBLIC_ID).addTransformation("f_mp4") : cld.image(PUBLIC_ID);

  // Add a simple Ken Burns–style zoom/pan when showing video
  if (state.video) {
    asset.addTransformation("e_zoompan:from_(g_auto;zoom_3.2);du_10;fps_30");
  }

  // Always size to the frame to keep the border stable and the buttons from moving
  asset.resize(fill().width(frame.w).height(frame.h));

  // Build transformation steps for image (order matters)
  const steps = [];


  // Effects: keep ordering explicit. If multiple are toggled, we respect this order.
  // (You can reorder these lines to change precedence.)
  if (state.enhance) steps.push({ effect: "enhance" });
  if (state.toon)  steps.push({ effect: "cartoonify:20" });
  if (state.sepia) steps.push({ effect: "sepia" });     // often looks best after toon
  if (state.gray)  steps.push({ effect: "grayscale" });


  // Text overlay (applied at end so colours are not changed)
  if (state.text) {
    const encodedText  = encodeURIComponent(state.textContent);
    const overlayColor = toCloudinaryColor(state.textColor);

    steps.push(
      { overlay: `text:Arial_34_bold:${encodedText}`, color: overlayColor },
      { flags: "layer_apply", gravity: "south", y: 10 }
    );
  }

  // Apply the accumulated steps as one transformation string (SDK-backed)
  if (steps.length) {
    asset.addTransformation(transformationStringFromObject(steps));
  }

  return {
    type: state.video ? "video" : "image",
    url:  asset.toURL(),
    width: frame.w
  };
}


// ------------------------------
// Render the current asset
// ------------------------------
/**
 * Rebuild and render the asset. The bordered container remains visible;
 * we only swap the inner <img> / <video> element and fade it in when ready.
 */
async function updateImage() {
  const asset = buildAsset();
  await renderAsset(asset);
}

/**
 * Swap the media element to the correct tag (<img> or <video>), preload, and fade in.
 * Keeps the outer container (border) visible and smoothly resizes its width.
 */
function renderAsset({ type, url, width }) {
  return new Promise((resolve) => {
    const container = $("#photoContainer");
    container.style.width = `${width}px`; // smooth width change via CSS

    let media = $("#photo");
    const needVideo = type === "video";
    const hasVideo  = media && media.tagName === "VIDEO";

    // If the current element type is wrong (or absent), replace it
    if (!media || (needVideo && !hasVideo) || (!needVideo && hasVideo)) {
      container.innerHTML = "";
      media = needVideo ? document.createElement("video") : document.createElement("img");
      media.id = "photo";
      media.className = "media hidden"; // hidden until loaded

      if (needVideo) {
        media.autoplay = true;
        media.loop = true;
        media.muted = true;
        media.playsInline = true;
        media.controls   = true; 
      } else {
        media.alt = "Cloudinary demo";
      }
      container.appendChild(media);
    } else {
      // Same element type; just hide while swapping the src
      media.classList.add("hidden");
    }

    // Preload and reveal
    if (needVideo) {
      media.onloadeddata = () => { media.classList.remove("hidden"); resolve(); };
      media.src = url;
      media.load();
    } else {
      const pre = new Image();
      pre.onload = () => { media.src = url; media.classList.remove("hidden"); resolve(); };
      pre.src = url;
    }
  });
}


// ------------------------------
// Text overlay dialog (<dialog>)
// ------------------------------
/**
 * Opens a modal dialog to capture overlay text and color.
 * Returns either `{ text, color }` or `null` if canceled.
 */
function openTextDialog(defaultText, defaultHex) {
  return new Promise((resolve) => {
    const dlg = $("#textDialog");
    const txt = $("#dlgText");
    const col = $("#dlgColor");
    const ok  = $("#dlgOK");
    const cancel = $("#dlgCancel");

    // Populate defaults
    txt.value = defaultText;
    const isHex = (h) => /^#?[0-9a-f]{6}$/i.test(h.replace("#", ""));
    col.value = (defaultHex && isHex(defaultHex))
      ? (defaultHex.startsWith("#") ? defaultHex : `#${defaultHex}`)
      : "#ffffff";

    // One-off listeners for this open/close cycle
    ok.addEventListener("click", () => { dlg.close(); resolve({ text: txt.value.trim(), color: col.value }); }, { once: true });
    cancel.addEventListener("click", () => { dlg.close(); resolve(null); }, { once: true });
    dlg.addEventListener("close", () => resolve(null), { once: true });

    dlg.showModal();
  });
}


// ------------------------------
// Button wiring (delegation)
// ------------------------------
// Mutual exclusivity: Video cannot be combined with toon/sepia/gray (and vice versa).
$(".btn-group").addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn");
  if (!btn) return;

  const effectKey = btn.dataset.effect;  // e.g., "text", "video", "sepia"
  const action    = btn.dataset.action;  // e.g., "reset"

  // Handle "Reset" button
  if (action === "reset") {
    resetToggles();
    await updateImage();
    return;
  }

  if (!effectKey) return;

  // Special: when enabling Text, collect text + color first
  if (effectKey === "text") {
    if (!state.text) {
      const result = await openTextDialog(state.textContent, state.textColor);
      if (!result) return;                // user canceled
      if (result.text)  state.textContent = result.text;
      if (result.color) state.textColor   = result.color;
    }
    state.text = !state.text;
    setButtonActive("text", state.text);
    await updateImage();
    return;
  }

  // Generic toggle for all other effects
  const next = !state[effectKey];
  state[effectKey] = next;
  setButtonActive(effectKey, next);

  // Enforce exclusivity:
  // If Video was turned on, disable visual effects that clash with it.
  if (effectKey === "video" && next) {
    ["sepia", "toon", "gray", "enhance"].forEach((k) => {
      if (state[k]) {
        state[k] = false;
        setButtonActive(k, false);
      }
    });
  }

  // If a visual effect was turned on, make sure Video is off.
  if ((effectKey === "sepia" || effectKey === "toon" || effectKey === "gray" || effectKey === "enhance") && next) {
    if (state.video) {
      state.video = false;
      setButtonActive("video", false);
    }
  }

  await updateImage();
});


// ------------------------------
// Initial render
// ------------------------------
updateImage();
