/* ============================================================================
   XP Isometric 3D Icons Library (Windows XP Luna 2001 Aesthetic)
   100% offline SVG icons with 3D isometric depth, soft outlines, and gradients.
   ============================================================================ */
(function (global) {
  "use strict";

  const ICONS = {
    myComputer: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="xp-crt-bezel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#F7F5EA"/>
            <stop offset="100%" stop-color="#B8B3A2"/>
          </linearGradient>
          <linearGradient id="xp-crt-screen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#76C7FF"/>
            <stop offset="55%" stop-color="#2275E0"/>
            <stop offset="100%" stop-color="#13459B"/>
          </linearGradient>
        </defs>
        <polygon points="4,4 19,2 22,5 22,16 18,18 4,17" fill="url(#xp-crt-bezel)" stroke="#4A473E" stroke-width="1"/>
        <polygon points="5,5 17,4 17,14 5,15" fill="url(#xp-crt-screen)" stroke="#1B3C7A" stroke-width="0.9"/>
        <path d="M6 7l9-1v2l-9 1z" fill="#FFFFFF" opacity="0.35"/>
        <polygon points="7,17 17,18 19,21 5,21" fill="#D4CFC0" stroke="#5A564C" stroke-width="0.9"/>
        <rect x="2" y="13" width="6" height="8" rx="1" fill="#E8E4D5" stroke="#5A564C" stroke-width="0.9"/>
        <circle cx="5" cy="19" r="0.9" fill="#32C832"/>
      </svg>`,

    folder: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="xp-fld-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FFE47A"/>
            <stop offset="100%" stop-color="#D98B14"/>
          </linearGradient>
          <linearGradient id="xp-fld-front" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#FFF099"/>
            <stop offset="55%" stop-color="#FFCA3A"/>
            <stop offset="100%" stop-color="#E29315"/>
          </linearGradient>
        </defs>
        <path d="M3 6l6-1 2 2h9v11l-17 2z" fill="url(#xp-fld-back)" stroke="#8F5705" stroke-width="1" stroke-linejoin="round"/>
        <polygon points="3,9 21,8 22,19 4,20" fill="url(#xp-fld-front)" stroke="#9D6108" stroke-width="1" stroke-linejoin="round"/>
        <path d="M4 10l16-1" stroke="#FFF9D6" stroke-width="1.1"/>
      </svg>`,

    saveFloppy: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="xp-flp-blue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#58A8FF"/>
            <stop offset="100%" stop-color="#0B4DB8"/>
          </linearGradient>
        </defs>
        <polygon points="3,4 18,3 21,6 21,20 4,21" fill="url(#xp-flp-blue)" stroke="#082D6E" stroke-width="1" stroke-linejoin="round"/>
        <rect x="7" y="4" width="9" height="6" rx="0.8" fill="#E8ECF2" stroke="#53627A" stroke-width="0.9"/>
        <rect x="12" y="5" width="2.2" height="4" fill="#3B4961"/>
        <rect x="6" y="13" width="12" height="6.5" rx="0.8" fill="#FFFDF5" stroke="#36578F" stroke-width="0.8"/>
        <line x1="8" y1="15.5" x2="16" y2="15.5" stroke="#D1493B" stroke-width="1"/>
        <line x1="8" y1="17.6" x2="14" y2="17.6" stroke="#7E92B5" stroke-width="1"/>
      </svg>`,

    exportFilm: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="xp-disc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#E7F3FF"/>
            <stop offset="50%" stop-color="#8FD0FF"/>
            <stop offset="100%" stop-color="#D79BFF"/>
          </linearGradient>
        </defs>
        <rect x="2" y="4" width="14" height="16" rx="1.5" fill="#374151" stroke="#111827" stroke-width="1"/>
        <rect x="4.5" y="6" width="9" height="5" fill="#60A5FA"/>
        <rect x="4.5" y="13" width="9" height="5" fill="#FBBF24"/>
        <circle cx="16.5" cy="15.5" r="6" fill="url(#xp-disc)" stroke="#2563EB" stroke-width="1"/>
        <circle cx="16.5" cy="15.5" r="1.8" fill="#FFFFFF" stroke="#64748B" stroke-width="0.8"/>
      </svg>`,

    trash: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="xp-bin-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#DCEEFF"/>
            <stop offset="55%" stop-color="#93C5FD"/>
            <stop offset="100%" stop-color="#3B82F6"/>
          </linearGradient>
        </defs>
        <polygon points="5,7 19,6 17.5,20 6.5,21" fill="url(#xp-bin-body)" stroke="#1E40AF" stroke-width="1" stroke-linejoin="round"/>
        <ellipse cx="12" cy="6.5" rx="7.5" ry="2.2" fill="#E0F2FE" stroke="#1E40AF" stroke-width="1"/>
        <line x1="9" y1="9.5" x2="9.5" y2="18.5" stroke="#1D4ED8" stroke-width="1" opacity="0.65"/>
        <line x1="12" y1="9.5" x2="12" y2="19" stroke="#1D4ED8" stroke-width="1" opacity="0.65"/>
        <line x1="15" y1="9.5" x2="14.5" y2="18.5" stroke="#1D4ED8" stroke-width="1" opacity="0.65"/>
      </svg>`,

    alertWarn: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="xp-warn-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FFF07A"/>
            <stop offset="100%" stop-color="#F59E0B"/>
          </linearGradient>
        </defs>
        <path d="M12 3L22 20H2z" fill="url(#xp-warn-g)" stroke="#92400E" stroke-width="1.3" stroke-linejoin="round"/>
        <rect x="11" y="9" width="2" height="6" rx="0.8" fill="#1F2937"/>
        <circle cx="12" cy="17.2" r="1.2" fill="#1F2937"/>
      </svg>`,

    alertError: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <radialGradient id="xp-err-g" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#FCA5A5"/>
            <stop offset="45%" stop-color="#EF4444"/>
            <stop offset="100%" stop-color="#991B1B"/>
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="9.5" fill="url(#xp-err-g)" stroke="#7F1D1D" stroke-width="1.1"/>
        <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>
      </svg>`,

    alertInfo: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <radialGradient id="xp-info-g" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#93C5FD"/>
            <stop offset="50%" stop-color="#2563EB"/>
            <stop offset="100%" stop-color="#1E3A8A"/>
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="9.5" fill="url(#xp-info-g)" stroke="#1E3A8A" stroke-width="1.1"/>
        <circle cx="12" cy="7.5" r="1.4" fill="#FFFFFF"/>
        <rect x="10.8" y="10.5" width="2.4" height="7" rx="1" fill="#FFFFFF"/>
      </svg>`,

    shield: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5L20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3.5z" fill="#E5E7EB" stroke="#374151" stroke-width="1.1"/>
        <path d="M12 4.2v7.8H5.8V7.2L12 4.2z" fill="#EF4444"/>
        <path d="M12 4.2v7.8h6.2V7.2L12 4.2z" fill="#22C55E"/>
        <path d="M12 12v8.2c-3.5-1.3-6.2-4.2-6.2-8.2H12z" fill="#3B82F6"/>
        <path d="M12 12v8.2c3.5-1.3 6.2-4.2 6.2-8.2H12z" fill="#FACC15"/>
      </svg>`,

    sound: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <polygon points="3,9 8,9 14,4 14,20 8,15 3,15" fill="#9CA3AF" stroke="#374151" stroke-width="1" stroke-linejoin="round"/>
        <path d="M16.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="#2563EB" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#60A5FA" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`,

    gear: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="xp-gear-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#F3F4F6"/>
            <stop offset="100%" stop-color="#9CA3AF"/>
          </linearGradient>
        </defs>
        <path d="M12 2.5l1.6 2.1 2.6-.4.7 2.5 2.4 1.1-.8 2.5 1.5 2.1-1.5 2.1.8 2.5-2.4 1.1-.7 2.5-2.6-.4-1.6 2.1-1.6-2.1-2.6.4-.7-2.5-2.4-1.1.8-2.5-1.5-2.1 1.5-2.1-.8-2.5 2.4-1.1.7-2.5 2.6.4z" fill="url(#xp-gear-g)" stroke="#4B5563" stroke-width="1" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="3.6" fill="#60A5FA" stroke="#1E40AF" stroke-width="1"/>
      </svg>`,

    help: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" fill="#2563EB" stroke="#1E3A8A" stroke-width="1.1"/>
        <path d="M9.2 9.2a3 3 0 0 1 5.6 1.2c0 1.8-2.8 2.2-2.8 4" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round"/>
        <circle cx="12" cy="17.4" r="1.2" fill="#FFFFFF"/>
      </svg>`,

    palette: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3C6.5 3 2.5 6.8 2.5 11.5c0 4 3 6.8 6.5 6.8h1.5c1 0 1.6.6 1.6 1.4 0 .9.8 1.5 1.9 1.5 4.3 0 7.5-3.8 7.5-9.2C21.5 6.8 17.3 3 12 3z" fill="#FDE68A" stroke="#92400E" stroke-width="1"/>
        <circle cx="7.5" cy="10" r="1.6" fill="#EF4444"/>
        <circle cx="11.5" cy="7.2" r="1.6" fill="#3B82F6"/>
        <circle cx="16" cy="9" r="1.6" fill="#22C55E"/>
        <circle cx="16.5" cy="13.5" r="1.6" fill="#A855F7"/>
      </svg>`,

    eye: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z" fill="#FFFFFF" stroke="#1E3A8A" stroke-width="1.2"/>
        <circle cx="12" cy="12" r="3.6" fill="#3B82F6" stroke="#1E3A8A" stroke-width="1"/>
        <circle cx="12" cy="12" r="1.4" fill="#111827"/>
        <circle cx="10.8" cy="10.8" r="0.8" fill="#FFFFFF"/>
      </svg>`,

    mic: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" fill="#CBD5E1" stroke="#334155" stroke-width="1.1"/>
        <path d="M6 11a6 6 0 0 0 12 0" fill="none" stroke="#1D4ED8" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="12" y1="17" x2="12" y2="21" stroke="#334155" stroke-width="1.6"/>
        <line x1="8.5" y1="21" x2="15.5" y2="21" stroke="#334155" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`,

    globe: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <radialGradient id="xp-glb-g" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#93C5FD"/>
            <stop offset="55%" stop-color="#2563EB"/>
            <stop offset="100%" stop-color="#1E3A8A"/>
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="9.5" fill="url(#xp-glb-g)" stroke="#1E3A8A" stroke-width="1.1"/>
        <ellipse cx="12" cy="12" rx="4.5" ry="9.3" fill="none" stroke="#DBEAFE" stroke-width="1"/>
        <line x1="2.8" y1="12" x2="21.2" y2="12" stroke="#DBEAFE" stroke-width="1"/>
        <path d="M4.5 8h15M4.5 16h15" stroke="#93C5FD" stroke-width="0.9"/>
      </svg>`,

    user: (s) => `
      <svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="7.5" r="4" fill="#FDE68A" stroke="#92400E" stroke-width="1"/>
        <path d="M4.5 20.5c0-4.2 3.3-7 7.5-7s7.5 2.8 7.5 7z" fill="#3B82F6" stroke="#1E3A8A" stroke-width="1" stroke-linejoin="round"/>
      </svg>`
  };

  function render(name, size = 16) {
    const fn = ICONS[name];
    if (!fn) return "";
    return `<span class="xp-ico-inline" data-xp-icon-rendered="${name}">${fn(size)}</span>`;
  }

  function hydrateAll(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") return 0;
    let count = 0;
    root.querySelectorAll("[data-xp-icon]").forEach((el) => {
      const name = el.getAttribute("data-xp-icon");
      const size = Number(el.getAttribute("data-xp-icon-size")) || 15;
      if (name && ICONS[name]) {
        el.innerHTML = ICONS[name](size);
        count++;
      }
    });
    return count;
  }

  const api = { ICONS, render, hydrateAll };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.XpIcons = api;
})(typeof window !== "undefined" ? window : globalThis);
