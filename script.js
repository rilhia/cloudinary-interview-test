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
} from "https://cdn.jsdelivr.net/npm/@cloudinary/url-gen@latest/+esm";

import { fill } from "https://cdn.jsdelivr.net/npm/@cloudinary/url-gen@latest/actions/resize/+esm";


// ------------------------------
// Configuration
// ------------------------------
// Change these to use with a different Cloudinary cloud and/or asset.
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
// `textContent` and `textColour` store the dialog selections for the overlay.
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
  textColour: "#ffffff"
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

/** Reset all boolean toggles, keep the saved text/colour values */
function resetToggles() {
  Object.keys(state).forEach((k) => {
    if (k === "textContent" || k === "textColour") return;
    state[k] = false;
  });
  document.querySelectorAll(".btn").forEach((b) => b.classList.remove("active"));
}

// ------------------------------
// Build the asset to display
// ------------------------------
/**
 * Creates either an image URL or a video URL, based on state.
 * - For "video", we request the asset and add a zoom-pan effect.
 * - For image, we apply selected transformations in a well-defined order.
 * Returns: { type: "image"|"video", url: string, width: number }
 */
function buildAsset() {

  // Identify frame dimensions required
  const frame = state.square ? FRAME_SQUARE : FRAME_WIDE;

  // We intentionally use image delivery for both cases:
  // - When `video` is ON: we request immediately transform the asset to be mp4
  // - When `video` is OFF: we request the plain image public_id
  const asset = state.video ? cld.image(PUBLIC_ID).addTransformation("f_mp4") : cld.image(PUBLIC_ID);

  // Adds a zoom and move to emulate a video by moving around the image
  if (state.video) {
    asset.addTransformation("e_zoompan:from_(g_auto;zoom_3.2);du_10;fps_30");
  }

  // Always size to the frame to keep the border stable and the buttons from moving
  asset.resize(fill().width(frame.w).height(frame.h));

  // Build transformation chain for image (order matters)
  const chain = [];


  // Effects: keep ordering explicit. If multiple are toggled, this appears to be the best order.
  if (state.enhance) chain.push({ effect: "enhance" });
  if (state.toon)  chain.push({ effect: "cartoonify:20" });
  if (state.sepia) chain.push({ effect: "sepia" });     
  if (state.gray)  chain.push({ effect: "grayscale" });


  // Text overlay (applied at end so colours are not changed)
  if (state.text) {
    const encodedText  = encodeURIComponent(state.textContent);
    const overlayColour = state.textColour;

    chain.push(
      { overlay: `text:Arial_34_bold:${encodedText}`, color: overlayColour },
      { flags: "layer_apply", gravity: "south", y: 10 }
    );
  }

  // Apply the accumulated transformation chain as one transformation string (SDK-backed)
  if (chain.length) {
    asset.addTransformation(transformationStringFromObject(chain));
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
 * Opens a modal dialog to capture overlay text and colour.
 * Returns either `{ text, colour }` or `null` if canceled.
 */
function openTextDialog(defaultText, defaultHex) {
  return new Promise((resolve) => {
    const dlg = $("#textDialog");
    const txt = $("#dlgText");
    const col = $("#dlgColour");
    const ok  = $("#dlgOK");
    const cancel = $("#dlgCancel");

    // Populate defaults
    txt.value = defaultText;
    const isHex = (h) => /^#?[0-9a-f]{6}$/i.test(h.replace("#", ""));
    col.value = (defaultHex && isHex(defaultHex))
      ? (defaultHex.startsWith("#") ? defaultHex : `#${defaultHex}`)
      : "#ffffff";

    // One-off listeners for this open/close cycle
    ok.addEventListener("click", () => { dlg.close(); resolve({ text: txt.value.trim(), colour: col.value }); }, { once: true });
    cancel.addEventListener("click", () => { dlg.close(); resolve(null); }, { once: true });
    dlg.addEventListener("close", () => resolve(null), { once: true });

    dlg.showModal();
  });
}


// ------------------------------
// Button wiring 
// ------------------------------
// Click listeners applied to all buttons. Note how state object is observed and updated.
// Mutual exclusivity: Video cannot be combined with toon/sepia/gray/enhance (and vice versa) in Cloudinary
$(".btn-group").addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn");
  if (!btn) return;

  const effectKey = btn.dataset.effect;  // e.g., "text", "video", "sepia", "enhance", etc
  const action    = btn.dataset.action;  // e.g., "reset"

  // Handle "Reset" button
  if (action === "reset") {
    resetToggles();
    await updateImage();
    return;
  }

  if (!effectKey) return;

  // Special: when enabling Text, collect text + colour first
  if (effectKey === "text") {
    if (!state.text) {
      const result = await openTextDialog(state.textContent, state.textColour);
      if (!result) return;                // user canceled
      if (result.text)  state.textContent = result.text;
      if (result.colour) state.textColour   = result.colour;
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
  // If Video was turned on, disable toon/sepia/gray/enhance.
  if (effectKey === "video" && next) {
    ["sepia", "toon", "gray", "enhance"].forEach((k) => {
      if (state[k]) {
        state[k] = false;
        setButtonActive(k, false);
      }
    });
  }

  // If toon/sepia/gray/enhance was turned on, make sure Video is off.
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
