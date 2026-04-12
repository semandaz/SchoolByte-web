const SCHOOLBYTE_AVATARS = [
  {
    id: 'blob1', name: 'Blobby', tier: 1, tierName: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <ellipse cx="52" cy="51" rx="38" ry="40" fill="#f4c542"/>
      <ellipse cx="50" cy="50" rx="36" ry="38" fill="#f9d86e"/>
      <ellipse cx="36" cy="42" rx="7" ry="9" fill="white"/>
      <ellipse cx="64" cy="40" rx="5" ry="8" fill="white"/>
      <circle cx="37" cy="43" r="4" fill="#333"/>
      <circle cx="65" cy="41" r="3" fill="#333"/>
      <circle cx="38" cy="42" r="1.5" fill="white"/>
      <path d="M35 65 Q50 58 67 68" stroke="#b85c00" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="30" cy="60" rx="6" ry="4" fill="#f4a460" opacity="0.5"/>
      <ellipse cx="72" cy="58" rx="6" ry="4" fill="#f4a460" opacity="0.5"/>
    </svg>`
  },
  {
    id: 'squig2', name: 'Squiggly', tier: 1, tierName: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <path d="M20 45 Q18 25 40 20 Q65 14 78 35 Q90 55 80 72 Q70 88 48 86 Q22 84 18 65 Z" fill="#a8d8a8"/>
      <ellipse cx="38" cy="42" rx="8" ry="10" fill="white"/>
      <circle cx="38" cy="43" r="5" fill="#222"/>
      <circle cx="40" cy="41" r="2" fill="white"/>
      <ellipse cx="63" cy="39" rx="6" ry="6" fill="white"/>
      <circle cx="63" cy="40" r="3.5" fill="#222"/>
      <circle cx="64" cy="38" r="1.5" fill="white"/>
      <path d="M36 62 Q42 70 52 65 Q58 61 65 65" stroke="#555" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="48" cy="55" r="3" fill="#ff9999"/>
    </svg>`
  },
  {
    id: 'derp3', name: 'Derpy', tier: 1, tierName: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="#ffb347"/>
      <path d="M34 40 L38 44 M38 40 L34 44" stroke="#333" stroke-width="3" stroke-linecap="round"/>
      <path d="M60 38 L64 42 M64 38 L60 42" stroke="#333" stroke-width="3" stroke-linecap="round"/>
      <path d="M33 62 Q40 55 50 60 Q60 65 67 58" stroke="#8B4513" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="34" cy="58" rx="7" ry="5" fill="#ff7f7f" opacity="0.5"/>
      <ellipse cx="66" cy="56" rx="7" ry="5" fill="#ff7f7f" opacity="0.5"/>
      <path d="M30 30 Q45 20 55 28" stroke="#c8860a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M52 26 Q63 16 72 28" stroke="#c8860a" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`
  },

  {
    id: 'sunny4', name: 'Sunny', tier: 2, tierName: 'Rising',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="#ffe066"/>
      <circle cx="50" cy="50" r="38" fill="#ffd23f"/>
      <ellipse cx="37" cy="43" rx="6" ry="7" fill="white"/>
      <circle cx="37" cy="44" r="4" fill="#333"/>
      <circle cx="38" cy="43" r="1.5" fill="white"/>
      <ellipse cx="63" cy="43" rx="6" ry="7" fill="white"/>
      <circle cx="63" cy="44" r="4" fill="#333"/>
      <circle cx="64" cy="43" r="1.5" fill="white"/>
      <path d="M35 62 Q50 74 65 62" stroke="#d4880a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="34" cy="56" rx="7" ry="5" fill="#ffb347" opacity="0.6"/>
      <ellipse cx="66" cy="56" rx="7" ry="5" fill="#ffb347" opacity="0.6"/>
      <path d="M30 30 Q50 24 70 30" stroke="#e8a000" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'cool5', name: 'Cool Cat', tier: 2, tierName: 'Rising',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="52" r="38" fill="#87ceeb"/>
      <circle cx="50" cy="52" r="36" fill="#6ab4d8"/>
      <rect x="28" y="40" width="44" height="14" rx="7" fill="#1a1a2e"/>
      <rect x="29" y="41" width="18" height="12" rx="6" fill="#2a2a4a"/>
      <rect x="53" y="41" width="18" height="12" rx="6" fill="#2a2a4a"/>
      <rect x="46" y="44" width="8" height="5" fill="#111" rx="2"/>
      <path d="M35 63 Q50 73 65 63" stroke="#1a3a5c" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M30 28 Q40 20 50 24 Q60 20 70 28" stroke="#4a8fba" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M50 24 L50 30" stroke="#4a8fba" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'freck6', name: 'Freckles', tier: 2, tierName: 'Rising',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="#f5cba7"/>
      <circle cx="50" cy="50" r="38" fill="#f0c090"/>
      <ellipse cx="37" cy="43" rx="6" ry="7" fill="white"/>
      <circle cx="37" cy="44" r="4" fill="#4a3728"/>
      <circle cx="38" cy="42" r="1.5" fill="white"/>
      <ellipse cx="63" cy="43" rx="6" ry="7" fill="white"/>
      <circle cx="63" cy="44" r="4" fill="#4a3728"/>
      <circle cx="64" cy="42" r="1.5" fill="white"/>
      <path d="M37 60 Q50 70 63 60" stroke="#c8860a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="32" cy="57" r="2" fill="#e0997a"/>
      <circle cx="36" cy="60" r="1.5" fill="#e0997a"/>
      <circle cx="64" cy="57" r="2" fill="#e0997a"/>
      <circle cx="68" cy="60" r="1.5" fill="#e0997a"/>
      <path d="M35 32 Q50 25 65 32" stroke="#8B4513" stroke-width="3" fill="#8B4513"/>
      <ellipse cx="50" cy="34" rx="15" ry="6" fill="#6B3410"/>
    </svg>`
  },

  {
    id: 'scholar7', name: 'Scholar', tier: 3, tierName: 'Advanced',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="56" r="36" fill="#c0aaf0"/>
      <circle cx="50" cy="56" r="34" fill="#b09ae0"/>
      <ellipse cx="37" cy="50" rx="6" ry="7" fill="white"/>
      <circle cx="37" cy="51" r="4" fill="#2c1a6e"/>
      <circle cx="38" cy="50" r="1.5" fill="white"/>
      <ellipse cx="63" cy="50" rx="6" ry="7" fill="white"/>
      <circle cx="63" cy="51" r="4" fill="#2c1a6e"/>
      <circle cx="64" cy="50" r="1.5" fill="white"/>
      <path d="M38 68 Q50 77 62 68" stroke="#4a2c9e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <rect x="22" y="26" width="56" height="8" rx="4" fill="#1a2a6c"/>
      <polygon points="50,12 76,26 24,26" fill="#1a2a6c"/>
      <rect x="68" y="26" width="4" height="12" fill="#b21f1f"/>
      <rect x="66" y="36" width="8" height="5" rx="2" fill="#b21f1f"/>
      <path d="M30 43 Q50 38 70 43" stroke="#7a5ac0" stroke-width="2" fill="none"/>
    </svg>`
  },
  {
    id: 'techie8', name: 'Techie', tier: 3, tierName: 'Advanced',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="52" r="38" fill="#4fc3f7"/>
      <circle cx="50" cy="52" r="36" fill="#29b6f6"/>
      <ellipse cx="37" cy="46" rx="7" ry="8" fill="white"/>
      <circle cx="37" cy="47" r="4.5" fill="#1565c0"/>
      <circle cx="38" cy="46" r="1.8" fill="white"/>
      <ellipse cx="63" cy="46" rx="7" ry="8" fill="white"/>
      <circle cx="63" cy="47" r="4.5" fill="#1565c0"/>
      <circle cx="64" cy="46" r="1.8" fill="white"/>
      <rect x="28" y="38" width="20" height="14" rx="6" fill="none" stroke="#0d47a1" stroke-width="2.5"/>
      <rect x="52" y="38" width="20" height="14" rx="6" fill="none" stroke="#0d47a1" stroke-width="2.5"/>
      <line x1="48" y1="45" x2="52" y2="45" stroke="#0d47a1" stroke-width="2.5"/>
      <path d="M37 64 Q50 74 63 64" stroke="#0d47a1" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M25 28 Q38 20 50 26 Q62 20 75 28" stroke="#0277bd" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'star9', name: 'Star Pupil', tier: 3, tierName: 'Advanced',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="#ff7eb3"/>
      <circle cx="50" cy="50" r="38" fill="#ff5fa0"/>
      <ellipse cx="37" cy="44" rx="7" ry="8" fill="white"/>
      <circle cx="37" cy="45" r="4.5" fill="#7b1fa2"/>
      <circle cx="38" cy="44" r="1.8" fill="white"/>
      <ellipse cx="63" cy="44" rx="7" ry="8" fill="white"/>
      <circle cx="63" cy="45" r="4.5" fill="#7b1fa2"/>
      <circle cx="64" cy="44" r="1.8" fill="white"/>
      <path d="M37 63 Q50 74 63 63" stroke="#9c004d" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <polygon points="50,8 53,17 62,17 55,23 58,32 50,26 42,32 45,23 38,17 47,17" fill="#ffd700" opacity="0.95"/>
      <ellipse cx="33" cy="58" rx="7" ry="5" fill="#ff9ec0" opacity="0.7"/>
      <ellipse cx="67" cy="58" rx="7" ry="5" fill="#ff9ec0" opacity="0.7"/>
    </svg>`
  },

  {
    id: 'exec10', name: 'Executive', tier: 4, tierName: 'Elite',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="#1a2a6c"/>
      <defs>
        <radialGradient id="exec-bg" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#2a3a8c"/>
          <stop offset="100%" stop-color="#0d1a4d"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="38" fill="url(#exec-bg)"/>
      <circle cx="50" cy="44" r="14" fill="#f5cba7"/>
      <ellipse cx="50" cy="68" rx="20" ry="12" fill="#f5cba7"/>
      <rect x="38" y="55" width="24" height="6" fill="#f5cba7"/>
      <ellipse cx="37" cy="43" rx="5" ry="5.5" fill="#f5cba7"/>
      <ellipse cx="63" cy="43" rx="5" ry="5.5" fill="#f5cba7"/>
      <circle cx="45" cy="43" r="2.5" fill="#2c1a6e"/>
      <circle cx="55" cy="43" r="2.5" fill="#2c1a6e"/>
      <circle cx="45.8" cy="42.3" r="1" fill="white"/>
      <circle cx="55.8" cy="42.3" r="1" fill="white"/>
      <path d="M44 52 Q50 57 56 52" stroke="#c8860a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <rect x="42" y="56" width="16" height="10" rx="3" fill="#1a2a6c"/>
      <rect x="46" y="54" width="8" height="5" rx="2" fill="#b21f1f"/>
      <path d="M36 35 Q50 28 64 35" stroke="#f0c090" stroke-width="4" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'crown11', name: 'Champion', tier: 4, tierName: 'Elite',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <radialGradient id="champ-bg" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#2ecc71"/>
          <stop offset="100%" stop-color="#1a6c3a"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="40" fill="url(#champ-bg)"/>
      <circle cx="50" cy="55" r="18" fill="#f5cba7"/>
      <ellipse cx="50" cy="72" rx="22" ry="10" fill="#f5cba7"/>
      <rect x="38" y="60" width="24" height="7" fill="#f5cba7"/>
      <circle cx="44" cy="53" r="3" fill="#2c1a6e"/>
      <circle cx="56" cy="53" r="3" fill="#2c1a6e"/>
      <circle cx="44.8" cy="52.2" r="1.2" fill="white"/>
      <circle cx="56.8" cy="52.2" r="1.2" fill="white"/>
      <path d="M43 63 Q50 70 57 63" stroke="#b8720a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M50 8 L57 22 L72 18 L64 30 L78 32 L65 38 L68 54 L50 44 L32 54 L35 38 L22 32 L36 30 L28 18 L43 22 Z" fill="#ffd700"/>
      <circle cx="50" cy="8" r="3" fill="#ffa500"/>
      <circle cx="72" cy="18" r="3" fill="#ffa500"/>
      <circle cx="28" cy="18" r="3" fill="#ffa500"/>
    </svg>`
  },
  {
    id: 'elite12', name: 'Elite Scholar', tier: 4, tierName: 'Elite',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <radialGradient id="elite-bg" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#b21f1f"/>
          <stop offset="100%" stop-color="#6d0f0f"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="40" fill="url(#elite-bg)"/>
      <circle cx="50" cy="52" r="17" fill="#f5cba7"/>
      <ellipse cx="50" cy="70" rx="22" ry="11" fill="#f5cba7"/>
      <rect x="38" y="57" width="24" height="8" fill="#f5cba7"/>
      <ellipse cx="36" cy="50" rx="5" ry="5" fill="#f5cba7"/>
      <ellipse cx="64" cy="50" rx="5" ry="5" fill="#f5cba7"/>
      <circle cx="44" cy="51" r="3" fill="#2c1a6e"/>
      <circle cx="56" cy="51" r="3" fill="#2c1a6e"/>
      <circle cx="44.8" cy="50.2" r="1.2" fill="white"/>
      <circle cx="56.8" cy="50.2" r="1.2" fill="white"/>
      <path d="M43 62 Q50 69 57 62" stroke="#b8720a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <polygon points="50,14 52,20 58,20 53,24 55,30 50,26 45,30 47,24 42,20 48,20" fill="#ffd700"/>
      <rect x="38" y="28" width="24" height="5" rx="2.5" fill="#1a2a6c"/>
      <polygon points="38,28 50,18 62,28" fill="#1a2a6c"/>
      <rect x="60" y="28" width="3" height="9" fill="#ffd700"/>
      <rect x="58" y="35" width="7" height="4" rx="2" fill="#ffd700"/>
    </svg>`
  }
];

if (typeof module !== 'undefined') module.exports = SCHOOLBYTE_AVATARS;
