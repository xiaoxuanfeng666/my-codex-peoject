const STORAGE_KEY = "lucky-draw-history-v1";
const TOTAL_KEY = "lucky-draw-total-v1";

const prizes = [
  { name: "一等奖", icon: "🏆", color: "#ffcc4d", weight: 1 },
  { name: "二等奖", icon: "🎧", color: "#ff7c7c", weight: 4 },
  { name: "三等奖", icon: "🍫", color: "#57d6c9", weight: 8 },
  { name: "现金红包", icon: "🧧", color: "#6f9cff", weight: 7 },
  { name: "神秘礼物", icon: "🎁", color: "#b794f6", weight: 6 },
  { name: "幸运奖", icon: "☕", color: "#ff9fd1", weight: 12 },
  { name: "再来一次", icon: "🔁", color: "#ffb454", weight: 18 },
  { name: "谢谢参与", icon: "🍀", color: "#61d98b", weight: 44 }
];

const SVG_NS = "http://www.w3.org/2000/svg";
const CX = 200;
const CY = 200;
const RADIUS = 188;
const LABEL_RADIUS = 120;
const sectorAngle = 360 / prizes.length;

const elements = {
  sectors: document.querySelector("#wheelSectors"),
  rotor: document.querySelector("#wheelRotor"),
  spinButton: document.querySelector("#spinButton"),
  buttonText: document.querySelector("#buttonText"),
  resultPanel: document.querySelector("#resultPanel"),
  resultIcon: document.querySelector("#resultIcon"),
  resultLabel: document.querySelector("#resultLabel"),
  resultText: document.querySelector("#resultText"),
  spinCount: document.querySelector("#spinCount"),
  prizeList: document.querySelector("#prizeList"),
  historyList: document.querySelector("#historyList"),
  clearHistory: document.querySelector("#clearHistory"),
  confetti: document.querySelector("#confettiCanvas"),
  accessPath: document.querySelector("#accessPath")
};

let rotation = 0;
let isSpinning = false;
let history = loadHistory();
let totalSpins = loadTotalSpins();
let confettiAnimation = null;

function polarToCartesian(radius, angle) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad)
  };
}

function createWheel() {
  const fragment = document.createDocumentFragment();

  prizes.forEach((prize, index) => {
    const startAngle = index * sectorAngle - sectorAngle / 2;
    const endAngle = startAngle + sectorAngle;
    const start = polarToCartesian(RADIUS, startAngle);
    const end = polarToCartesian(RADIUS, endAngle);
    const largeArcFlag = sectorAngle > 180 ? 1 : 0;

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "wheel-sector");
    path.setAttribute("fill", prize.color);
    path.setAttribute(
      "d",
      `M ${CX} ${CY} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`
    );
    fragment.appendChild(path);

    const labelPoint = polarToCartesian(LABEL_RADIUS, index * sectorAngle);
    const labelAngle = index * sectorAngle;
    const icon = document.createElementNS(SVG_NS, "text");
    icon.setAttribute("class", "wheel-label wheel-label-icon");
    icon.setAttribute("x", labelPoint.x);
    icon.setAttribute("y", labelPoint.y - 7);
    icon.setAttribute("text-anchor", "middle");
    icon.setAttribute("dominant-baseline", "middle");
    icon.setAttribute("transform", `rotate(${labelAngle} ${labelPoint.x} ${labelPoint.y})`);
    icon.textContent = prize.icon;
    fragment.appendChild(icon);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("class", "wheel-label");
    label.setAttribute("x", labelPoint.x);
    label.setAttribute("y", labelPoint.y + 15);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "middle");
    label.setAttribute("transform", `rotate(${labelAngle} ${labelPoint.x} ${labelPoint.y})`);
    label.textContent = prize.name;
    fragment.appendChild(label);
  });

  elements.sectors.replaceChildren(fragment);
}

function renderPrizeList() {
  const totalWeight = prizes.reduce((sum, prize) => sum + prize.weight, 0);
  elements.prizeList.replaceChildren(
    ...prizes.map((prize) => {
      const item = document.createElement("li");
      item.className = "prize-item";
      item.innerHTML = `
        <span class="prize-swatch" style="background:${prize.color}">${prize.icon}</span>
        <span class="prize-info">
          <strong>${prize.name}</strong>
          <span>命中概率 ${((prize.weight / totalWeight) * 100).toFixed(1)}%</span>
        </span>
        <span class="prize-weight">${prize.weight}x</span>
      `;
      return item;
    })
  );
}

function pickPrize() {
  const totalWeight = prizes.reduce((sum, prize) => sum + prize.weight, 0);
  let random = Math.random() * totalWeight;

  for (let index = 0; index < prizes.length; index += 1) {
    random -= prizes[index].weight;
    if (random < 0) {
      return { ...prizes[index], index };
    }
  }

  return { ...prizes[prizes.length - 1], index: prizes.length - 1 };
}

function getNextRotation(targetIndex) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const turns = reducedMotion ? 0 : 5 + Math.floor(Math.random() * 3);
  const targetCenter = targetIndex * sectorAngle;
  const currentNormalized = ((rotation % 360) + 360) % 360;
  const correction = (360 - targetCenter - currentNormalized + 360) % 360;
  const safeJitter = (Math.random() - 0.5) * sectorAngle * 0.46;

  return rotation + turns * 360 + correction + safeJitter;
}

function spin() {
  if (isSpinning) return;

  isSpinning = true;
  elements.spinButton.disabled = true;
  elements.buttonText.textContent = "好运正在旋转…";
  elements.resultPanel.classList.remove("is-winner");
  elements.resultIcon.textContent = "🌀";
  elements.resultLabel.textContent = "转盘加速中";
  elements.resultText.textContent = "请屏住呼吸";

  const winner = pickPrize();
  const nextRotation = getNextRotation(winner.index);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reducedMotion ? 450 : 4400;

  rotation = nextRotation;
  elements.rotor.style.transitionDuration = `${duration}ms`;
  elements.rotor.style.transform = `rotate(${rotation}deg)`;

  window.setTimeout(() => finishSpin(winner), duration + 120);
}

function finishSpin(winner) {
  isSpinning = false;
  elements.spinButton.disabled = false;
  elements.buttonText.textContent = winner.name === "再来一次" ? "再转一次" : "再抽一次";
  elements.resultIcon.textContent = winner.icon;
  elements.resultPanel.classList.add("is-winner");

  if (winner.name === "谢谢参与") {
    elements.resultLabel.textContent = "这次差一点点";
    elements.resultText.textContent = "别灰心，好运正在路上";
  } else if (winner.name === "再来一次") {
    elements.resultLabel.textContent = "好运加时";
    elements.resultText.textContent = "获得一次额外机会";
  } else {
    elements.resultLabel.textContent = "恭喜你抽中";
    elements.resultText.textContent = winner.name;
  }

  addHistory(winner);
  if (!["谢谢参与", "再来一次"].includes(winner.name)) {
    launchConfetti(winner.color);
  }
}

function loadHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function loadTotalSpins() {
  const value = Number(localStorage.getItem(TOTAL_KEY));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function saveTotalSpins() {
  localStorage.setItem(TOTAL_KEY, String(totalSpins));
}

function addHistory(winner) {
  history.unshift({
    name: winner.name,
    icon: winner.icon,
    color: winner.color,
    time: Date.now()
  });
  history = history.slice(0, 8);
  totalSpins += 1;
  saveHistory();
  saveTotalSpins();
  renderHistory();
}

function renderHistory() {
  elements.spinCount.textContent = totalSpins;

  if (!history.length) {
    elements.historyList.innerHTML = '<div class="history-empty">还没有抽奖记录<br />第一份好运等你开启</div>';
    return;
  }

  elements.historyList.replaceChildren(
    ...history.map((entry, index) => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `
        <span class="history-index" style="background:${entry.color}">${index + 1}</span>
        <strong>${entry.icon} ${entry.name}</strong>
        <time>${formatTime(entry.time)}</time>
      `;
      return item;
    })
  );
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp));
}

function launchConfetti(primaryColor) {
  if (confettiAnimation) {
    cancelAnimationFrame(confettiAnimation);
  }

  const canvas = elements.confetti;
  const context = canvas.getContext("2d");
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * ratio;
  canvas.height = window.innerHeight * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const colors = [primaryColor, "#ffcf55", "#ff7c7c", "#57d6c9", "#6f9cff", "#ffffff"];
  const particles = Array.from({ length: 110 }, () => ({
    x: window.innerWidth * (0.3 + Math.random() * 0.4),
    y: window.innerHeight * (0.35 + Math.random() * 0.2),
    vx: (Math.random() - 0.5) * 11,
    vy: -5 - Math.random() * 10,
    gravity: 0.22 + Math.random() * 0.1,
    size: 5 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - 0.5) * 0.32,
    life: 1
  }));

  let frame = 0;
  function draw() {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += particle.gravity;
      particle.vx *= 0.992;
      particle.rotation += particle.rotationSpeed;
      particle.life -= 0.009;

      context.save();
      context.globalAlpha = Math.max(particle.life, 0);
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.62);
      context.restore();
    });

    frame += 1;
    if (frame < 150 && particles.some((particle) => particle.life > 0)) {
      confettiAnimation = requestAnimationFrame(draw);
    } else {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      confettiAnimation = null;
    }
  }

  draw();
}

elements.spinButton.addEventListener("click", spin);
elements.clearHistory.addEventListener("click", () => {
  history = [];
  totalSpins = 0;
  saveHistory();
  saveTotalSpins();
  renderHistory();
});

window.addEventListener("resize", () => {
  if (confettiAnimation) {
    cancelAnimationFrame(confettiAnimation);
    confettiAnimation = null;
    elements.confetti.getContext("2d").clearRect(0, 0, elements.confetti.width, elements.confetti.height);
  }
});

elements.accessPath.textContent = window.location.href;

createWheel();
renderPrizeList();
renderHistory();




