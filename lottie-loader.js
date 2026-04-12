/**
 * SchoolByte Lottie Loader
 * Shows an animated book-reading loading screen using lottie/lottieanimation.json.
 * Since the source Lottie has a single static frame, all motion is achieved with CSS.
 *
 * Usage:
 *   LottieLoader.show();          // show the overlay
 *   LottieLoader.hide();          // fade out and remove
 *   LottieLoader.init();          // called automatically on script load
 */

(function () {
  'use strict';

  const LOTTIE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
  const ANIM_PATH  = 'lottie/lottieanimation.json';

  const CSS = `
    #sb-lottie-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0d1a4d 0%, #1a2a6c 45%, #6d0f0f 100%);
      transition: opacity 0.55s ease, visibility 0.55s ease;
      opacity: 1;
      visibility: visible;
    }
    #sb-lottie-overlay.sb-hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    /* ── floating book container ── */
    .sb-book-stage {
      position: relative;
      width: 220px;
      height: 220px;
      animation: sbFloat 3.2s ease-in-out infinite;
    }

    @keyframes sbFloat {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-14px); }
    }

    /* Lottie/image frame */
    #sb-lottie-frame {
      width: 220px;
      height: 220px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,215,0,0.18);
    }
    #sb-lottie-frame > div { width: 100% !important; height: 100% !important; }

    /* ── page-flip element (covers right half of book) ── */
    .sb-page-flip {
      position: absolute;
      top: 12%;
      right: 6%;
      width: 44%;
      height: 76%;
      transform-origin: left center;
      transform-style: preserve-3d;
      animation: sbPageFlip 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      pointer-events: none;
      border-radius: 0 10px 10px 0;
      background: linear-gradient(
        to right,
        rgba(255,255,255,0.0) 0%,
        rgba(255,255,255,0.06) 35%,
        rgba(255,255,255,0.14) 70%,
        rgba(255,255,255,0.22) 100%
      );
    }

    @keyframes sbPageFlip {
      0%   { transform: perspective(500px) rotateY(0deg);    opacity: 0; }
      8%   { opacity: 1; }
      38%  { transform: perspective(500px) rotateY(-38deg);  opacity: 1; }
      55%  { transform: perspective(500px) rotateY(-28deg);  opacity: 0.7; }
      72%  { transform: perspective(500px) rotateY(0deg);    opacity: 0; }
      100% { transform: perspective(500px) rotateY(0deg);    opacity: 0; }
    }

    /* ── page-flip shadow stripe ── */
    .sb-page-shadow {
      position: absolute;
      top: 12%;
      right: 6%;
      width: 8%;
      height: 76%;
      pointer-events: none;
      animation: sbPageShadow 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      background: linear-gradient(to right, rgba(0,0,0,0.18), transparent);
      border-radius: 2px;
    }

    @keyframes sbPageShadow {
      0%   { opacity: 0; transform: scaleX(0.2); }
      8%   { opacity: 1; transform: scaleX(1); }
      38%  { opacity: 0.6; transform: scaleX(1.4); }
      72%  { opacity: 0; transform: scaleX(0.2); }
      100% { opacity: 0; transform: scaleX(0.2); }
    }

    /* ── gold glow pulse ── */
    .sb-glow {
      position: absolute;
      inset: -12px;
      border-radius: 28px;
      background: transparent;
      box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.0);
      animation: sbGlow 1.8s ease-in-out infinite;
      pointer-events: none;
    }

    @keyframes sbGlow {
      0%, 100% { box-shadow: 0 0 0 3px rgba(255,215,0,0.0),  0 0 20px rgba(255,215,0,0.0); }
      40%       { box-shadow: 0 0 0 3px rgba(255,215,0,0.22), 0 0 40px rgba(255,215,0,0.12); }
    }

    /* ── text area ── */
    .sb-loader-text {
      margin-top: 32px;
      text-align: center;
    }
    .sb-loader-title {
      font-family: 'Inter', sans-serif;
      font-size: 1.05rem;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.04em;
      margin-bottom: 10px;
    }
    .sb-loader-sub {
      font-family: 'Inter', sans-serif;
      font-size: 0.82rem;
      color: rgba(255,255,255,0.52);
      letter-spacing: 0.02em;
    }

    /* animated dots */
    .sb-dots span {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #ffd700;
      margin: 0 3px;
      animation: sbDot 1.3s ease-in-out infinite;
    }
    .sb-dots span:nth-child(2) { animation-delay: 0.2s; }
    .sb-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes sbDot {
      0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
      40%            { transform: scale(1.2); opacity: 1;   }
    }

    /* ── progress bar ── */
    .sb-progress-wrap {
      width: 180px;
      height: 3px;
      background: rgba(255,255,255,0.12);
      border-radius: 10px;
      margin: 16px auto 0;
      overflow: hidden;
    }
    .sb-progress-bar {
      height: 100%;
      background: linear-gradient(to right, #ffd700, #ffa500);
      border-radius: 10px;
      animation: sbProgress 2.2s ease-in-out infinite;
    }

    @keyframes sbProgress {
      0%   { width: 0%;   margin-left: 0%;   }
      50%  { width: 80%;  margin-left: 10%;  }
      100% { width: 0%;   margin-left: 100%; }
    }
  `;

  function injectStyles() {
    if (document.getElementById('sb-lottie-styles')) return;
    const style = document.createElement('style');
    style.id = 'sb-lottie-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildOverlay() {
    if (document.getElementById('sb-lottie-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'sb-lottie-overlay';
    overlay.innerHTML = `
      <div class="sb-book-stage">
        <div class="sb-glow"></div>
        <div id="sb-lottie-frame"></div>
        <div class="sb-page-shadow"></div>
        <div class="sb-page-flip"></div>
      </div>
      <div class="sb-loader-text">
        <div class="sb-loader-title">SchoolByte</div>
        <div class="sb-loader-sub">Preparing your learning experience</div>
        <div class="sb-progress-wrap">
          <div class="sb-progress-bar"></div>
        </div>
        <div class="sb-dots" style="margin-top:14px;">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function loadLottieLib(callback) {
    if (window.lottie) { callback(); return; }
    const s = document.createElement('script');
    s.src = LOTTIE_CDN;
    s.onload = callback;
    s.onerror = callback; // fall back to static img on error
    document.head.appendChild(s);
  }

  function playAnimation() {
    const frame = document.getElementById('sb-lottie-frame');
    if (!frame) return;

    if (window.lottie) {
      try {
        window.lottie.loadAnimation({
          container: frame,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: ANIM_PATH
        });
        return;
      } catch (e) { /* fall through */ }
    }

    // Fallback: render as image via fetch
    fetch(ANIM_PATH)
      .then(r => r.json())
      .then(data => {
        const asset = data.assets && data.assets[0];
        if (asset && asset.p && asset.p.startsWith('data:')) {
          const img = document.createElement('img');
          img.src = asset.p;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:20px;';
          frame.appendChild(img);
        }
      })
      .catch(() => {
        frame.innerHTML = '<i class="fas fa-book-open" style="font-size:5rem;color:#ffd700;display:flex;align-items:center;justify-content:center;height:100%;"></i>';
      });
  }

  const LottieLoader = {
    _ready: false,

    init: function () {
      injectStyles();
      if (document.body) {
        buildOverlay();
        loadLottieLib(playAnimation);
        this._ready = true;
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          buildOverlay();
          loadLottieLib(playAnimation);
          this._ready = true;
        });
      }
    },

    show: function () {
      const o = document.getElementById('sb-lottie-overlay');
      if (o) { o.classList.remove('sb-hidden'); }
    },

    hide: function (delay) {
      const ms = typeof delay === 'number' ? delay : 0;
      setTimeout(() => {
        const o = document.getElementById('sb-lottie-overlay');
        if (o) { o.classList.add('sb-hidden'); }
      }, ms);
    }
  };

  // Auto-init
  LottieLoader.init();
  window.LottieLoader = LottieLoader;

  // Auto-hide when the window fully loads (fallback for pages that don't call hide() manually)
  window.addEventListener('load', function () {
    setTimeout(function () {
      const o = document.getElementById('sb-lottie-overlay');
      if (o && !o.classList.contains('sb-hidden')) {
        LottieLoader.hide();
      }
    }, 400);
  });
})();
