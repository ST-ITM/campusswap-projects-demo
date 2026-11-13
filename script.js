const instruments = [
  { name: "Kick", description: "THE HEARTBEAT", symbol: "◉", color: "#f19a81", steps: [0, 4, 8, 12] },
  { name: "Snare", description: "THE BACKBEAT", symbol: "✳", color: "#c5a6ed", steps: [4, 12] },
  { name: "Clap", description: "A LITTLE SNAP", symbol: "✦", color: "#edc879", steps: [4, 12] },
  { name: "Closed hat", description: "KEEP IT MOVING", symbol: "✕", color: "#a9d8bd", steps: [0, 2, 4, 6, 8, 10, 12, 14] },
  { name: "Open hat", description: "LET IT BREATHE", symbol: "✺", color: "#9bbce5", steps: [6, 14] },
  { name: "Perc", description: "THE WILD CARD", symbol: "◆", color: "#e5a9bd", steps: [3, 10] },
];

const tracks = document.querySelector("#tracks");
const numbers = document.querySelector("#step-numbers");
const playButton = document.querySelector("#play");
const tempo = document.querySelector("#tempo");
const volume = document.querySelector("#volume");
let pattern = instruments.map(instrument => Array.from({ length: 16 }, (_, step) => instrument.steps.includes(step)));
let audioContext;
let masterGain;
let noiseBuffer;
let playing = false;
let nextStep = 0;
let nextStepTime = 0;
let scheduler;
let visualTimers = [];

for (let step = 0; step < 16; step++) {
  const number = document.createElement("span");
  number.textContent = String(step + 1).padStart(2, "0");
  numbers.append(number);
}

instruments.forEach((instrument, index) => {
  const row = document.createElement("div");
  row.className = "track";
  row.style.setProperty("--color", instrument.color);
  const sound = document.createElement("button");
  sound.className = "sound-button";
  sound.type = "button";
  sound.setAttribute("aria-label", `Play ${instrument.name} (key ${index + 1})`);
  sound.innerHTML = `<span class="sound-symbol" aria-hidden="true">${instrument.symbol}</span><span class="sound-copy"><span class="sound-name">${instrument.name}</span><span class="sound-description">${instrument.description}</span></span><span class="sound-key">${index + 1}</span>`;
  sound.addEventListener("click", () => preview(index));
  const steps = document.createElement("div");
  steps.className = "steps";
  for (let step = 0; step < 16; step++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "step";
    button.setAttribute("aria-label", `${instrument.name}, step ${step + 1}`);
    button.addEventListener("click", () => {
      pattern[index][step] = !pattern[index][step];
      updateStep(button, pattern[index][step]);
    });
    updateStep(button, pattern[index][step]);
    steps.append(button);
  }
  row.append(sound, steps);
  tracks.append(row);
});

function updateStep(button, active) {
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
}

function renderPattern() {
  [...tracks.children].forEach((row, index) => {
    row.querySelectorAll(".step").forEach((button, step) => updateStep(button, pattern[index][step]));
  });
}

function setupAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = Number(volume.value) / 100 * 0.6;
    masterGain.connect(audioContext.destination);
    noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (audioContext.state === "suspended") audioContext.resume();
}

function tone(time, frequency, endFrequency, duration, level, type = "sine") {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, time);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
  gain.gain.setValueAtTime(level, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  oscillator.connect(gain).connect(masterGain);
  oscillator.start(time);
  oscillator.stop(time + duration);
}

function noise(time, duration, level, frequency, filterType = "highpass") {
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = noiseBuffer;
  filter.type = filterType;
  filter.frequency.value = frequency;
  gain.gain.setValueAtTime(level, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  source.connect(filter).connect(gain).connect(masterGain);
  source.start(time);
  source.stop(time + duration);
}

function playSound(index, time) {
  switch (index) {
    case 0: tone(time, 150, 42, 0.42, 1); break;
    case 1: tone(time, 190, 90, 0.12, 0.38, "triangle"); noise(time, 0.2, 0.65, 1400); break;
    case 2:
      [0, 0.018, 0.036].forEach(offset => noise(time + offset, 0.1, 0.3, 1100));
      break;
    case 3: noise(time, 0.055, 0.3, 7000); break;
    case 4: noise(time, 0.3, 0.25, 6000); break;
    case 5: tone(time, 720, 280, 0.16, 0.35, "triangle"); break;
  }
}

function preview(index) {
  setupAudio();
  playSound(index, audioContext.currentTime);
}

function highlightStep(step) {
  tracks.querySelectorAll(".step.current").forEach(button => button.classList.remove("current"));
  if (step !== null) {
    tracks.querySelectorAll(".steps").forEach(row => row.children[step].classList.add("current"));
  }
}

function schedule() {
  while (nextStepTime < audioContext.currentTime + 0.1) {
    const step = nextStep;
    const time = nextStepTime;
    pattern.forEach((row, index) => { if (row[step]) playSound(index, time); });
    const timer = setTimeout(() => {
      visualTimers = visualTimers.filter(id => id !== timer);
      if (playing) highlightStep(step);
    }, Math.max(0, (time - audioContext.currentTime) * 1000));
    visualTimers.push(timer);
    nextStep = (nextStep + 1) % 16;
    nextStepTime += 60 / Number(tempo.value) / 4;
  }
}

playButton.addEventListener("click", () => {
  if (playing) {
    playing = false;
    clearInterval(scheduler);
    visualTimers.forEach(clearTimeout);
    visualTimers = [];
    highlightStep(null);
    playButton.querySelector(".play-icon").textContent = "▶";
    playButton.querySelector(".play-label").textContent = "PLAY";
    playButton.setAttribute("aria-label", "Play sequence");
  } else {
    setupAudio();
    playing = true;
    nextStep = 0;
    nextStepTime = audioContext.currentTime + 0.05;
    schedule();
    scheduler = setInterval(schedule, 25);
    playButton.querySelector(".play-icon").textContent = "■";
    playButton.querySelector(".play-label").textContent = "STOP";
    playButton.setAttribute("aria-label", "Stop sequence");
  }
});

tempo.addEventListener("input", () => { document.querySelector("#tempo-value").textContent = tempo.value; });
volume.addEventListener("input", () => {
  document.querySelector("#volume-value").textContent = `${volume.value}%`;
  if (masterGain) masterGain.gain.setTargetAtTime(Number(volume.value) / 100 * 0.6, audioContext.currentTime, 0.01);
});
document.querySelector("#clear").addEventListener("click", () => {
  pattern = instruments.map(() => Array(16).fill(false));
  renderPattern();
});
document.querySelector("#randomize").addEventListener("click", () => {
  pattern = instruments.map((_, index) => Array.from({ length: 16 }, (_, step) => {
    const probability = index === 0 ? (step % 4 === 0 ? 0.8 : 0.08) : index === 3 ? 0.5 : 0.2;
    return Math.random() < probability;
  }));
  renderPattern();
});
document.addEventListener("keydown", event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|BUTTON)$/.test(event.target.tagName)) return;
  const index = Number(event.key) - 1;
  if (index >= 0 && index < instruments.length && event.key !== " ") preview(index);
});
