/**
 * Lightweight interactions today, ready to be replaced by typed modules when the
 * future Node.js + PostgreSQL integration owns forms, authentication and content.
 */

const appConfig = {
  apiBaseUrl: "/api",
  endpoints: {
    leads: "/leads",
    studentArea: "/student-area",
  },
};

const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const studentAccess = document.querySelector("[data-student-access]");
const studentMenuToggle = document.querySelector("[data-student-menu-toggle]");
const studentLoginOpen = document.querySelector("[data-student-login-open]");
const studentLoginForm = document.querySelector("[data-student-login-form]");
const revealItems = document.querySelectorAll(".reveal");
const packageGrid = document.querySelector(".service-grid");
const packageCards = document.querySelectorAll(".service-card");
const floralCanvas = document.querySelector("[data-floral-background]");
const wordCard = document.querySelector("[data-word-card]");
const wordText = document.querySelector("[data-word-text]");
const wordPronunciation = document.querySelector("[data-word-pronunciation]");
const wordTranslation = document.querySelector("[data-word-translation]");
const wordExample = document.querySelector("[data-word-example]");
const wordAudioButton = document.querySelector("[data-word-audio]");

const wordsOfTheDay = [
  {
    word: "Graceful",
    translation: "elegante, leve e delicado",
    pronunciation: "/ˈɡreɪs.fəl/",
    example: "She gave a graceful answer during the meeting.",
  },
  {
    word: "Steady",
    translation: "constante, firme",
    pronunciation: "/ˈsted.i/",
    example: "Small, steady practice helps you speak with more confidence.",
  },
  {
    word: "Curious",
    translation: "curioso, interessado em aprender",
    pronunciation: "/ˈkjʊr.i.əs/",
    example: "Curious students usually learn new expressions faster.",
  },
  {
    word: "Thoughtful",
    translation: "atencioso, cuidadoso",
    pronunciation: "/ˈθɑːt.fəl/",
    example: "A thoughtful question can make the whole conversation deeper.",
  },
  {
    word: "Confident",
    translation: "confiante, seguro",
    pronunciation: "/ˈkɑːn.fə.dənt/",
    example: "She sounded confident when she introduced herself in English.",
  },
  {
    word: "Gentle",
    translation: "gentil, suave",
    pronunciation: "/ˈdʒen.təl/",
    example: "Use a gentle tone when you are giving feedback.",
  },
  {
    word: "Reliable",
    translation: "confiável",
    pronunciation: "/rɪˈlaɪ.ə.bəl/",
    example: "A reliable routine makes studying feel easier.",
  },
  {
    word: "Brave",
    translation: "corajoso",
    pronunciation: "/breɪv/",
    example: "It is brave to speak even when you are still learning.",
  },
  {
    word: "Fluent",
    translation: "fluente, natural ao falar",
    pronunciation: "/ˈfluː.ənt/",
    example: "Fluent speech comes from practice, not perfection.",
  },
  {
    word: "Mindful",
    translation: "consciente, atento",
    pronunciation: "/ˈmaɪnd.fəl/",
    example: "Be mindful of the words you already know and use them often.",
  },
  {
    word: "Polished",
    translation: "bem acabado, refinado",
    pronunciation: "/ˈpɑː.lɪʃt/",
    example: "Her presentation sounded polished after a few rehearsals.",
  },
  {
    word: "Bright",
    translation: "inteligente, claro, radiante",
    pronunciation: "/braɪt/",
    example: "That is a bright idea for your speaking practice.",
  },
  {
    word: "Resilient",
    translation: "resiliente, capaz de se recuperar",
    pronunciation: "/rɪˈzɪl.jənt/",
    example: "Resilient learners keep going after making mistakes.",
  },
  {
    word: "Precise",
    translation: "preciso, exato",
    pronunciation: "/prɪˈsaɪs/",
    example: "Try to be precise when you describe your routine.",
  },
  {
    word: "Warm",
    translation: "acolhedor, caloroso",
    pronunciation: "/wɔːrm/",
    example: "A warm greeting can start a conversation beautifully.",
  },
];

function setupFloralBackground() {
  if (!floralCanvas) {
    return;
  }

  const ctx = floralCanvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
  });

  if (!ctx) {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mouse = { x: -9999, y: -9999, active: false };
  const particles = [];
  const lightPalette = [
    "rgba(229, 210, 164, 0.72)",
    "rgba(218, 188, 112, 0.64)",
    "rgba(196, 161, 90, 0.58)",
    "rgba(244, 229, 190, 0.6)",
    "rgba(174, 136, 72, 0.62)",
  ];
  const darkPalette = [
    "rgba(3, 18, 14, 0.82)",
    "rgba(6, 24, 18, 0.78)",
    "rgba(10, 31, 23, 0.74)",
    "rgba(22, 30, 20, 0.68)",
    "rgba(4, 20, 16, 0.76)",
  ];
  const lightSprites = [];
  const darkSprites = [];
  const lightSections = Array.from(
    document.querySelectorAll(".word-section, .teacher-section, .classes, .trial-section")
  );
  const lightSectionRects = [];
  const dots = [];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let animationFrame = 0;
  let lastTimestamp = 0;
  let resizeFrame = 0;
  let sectionFrame = 0;
  let isPaused = false;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function createSprite({ color }) {
    const spriteSize = 64;
    const sprite = typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(spriteSize, spriteSize)
      : document.createElement("canvas");
    const spriteContext = sprite.getContext("2d");
    const center = spriteSize / 2;

    sprite.width = spriteSize;
    sprite.height = spriteSize;

    if (!spriteContext) {
      return sprite;
    }

    spriteContext.translate(center, center);

    const glow = spriteContext.createRadialGradient(0, 0, 0, 0, 0, 24);
    glow.addColorStop(0, color);
    glow.addColorStop(0.28, color);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");

    spriteContext.fillStyle = glow;
    spriteContext.beginPath();
    spriteContext.arc(0, 0, 24, 0, Math.PI * 2);
    spriteContext.fill();

    spriteContext.strokeStyle = color;
    spriteContext.lineCap = "round";
    spriteContext.lineWidth = 1.25;
    spriteContext.beginPath();
    spriteContext.moveTo(-18, 0);
    spriteContext.lineTo(18, 0);
    spriteContext.moveTo(0, -18);
    spriteContext.lineTo(0, 18);
    spriteContext.stroke();

    spriteContext.beginPath();
    spriteContext.arc(0, 0, 2.2, 0, Math.PI * 2);
    spriteContext.fillStyle = color;
    spriteContext.fill();

    return sprite;
  }

  function buildSprites() {
    lightSprites.length = 0;
    darkSprites.length = 0;

    lightPalette.forEach((color, index) => {
      lightSprites.push(
        createSprite({
          color,
        })
      );
    });

    darkPalette.forEach((color, index) => {
      darkSprites.push(
        createSprite({
          color,
        })
      );
    });
  }

  function updateLightSectionRects() {
    lightSectionRects.length = 0;

    lightSections.forEach((section) => {
      const rect = section.getBoundingClientRect();

      if (rect.bottom >= -120 && rect.top <= height + 120) {
        lightSectionRects.push({
          top: rect.top,
          bottom: rect.bottom,
        });
      }
    });
  }

  function requestSectionMeasure() {
    window.cancelAnimationFrame(sectionFrame);
    sectionFrame = window.requestAnimationFrame(updateLightSectionRects);
  }

  function createParticle(index) {
    const depth = randomBetween(0.42, 1);
    const spriteIndex = index % lightSprites.length;
    const size = randomBetween(7, 17) * depth;
    const y = randomBetween(-80, height + 80);

    return {
      x: randomBetween(-80, width + 80),
      y,
      baseX: randomBetween(-80, width + 80),
      depth,
      size,
      spriteIndex,
      lightMix: 0,
      opacity: randomBetween(0.2, 0.52) * depth,
      drift: randomBetween(0.12, 0.34) * depth,
      floatSpeed: 0,
      twinkleSpeed: 0,
      wave: randomBetween(5, 20),
      phase: randomBetween(0, Math.PI * 2),
      rotation: randomBetween(0, Math.PI * 2),
      spin: 0,
    };
  }

  function buildDots() {
    const spacing = width < 760 ? 30 : 24;
    const columns = Math.ceil(width / spacing) + 2;
    const rows = Math.ceil(height / spacing) + 2;

    dots.length = 0;

    for (let row = -1; row < rows; row += 1) {
      const rowOffset = row % 2 === 0 ? 0 : spacing / 2;

      for (let column = -1; column < columns; column += 1) {
        dots.push({
          x: column * spacing + rowOffset,
          y: row * spacing,
          phase: randomBetween(0, Math.PI * 2),
          radius: randomBetween(0.72, 1.05),
        });
      }
    }
  }

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    floralCanvas.width = Math.floor(width * dpr);
    floralCanvas.height = Math.floor(height * dpr);
    floralCanvas.style.width = `${width}px`;
    floralCanvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const targetCount = Math.min(240, Math.max(104, Math.floor((width * height) / 8500)));
    particles.length = 0;

    for (let index = 0; index < targetCount; index += 1) {
      particles.push(createParticle(index));
    }

    buildDots();
    updateLightSectionRects();
  }

  function getLightMixForY(y) {
    const fade = 120;

    for (const rect of lightSectionRects) {
      if (y >= rect.top && y <= rect.bottom) {
        return 1;
      }

      if (y > rect.top - fade && y < rect.top) {
        return 1 - (rect.top - y) / fade;
      }

      if (y > rect.bottom && y < rect.bottom + fade) {
        return 1 - (y - rect.bottom) / fade;
      }
    }

    return 0;
  }

  function drawParticle(particle, time, influence) {
    const size = particle.size * (0.82 + influence * 0.22);
    const halfSize = size / 2;
    const baseAlpha = Math.min(0.34, particle.opacity * 0.18 + influence * 0.14);
    const lightSprite = lightSprites[particle.spriteIndex];
    const darkSprite = darkSprites[particle.spriteIndex];

    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);

    if (particle.lightMix < 0.98) {
      ctx.globalAlpha = baseAlpha * (1 - particle.lightMix);
      ctx.drawImage(lightSprite, -halfSize, -halfSize, size, size);
    }

    if (particle.lightMix > 0.02) {
      ctx.globalAlpha = baseAlpha * particle.lightMix;
      ctx.drawImage(darkSprite, -halfSize, -halfSize, size, size);
    }

    ctx.restore();
  }

  function getDotColor(lightMix, alpha) {
    const darkSectionColor = [196, 161, 90];
    const lightSectionColor = [12, 45, 34];
    const red = Math.round(darkSectionColor[0] * (1 - lightMix) + lightSectionColor[0] * lightMix);
    const green = Math.round(darkSectionColor[1] * (1 - lightMix) + lightSectionColor[1] * lightMix);
    const blue = Math.round(darkSectionColor[2] * (1 - lightMix) + lightSectionColor[2] * lightMix);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function drawInteractiveDots(time) {
    const hoverRadius = width < 760 ? 86 : 120;
    const hoverRadiusSquared = hoverRadius * hoverRadius;

    dots.forEach((dot) => {
      const lightMix = getLightMixForY(dot.y);
      let influence = 0;

      if (mouse.active) {
        const dx = mouse.x - dot.x;
        const dy = mouse.y - dot.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < hoverRadiusSquared) {
          const distance = Math.sqrt(distanceSquared);
          const proximity = 1 - distance / hoverRadius;
          influence = proximity * proximity;
        }
      }

      const pulse = influence > 0 ? (Math.sin(time * 2.2 + dot.phase) + 1) * 0.5 : 0;
      const baseAlpha = lightMix > 0.5 ? 0.035 : 0.032;
      const radius = dot.radius * 0.7 + influence * (0.72 + pulse * 0.18);
      const alpha = baseAlpha + influence * (lightMix > 0.5 ? 0.16 : 0.19);

      if (influence > 0.12) {
        ctx.save();
        ctx.shadowBlur = (lightMix > 0.5 ? 3 : 4) * influence;
        ctx.shadowColor = getDotColor(lightMix, lightMix > 0.5 ? 0.12 : 0.16);
      }

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getDotColor(lightMix, alpha);
      ctx.fill();

      if (influence > 0.12) {
        ctx.restore();
      }
    });
  }

  function updateParticle(particle, time, delta) {
    particle.y -= particle.floatSpeed * delta;
    particle.x = particle.baseX + Math.sin(time * particle.drift + particle.phase) * particle.wave * particle.depth;
    particle.rotation += particle.spin * delta;

    if (particle.y < -90) {
      particle.y = height + randomBetween(30, 120);
      particle.baseX = randomBetween(-80, width + 80);
      particle.x = particle.baseX;
    }
  }

  function getMouseInfluence(particle) {
    if (!mouse.active) {
      return 0;
    }

    const dx = mouse.x - particle.x;
    const dy = mouse.y - particle.y;
    const distanceSquared = dx * dx + dy * dy;
    const radius = 140;

    if (distanceSquared > radius * radius) {
      return 0;
    }

    const distance = Math.sqrt(distanceSquared);
    const influence = 1 - distance / radius;
    particle.baseX -= (dx / Math.max(distance, 1)) * influence * 0.18 * particle.depth;
    particle.y -= (dy / Math.max(distance, 1)) * influence * 0.12 * particle.depth;

    return influence;
  }

  function drawFrame(timestamp = 0) {
    if (isPaused) {
      return;
    }

    const time = timestamp * 0.001;
    const delta = Math.min(0.033, (timestamp - lastTimestamp || 16.7) / 1000);
    lastTimestamp = timestamp;

    ctx.clearRect(0, 0, width, height);
    drawInteractiveDots(time);

    particles.forEach((particle) => {
      const targetMix = getLightMixForY(particle.y);
      particle.lightMix += (targetMix - particle.lightMix) * Math.min(1, delta * 4.5);

      const influence = getMouseInfluence(particle);
      drawParticle(particle, time, influence);
    });

    if (!reduceMotion) {
      animationFrame = window.requestAnimationFrame(drawFrame);
    }
  }

  function requestResize() {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(resizeCanvas);
  }

  window.addEventListener("resize", requestResize, { passive: true });
  window.addEventListener("scroll", requestSectionMeasure, { passive: true });
  window.addEventListener(
    "pointermove",
    (event) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      mouse.active = true;
    },
    { passive: true }
  );
  window.addEventListener("pointerleave", () => {
    mouse.active = false;
  });
  document.addEventListener("visibilitychange", () => {
    isPaused = document.hidden;

    if (!isPaused && !reduceMotion) {
      lastTimestamp = performance.now();
      animationFrame = window.requestAnimationFrame(drawFrame);
    }
  });

  buildSprites();
  resizeCanvas();
  drawFrame();

  window.addEventListener("pagehide", () => {
    window.cancelAnimationFrame(animationFrame);
    window.cancelAnimationFrame(resizeFrame);
    window.cancelAnimationFrame(sectionFrame);
  });
}

function updateHeaderState() {
  header?.classList.toggle("is-scrolled", window.scrollY > 12);
}

function closeMobileNav() {
  document.body.classList.remove("nav-open");
  nav?.classList.remove("is-open");
  navToggle?.setAttribute("aria-expanded", "false");
}

function closeStudentAccess() {
  studentAccess?.classList.remove("is-open");
  studentAccess?.classList.remove("is-login");
  studentMenuToggle?.setAttribute("aria-expanded", "false");

  if (studentLoginForm) {
    studentLoginForm.hidden = true;
  }
}

function setupNavigation() {
  navToggle?.addEventListener("click", () => {
    const isOpen = nav?.classList.toggle("is-open");

    document.body.classList.toggle("nav-open", Boolean(isOpen));
    navToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));

    if (isOpen) {
      closeStudentAccess();
    }
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileNav);
  });
}

function setupStudentAccess() {
  studentMenuToggle?.addEventListener("click", () => {
    const isOpen = studentAccess?.classList.toggle("is-open");

    studentMenuToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
    closeMobileNav();

    if (!isOpen && studentLoginForm) {
      studentAccess?.classList.remove("is-login");
      studentLoginForm.hidden = true;
    }
  });

  studentLoginOpen?.addEventListener("click", () => {
    studentAccess?.classList.add("is-login");

    if (studentLoginForm) {
      studentLoginForm.hidden = false;
      studentLoginForm.querySelector("input")?.focus();
    }
  });

  studentLoginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.href = "login.html";
  });

  document.addEventListener("click", (event) => {
    if (!studentAccess?.contains(event.target)) {
      closeStudentAccess();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeStudentAccess();
    }
  });
}

function setupRevealAnimation() {
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function closePackageCard(card) {
  const toggle = card.querySelector("[data-package-toggle]");
  const details = card.querySelector("[data-package-details]");
  const detailsLinks = details?.querySelectorAll("a, button");

  card.classList.remove("active");
  details?.classList.remove("expanded");
  toggle?.setAttribute("aria-expanded", "false");
  detailsLinks?.forEach((item) => item.setAttribute("tabindex", "-1"));

  if (details) {
    details.setAttribute("aria-hidden", "true");
    details.style.maxHeight = "0px";
  }
}

function syncPackageGridState() {
  const hasActiveCard = Array.from(packageCards).some((card) => card.classList.contains("active"));

  packageGrid?.classList.toggle("has-active", hasActiveCard);
}

function openPackageCard(card) {
  const toggle = card.querySelector("[data-package-toggle]");
  const details = card.querySelector("[data-package-details]");
  const detailsLinks = details?.querySelectorAll("a, button");

  packageCards.forEach((item) => {
    if (item !== card) {
      closePackageCard(item);
    }
  });

  card.classList.add("active");
  details?.classList.add("expanded");
  toggle?.setAttribute("aria-expanded", "true");
  detailsLinks?.forEach((item) => item.removeAttribute("tabindex"));

  if (details) {
    details.setAttribute("aria-hidden", "false");
    details.style.maxHeight = `${details.scrollHeight}px`;
  }

  syncPackageGridState();
}

function setupPackageCards() {
  let packageResizeFrame = 0;

  packageCards.forEach((card) => {
    const toggle = card.querySelector("[data-package-toggle]");

    toggle?.addEventListener("click", () => {
      if (card.classList.contains("active")) {
        closePackageCard(card);
        syncPackageGridState();
        return;
      }

      openPackageCard(card);
    });
  });

  window.addEventListener(
    "resize",
    () => {
      window.cancelAnimationFrame(packageResizeFrame);
      packageResizeFrame = window.requestAnimationFrame(() => {
        const activeDetails = document.querySelector(".service-card.active [data-package-details]");

        if (activeDetails) {
          activeDetails.style.maxHeight = `${activeDetails.scrollHeight}px`;
        }
      });
    },
    { passive: true }
  );
}

async function loadWordsOfTheDay() {
  // Future hook: replace this return with a fetch from an API or database.
  return wordsOfTheDay;
}

function getDayOfYear(date) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return Math.floor((localDate - startOfYear) / 86400000);
}

function getBaseWordIndex(date, words) {
  const dayOfYear = getDayOfYear(date);
  const yearOffset = date.getFullYear() % words.length;

  return ((dayOfYear - 1) * 7 + yearOffset) % words.length;
}

function getWordIndexForDate(date, words, depth = 0) {
  if (words.length <= 1) {
    return 0;
  }

  const baseIndex = getBaseWordIndex(date, words);

  if (depth >= words.length) {
    return baseIndex;
  }

  const previousDate = new Date(date);
  previousDate.setDate(date.getDate() - 1);

  const previousIndex = getWordIndexForDate(previousDate, words, depth + 1);

  if (baseIndex === previousIndex) {
    return (baseIndex + 1) % words.length;
  }

  return baseIndex;
}

function getWordForDate(date, words) {
  return words[getWordIndexForDate(date, words)];
}

function renderWordOfTheDay(word) {
  if (!wordCard || !wordText || !wordPronunciation || !wordTranslation || !wordExample) {
    return;
  }

  wordCard.classList.add("is-changing");

  window.setTimeout(() => {
    wordText.textContent = word.word;
    wordPronunciation.textContent = word.pronunciation;
    wordTranslation.textContent = word.translation;
    wordExample.textContent = `“${word.example}”`;
    wordAudioButton?.setAttribute("aria-label", `Ouvir pronuncia de ${word.word}`);
    wordCard.classList.remove("is-changing");
  }, 140);
}

function speakWord(word) {
  if (!word || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word.word);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

function scheduleNextWordRefresh(onRefresh) {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const delay = tomorrow - now + 1200;

  window.setTimeout(() => {
    onRefresh();
    scheduleNextWordRefresh(onRefresh);
  }, delay);
}

async function setupWordOfTheDay() {
  if (!wordCard) {
    return;
  }

  const words = await loadWordsOfTheDay();

  if (!Array.isArray(words) || words.length === 0) {
    return;
  }

  let currentWord = null;
  const refreshWord = () => {
    currentWord = getWordForDate(new Date(), words);
    renderWordOfTheDay(currentWord);
  };

  refreshWord();

  wordAudioButton?.addEventListener("click", () => {
    speakWord(currentWord);
  });

  scheduleNextWordRefresh(refreshWord);
}

function prepareFutureIntegrations() {
  window.englishStudio = {
    config: appConfig,
    submitLead: async (payload) => {
      // Future hook: POST payload to `${appConfig.apiBaseUrl}${appConfig.endpoints.leads}`.
      return { ok: true, payload };
    },
  };
}

function startFloralBackgroundAfterFirstPaint() {
  const start = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(setupFloralBackground, { timeout: 900 });
      return;
    }

    window.setTimeout(setupFloralBackground, 180);
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(start);
  });
}

window.addEventListener("scroll", updateHeaderState, { passive: true });
window.addEventListener("load", updateHeaderState);

setupNavigation();
setupStudentAccess();
setupRevealAnimation();
setupPackageCards();
setupWordOfTheDay();
prepareFutureIntegrations();
startFloralBackgroundAfterFirstPaint();
