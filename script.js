// --- Imports ---
import { Cloudinary, transformationStringFromObject } from "https://cdn.jsdelivr.net/npm/@cloudinary/url-gen@1.20.0/+esm";
import { fill } from "https://cdn.jsdelivr.net/npm/@cloudinary/url-gen@1.20.0/actions/resize/+esm";

// --- Config ---
const CLOUD_NAME = "demo";   // change to yours
const PUBLIC_ID  = "sample"; // change to yours

// --- Cloudinary ---
const cld = new Cloudinary({ cloud: { cloudName: CLOUD_NAME } });

// --- State ---
const state = {
  text: false, square: false, toon: false, sepia: false, gray: false, colorize: false, video: false,
  textContent: "Hello Cloudinary",
  textColor: "#ffffff"
};

// --- Build asset (image or video) ---
function buildAsset() {
  // Use image delivery for both; ".mp4" public_id + zoompan yields a video
  const img = state.video ? cld.image(`${PUBLIC_ID}.mp4`) : cld.image(PUBLIC_ID);

  if (state.video) {
    const zoompan = "e_zoompan:from_(g_auto;zoom_3.2);du_10;fps_30";
    img.addTransformation(zoompan);
  }

  // Size frame
  state.square
    ? img.resize(fill().width(333).height(333))
    : img.resize(fill().width(500).height(333));

  // Build transformation steps (ordered; sepia last if present)
  const steps = [];

  // Text overlay
  if (state.text) {
    const overlayText  = encodeURIComponent(state.textContent || "Hello Cloudinary");
    const overlayColor = (state.textColor && state.textColor.startsWith("#"))
      ? `rgb:${state.textColor.slice(1)}`
      : (state.textColor || "white");

    steps.push(
      { overlay: `text:Arial_34_bold:${overlayText}`, color: overlayColor },
      { flags: "layer_apply", gravity: "south", y: 10 }
    );
  }

  // Effects - The order is important if multiple of these are used
  if (state.enhance)  steps.push({ effect: "enhance" });
  if (state.toon)  steps.push({ effect: "cartoonify:20" });
  if (state.sepia) steps.push({ effect: "sepia" }); 
  if (state.gray)  steps.push({ effect: "grayscale" }); 
 

  if (steps.length) img.addTransformation(transformationStringFromObject(steps));

  const width = state.square ? 333 : 500;
  return { type: state.video ? "video" : "image", url: img.toURL(), width };
}

// --- Render (swap only media, keep border) ---
async function updateImage() {
  const asset = buildAsset();
  await renderAsset(asset);
}

function renderAsset({ type, url, width }) {
  return new Promise((resolve) => {
    const container = document.getElementById("photoContainer");
    container.style.width = `${width}px`;

    let media = document.getElementById("photo");
    const needVideo = type === "video";
    const hasVideo  = media && media.tagName === "VIDEO";

    // Ensure correct element type
    if (!media || (needVideo && !hasVideo) || (!needVideo && hasVideo)) {
      container.innerHTML = "";
      media = needVideo ? document.createElement("video") : document.createElement("img");
      media.id = "photo";
      media.className = "media hidden";
      if (needVideo) {
        media.autoplay = true; media.loop = true; media.muted = true; media.playsInline = true;
      } else {
        media.alt = "Cloudinary demo";
      }
      container.appendChild(media);
    } else {
      media.classList.add("hidden");
    }

    if (needVideo) {
      media.onloadeddata = () => { media.classList.remove("hidden"); resolve(); };
      media.src = url; media.load();
    } else {
      const pre = new Image();
      pre.onload = () => { media.src = url; media.classList.remove("hidden"); resolve(); };
      pre.src = url;
    }
  });
}

// --- Text dialog ---
function openTextDialog(defaultText, defaultHex) {
  return new Promise((resolve) => {
    const dlg = document.getElementById("textDialog");
    const txt = document.getElementById("dlgText");
    const col = document.getElementById("dlgColor");
    const ok  = document.getElementById("dlgOK");
    const cancel = document.getElementById("dlgCancel");

    txt.value = defaultText || "Hello Cloudinary";
    const validHex = (h) => /^#?[0-9a-f]{6}$/i.test(h.replace("#",""));
    col.value = (defaultHex && validHex(defaultHex)) ? (defaultHex.startsWith("#") ? defaultHex : `#${defaultHex}`) : "#ffffff";

    ok.addEventListener("click", () => { dlg.close(); resolve({ text: txt.value.trim(), color: col.value }); }, { once: true });
    cancel.addEventListener("click", () => { dlg.close(); resolve(null); }, { once: true });
    dlg.addEventListener("close", () => resolve(null), { once: true });

    dlg.showModal();
  });
}

// --- Buttons (delegation + exclusivity) ---
document.querySelector(".btn-group").addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn");
  if (!btn) return;

  const effectKey = btn.dataset.effect;
  const action    = btn.dataset.action;

  // Reset
  if (action === "reset") {
    Object.keys(state).forEach(k => state[k] = (k === "textContent" ? state[k] : k === "textColor" ? state[k] : false));
    document.querySelectorAll(".btn").forEach(b => b.classList.remove("active"));
    await updateImage();
    return;
  }
  if (!effectKey) return;

  // Text → open dialog first when turning ON
  if (effectKey === "text") {
    if (!state.text) {
      const res = await openTextDialog(state.textContent, state.textColor);
      if (!res) return; // canceled
      if (res.text)  state.textContent = res.text;
      if (res.color) state.textColor   = res.color;
    }
    state.text = !state.text;
    btn.classList.toggle("active", state.text);
    await updateImage();
    return;
  }

  // Default toggle
  const next = !state[effectKey];
  state[effectKey] = next;
  btn.classList.toggle("active", next);

  // Mutual exclusivity:
  // If VIDEO turns on → turn OFF sepia, toon, gray
  if (effectKey === "video" && next) {
    ["sepia", "toon", "gray", "enhance"].forEach(k => {
      if (state[k]) {
        state[k] = false;
        const b = document.querySelector(`.btn[data-effect="${k}"]`);
        if (b) b.classList.remove("active");
      }
    });
  }
  // If sepia OR toon OR gray turns on → turn OFF video
  if ((effectKey === "sepia" || effectKey === "toon" || effectKey === "gray" || effectKey === "enhance") && next) {
    if (state.video) {
      state.video = false;
      const vb = document.querySelector(`.btn[data-effect="video"]`);
      if (vb) vb.classList.remove("active");
    }
  }

  await updateImage();
});

// --- Initial render ---
updateImage();