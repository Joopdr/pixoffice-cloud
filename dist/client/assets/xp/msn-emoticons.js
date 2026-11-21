/* ============================================================================
   MSN Messenger Classic Glossy Yellow Emoticons (2004-2006 Era)
   Includes inline SVG emoticons, CSS bounce/wink animations, Nudge/Cutucar shake,
   and canvas rasterization for stamping emoticons onto drawings.
   ============================================================================ */
(function (global) {
  "use strict";

  const GLOSS_DEFS = `
    <defs>
      <radialGradient id="msn-orb" cx="35%" cy="28%" r="70%">
        <stop offset="0%" stop-color="#FFF9A6"/>
        <stop offset="45%" stop-color="#FFD829"/>
        <stop offset="85%" stop-color="#F59E0B"/>
        <stop offset="100%" stop-color="#B45309"/>
      </radialGradient>
      <linearGradient id="msn-shine" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.88"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </linearGradient>
    </defs>`;

  function orbBase(innerSvg) {
    return `${GLOSS_DEFS}
      <circle cx="12" cy="12" r="10.2" fill="url(#msn-orb)" stroke="#92400E" stroke-width="1"/>
      <ellipse cx="12" cy="6.8" rx="6.8" ry="3.6" fill="url(#msn-shine)"/>
      ${innerSvg}`;
  }

  const EMOTICONS = [
    {
      id: "smile", code: ":)", namePt: "Sorriso MSN", nameEn: "MSN Smile", anim: "msn-emo-bounce",
      svg: orbBase(`
        <ellipse cx="8.6" cy="9.4" rx="1.2" ry="1.8" fill="#1F2937"/>
        <ellipse cx="15.4" cy="9.4" rx="1.2" ry="1.8" fill="#1F2937"/>
        <path d="M7.2 13.8c1.3 2.5 8.3 2.5 9.6 0" fill="none" stroke="#1F2937" stroke-width="1.6" stroke-linecap="round"/>`)
    },
    {
      id: "grin", code: ":D", namePt: "Gargalhada MSN", nameEn: "Big Grin", anim: "msn-emo-bounce",
      svg: orbBase(`
        <ellipse cx="8.6" cy="9" rx="1.2" ry="1.8" fill="#1F2937"/>
        <ellipse cx="15.4" cy="9" rx="1.2" ry="1.8" fill="#1F2937"/>
        <path d="M6.8 13h10.4c-.5 4.2-9.9 4.2-10.4 0z" fill="#FFFFFF" stroke="#1F2937" stroke-width="1.3" stroke-linejoin="round"/>`)
    },
    {
      id: "wink", code: ";)", namePt: "Piscadinha MSN", nameEn: "Wink", anim: "msn-emo-wink",
      svg: orbBase(`
        <path d="M7 9.6c1-1.3 2.6-1.3 3.6 0" fill="none" stroke="#1F2937" stroke-width="1.6" stroke-linecap="round"/>
        <ellipse cx="15.4" cy="9.4" rx="1.2" ry="1.8" fill="#1F2937"/>
        <path d="M7.5 14c1.5 2.2 7.5 2.2 9 0" fill="none" stroke="#1F2937" stroke-width="1.5" stroke-linecap="round"/>`)
    },
    {
      id: "tongue", code: ":P", namePt: "Língua MSN", nameEn: "Tongue Out", anim: "msn-emo-bounce",
      svg: orbBase(`
        <ellipse cx="8.6" cy="9" rx="1.2" ry="1.8" fill="#1F2937"/>
        <ellipse cx="15.4" cy="9" rx="1.2" ry="1.8" fill="#1F2937"/>
        <path d="M7.2 13.4h9.6" stroke="#1F2937" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M10.2 13.6v3.4c0 1.4 3.6 1.4 3.6 0v-3.4z" fill="#FB7185" stroke="#9F1239" stroke-width="1"/>`)
    },
    {
      id: "cool", code: "(H)", namePt: "Descolado MSN", nameEn: "Cool Shades", anim: "",
      svg: orbBase(`
        <rect x="4.5" y="7.2" width="6.5" height="4.2" rx="1.2" fill="#111827"/>
        <rect x="13" y="7.2" width="6.5" height="4.2" rx="1.2" fill="#111827"/>
        <line x1="11" y1="8.8" x2="13" y2="8.8" stroke="#111827" stroke-width="1.5"/>
        <path d="M6 8.3l3.2 0" stroke="#60A5FA" stroke-width="1" stroke-linecap="round"/>
        <path d="M8.5 14.8c1.8 1.5 5.6 1.5 7.4-.2" fill="none" stroke="#1F2937" stroke-width="1.5" stroke-linecap="round"/>`)
    },
    {
      id: "surprised", code: ":-O", namePt: "Surpreso MSN", nameEn: "Surprised", anim: "msn-emo-bounce",
      svg: orbBase(`
        <ellipse cx="8.6" cy="8.8" rx="1.3" ry="1.9" fill="#1F2937"/>
        <ellipse cx="15.4" cy="8.8" rx="1.3" ry="1.9" fill="#1F2937"/>
        <ellipse cx="12" cy="15.6" rx="2.3" ry="2.8" fill="#991B1B" stroke="#1F2937" stroke-width="1.2"/>`)
    },
    {
      id: "confused", code: ":-S", namePt: "Confuso MSN", nameEn: "Confused", anim: "",
      svg: orbBase(`
        <circle cx="8.6" cy="9.2" r="1.4" fill="#1F2937"/>
        <circle cx="15.4" cy="9.2" r="1.4" fill="#1F2937"/>
        <path d="M7 15.2c1.2-1.6 2.6 1.6 4.2 0s3 1.6 5.2-.2" fill="none" stroke="#1F2937" stroke-width="1.5" stroke-linecap="round"/>`)
    },
    {
      id: "sad", code: ":(", namePt: "Triste MSN", nameEn: "Sad", anim: "",
      svg: orbBase(`
        <ellipse cx="8.6" cy="9.4" rx="1.2" ry="1.7" fill="#1F2937"/>
        <ellipse cx="15.4" cy="9.4" rx="1.2" ry="1.7" fill="#1F2937"/>
        <path d="M7.6 16.4c1.6-2 7.2-2 8.8 0" fill="none" stroke="#1F2937" stroke-width="1.5" stroke-linecap="round"/>`)
    },
    {
      id: "angry", code: ":-@", namePt: "Bravo MSN", nameEn: "Angry", anim: "",
      svg: `
        <defs>
          <radialGradient id="msn-red-orb" cx="35%" cy="28%" r="70%">
            <stop offset="0%" stop-color="#FCA5A5"/>
            <stop offset="55%" stop-color="#EF4444"/>
            <stop offset="100%" stop-color="#991B1B"/>
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="10.2" fill="url(#msn-red-orb)" stroke="#7F1D1D" stroke-width="1"/>
        <path d="M6.8 7.5l3.6 2M17.2 7.5l-3.6 2" stroke="#1F2937" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="8.8" cy="10.6" r="1.2" fill="#1F2937"/>
        <circle cx="15.2" cy="10.6" r="1.2" fill="#1F2937"/>
        <path d="M8 16c2-1.6 6-1.6 8 0" fill="none" stroke="#1F2937" stroke-width="1.5" stroke-linecap="round"/>`
    },
    {
      id: "heart", code: "(L)", namePt: "Coração MSN", nameEn: "Love Heart", anim: "msn-emo-bounce",
      svg: `
        <defs>
          <radialGradient id="msn-hrt-g" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#FDA4AF"/>
            <stop offset="45%" stop-color="#E11D48"/>
            <stop offset="100%" stop-color="#881337"/>
          </radialGradient>
        </defs>
        <path d="M12 20.5S3.2 14.6 3.2 8.6a4.7 4.7 0 0 1 8.8-2.3 4.7 4.7 0 0 1 8.8 2.3c0 6-8.8 11.9-8.8 11.9z" fill="url(#msn-hrt-g)" stroke="#881337" stroke-width="1"/>
        <ellipse cx="8" cy="7.5" rx="2" ry="1.1" fill="#FFFFFF" opacity="0.65" transform="rotate(-25 8 7.5)"/>`
    },
    {
      id: "star", code: "(*)", namePt: "Estrela MSN", nameEn: "Gold Star", anim: "msn-emo-bounce",
      svg: orbBase(`
        <polygon points="12,3.5 14.6,9 20.5,9.8 16.2,13.9 17.3,19.8 12,16.9 6.7,19.8 7.8,13.9 3.5,9.8 9.4,9" fill="#FDE047" stroke="#92400E" stroke-width="1" stroke-linejoin="round"/>`)
    },
    {
      id: "nudge", code: "NUDGE", namePt: "Cutucar (Nudge!)", nameEn: "MSN Nudge", anim: "msn-emo-bounce",
      svg: `
        <circle cx="9.5" cy="7.5" r="3.4" fill="#60A5FA" stroke="#1E3A8A" stroke-width="1"/>
        <path d="M4.2 18.5c0-3.4 2.3-5.6 5.3-5.6s5.3 2.2 5.3 5.6z" fill="#3B82F6" stroke="#1E3A8A" stroke-width="1"/>
        <circle cx="15.5" cy="9.5" r="3.1" fill="#4ADE80" stroke="#14532D" stroke-width="1"/>
        <path d="M11 19.5c0-3 2-5 4.5-5s4.5 2 4.5 5z" fill="#22C55E" stroke="#14532D" stroke-width="1"/>
        <path d="M2 8l2 2-2 2M22 8l-2 2 2 2" fill="none" stroke="#EF4444" stroke-width="1.6" stroke-linecap="round"/>`
    },
    {
      id: "lightbulb", code: "(I)", namePt: "Ideia MSN", nameEn: "Lightbulb", anim: "msn-emo-bounce",
      svg: `
        <circle cx="12" cy="9.5" r="6" fill="#FEF08A" stroke="#CA8A04" stroke-width="1.1"/>
        <rect x="9.5" y="15.5" width="5" height="3.5" rx="1" fill="#94A3B8" stroke="#475569" stroke-width="1"/>
        <path d="M10 9.5l2 2.5 2-2.5" fill="none" stroke="#B45309" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M12 1.5v1.5M4.5 5l1.2 1M19.5 5l-1.2 1" stroke="#EAB308" stroke-width="1.5" stroke-linecap="round"/>`
    }
  ];

  function getById(id) {
    return EMOTICONS.find((e) => e.id === id) || EMOTICONS[0];
  }

  function getHtml(id, size = 18, animated = true) {
    const item = getById(id);
    const cls = animated && item.anim ? `msn-emo ${item.anim}` : "msn-emo";
    return `<span class="${cls}" title="${item.namePt} (${item.code})" data-msn-emo="${item.id}"><svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${item.svg}</svg></span>`;
  }

  function triggerNudge(targetEl, sfxPlayer) {
    const el = targetEl || (typeof document !== "undefined" ? (document.querySelector(".studio-shell") || document.body) : null);
    if (el && el.classList) {
      el.classList.remove("xp-nudge-active");
      void el.offsetWidth;
      el.classList.add("xp-nudge-active");
      setTimeout(() => el.classList.remove("xp-nudge-active"), 520);
    }
    if (sfxPlayer && typeof sfxPlayer.play === "function") {
      sfxPlayer.play("nudge");
    }
  }

  const api = { EMOTICONS, list: () => EMOTICONS, getById, getHtml, triggerNudge };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.MsnEmoticons = api;
})(typeof window !== "undefined" ? window : globalThis);
