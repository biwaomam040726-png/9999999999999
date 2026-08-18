import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import {
  Accessibility, ArrowLeft, ArrowRight, BarChart3, Camera, Check, ChevronLeft,
  Download, FileSpreadsheet, Gamepad2, GraduationCap, Hand, Keyboard, LogOut,
  Pause, Play, Plus, RotateCcw, Save, Settings, ShieldCheck, Sparkles, Swords, Trash2, Trophy, Upload, Users,
  Volume2, VolumeX, X, Zap, ListChecks,
} from "lucide-react";
import * as THREE from "three";
import { gsap } from "gsap";

type Screen = "lobby" | "game" | "summary" | "teacher";
type GameMode = "solo" | "versus";
type ControlMode = "none" | "hand" | "mouse";
type PlayerId = 0 | 1;
type AnswerKind = "essential" | "noise";
type QuestionMode = "classify" | "mcq";
type CardItem = {
  id?: string;
  mode?: QuestionMode;
  label: string;
  detail: string;
  essential?: boolean;
  icon: string;
  prompt?: string;
  leftLabel?: string;
  rightLabel?: string;
  choices?: string[];
  correctChoice?: number;
};
type Level = { id: number; eyebrow: string; title: string; mission: string; subject: string; subjectIcon: string; enemy: string; items: CardItem[] };
type AnswerRecord = CardItem & { level: number; correct: boolean; chosen: string; timeout?: boolean };
type StudentReport = { id: number; name: string; score: number; accuracy: number; correct: number; total: number; seconds: number; level: number; date: string; mode?: GameMode };
type Landmark = { x: number; y: number; z: number };
type HandednessCategory = { categoryName?: string; score?: number };
type HandResult = { landmarks?: Landmark[][]; handedness?: HandednessCategory[][] };
type XRSystemLike = {
  isSessionSupported: (mode: string) => Promise<boolean>;
  requestSession: (mode: string, options?: Record<string, unknown>) => Promise<{ addEventListener: (name: string, callback: () => void) => void }>;
};

type PlayerGame = {
  score: number;
  combo: number;
  lives: number;
  power: number;
  answered: boolean;
  feedback: null | { correct: boolean; title: string; points: number; chosen: string; motion: "left" | "right" | "option" };
  choiceIndex: number;
  records: AnswerRecord[];
};

type TrackSample = { x: number; y: number; at: number };
type HandTrack = {
  id: number;
  owner: PlayerId | null;
  primary: boolean;
  candidateOwner: PlayerId | null;
  candidateSince: number;
  lastSeen: number;
  handedness: string;
  x: number;
  y: number;
  palmWidth: number;
  rawX: number;
  rawY: number;
  vx: number;
  vy: number;
  stableFrames: number;
  trail: TrackSample[];
  lastActionAt: number;
  armed: boolean;
  neutralSince: number;
  pinchState: boolean;
  pinchOnFrames: number;
  pinchOffFrames: number;
  selectedLatch: boolean;
  fistSince: number;
  openSince: number;
  raisedSince: number;
  dwellSince?: number;
  dwellTarget?: string;
  targetLandmarks: Landmark[] | null;
  renderLandmarks: Landmark[] | null;
};

type GestureAction = {
  screen: Screen;
  mode: GameMode;
  paused: boolean;
  questionMode: QuestionMode;
  soloFeedback: unknown;
  beginGame: () => void;
  swipe: (player: PlayerId, kind: AnswerKind) => void;
  confirm: (player: PlayerId) => void;
  usePower: (player: PlayerId) => void;
  togglePause: () => void;
};

const LEVELS: Level[] = [
  {
    id: 1, eyebrow: "ด่าน 01 · Important or Not?", title: "จับแก่นของสิ่งของ",
    mission: "เลือกเฉพาะลักษณะที่จำเป็นต่อการอธิบาย ‘สุนัข’", subject: "สุนัข", subjectIcon: "🐕", enemy: "Noise Monster",
    items: [
      { label: "มี 4 ขา", detail: "โครงสร้างพื้นฐานที่ช่วยจำแนกสัตว์ชนิดนี้", essential: true, icon: "🐾" },
      { label: "ส่งเสียงเห่า", detail: "พฤติกรรมเด่นที่สื่อถึงสุนัข", essential: true, icon: "🔊" },
      { label: "ชื่อโมจิ", detail: "ชื่อเฉพาะเปลี่ยนได้ จึงไม่ใช่แก่นร่วม", essential: false, icon: "🏷️" },
      { label: "เกิดวันอังคาร", detail: "วันเกิดไม่ช่วยให้เราเข้าใจว่าสุนัขคืออะไร", essential: false, icon: "📅" },
      { label: "เป็นสัตว์เลี้ยงลูกด้วยนม", detail: "เป็นคุณสมบัติสำคัญทางชีววิทยา", essential: true, icon: "🧬" },
      { label: "ปลอกคอสีน้ำเงิน", detail: "เครื่องประดับและสีเปลี่ยนได้โดยตัวตนยังเหมือนเดิม", essential: false, icon: "🔵" },
    ],
  },
  {
    id: 2, eyebrow: "ด่าน 02 · Identify Abstraction", title: "สร้างแบบจำลองรถยนต์",
    mission: "เก็บคุณสมบัติที่รถทั่วไปจำเป็นต้องมี", subject: "รถยนต์", subjectIcon: "🚗", enemy: "Decoration Ghost",
    items: [
      { label: "มีล้อ", detail: "ล้อเป็นส่วนหลักที่ทำให้รถเคลื่อนที่บนพื้น", essential: true, icon: "⚙️" },
      { label: "เคลื่อนที่ได้", detail: "หน้าที่หลักของรถคือการพาไปจากจุดหนึ่งสู่อีกจุด", essential: true, icon: "↗️" },
      { label: "มีแหล่งพลังงาน", detail: "รถต้องมีพลังงาน เช่น น้ำมันหรือไฟฟ้า", essential: true, icon: "🔋" },
      { label: "สีแดง", detail: "รถสีใดก็ยังเป็นรถ สีจึงเป็นรายละเอียดรอง", essential: false, icon: "🎨" },
      { label: "ติดสติกเกอร์", detail: "สติกเกอร์เป็นเพียงการตกแต่ง", essential: false, icon: "✨" },
      { label: "เปิดเพลงได้", detail: "ระบบเพลงไม่มีผลต่อหน้าที่หลักของรถ", essential: false, icon: "🎵" },
    ],
  },
  {
    id: 3, eyebrow: "ด่าน 03 · Real World", title: "ห้องเรียนไร้สิ่งรบกวน",
    mission: "เลือกข้อมูลจำเป็นสำหรับ ‘การนำเสนอหน้าชั้นเรียน’", subject: "การนำเสนอ", subjectIcon: "🏫", enemy: "Fake Data",
    items: [
      { label: "หัวข้อชัดเจน", detail: "ผู้ฟังต้องรู้ว่าเรากำลังอธิบายเรื่องอะไร", essential: true, icon: "🎯" },
      { label: "ข้อมูลถูกต้อง", detail: "ความถูกต้องทำให้ข้อสรุปน่าเชื่อถือ", essential: true, icon: "📚" },
      { label: "ลำดับเนื้อหา", detail: "โครงสร้างช่วยให้ผู้ฟังติดตามความคิดได้", essential: true, icon: "🧩" },
      { label: "กรอบสไลด์วิบวับ", detail: "กรอบสวยไม่ทำให้สาระสำคัญขึ้น", essential: false, icon: "💫" },
      { label: "เอฟเฟกต์หมุน 12 แบบ", detail: "เอฟเฟกต์มากเกินไปทำให้เสียสมาธิ", essential: false, icon: "🌀" },
      { label: "ฟอนต์ 8 ชนิด", detail: "ความหลากหลายเกินจำเป็นลดความอ่านง่าย", essential: false, icon: "🔤" },
    ],
  },
  {
    id: 4, eyebrow: "ด่าน 04 · Programming", title: "แก่นของอัลกอริทึม",
    mission: "สร้างแบบจำลองโปรแกรมคำนวณคะแนนเฉลี่ย", subject: "อัลกอริทึม", subjectIcon: "⌘", enemy: "Distraction Virus",
    items: [
      { label: "Input: คะแนน", detail: "โปรแกรมต้องรับข้อมูลคะแนนก่อนคำนวณ", essential: true, icon: "📥" },
      { label: "Process: หาค่าเฉลี่ย", detail: "ขั้นตอนประมวลผลคือแก่นของวิธีแก้ปัญหา", essential: true, icon: "⚡" },
      { label: "Output: ค่าเฉลี่ย", detail: "ผลลัพธ์บอกคำตอบที่โปรแกรมสร้าง", essential: true, icon: "📤" },
      { label: "พื้นหลังเคลื่อนไหว", detail: "แอนิเมชันไม่กระทบคำตอบของอัลกอริทึม", essential: false, icon: "🎞️" },
      { label: "ปุ่มมีเงาสีรุ้ง", detail: "การตกแต่งปุ่มไม่ใช่ตรรกะที่ใช้คำนวณ", essential: false, icon: "🌈" },
      { label: "เสียงเมื่อคลิก", detail: "เสียงตอบสนองไม่จำเป็นต่อการหาค่าเฉลี่ย", essential: false, icon: "🔔" },
    ],
  },
  {
    id: 5, eyebrow: "ด่าน 05 · Mission Challenge", title: "ปะทะ Chaos AI",
    mission: "แยกแก่นสำคัญจากข้อมูลปะปนให้ทันเวลา", subject: "ภารกิจช่วยเหลือ", subjectIcon: "🤖", enemy: "CHAOS AI · BOSS",
    items: [
      { label: "ตำแหน่งผู้ประสบเหตุ", detail: "ทีมช่วยเหลือต้องรู้จุดหมายที่แน่นอน", essential: true, icon: "📍" },
      { label: "ระดับความเร่งด่วน", detail: "ใช้จัดลำดับการช่วยเหลืออย่างเหมาะสม", essential: true, icon: "🚨" },
      { label: "อาการสำคัญ", detail: "ช่วยเลือกวิธีและอุปกรณ์ที่ต้องใช้", essential: true, icon: "❤️" },
      { label: "สีรองเท้าผู้แจ้ง", detail: "ไม่ช่วยในการวางแผนช่วยเหลือ", essential: false, icon: "👟" },
      { label: "เพลงที่เปิดอยู่", detail: "เสียงเพลงไม่เกี่ยวกับเป้าหมายของภารกิจ", essential: false, icon: "🎧" },
      { label: "จำนวนไลก์ของโพสต์", detail: "ยอดไลก์ไม่บอกความรุนแรงของเหตุการณ์", essential: false, icon: "👍" },
      { label: "ช่องทางติดต่อกลับ", detail: "จำเป็นหากทีมต้องขอข้อมูลเพิ่ม", essential: true, icon: "📞" },
      { label: "สติกเกอร์ในแชต", detail: "เป็นสิ่งตกแต่งที่ไม่เปลี่ยนสาระ", essential: false, icon: "😺" },
    ],
  },
];

const EMPTY_PLAYER = (): PlayerGame => ({ score: 0, combo: 0, lives: 3, power: 2, answered: false, feedback: null, choiceIndex: 0, records: [] });
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a: Landmark, b: Landmark, c: Landmark) => {
  const abx = a.x - b.x; const aby = a.y - b.y; const cbx = c.x - b.x; const cby = c.y - b.y;
  const denom = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (!denom) return 0;
  return Math.acos(clamp((abx * cbx + aby * cby) / denom, -1, 1)) * 180 / Math.PI;
};
const palmCenter = (hand: Landmark[]) => {
  const ids = [0, 5, 9, 13, 17];
  const x = ids.reduce((sum, i) => sum + hand[i].x, 0) / ids.length;
  const y = ids.reduce((sum, i) => sum + hand[i].y, 0) / ids.length;
  return { x: 1 - x, y };
};

const normalizeLevels = (source: Level[]): Level[] => source.map((level, levelIndex) => ({
  ...level,
  id: Number(level.id || levelIndex + 1),
  items: (level.items ?? []).map((item, questionIndex) => ({
    ...item,
    id: item.id || `q-${levelIndex + 1}-${questionIndex + 1}-${Date.now().toString(36)}`,
    mode: item.mode || "classify",
    prompt: item.prompt || `ข้อมูลนี้จำเป็นต่อการอธิบาย “${level.subject}” หรือไม่?`,
    leftLabel: item.leftLabel || "ไม่สำคัญ",
    rightLabel: item.rightLabel || "เก็บไว้",
    choices: item.mode === "mcq" ? (item.choices?.length ? item.choices : ["คำตอบ 1", "คำตอบ 2"]) : item.choices,
    correctChoice: item.mode === "mcq" ? clamp(Number(item.correctChoice ?? 0), 0, Math.max(0, (item.choices?.length ?? 2) - 1)) : item.correctChoice,
  })),
}));
const questionPrompt = (item: CardItem, level: Level) => item.prompt?.trim() || `ข้อมูลนี้จำเป็นต่อการอธิบาย “${level.subject}” หรือไม่?`;
const questionMode = (item: CardItem): QuestionMode => item.mode || "classify";

type QuestionDraft = {
  editingId: string | null; levelIndex: number; mode: QuestionMode; label: string; prompt: string; detail: string; icon: string; essential: boolean; leftLabel: string; rightLabel: string; choices: string[]; correctChoice: number;
};
const blankQuestionDraft = (): QuestionDraft => ({ editingId: null, levelIndex: 0, mode: "classify", label: "", prompt: "", detail: "", icon: "✨", essential: true, leftLabel: "ไม่สำคัญ", rightLabel: "เก็บไว้", choices: ["คำตอบ 1", "คำตอบ 2"], correctChoice: 0 });
const fingerCount = (hand: Landmark[]) => {
  const fingers = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]];
  return fingers.filter(([mcp, pip, tip]) => angle(hand[mcp], hand[pip], hand[tip]) > 145 && distance(hand[tip], hand[0]) > distance(hand[pip], hand[0]) * 1.08).length;
};

function useSound(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback((kind: "success" | "error" | "power" | "victory") => {
    if (!enabled || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = ctxRef.current ?? new AudioCtx(); ctxRef.current = ctx;
    const notes = kind === "success" ? [523, 659] : kind === "error" ? [180, 130] : kind === "power" ? [330, 523, 784] : [392, 523, 659, 1046];
    notes.forEach((note, index) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = kind === "error" ? "sawtooth" : "sine"; osc.frequency.value = note;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + index * .08);
      gain.gain.exponentialRampToValueAtTime(.11, ctx.currentTime + index * .08 + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + index * .08 + .16);
      osc.connect(gain).connect(ctx.destination); osc.start(ctx.currentTime + index * .08); osc.stop(ctx.currentTime + index * .08 + .18);
    });
  }, [enabled]);
}

function HologramScene({ burst, onRendererReady }: { burst: number; onRendererReady: (renderer: THREE.WebGLRenderer | null) => void }) {
  const mountRef = useRef<HTMLDivElement>(null); const coreRef = useRef<THREE.Mesh | null>(null);
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / Math.max(1, mount.clientHeight), .1, 100); camera.position.z = 7;
    const probe = document.createElement("canvas"); const context = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!context) { mount.classList.add("webgl-fallback"); return; }
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: probe, context, alpha: true, antialias: true }); }
    catch { mount.classList.add("webgl-fallback"); return; }
    renderer.xr.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6)); renderer.setSize(mount.clientWidth, mount.clientHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; mount.appendChild(renderer.domElement); onRendererReady(renderer);
    const group = new THREE.Group(); scene.add(group);
    [1.75, 2.35, 2.95].forEach((radius, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .014 + index * .005, 12, 100), new THREE.MeshBasicMaterial({ color: 0x77e9ff, transparent: true, opacity: .23 }));
      ring.rotation.x = 1.1 + index * .32; ring.rotation.y = index * .6; group.add(ring);
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 1), new THREE.MeshBasicMaterial({ color: 0xb99cff, wireframe: true, transparent: true, opacity: .64 })); coreRef.current = core; group.add(core);
    const count = 480; const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) { positions[i * 3] = (Math.random() - .5) * 11; positions[i * 3 + 1] = (Math.random() - .5) * 8; positions[i * 3 + 2] = (Math.random() - .5) * 5; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x8eeeff, size: .028, transparent: true, opacity: .6 }); const points = new THREE.Points(geometry, material); scene.add(points);
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => { const elapsed = clock.getElapsedTime(); group.rotation.z = elapsed * .09; group.rotation.y = Math.sin(elapsed * .28) * .16; points.rotation.y = elapsed * .018; core.rotation.x = elapsed * .3; core.rotation.y = elapsed * .45; renderer.render(scene, camera); });
    const resize = () => { camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight); camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight); };
    window.addEventListener("resize", resize);
    return () => { renderer.setAnimationLoop(null); onRendererReady(null); window.removeEventListener("resize", resize); geometry.dispose(); material.dispose(); renderer.dispose(); if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement); };
  }, [onRendererReady]);
  useEffect(() => { if (coreRef.current && burst) gsap.fromTo(coreRef.current.scale, { x: .65, y: .65, z: .65 }, { x: 1.8, y: 1.8, z: 1.8, duration: .25, yoyo: true, repeat: 1, ease: "power2.out" }); }, [burst]);
  return <div ref={mountRef} className="hologram-scene" aria-hidden="true" />;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("lobby"); const [mode, setMode] = useState<GameMode>("solo"); const [controlMode, setControlMode] = useState<ControlMode>("none");
  const [levels, setLevels] = useState<Level[]>(() => {
    try { const saved = localStorage.getItem("abstract-hero-question-bank-v5"); if (saved) { const parsed = JSON.parse(saved) as Level[]; if (Array.isArray(parsed) && parsed.length) return normalizeLevels(parsed); } } catch { /* use defaults */ }
    return normalizeLevels(LEVELS);
  });
  const levelsRef = useRef(levels); useEffect(() => { levelsRef.current = levels; try { localStorage.setItem("abstract-hero-question-bank-v5", JSON.stringify(levels)); } catch { /* optional */ } }, [levels]);
  const [teacherTab, setTeacherTab] = useState<"results" | "questions">("results");
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(() => blankQuestionDraft());
  const importQuestionsRef = useRef<HTMLInputElement>(null);
  const [studentName, setStudentName] = useState(""); const [player2Name, setPlayer2Name] = useState("");
  const [levelIndex, setLevelIndex] = useState(0); const [deck, setDeck] = useState<CardItem[]>(() => shuffle(levels[0]?.items ?? [])); const [cardIndex, setCardIndex] = useState(0); const [timeLeft, setTimeLeft] = useState(14);
  const [players, setPlayers] = useState<[PlayerGame, PlayerGame]>([EMPTY_PLAYER(), EMPTY_PLAYER()]); const playersRef = useRef(players); useEffect(() => { playersRef.current = players; }, [players]);
  const [paused, setPaused] = useState(false); const [soloFeedback, setSoloFeedback] = useState<{ correct: boolean; title: string; body: string } | null>(null); const [burst, setBurst] = useState(0);
  const [cameraOn, setCameraOn] = useState(false); const [cameraMessage, setCameraMessage] = useState("กำลังเตรียมกล้อง…"); const [cameraFps, setCameraFps] = useState(0); const [soundOn, setSoundOn] = useState(true); const [voiceOn, setVoiceOn] = useState(true);
  const [largeText, setLargeText] = useState(false); const [colorBlind, setColorBlind] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false); const [touchOnlyMode, setTouchOnlyMode] = useState(false); const [handGuideOpen, setHandGuideOpen] = useState(true); const [answerFloatSpeed, setAnswerFloatSpeed] = useState<"slow" | "normal" | "fast">("slow"); const [ultraSpaceMode, setUltraSpaceMode] = useState(true);
  const [gestureLabel, setGestureLabel] = useState("กำลังเตรียม Hand AI"); const [handReady, setHandReady] = useState(false); const [handSelected, setHandSelected] = useState(false);
  const [handModelReady, setHandModelReady] = useState(false); const [handSetupStep, setHandSetupStep] = useState<0 | 1 | 2>(0); const [handScanProgress, setHandScanProgress] = useState(0);
  const handReadyRef = useRef(handReady); useEffect(() => { handReadyRef.current = handReady; }, [handReady]);
  const handSetupStepRef = useRef(handSetupStep); useEffect(() => { handSetupStepRef.current = handSetupStep; }, [handSetupStep]);
  const [playerReady, setPlayerReady] = useState<[boolean, boolean]>([false, false]); const playerReadyRef = useRef(playerReady); useEffect(() => { playerReadyRef.current = playerReady; }, [playerReady]);
  const [playerGesture, setPlayerGesture] = useState<[string, string]>(["รอมือผู้เล่น 1", "รอมือผู้เล่น 2"]);
  const [xrSupported, setXrSupported] = useState(false); const [xrActive, setXrActive] = useState(false); const [reports, setReports] = useState<StudentReport[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null); const feedbackRef = useRef<HTMLDivElement>(null); const floatingAnswerRef = useRef<HTMLDivElement>(null); const startButtonRef = useRef<HTMLButtonElement>(null); const feedbackNextRef = useRef<HTMLButtonElement>(null); const handScanStartedAtRef = useRef(0); const cursorRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)] as const;
  const skeletonRefs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)] as const;
  const xrRendererRef = useRef<THREE.WebGLRenderer | null>(null); const startTimeRef = useRef(0); const actionRef = useRef<GestureAction | null>(null); const playSound = useSound(soundOn); const roundAdvanceRef = useRef<number | null>(null); const floatingAnswerMotionRef = useRef({ x: 24, y: 120, tx: 24, ty: 120, rot: -2, trot: -2, scale: 1.02, tscale: 1.02, phaseX: 0, phaseY: 1.4, phaseDepth: 0.8, phaseRoll: 0.2, bobAmpX: 16, bobAmpY: 10, bobSpeedX: 0.7, bobSpeedY: 0.52, depthAmp: 16, depthSpeed: 0.6, rollAmp: 5.5, rollSpeed: 0.44, glowPhase: 0.6 });
  const playableLevels = useMemo(() => { const ready = levels.filter(item => item.items.length > 0); return ready.length ? ready : normalizeLevels(LEVELS); }, [levels]);
  const level = playableLevels[levelIndex] ?? playableLevels[0]; const card = deck[cardIndex];
  const totalQuestions = Math.max(1, playableLevels.reduce((sum, item) => sum + item.items.length, 0)); const completedQuestions = playableLevels.slice(0, levelIndex).reduce((sum, item) => sum + item.items.length, 0) + cardIndex; const progress = completedQuestions / totalQuestions * 100;
  const soloAccuracy = players[0].records.length ? Math.round(players[0].records.filter((record) => record.correct).length / players[0].records.length * 100) : 100;
  const onRendererReady = useCallback((renderer: THREE.WebGLRenderer | null) => { xrRendererRef.current = renderer; }, []);

  const speak = useCallback((text: string) => { if (!voiceOn || typeof window === "undefined" || !("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "th-TH"; utterance.rate = .95; window.speechSynthesis.speak(utterance); }, [voiceOn]);
  const stopCamera = useCallback(() => { const stream = videoRef.current?.srcObject as MediaStream | null; stream?.getTracks().forEach((track) => track.stop()); if (videoRef.current) videoRef.current.srcObject = null; setCameraOn(false); }, []);
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraMessage("อุปกรณ์นี้ไม่รองรับกล้อง — เล่นด้วยสัมผัสได้"); return false; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, max: 60 } }, audio: false });
      const cameraTrack = stream.getVideoTracks()[0]; if (cameraTrack && "contentHint" in cameraTrack) cameraTrack.contentHint = "motion";
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const actualFps = Number(cameraTrack?.getSettings?.().frameRate || 0); setCameraFps(actualFps ? Math.round(actualFps) : 60);
      setCameraOn(true); setHandReady(false); setHandSetupStep(0); setHandScanProgress(0); setCameraMessage(actualFps ? `Camera AR ${Math.round(actualFps)} FPS · กดถัดไปเพื่อตั้งค่ามือ` : "Camera AR พร้อม · กดถัดไปเพื่อตั้งค่ามือ"); return true;
    } catch { setCameraOn(false); setCameraMessage("กล้องถูกปิด — ยังเล่นด้วยปุ่มหรือคีย์บอร์ดได้"); return false; }
  }, []);
  const beginHandScan = useCallback(() => {
    if (!cameraOn || !handModelReady) return;
    handScanStartedAtRef.current = performance.now(); setHandReady(false); setHandSetupStep(1); setHandScanProgress(0); setGestureLabel("ยกฝ่ามือให้เห็นเต็มมือ · กำลังรอสแกน");
  }, [cameraOn, handModelReady]);

  useEffect(() => {
    if (controlMode !== "hand") { stopCamera(); return; }
    const task = window.setTimeout(() => void startCamera(), 0);
    return () => { window.clearTimeout(task); stopCamera(); };
  }, [controlMode, startCamera, stopCamera]);
  useEffect(() => {
    const task = window.setTimeout(() => { try { const saved = localStorage.getItem("abstract-hero-reports"); if (saved) setReports(JSON.parse(saved) as StudentReport[]); } catch { /* optional */ } }, 0);
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr; if (xr) void xr.isSessionSupported("immersive-ar").then(setXrSupported).catch(() => setXrSupported(false));
    return () => window.clearTimeout(task);
  }, []);
  useEffect(() => {
    if (screen !== "game" || mode !== "solo" || !card || questionMode(card) === "mcq") return;
    const element = floatingAnswerRef.current;
    if (!element) return;
    const motion = floatingAnswerMotionRef.current;
    const speedMap = { slow: .55, normal: .82, fast: 1.12 } as const;
    const speed = speedMap[answerFloatSpeed];
    const intersects = (box: { left: number; top: number; right: number; bottom: number }, avoid: { left: number; top: number; right: number; bottom: number }) => !(box.right < avoid.left || box.left > avoid.right || box.bottom < avoid.top || box.top > avoid.bottom);
    const getAvoidRects = () => {
      const rects: { left: number; top: number; right: number; bottom: number }[] = [];
      const questionRect = document.querySelector(".floating-question-card")?.getBoundingClientRect();
      const topRect = document.querySelector(".topbar")?.getBoundingClientRect();
      const actionRect = document.querySelector(".decision-buttons, .mcq-grid")?.getBoundingClientRect();
      const timerRect = document.querySelector(".timer-ring")?.getBoundingClientRect();
      const guideRect = document.querySelector(".hand-guide-panel.open")?.getBoundingClientRect();
      if (questionRect) rects.push({ left: questionRect.left - 120, top: questionRect.top - 96, right: questionRect.right + 120, bottom: questionRect.bottom + 96 });
      if (topRect) rects.push({ left: topRect.left - 16, top: topRect.top - 16, right: topRect.right + 16, bottom: topRect.bottom + 24 });
      if (actionRect) rects.push({ left: actionRect.left - 48, top: actionRect.top - 34, right: actionRect.right + 48, bottom: actionRect.bottom + 36 });
      if (timerRect) rects.push({ left: timerRect.left - 28, top: timerRect.top - 28, right: timerRect.right + 28, bottom: timerRect.bottom + 28 });
      if (guideRect) rects.push({ left: guideRect.left - 24, top: guideRect.top - 24, right: guideRect.right + 24, bottom: guideRect.bottom + 24 });
      return rects;
    };
    const pickTarget = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const currentRect = element.getBoundingClientRect();
      const boxWidth = Math.max(220, currentRect.width || Math.min(320, viewportWidth * .24));
      const boxHeight = Math.max(96, currentRect.height || Math.min(120, viewportHeight * .14));
      const safeMarginX = 32;
      const safeMarginTop = 88;
      const safeMarginBottom = 130;
      const avoidRects = getAvoidRects();
      let nextX = 24; let nextY = 100; let tries = 0; let valid = false;
      while (tries < 56 && !valid) {
        nextX = safeMarginX + Math.random() * Math.max(40, viewportWidth - boxWidth - safeMarginX * 2);
        nextY = safeMarginTop + Math.random() * Math.max(40, viewportHeight - boxHeight - safeMarginTop - safeMarginBottom);
        const candidate = { left: nextX, top: nextY, right: nextX + boxWidth, bottom: nextY + boxHeight };
        valid = avoidRects.every((rect) => !intersects(candidate, rect));
        tries += 1;
      }
      motion.tx = nextX;
      motion.ty = nextY;
      motion.trot = -5 + Math.random() * 10;
      motion.tscale = .99 + Math.random() * .05;
      motion.phaseX = Math.random() * Math.PI * 2;
      motion.phaseY = Math.random() * Math.PI * 2;
      motion.phaseDepth = Math.random() * Math.PI * 2;
      motion.phaseRoll = Math.random() * Math.PI * 2;
      motion.glowPhase = Math.random() * Math.PI * 2;
      motion.bobAmpX = (ultraSpaceMode ? 18 : 10) + Math.random() * (ultraSpaceMode ? 22 : 12);
      motion.bobAmpY = (ultraSpaceMode ? 10 : 6) + Math.random() * (ultraSpaceMode ? 16 : 10);
      motion.bobSpeedX = ((ultraSpaceMode ? .22 : .18) + Math.random() * .16) * speed;
      motion.bobSpeedY = ((ultraSpaceMode ? .18 : .15) + Math.random() * .14) * speed;
      motion.depthAmp = (ultraSpaceMode ? 24 : 10) + Math.random() * (ultraSpaceMode ? 24 : 12);
      motion.depthSpeed = ((ultraSpaceMode ? .12 : .09) + Math.random() * .12) * speed;
      motion.rollAmp = (ultraSpaceMode ? 5 : 2.5) + Math.random() * (ultraSpaceMode ? 4 : 2.5);
      motion.rollSpeed = ((ultraSpaceMode ? .11 : .08) + Math.random() * .1) * speed;
    };
    motion.x = Math.min(window.innerWidth * .14, 140);
    motion.y = Math.min(window.innerHeight * .22, 160);
    element.style.left = `${motion.x}px`;
    element.style.top = `${motion.y}px`;
    pickTarget();
    let frame = 0; let previous = performance.now();
    const animate = (now: number) => {
      const delta = Math.min(32, now - previous || 16.67); previous = now;
      const t = now * .001;
      const blend = Math.min(.07, .018 * speed + .012 * (delta / 16.67));
      motion.x += (motion.tx - motion.x) * blend;
      motion.y += (motion.ty - motion.y) * blend;
      motion.rot += (motion.trot - motion.rot) * blend * .65;
      motion.scale += (motion.tscale - motion.scale) * blend * .42;
      const orbitX = Math.sin(t * motion.bobSpeedX + motion.phaseX) * motion.bobAmpX;
      const orbitY = Math.cos(t * motion.bobSpeedY + motion.phaseY) * motion.bobAmpY;
      const depth = Math.sin(t * motion.depthSpeed + motion.phaseDepth) * motion.depthAmp;
      const rollX = Math.cos(t * motion.rollSpeed + motion.phaseRoll) * motion.rollAmp;
      const yaw = Math.sin(t * (motion.rollSpeed * .92) + motion.phaseX) * (motion.rollAmp * (ultraSpaceMode ? 2.4 : 1.6));
      const glow = .94 + ((Math.sin(t * (.3 * speed) + motion.glowPhase) + 1) / 2) * (ultraSpaceMode ? .18 : .08);
      element.style.left = `${motion.x}px`;
      element.style.top = `${motion.y}px`;
      element.style.transform = `translate3d(${orbitX}px, ${orbitY}px, ${depth}px) rotate(${motion.rot}deg) rotateX(${rollX}deg) rotateY(${yaw}deg) scale(${motion.scale})`;
      element.style.filter = `brightness(${glow}) saturate(${ultraSpaceMode ? 1.18 : 1.06})`;
      if (Math.abs(motion.tx - motion.x) < 16 && Math.abs(motion.ty - motion.y) < 16) pickTarget();
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    const handleResize = () => pickTarget();
    window.addEventListener("resize", handleResize);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", handleResize); };
  }, [screen, mode, levelIndex, cardIndex, card?.label, card?.icon, answerFloatSpeed, ultraSpaceMode]);

  const saveReport = useCallback((player: PlayerGame, name: string) => {
    const total = player.records.length; const accuracy = total ? Math.round(player.records.filter(r => r.correct).length / total * 100) : 0;
    const report: StudentReport = { id: Date.now() + Math.random(), name: name.trim() || "Abstract Hero", score: player.score, accuracy, correct: player.records.filter(r => r.correct).length, total, seconds: Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)), level: playableLevels.length, date: new Date().toLocaleString("th-TH"), mode };
    setReports(current => { const next = [report, ...current].slice(0, 80); try { localStorage.setItem("abstract-hero-reports", JSON.stringify(next)); } catch { /* optional */ } return next; });
  }, [mode, playableLevels.length]);

  const finishGame = useCallback(() => {
    const finalPlayers = playersRef.current; saveReport(finalPlayers[0], studentName || (mode === "versus" ? "Player 1" : "Abstract Hero")); if (mode === "versus") saveReport(finalPlayers[1], player2Name || "Player 2");
    setScreen("summary"); playSound("victory"); speak(mode === "versus" ? "การแข่งขันจบแล้ว มาดูผลผู้ชนะกัน" : "ภารกิจสำเร็จ เธอแยกข้อมูลสำคัญออกจากรายละเอียดที่ไม่จำเป็นได้แล้ว");
  }, [mode, playSound, player2Name, saveReport, speak, studentName]);

  const resetRoundState = useCallback(() => {
    setSoloFeedback(null); setPlayers(current => [{ ...current[0], answered: false, feedback: null, choiceIndex: 0 }, { ...current[1], answered: false, feedback: null, choiceIndex: 0 }]); setHandSelected(false);
  }, []);

  const advanceCard = useCallback(() => {
    if (roundAdvanceRef.current) { window.clearTimeout(roundAdvanceRef.current); roundAdvanceRef.current = null; }
    resetRoundState();
    if (cardIndex < deck.length - 1) {
      setCardIndex(value => value + 1); const accuracy = soloAccuracy; const adaptiveTime = accuracy >= 85 ? 11 : accuracy < 60 ? 16 : 13; setTimeLeft(levelIndex === 4 ? Math.max(8, adaptiveTime - 2) : adaptiveTime); return;
    }
    if (levelIndex < playableLevels.length - 1) {
      const nextLevel = levelIndex + 1; setLevelIndex(nextLevel); setDeck(shuffle(playableLevels[nextLevel].items)); setCardIndex(0); setTimeLeft(nextLevel === playableLevels.length - 1 ? 10 : 13); setPlayers(current => [{ ...current[0], combo: 0, power: Math.min(3, current[0].power + 1) }, { ...current[1], combo: 0, power: Math.min(3, current[1].power + 1) }]); speak(`เข้าสู่ด่านที่ ${nextLevel + 1} ${playableLevels[nextLevel].title}`); return;
    }
    finishGame();
  }, [cardIndex, deck.length, finishGame, levelIndex, playableLevels, resetRoundState, soloAccuracy, speak]);

  const scheduleAdvance = useCallback((delay = 1050) => {
    if (roundAdvanceRef.current) window.clearTimeout(roundAdvanceRef.current);
    roundAdvanceRef.current = window.setTimeout(() => { roundAdvanceRef.current = null; advanceCard(); }, delay);
  }, [advanceCard]);

  const classifyForPlayer = useCallback((player: PlayerId, kind: AnswerKind) => {
    const current = playersRef.current[player]; if (!card || paused || current.answered || (mode === "solo" && soloFeedback)) return;
    const correct = (kind === "essential") === card.essential; const nextCombo = correct ? current.combo + 1 : 0; let points = correct ? 10 : -5;
    if (correct && nextCombo >= 2) points += 5; if (correct && nextCombo > 0 && nextCombo % 5 === 0) points += 20; if (correct && timeLeft >= 8) points += 3;
    const record: AnswerRecord = { ...card, level: level.id, correct, chosen: kind };
    const feedbackTitle = correct ? (card.essential ? "ถูก — นี่คือแก่นสำคัญ" : "ถูก — ตัดรายละเอียดรบกวน") : "ยังไม่ถูก";
    setPlayers(currentPlayers => {
      const next = [...currentPlayers] as [PlayerGame, PlayerGame]; const p = next[player];
      next[player] = { ...p, score: Math.max(0, p.score + points), combo: nextCombo, lives: correct ? p.lives : Math.max(0, p.lives - 1), answered: true, feedback: { correct, title: feedbackTitle, points, chosen: kind, motion: kind === "noise" ? "left" : "right" }, records: [...p.records, record] };
      playersRef.current = next; return next;
    });
    setBurst(value => value + 1); playSound(correct ? "success" : "error");
    if (mode === "solo") {
      setSoloFeedback({ correct, title: correct ? (card.essential ? "ใช่เลย — นี่คือแก่นสำคัญ" : "เยี่ยม — ตัดรายละเอียดรบกวนแล้ว") : "เกือบถูกแล้ว ลองดูเหตุผลนี้", body: card.detail });
      speak(`${correct ? "ถูกต้อง" : "คำตอบนี้ยังไม่ถูก"} ${card.detail}`);
      requestAnimationFrame(() => { if (feedbackRef.current) gsap.fromTo(feedbackRef.current, { y: 24, opacity: 0, scale: .96 }, { y: 0, opacity: 1, scale: 1, duration: .35, ease: "back.out(1.4)" }); });
    } else {
      window.setTimeout(() => { if (playersRef.current[0].answered && playersRef.current[1].answered) scheduleAdvance(850); }, 0);
    }
  }, [card, level.id, mode, paused, playSound, scheduleAdvance, soloFeedback, speak, timeLeft]);


  const answerMcqForPlayer = useCallback((player: PlayerId, choiceIndex: number) => {
    const current = playersRef.current[player]; if (!card || questionMode(card) !== "mcq" || paused || current.answered || (mode === "solo" && soloFeedback)) return;
    const choices = card.choices ?? []; if (!choices.length) return;
    const safeIndex = clamp(choiceIndex, 0, choices.length - 1); const correctIndex = clamp(Number(card.correctChoice ?? 0), 0, choices.length - 1); const correct = safeIndex === correctIndex;
    const nextCombo = correct ? current.combo + 1 : 0; let points = correct ? 12 : -5; if (correct && nextCombo >= 2) points += 4; if (correct && timeLeft >= 8) points += 3;
    const chosen = choices[safeIndex] ?? `ตัวเลือก ${safeIndex + 1}`; const record: AnswerRecord = { ...card, level: level.id, correct, chosen };
    const feedbackTitle = correct ? `ถูก — ${chosen}` : `ยังไม่ถูก — คำตอบคือ ${choices[correctIndex] ?? "ตัวเลือกที่ถูก"}`;
    setPlayers(currentPlayers => { const next = [...currentPlayers] as [PlayerGame, PlayerGame]; const p = next[player]; next[player] = { ...p, score: Math.max(0, p.score + points), combo: nextCombo, lives: correct ? p.lives : Math.max(0, p.lives - 1), answered: true, choiceIndex: safeIndex, feedback: { correct, title: feedbackTitle, points, chosen, motion: "option" }, records: [...p.records, record] }; playersRef.current = next; return next; });
    setBurst(value => value + 1); playSound(correct ? "success" : "error");
    if (mode === "solo") { setSoloFeedback({ correct, title: feedbackTitle, body: card.detail }); speak(`${correct ? "ถูกต้อง" : "คำตอบนี้ยังไม่ถูก"} ${card.detail}`); }
    else window.setTimeout(() => { if (playersRef.current[0].answered && playersRef.current[1].answered) scheduleAdvance(850); }, 0);
  }, [card, level.id, mode, paused, playSound, scheduleAdvance, soloFeedback, speak, timeLeft]);

  const changeMcqChoice = useCallback((player: PlayerId, delta: number) => {
    if (!card || questionMode(card) !== "mcq" || playersRef.current[player].answered) return; const count = Math.max(1, card.choices?.length ?? 0);
    setPlayers(current => { const next = [...current] as [PlayerGame, PlayerGame]; const p = next[player]; next[player] = { ...p, choiceIndex: (p.choiceIndex + delta + count) % count }; playersRef.current = next; return next; });
    setPlayerGesture(current => { const next = [...current] as [string, string]; next[player] = delta > 0 ? "SWIPE RIGHT · เลื่อนคำตอบ" : "SWIPE LEFT · เลื่อนคำตอบ"; return next; });
  }, [card]);

  const handleSwipe = useCallback((player: PlayerId, kind: AnswerKind) => {
    if (!card) return; if (questionMode(card) === "mcq") changeMcqChoice(player, kind === "essential" ? 1 : -1); else classifyForPlayer(player, kind);
  }, [card, changeMcqChoice, classifyForPlayer]);
  const confirmCurrentChoice = useCallback((player: PlayerId) => {
    if (!card) return; if (questionMode(card) === "mcq") answerMcqForPlayer(player, playersRef.current[player].choiceIndex); else classifyForPlayer(player, "essential");
  }, [answerMcqForPlayer, card, classifyForPlayer]);

  const activatePower = useCallback((player: PlayerId) => {
    const p = playersRef.current[player]; if (!card || p.power <= 0 || screen !== "game" || p.answered || paused) return;
    setPlayers(current => { const next = [...current] as [PlayerGame, PlayerGame]; next[player] = { ...next[player], power: Math.max(0, next[player].power - 1) }; playersRef.current = next; return next; });
    setTimeLeft(value => value + 6); playSound("power"); if (mode === "solo") speak(card.essential ? "โฟกัสวิชันตรวจพบแก่นสำคัญ" : "โฟกัสวิชันตรวจพบรายละเอียดที่ตัดออกได้");
  }, [card, mode, paused, playSound, screen, speak]);

  const beginGame = useCallback(() => {
    if (controlMode === "none") return;
    startTimeRef.current = Date.now(); setLevelIndex(0); setDeck(shuffle(playableLevels[0].items)); setCardIndex(0); setTimeLeft(14); setPlayers([EMPTY_PLAYER(), EMPTY_PLAYER()]); setSoloFeedback(null); setPaused(false); setScreen("game"); playSound("power"); speak(mode === "versus" ? "เริ่มการแข่งขัน ผู้เล่นหนึ่งฝั่งซ้าย ผู้เล่นสองฝั่งขวา ปัดมือเฉพาะการ์ดของตัวเอง" : "ยินดีต้อนรับ Abstract Hero ปัดขวาเพื่อเก็บข้อมูลสำคัญ และปัดซ้ายเพื่อตัดรายละเอียดที่ไม่จำเป็น");
  }, [controlMode, mode, playSound, playableLevels, speak]);

  useEffect(() => {
    if (screen !== "game" || paused || (mode === "solo" && soloFeedback)) return;
    const timer = window.setInterval(() => setTimeLeft(value => {
      if (value > 1) return value - 1;
      window.clearInterval(timer);
      const timeoutPlayer = (player: PlayerId) => {
        if (!card) return;
        if (questionMode(card) === "mcq") { const choices = card.choices ?? []; if (choices.length) answerMcqForPlayer(player, (Number(card.correctChoice ?? 0) + 1) % choices.length); }
        else { const fallback: AnswerKind = card.essential ? "noise" : "essential"; classifyForPlayer(player, fallback); }
      };
      if (mode === "solo") window.setTimeout(() => timeoutPlayer(0), 0);
      else { const current = playersRef.current; if (!current[0].answered) window.setTimeout(() => timeoutPlayer(0), 0); if (!current[1].answered) window.setTimeout(() => timeoutPlayer(1), 0); window.setTimeout(() => scheduleAdvance(850), 50); }
      return 0;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [answerMcqForPlayer, card, classifyForPlayer, mode, paused, scheduleAdvance, screen, soloFeedback]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (screen === "lobby" && event.key === "Enter" && controlMode !== "none" && (controlMode === "mouse" || (mode === "solo" ? handReady : playerReadyRef.current.every(Boolean)))) beginGame();
      if (screen !== "game") return;
      if (mode === "solo") { if (event.key === "ArrowLeft") handleSwipe(0, "noise"); if (event.key === "ArrowRight") handleSwipe(0, "essential"); if (event.key === "Enter" && card && questionMode(card) === "mcq") confirmCurrentChoice(0); if (event.code === "Space") { event.preventDefault(); activatePower(0); } }
      else { if (event.key.toLowerCase() === "a") handleSwipe(0, "noise"); if (event.key.toLowerCase() === "d") handleSwipe(0, "essential"); if (event.key.toLowerCase() === "w" && card && questionMode(card) === "mcq") confirmCurrentChoice(0); if (event.key === "ArrowLeft") handleSwipe(1, "noise"); if (event.key === "ArrowRight") handleSwipe(1, "essential"); if (event.key === "ArrowUp" && card && questionMode(card) === "mcq") confirmCurrentChoice(1); }
      if (event.key.toLowerCase() === "p") setPaused(value => !value);
    };
    window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey);
  }, [activatePower, beginGame, card, confirmCurrentChoice, controlMode, handleSwipe, handReady, mode, screen]);

  useEffect(() => { actionRef.current = { screen, mode, paused, questionMode: card ? questionMode(card) : "classify", soloFeedback, beginGame, swipe: handleSwipe, confirm: confirmCurrentChoice, usePower: activatePower, togglePause: () => setPaused(value => !value) }; }, [activatePower, beginGame, card, confirmCurrentChoice, handleSwipe, mode, paused, screen, soloFeedback]);

  // Robust hand tracking + gesture state machine.
  useEffect(() => {
    if (controlMode !== "hand" || !cameraOn || !videoRef.current) return;
    let cancelled = false; let animationFrame = 0; let landmarker: { detectForVideo: (video: HTMLVideoElement, now: number) => HandResult; close: () => void } | null = null;
    let lastVideoTime = -1; let nextTrackId = 1; let lastInferenceAt = 0; let lastLabel = ""; let inferenceInterval = 20; let lastScanProgress = -1;
    const tracks = new Map<number, HandTrack>();
    const HAND_CONNECTIONS: [number, number][] = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17],[5,13]];
    const renderSkeletons = (now: number) => {
      ([0,1] as PlayerId[]).forEach(owner => {
        const canvas = skeletonRefs[owner].current; if (!canvas) return;
        const visible = [...tracks.values()].filter(t => t.owner === owner && now - t.lastSeen < 260 && t.targetLandmarks?.length === 21);
        const dpr = Math.min(window.devicePixelRatio || 1, 2); const width = innerWidth; const height = innerHeight;
        if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
        const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
        if (!visible.length) { canvas.style.opacity = "0"; return; } canvas.style.opacity = "1";
        const lineColor = owner === 0 ? "rgba(110,232,255,.94)" : "rgba(199,154,255,.94)";
        const glowColor = owner === 0 ? "rgba(87,219,255,.72)" : "rgba(181,118,255,.72)";
        visible.slice(0,2).forEach(track => {
          if (!track.targetLandmarks) return;
          if (!track.renderLandmarks) track.renderLandmarks = track.targetLandmarks.map(v => ({...v}));
          const lerp = track.primary ? .52 : .44;
          track.renderLandmarks = track.renderLandmarks.map((v, i) => { const target = track.targetLandmarks![i]; return { x: v.x + (target.x - v.x) * lerp, y: v.y + (target.y - v.y) * lerp, z: v.z + (target.z - v.z) * lerp }; });
          const pts = track.renderLandmarks.map(v => ({ x: (1 - v.x) * width, y: v.y * height }));
          ctx.save(); ctx.globalAlpha = track.primary ? 1 : .56; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = lineColor; ctx.lineWidth = track.primary ? 3.2 : 2.4; ctx.shadowColor = glowColor; ctx.shadowBlur = track.primary ? 13 : 8;
          ctx.beginPath(); HAND_CONNECTIONS.forEach(([a,b]) => { ctx.moveTo(pts[a].x,pts[a].y); ctx.lineTo(pts[b].x,pts[b].y); }); ctx.stroke();
          pts.forEach((pt, i) => { ctx.beginPath(); ctx.fillStyle = (i===4 || i===8) ? "rgba(255,255,255,.98)" : lineColor; ctx.arc(pt.x,pt.y,i===0?6.4:4.2,0,Math.PI*2); ctx.fill(); }); ctx.restore();
        });
      });
    }; const primaryByPlayer: [number | null, number | null] = [null, null]; const powerHoldSince: [number, number] = [0, 0]; const powerLatched: [boolean, boolean] = [false, false];

    const setLabel = (label: string) => { if (label !== lastLabel) { lastLabel = label; setGestureLabel(label); } };
    const setPlayerLabel = (player: PlayerId, label: string) => setPlayerGesture(current => { if (current[player] === label) return current; const next = [...current] as [string, string]; next[player] = label; return next; });
    const ownerZone = (x: number): PlayerId | null => x <= .43 ? 0 : x >= .57 ? 1 : null;
    const canActAtX = (owner: PlayerId, x: number) => owner === 0 ? x < .82 : x > .18;

    const boot = async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const wasm = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const options = {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" as const },
          runningMode: "VIDEO" as const,
          numHands: mode === "versus" ? 4 : 2,
          minHandDetectionConfidence: .35,
          minHandPresenceConfidence: .35,
          minTrackingConfidence: .35,
        };
        try { landmarker = await vision.HandLandmarker.createFromOptions(wasm, options) as typeof landmarker; }
        catch { landmarker = await vision.HandLandmarker.createFromOptions(wasm, { ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" as const } }) as typeof landmarker; }
        if (cancelled || !landmarker) { landmarker?.close(); return; }
        setHandModelReady(true); setHandReady(false); setLabel(mode === "versus" ? "Hand AI โหลดแล้ว · ยกฝ่ามือในฝั่งของตัวเองเพื่อสแกนและ Lock Player" : "กล้องและ Hand AI พร้อม · กดถัดไป แล้วชูฝ่ามือเพื่อสแกน");
      } catch { if (!cancelled) { setHandModelReady(false); setHandReady(false); setLabel("Hand AI เปิดไม่สำเร็จ · ยังใช้ปุ่ม/คีย์บอร์ดได้"); } return; }

      const loop = () => {
        if (cancelled || !landmarker || !videoRef.current) return;
        const video = videoRef.current; const now = performance.now();
        // Camera/UI render at 60fps. Hand inference adapts roughly 30–50fps so MediaPipe does not choke the main thread.
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastInferenceAt >= inferenceInterval) {
          lastInferenceAt = now; lastVideoTime = video.currentTime;
          const inferenceStarted = performance.now();
          const result = landmarker.detectForVideo(video, now); const inferenceCost = performance.now() - inferenceStarted;
          inferenceInterval = inferenceCost > 28 ? 34 : inferenceCost > 20 ? 28 : inferenceCost > 13 ? 23 : 18;
          const hands = result.landmarks ?? []; const handedness = result.handedness ?? [];
          const observations = hands.map((hand, index) => {
            const center = palmCenter(hand); return { hand, x: center.x, y: center.y, palmWidth: clamp(distance(hand[5], hand[17]), .035, .28), handedness: handedness[index]?.[0]?.categoryName ?? "Unknown" };
          });

          // Greedy nearest-neighbour track matching. Ownership is stored on the track, not derived from current x every frame.
          const unmatchedTracks = [...tracks.values()].filter(t => now - t.lastSeen < 1700); const used = new Set<number>();
          observations.forEach(obs => {
            let best: HandTrack | null = null; let bestScore = Infinity;
            unmatchedTracks.forEach(track => {
              if (used.has(track.id)) return; const d = Math.hypot(obs.x - track.x, obs.y - track.y); const handedPenalty = track.handedness !== "Unknown" && obs.handedness !== "Unknown" && track.handedness !== obs.handedness ? .045 : 0; const score = d + handedPenalty;
              if (score < bestScore && d < .24) { best = track; bestScore = score; }
            });
            let track = best;
            if (!track) {
              track = { id: nextTrackId++, owner: mode === "solo" ? 0 : null, primary: mode === "solo" && primaryByPlayer[0] === null, candidateOwner: null, candidateSince: 0, lastSeen: now, handedness: obs.handedness, x: obs.x, y: obs.y, palmWidth: obs.palmWidth, rawX: obs.x, rawY: obs.y, vx: 0, vy: 0, stableFrames: 0, trail: [], lastActionAt: 0, armed: true, neutralSince: now, pinchState: false, pinchOnFrames: 0, pinchOffFrames: 0, selectedLatch: false, fistSince: 0, openSince: 0, raisedSince: 0, targetLandmarks: obs.hand.map(v => ({...v})), renderLandmarks: null };
              if (track.primary) primaryByPlayer[0] = track.id; tracks.set(track.id, track);
            }
            used.add(track.id);
            const frameDt = Math.max(.016, Math.min(.09, (now - track.lastSeen) / 1000 || .033)); const rawDx = obs.x - track.rawX; const rawDy = obs.y - track.rawY; const rawJump = Math.hypot(rawDx, rawDy);
            // Reject improbable landmark jumps while a track is already stable. A real fast swipe is still below this gate at 30fps.
            if (track.stableFrames > 8 && rawJump > Math.max(.19, track.palmWidth * 1.75)) return;
            track.lastSeen = now; track.handedness = obs.handedness; track.vx = track.vx * .45 + rawDx / frameDt * .55; track.vy = track.vy * .45 + rawDy / frameDt * .55; track.rawX = obs.x; track.rawY = obs.y;
            const speed = Math.hypot(track.vx, track.vy); const alpha = speed > .7 ? .78 : speed > .28 ? .62 : .46; track.x += (obs.x - track.x) * alpha; track.y += (obs.y - track.y) * alpha; track.palmWidth = track.palmWidth * .78 + obs.palmWidth * .22; track.stableFrames = Math.min(120, track.stableFrames + 1); track.targetLandmarks = obs.hand.map(v => ({...v}));

            const ext = fingerCount(obs.hand); const pinchRatio = distance(obs.hand[4], obs.hand[8]) / Math.max(.035, obs.palmWidth); const fist = ext <= 1 && [8, 12, 16, 20].reduce((sum, i) => sum + distance(obs.hand[i], obs.hand[0]), 0) / 4 < [5, 9, 13, 17].reduce((sum, i) => sum + distance(obs.hand[i], obs.hand[0]), 0) / 4 * 1.55;
            const open = ext >= 3 && !fist && pinchRatio > .55;

            // Pinch hysteresis: requires multiple frames to engage/release.
            if (!track.pinchState) { track.pinchOnFrames = pinchRatio < .48 ? track.pinchOnFrames + 1 : 0; if (track.pinchOnFrames >= 2) { track.pinchState = true; track.pinchOffFrames = 0; } }
            else { track.pinchOffFrames = pinchRatio > .62 ? track.pinchOffFrames + 1 : 0; if (track.pinchOffFrames >= 2) { track.pinchState = false; track.pinchOnFrames = 0; } }
            track.openSince = open ? (track.openSince || now) : 0; track.fistSince = fist ? (track.fistSince || now) : 0;

            // SOLO hand readiness gate: gestures remain locked until an open palm is scanned steadily.
            if (mode === "solo" && track.primary && handSetupStepRef.current === 1) {
              if (open && track.stableFrames >= 7 && track.openSince) {
                const elapsed = now - Math.max(track.openSince, handScanStartedAtRef.current); const progressValue = Math.min(100, Math.round(elapsed / 9));
                if (Math.abs(progressValue - lastScanProgress) >= 3) { lastScanProgress = progressValue; setHandScanProgress(progressValue); setLabel(`กำลังสแกนมือ ${progressValue}% · ค้างฝ่ามือให้นิ่ง`); }
                if (elapsed >= 900) { setHandScanProgress(100); setHandSetupStep(2); setHandReady(true); setLabel("✓ มือพร้อมใช้งาน · ใช้นิ้วชี้เล็งปุ่ม หรือปัดซ้าย/ขวาได้"); track.trail.length = 0; track.armed = false; track.lastActionAt = now; }
              } else { if (lastScanProgress !== 0) { lastScanProgress = 0; setHandScanProgress(0); } setLabel("ยกฝ่ามือให้เห็นครบ 5 นิ้ว · ระบบจะสแกนประมาณ 1 วินาที"); }
            }

            // VS calibration / re-acquisition. A primary hand is only acquired inside its own home zone with an open palm.
            if (mode === "versus" && track.owner === null) {
              const candidate = ownerZone(track.x);
              if (candidate !== null && open && track.stableFrames >= 8 && primaryByPlayer[candidate] === null) {
                if (track.candidateOwner !== candidate) { track.candidateOwner = candidate; track.candidateSince = now; }
                if (now - track.candidateSince >= 620) { track.owner = candidate; track.primary = true; primaryByPlayer[candidate] = track.id; setPlayerReady(current => { if (current[candidate]) return current; const next = [...current] as [boolean, boolean]; next[candidate] = true; if (next.every(Boolean)) { setHandReady(true); setLabel("✓ มือผู้เล่นทั้ง 2 พร้อมใช้งาน"); } return next; }); setPlayerLabel(candidate, `LOCKED · ${track.handedness === "Unknown" ? "มือหลัก" : track.handedness}`); }
              } else { track.candidateOwner = null; track.candidateSince = 0; }
            }

            // Secondary hand can belong to a player only when it appears near that player's already locked primary hand.
            if (mode === "versus" && track.owner === null && open) {
              ([0, 1] as PlayerId[]).forEach(owner => {
                const pid = primaryByPlayer[owner]; const primary = pid ? tracks.get(pid) : null; if (!primary || now - primary.lastSeen > 450) return;
                if (Math.hypot(track.x - primary.x, track.y - primary.y) < .34 && (owner === 0 ? track.x < .58 : track.x > .42)) { track.owner = owner; track.primary = false; }
              });
            }

            if (track.owner === null) return;
            const owner = track.owner; const active = actionRef.current; if (!active) return;
            const cursor = cursorRefs[owner].current;
            const indexTip = track.targetLandmarks?.[8]; const pointerX = indexTip ? (1 - indexTip.x) * innerWidth : (1 - track.x) * innerWidth; const pointerY = indexTip ? indexTip.y * innerHeight : track.y * innerHeight;
            if (track.primary && cursor) { cursor.style.opacity = "1"; cursor.style.transform = `translate(${pointerX}px,${pointerY}px)`; }
            if (!track.primary) return; // Only the locked primary hand may classify cards.

            // Point-and-dwell: after calibration the index finger can press START and NEXT without a mouse.
            if ((mode === "solo" && handReadyRef.current) || (mode === "versus" && playerReadyRef.current[owner])) {
              const target = active.screen === "lobby" ? startButtonRef.current : (active.screen === "game" && active.soloFeedback ? feedbackNextRef.current : null);
              if (target) {
                const rect = target.getBoundingClientRect(); const inside = pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom;
                if (inside) {
                  target.classList.add("hand-dwell-active"); const targetKey = active.screen === "lobby" ? "start" : "next";
                  if (track.dwellTarget !== targetKey) { track.dwellTarget = targetKey; track.dwellSince = now; }
                  if (track.dwellSince && now - track.dwellSince >= 700) { target.classList.remove("hand-dwell-active"); track.dwellSince = 0; track.dwellTarget = ""; target.click(); }
                } else { target.classList.remove("hand-dwell-active"); track.dwellSince = 0; track.dwellTarget = ""; }
              }
            }

            if (mode === "solo" && handSetupStepRef.current !== 2) return;
            if (mode === "versus" && !playerReadyRef.current[owner]) return;

            track.trail.push({ x: track.x, y: track.y, at: now }); while (track.trail.length && now - track.trail[0].at > 680) track.trail.shift();
            const recentNeutral = track.trail.filter(s => now - s.at <= 150); const neutralDx = recentNeutral.length > 1 ? Math.abs(recentNeutral[recentNeutral.length - 1].x - recentNeutral[0].x) : 0;
            if (!track.armed && now - track.lastActionAt > 140 && neutralDx < .05 && !track.pinchState && !fist) { if (!track.neutralSince) track.neutralSince = now; if (now - track.neutralSince > 60) track.armed = true; } else if (neutralDx >= .06) track.neutralSince = 0;

            if (active.screen === "lobby") { return; }
            if (active.screen !== "game" || (mode === "solo" && active.soloFeedback)) return;

            // Raise open palm to pause in solo only. VS pause remains a shared explicit control to avoid one player stopping the race.
            if (mode === "solo" && open && track.y < .27) {
              track.raisedSince = track.raisedSince || now;
              if (now - track.raisedSince > 500 && now - track.lastActionAt > 700) { setLabel("Raise Palm · PAUSE"); active.togglePause(); track.lastActionAt = now; track.raisedSince = 0; track.armed = false; }
            } else track.raisedSince = 0;
            if (active.paused || playersRef.current[owner].answered || !canActAtX(owner, track.x)) return;

            // Pinch -> select. Fist after pinch -> keep. Both use time hysteresis, not one-frame poses.
            if (track.pinchState) { track.selectedLatch = true; setHandSelected(true); setPlayerLabel(owner, "PINCH · เลือกการ์ด"); if (mode === "solo") setLabel("Pinch · เลือกการ์ด"); }
            if (track.selectedLatch && fist && track.fistSince && now - track.fistSince > 150 && now - track.lastActionAt > 260) {
              setPlayerLabel(owner, "FIST · เก็บข้อมูล"); active.confirm(owner); track.selectedLatch = false; track.lastActionAt = now; track.armed = false; track.trail.length = 0; setHandSelected(false); return;
            }

            // Swipe = roughly one palm width, horizontal-dominant, velocity constrained, one-shot until neutral re-arm.
            if (!track.armed || track.pinchState || fist || ext < 2 || now - track.lastActionAt < 150 || track.trail.length < 2) return;
            const windowSamples = track.trail.filter(s => now - s.at <= 700); if (windowSamples.length < 2) return;
            let min = windowSamples[0]; let max = windowSamples[0]; windowSamples.forEach(s => { if (s.x < min.x) min = s; if (s.x > max.x) max = s; });
            const currentSample = windowSamples[windowSamples.length - 1]; const rightDx = currentSample.x - min.x; const leftDx = max.x - currentSample.x; const dir = rightDx >= leftDx ? 1 : -1; const start = dir > 0 ? min : max; const dx = currentSample.x - start.x; const dy = currentSample.y - start.y; const duration = Math.max(1, (currentSample.at - start.at) / 1000); const velocity = Math.abs(dx) / duration;
            const threshold = clamp(track.palmWidth * .50, .032, .095);
            let forward = 0; let backward = 0; for (let i = 1; i < windowSamples.length; i += 1) { const step = (windowSamples[i].x - windowSamples[i - 1].x) * dir; if (step > .002) forward += step; else if (step < -.002) backward += Math.abs(step); } const monotonic = forward / Math.max(.001, forward + backward);
            if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * .72 && duration >= .03 && duration <= .95 && velocity >= .06 && monotonic >= .48) {
              const kind: AnswerKind = dx > 0 ? "essential" : "noise"; const label = active.questionMode === "mcq" ? (dx > 0 ? "SWIPE RIGHT · คำตอบถัดไป" : "SWIPE LEFT · คำตอบก่อนหน้า") : (dx > 0 ? "SWIPE RIGHT · เก็บ" : "SWIPE LEFT · ตัด");
              setPlayerLabel(owner, label); if (mode === "solo") setLabel(label); active.swipe(owner, kind); track.lastActionAt = now; track.armed = false; track.neutralSince = 0; track.trail.length = 0; track.selectedLatch = false; setHandSelected(false);
            }
          });

          // Hide cursors for missing primaries and allow controlled re-acquisition after a real loss.
          ([0, 1] as PlayerId[]).forEach(owner => {
            const pid = primaryByPlayer[owner]; const primary = pid ? tracks.get(pid) : null;
            if (!primary || now - primary.lastSeen > 280) { if (cursorRefs[owner].current) cursorRefs[owner].current!.style.opacity = "0"; }
            if (primary && now - primary.lastSeen > 1650) { primary.primary = false; primary.owner = null; primaryByPlayer[owner] = null; if (mode === "versus") { setHandReady(false); setPlayerReady(current => { const next = [...current] as [boolean, boolean]; next[owner] = false; return next; }); setPlayerLabel(owner, "หลุดการติดตาม · ยกฝ่ามือในฝั่งตัวเองเพื่อล็อกใหม่"); } else { handScanStartedAtRef.current = now; setHandReady(false); setHandSetupStep(1); setHandScanProgress(0); setLabel("มือหลุดจากกล้อง · ยกฝ่ามือเพื่อสแกนใหม่"); } }
          });
          [...tracks.values()].forEach(track => { if (now - track.lastSeen > 2200) tracks.delete(track.id); });

          // Two-hand power must be two hands owned by THE SAME player. This fixes the old bug where two different players could trigger power together.
          ([0, 1] as PlayerId[]).forEach(owner => {
            const ownedVisible = [...tracks.values()].filter(t => t.owner === owner && now - t.lastSeen < 260);
            if (ownedVisible.length >= 2 && actionRef.current?.screen === "game" && !playersRef.current[owner].answered) {
              powerHoldSince[owner] = powerHoldSince[owner] || now;
              if (!powerLatched[owner] && now - powerHoldSince[owner] > 430) { actionRef.current?.usePower(owner); powerLatched[owner] = true; setPlayerLabel(owner, "2 HANDS · POWER"); }
            } else { powerHoldSince[owner] = 0; powerLatched[owner] = false; }
          });

          if (!hands.length) { setLabel(mode === "versus" ? "ไม่พบมือ · กลับเข้าฝั่งของตัวเองแล้วยกฝ่ามือ" : "ไม่พบมือ · ยกมือให้เห็นเต็มฝ่ามือ"); }
        }
        renderSkeletons(now);
        animationFrame = requestAnimationFrame(loop);
      };
      loop();
    };
    void boot();
    return () => { cancelled = true; cancelAnimationFrame(animationFrame); landmarker?.close(); tracks.clear(); skeletonRefs.forEach(ref => { const canvas = ref.current; if (!canvas) return; const ctx = canvas.getContext("2d"); ctx?.clearRect(0,0,canvas.width,canvas.height); canvas.style.opacity = "0"; }); setHandModelReady(false); setHandReady(false); };
  }, [cameraOn, mode, controlMode]);

  const startWebXR = useCallback(async () => {
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr; const renderer = xrRendererRef.current;
    if (!xr || !renderer) { setCameraMessage("WebXR ไม่พร้อม — ใช้ Camera AR แทน"); return; }
    try { const session = await xr.requestSession("immersive-ar", { requiredFeatures: ["local"], optionalFeatures: ["local-floor", "dom-overlay"], domOverlay: { root: document.body } }); await renderer.xr.setSession(session as never); setXrActive(true); setCameraMessage("WebXR Immersive AR ทำงานอยู่"); session.addEventListener("end", () => { setXrActive(false); setCameraMessage("Camera AR พร้อมใช้งาน"); }); }
    catch { setCameraMessage("เปิด WebXR ไม่สำเร็จ — ใช้ Camera AR ต่อได้"); }
  }, []);

  const exitGame = useCallback(() => { if (roundAdvanceRef.current) window.clearTimeout(roundAdvanceRef.current); setPaused(false); setSoloFeedback(null); setScreen("lobby"); setPlayers([EMPTY_PLAYER(), EMPTY_PLAYER()]); setTimeLeft(14); }, []);
  const exportCsv = useCallback(() => { const rows = [["ชื่อผู้เรียน", "โหมด", "คะแนน", "ความแม่นยำ", "ตอบถูก", "จำนวนข้อ", "เวลา (วินาที)", "ด่านสูงสุด", "วันที่"], ...reports.map(r => [r.name, r.mode ?? "solo", r.score, `${r.accuracy}%`, r.correct, r.total, r.seconds, r.level, r.date])]; const csv = "\uFEFF" + rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "abstract-hero-learning-report.csv"; link.click(); URL.revokeObjectURL(url); }, [reports]);
  const openGoogleSheets = useCallback(() => { const rows = [["ชื่อผู้เรียน", "โหมด", "คะแนน", "ความแม่นยำ", "ตอบถูก", "จำนวนข้อ", "เวลา (วินาที)", "ด่านสูงสุด", "วันที่"], ...reports.map(r => [r.name, r.mode ?? "solo", r.score, `${r.accuracy}%`, r.correct, r.total, r.seconds, r.level, r.date])]; void navigator.clipboard?.writeText(rows.map(row => row.join("\t")).join("\n")); window.open("https://sheets.new", "_blank", "noopener,noreferrer"); setGestureLabel("คัดลอกรายงานแล้ว · วางใน Google Sheets ได้ทันที"); }, [reports]);


  const saveQuestionDraft = useCallback(() => {
    const draft = questionDraft; if (!draft.label.trim() || !draft.detail.trim()) { setGestureLabel("กรอกหัวข้อคำถามและคำอธิบายให้ครบ"); return; }
    const levelPos = clamp(draft.levelIndex, 0, Math.max(0, levels.length - 1)); const targetLevel = levels[levelPos]; if (!targetLevel) return;
    const choices = draft.mode === "mcq" ? draft.choices.map(v => v.trim()).filter(Boolean) : undefined; if (draft.mode === "mcq" && (!choices || choices.length < 2)) { setGestureLabel("คำถามหลายตัวเลือกต้องมีอย่างน้อย 2 คำตอบ"); return; }
    const nextItem: CardItem = { id: draft.editingId || `custom-${Date.now().toString(36)}`, mode: draft.mode, label: draft.label.trim(), prompt: draft.prompt.trim() || (draft.mode === "mcq" ? draft.label.trim() : `ข้อมูลนี้จำเป็นต่อการอธิบาย “${targetLevel.subject}” หรือไม่?`), detail: draft.detail.trim(), icon: draft.icon.trim() || "✨", essential: draft.mode === "classify" ? draft.essential : undefined, leftLabel: draft.leftLabel.trim() || "ไม่สำคัญ", rightLabel: draft.rightLabel.trim() || "เก็บไว้", choices, correctChoice: draft.mode === "mcq" ? clamp(draft.correctChoice, 0, Math.max(0, (choices?.length ?? 1) - 1)) : undefined };
    setLevels(current => current.map((lvl, li) => li !== levelPos ? lvl : ({ ...lvl, items: draft.editingId ? lvl.items.map(item => item.id === draft.editingId ? nextItem : item) : [...lvl.items, nextItem] })));
    setQuestionDraft({ ...blankQuestionDraft(), levelIndex: levelPos }); setGestureLabel(draft.editingId ? "แก้ไขคำถามแล้ว" : "เพิ่มคำถามใหม่แล้ว");
  }, [levels, questionDraft]);
  const editQuestion = useCallback((levelPos: number, item: CardItem) => { setQuestionDraft({ editingId: item.id || null, levelIndex: levelPos, mode: questionMode(item), label: item.label, prompt: item.prompt || "", detail: item.detail, icon: item.icon, essential: item.essential ?? true, leftLabel: item.leftLabel || "ไม่สำคัญ", rightLabel: item.rightLabel || "เก็บไว้", choices: item.choices?.length ? [...item.choices] : ["คำตอบ 1", "คำตอบ 2"], correctChoice: Number(item.correctChoice ?? 0) }); }, []);
  const deleteQuestion = useCallback((levelPos: number, id?: string) => { if (!id) return; setLevels(current => current.map((lvl, li) => li !== levelPos ? lvl : ({ ...lvl, items: lvl.items.filter(item => item.id !== id) }))); if (questionDraft.editingId === id) setQuestionDraft(blankQuestionDraft()); }, [questionDraft.editingId]);
  const exportQuestionBank = useCallback(() => { const blob = new Blob([JSON.stringify(levels, null, 2)], { type: "application/json;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "abstract-hero-question-bank-v5.json"; a.click(); URL.revokeObjectURL(url); }, [levels]);
  const importQuestionBank = useCallback(async (file?: File) => { if (!file) return; try { const parsed = JSON.parse(await file.text()) as Level[]; if (!Array.isArray(parsed) || !parsed.length) throw new Error("รูปแบบไม่ถูกต้อง"); const normalized = normalizeLevels(parsed); if (!normalized.some(l => l.items.length)) throw new Error("ไม่พบคำถาม"); setLevels(normalized); setQuestionDraft(blankQuestionDraft()); setGestureLabel(`นำเข้าคลังคำถาม ${normalized.reduce((sum,l)=>sum+l.items.length,0)} ข้อแล้ว`); } catch { setGestureLabel("นำเข้าไม่สำเร็จ · ตรวจไฟล์ JSON อีกครั้ง"); } }, []);
  const resetQuestionBank = useCallback(() => { setLevels(normalizeLevels(LEVELS)); setQuestionDraft(blankQuestionDraft()); setGestureLabel("คืนค่าคำถามตัวอย่างแล้ว"); }, []);

  const winner = mode === "versus" ? (players[0].score === players[1].score ? null : players[0].score > players[1].score ? 0 : 1) : 0;
  const stars = useMemo(() => { const value = soloAccuracy >= 90 ? 3 : soloAccuracy >= 70 ? 2 : 1; return Array.from({ length: 3 }, (_, i) => i < value); }, [soloAccuracy]);

  return (
    <main className={`${largeText ? "large-text" : ""} ${colorBlind ? "color-blind" : ""} ${mode === "versus" ? "versus-mode" : ""}`}>
      <section className="ar-stage" aria-label="พื้นที่เล่นเกม Abstract Hero AR">
        <video ref={videoRef} className={`camera-feed ${cameraOn ? "is-on" : ""}`} muted playsInline aria-label="ภาพจากกล้องของผู้เล่น" />
        <div className="camera-vignette" /><div className="scanlines" /><HologramScene burst={burst} onRendererReady={onRendererReady} />
        <canvas ref={skeletonRefs[0]} className="hand-skeleton player-one-skeleton" aria-hidden="true" />
        {mode === "versus" && <canvas ref={skeletonRefs[1]} className="hand-skeleton player-two-skeleton" aria-hidden="true" />}
        <div ref={cursorRefs[0]} className={`hand-cursor player-one-cursor skeleton-center ${handSelected ? "pinched" : ""}`}><span /></div>
        {mode === "versus" && <div ref={cursorRefs[1]} className="hand-cursor player-two-cursor skeleton-center"><span /></div>}
        {mode === "versus" && <div className="player-zone-overlay" aria-hidden="true"><div className="zone-left">P1</div><div className="zone-dead"><span>SAFE<br />ZONE</span></div><div className="zone-right">P2</div></div>}

        <header className="topbar glass-panel">
          <button className="brand" onClick={() => setScreen("lobby")} aria-label="กลับหน้าหลัก"><span className="brand-mark"><Sparkles size={18} /></span><span><strong>ABSTRACT</strong><small>HERO AR</small></span></button>
          <div className="top-status" aria-live="polite"><span className={`status-dot ${controlMode === "mouse" || (cameraOn && handReady) ? "active" : ""}`} />{controlMode === "mouse" ? "MOUSE MODE · คลิกคำตอบและปุ่มได้เลย" : controlMode === "none" ? "เลือกวิธีควบคุมก่อนเริ่มเกม" : handReady ? `HAND READY · ${gestureLabel}` : handModelReady ? gestureLabel : cameraMessage}</div>
          <nav className="top-actions" aria-label="เครื่องมือ">
            {screen === "game" && <button className="exit-game-button" onClick={exitGame}><LogOut size={17} /><span>ออกจากเกม</span></button>}
            <button className="teacher-nav-button" onClick={() => setScreen(screen === "teacher" ? "lobby" : "teacher")}><BarChart3 size={17} /><span>สำหรับครู</span></button>
            {xrSupported && <button className={`xr-button ${xrActive ? "active" : ""}`} onClick={() => void startWebXR()}><Sparkles size={16} /><span>{xrActive ? "AR ACTIVE" : "ENTER AR"}</span></button>}
            <button className="icon-button" onClick={() => setSoundOn(v => !v)} aria-label={soundOn ? "ปิดเสียง" : "เปิดเสียง"}>{soundOn ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
            <button className="icon-button" onClick={() => setSettingsOpen(v => !v)} aria-label="ตั้งค่าการเข้าถึง"><Settings size={19} /></button>
          </nav>
        </header>

        {settingsOpen && <aside className="settings-panel glass-panel" aria-label="ตั้งค่าการเข้าถึง"><div className="panel-heading"><Accessibility size={18} /><strong>การเข้าถึง</strong></div><label><span>ตัวอักษรขนาดใหญ่</span><input type="checkbox" checked={largeText} onChange={e => setLargeText(e.target.checked)} /></label><label><span>โหมดแยกสี</span><input type="checkbox" checked={colorBlind} onChange={e => setColorBlind(e.target.checked)} /></label><label><span>เสียงบรรยายไทย</span><input type="checkbox" checked={voiceOn} onChange={e => setVoiceOn(e.target.checked)} /></label><label><span>ความเร็วกรอบคำตอบ</span><select value={answerFloatSpeed} onChange={e => setAnswerFloatSpeed(e.target.value as "slow" | "normal" | "fast")}><option value="slow">ช้า</option><option value="normal">ปกติ</option><option value="fast">เร็ว</option></select></label><label><span>Ultra Space</span><input type="checkbox" checked={ultraSpaceMode} onChange={e => setUltraSpaceMode(e.target.checked)} /></label></aside>}

        {screen === "lobby" && <div className={`hand-ai-visible-hud ${handReady ? "is-ready" : ""}`} aria-live="polite"><div className="hand-ai-state"><span className="hand-ai-icon">✋</span><span><strong>{handReady ? "HAND AI ACTIVE" : "กำลังเปิด HAND AI"}</strong><small>{gestureLabel}</small></span></div><div className="hand-command-row"><div className="hand-command"><b>👈</b><span>ปัดซ้าย</span><em>ตัดออก</em></div><div className="hand-command"><b>👉</b><span>ปัดขวา</span><em>เก็บไว้</em></div><div className="hand-command"><b>🤏</b><span>จีบนิ้ว</span><em>เลือก</em></div><div className="hand-command"><b>✊</b><span>กำมือ</span><em>เก็บ</em></div><div className="hand-command"><b>✋</b><span>ยกฝ่ามือ</span><em>Pause/Start</em></div><div className="hand-command"><b>🙌</b><span>สองมือ</span><em>Power</em></div></div></div>}

        {screen === "game" && controlMode === "hand" && <><button className={`hand-guide-toggle ${handGuideOpen ? "active" : ""}`} onClick={() => setHandGuideOpen(v => !v)} aria-expanded={handGuideOpen} aria-label="เปิดคำอธิบายระบบมือ"><Hand size={18} /><span>วิธีใช้มือ</span><b>?</b></button><aside className={`hand-guide-panel glass-panel ${handGuideOpen ? "open" : ""}`} aria-label="คำอธิบายระบบมือ"><div className="hand-guide-head"><div><span className={`guide-live-dot ${handReady ? "ready" : ""}`} /><strong>HAND CONTROLS</strong><small>{handReady ? `กำลังตรวจจับ: ${gestureLabel}` : handModelReady ? gestureLabel : cameraMessage}</small></div><button onClick={() => setHandGuideOpen(false)} aria-label="ปิดคำอธิบาย"><X size={17} /></button></div><div className="hand-guide-grid"><div><b>👈</b><span><strong>ปัดซ้าย</strong><small>ตัดข้อมูล / ไม่สำคัญ</small></span></div><div><b>👉</b><span><strong>ปัดขวา</strong><small>เก็บข้อมูล / สำคัญ</small></span></div><div><b>🤏</b><span><strong>จีบนิ้วโป้ง+ชี้</strong><small>เลือกการ์ดหรือคำตอบ</small></span></div><div><b>✊</b><span><strong>กำมือหลังจีบ</strong><small>ยืนยัน / เก็บคำตอบ</small></span></div><div><b>✋</b><span><strong>แบฝ่ามือ</strong><small>เริ่มเกม / หยุดชั่วคราว</small></span></div><div><b>🙌</b><span><strong>ยกสองมือ</strong><small>ใช้ Focus Power</small></span></div></div><div className="hand-guide-note">{mode === "versus" ? <><strong>โหมด 2 คน:</strong> P1 อยู่ฝั่งซ้าย · P2 อยู่ฝั่งขวา · พื้นที่กลางเป็น SAFE ZONE และ Power ต้องเป็นสองมือของผู้เล่นคนเดียวกัน</> : <><strong>เคล็ดลับ:</strong> ให้กล้องเห็นฝ่ามือเต็ม ๆ แล้วปัดแนวนอนต่อเนื่อง ไม่ต้องเหวี่ยงแรง</>}</div></aside></>}

        {screen === "lobby" && <div className="lobby-shell">
          <div className="hero-copy">
            <div className="mission-tag"><span /> ภารกิจฝึก Abstraction</div><h1>มองให้เห็น<br /><em>“แก่นสำคัญ”</em></h1>
            <p>ระบบ Gesture Engine ใหม่จะล็อกมือผู้เล่น ลดการปัดไม่ติด และป้องกันผู้เล่นอีกฝั่งมาควบคุมการ์ดของเรา</p>
            <div className="mode-switch" role="group" aria-label="เลือกโหมดเกม"><button className={mode === "solo" ? "active" : ""} onClick={() => { setMode("solo"); setPlayerReady([false, false]); }}><Gamepad2 size={18} /> SOLO</button><button className={mode === "versus" ? "active" : ""} onClick={() => { setMode("versus"); setPlayerReady([false, false]); }}><Swords size={18} /> VS 2 PLAYERS</button></div>
            <div className="control-mode-picker glass-panel" aria-label="เลือกวิธีควบคุม">
              <div className="control-mode-heading"><strong>เลือกวิธีควบคุม</strong><small>เลือกก่อนเริ่มเกม — เปลี่ยนได้ทุกครั้งที่กลับหน้าหลัก</small></div>
              <div className="control-mode-options">
                <button className={controlMode === "hand" ? "active hand" : "hand"} onClick={() => { setControlMode("hand"); setTouchOnlyMode(false); setHandReady(false); setHandSetupStep(0); setHandScanProgress(0); setPlayerReady([false, false]); setGestureLabel("กำลังเปิดกล้องและเตรียม Hand AI"); }}><span className="control-mode-icon">✋</span><span><strong>กล้อง + ระบบมือ</strong><small>สแกนมือก่อนเล่น · ปัด / จีบ / กำมือ / นิ้วชี้</small></span></button>
                <button className={controlMode === "mouse" ? "active mouse" : "mouse"} onClick={() => { setControlMode("mouse"); setTouchOnlyMode(true); setHandReady(false); setHandSetupStep(0); setHandScanProgress(0); setPlayerReady([false, false]); setGestureLabel("MOUSE MODE · คลิกเพื่อเล่น"); stopCamera(); }}><span className="control-mode-icon">🖱️</span><span><strong>เมาส์</strong><small>ไม่ใช้กล้อง · คลิกคำตอบและปุ่มได้ทันที</small></span></button>
              </div>
              {controlMode === "none" && <div className="control-mode-required">เลือก “กล้อง + ระบบมือ” หรือ “เมาส์” ก่อนเริ่ม</div>}
            </div>
            <div className={`player-name-grid ${mode === "versus" ? "two" : ""}`}>
              <div className="name-field"><label htmlFor="student-name">{mode === "versus" ? "ผู้เล่น 1 · ฝั่งซ้าย" : "ชื่อฮีโร่ของคุณ"}</label><input id="student-name" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder={mode === "versus" ? "Player 1" : "เช่น น้องฟ้า"} autoComplete="name" /></div>
              {mode === "versus" && <div className="name-field"><label htmlFor="player-two-name">ผู้เล่น 2 · ฝั่งขวา</label><input id="player-two-name" value={player2Name} onChange={e => setPlayer2Name(e.target.value)} placeholder="Player 2" autoComplete="off" /></div>}
            </div>
            {mode === "versus" && controlMode === "hand" && <div className="calibration-panel glass-panel"><div className="calibration-head"><ShieldCheck size={18} /><strong>Player Lock Calibration</strong><small>แต่ละคนยืนในฝั่งตัวเอง แล้วยกฝ่ามือค้างประมาณ 0.5 วินาที</small></div><div className="calibration-players"><div className={playerReady[0] ? "ready" : ""}><span>P1</span><strong>{playerReady[0] ? "LOCKED" : "ยกฝ่ามือฝั่งซ้าย"}</strong><small>{playerGesture[0]}</small></div><div className={playerReady[1] ? "ready" : ""}><span>P2</span><strong>{playerReady[1] ? "LOCKED" : "ยกฝ่ามือฝั่งขวา"}</strong><small>{playerGesture[1]}</small></div></div><p>พื้นที่กลาง 14% เป็น Safe Zone: มือที่ยังไม่ถูกล็อกจะไม่ถูกยกให้ผู้เล่นคนใด จึงลดการสลับคนเมื่อยืนใกล้กัน</p></div>}
            {mode === "versus" && controlMode === "mouse" && <div className="mouse-ready-note glass-panel"><span>🖱️</span><div><strong>VS Mouse Mode พร้อม</strong><small>ผู้เล่น 1 และผู้เล่น 2 คลิกปุ่มคำตอบในฝั่งของตัวเองได้เลย ไม่ต้องสแกนมือ</small></div></div>}
            {mode === "solo" && controlMode === "hand" && <div className={`hand-setup-card glass-panel step-${handSetupStep}`}><div className="hand-setup-icon">{handSetupStep === 2 ? "✓" : "✋"}</div><div className="hand-setup-copy"><small>HAND SETUP</small><strong>{!cameraOn ? "เปิดกล้องก่อน" : !handModelReady ? "กำลังโหลดระบบมือ…" : handSetupStep === 0 ? "กล้องพร้อม — กดถัดไป" : handSetupStep === 1 ? "ยกฝ่ามือเพื่อสแกน" : "มือพร้อมใช้งานแล้ว"}</strong><span>{handSetupStep === 0 ? "ขั้นต่อไป ระบบจะสแกนรูปมือก่อนเปิดการปัดซ้าย/ขวา" : handSetupStep === 1 ? `ค้างฝ่ามือให้นิ่งประมาณ 1 วินาที · ${handScanProgress}%` : "ใช้นิ้วชี้เล็งปุ่มได้ · ปัดซ้าย/ขวา · จีบ · กำมือ · Power พร้อม"}</span>{handSetupStep === 1 && <div className="hand-scan-bar"><i style={{ width: `${handScanProgress}%` }} /></div>}</div></div>}
            <div className="hero-actions">{controlMode === "none" ? <button className="primary-button" disabled><Play size={20} /> เลือกวิธีควบคุมก่อน</button> : mode === "solo" && controlMode === "hand" && cameraOn && handModelReady && handSetupStep === 0 ? <button className="primary-button" onClick={beginHandScan}><Hand size={20} /> ถัดไป · สแกนมือ</button> : mode === "solo" && controlMode === "hand" && handSetupStep === 1 ? <button className="primary-button" disabled><Hand size={20} /> กำลังสแกนมือ {handScanProgress}%</button> : <button ref={startButtonRef} className="primary-button hand-start-button" onClick={beginGame} disabled={(controlMode === "hand" && mode === "versus" && !playerReady.every(Boolean)) || (controlMode === "hand" && mode === "solo" && !handReady)}><Play size={20} fill="currentColor" /> {mode === "versus" ? "เริ่มการแข่งขัน" : "เริ่มภารกิจ"}</button>}{controlMode === "hand" && !cameraOn && <button className="secondary-button" onClick={() => void startCamera()}><Camera size={20} /> เปิดกล้อง AR</button>}</div>
            {mode === "solo" && controlMode === "hand" && <div className="hand-ai-calibration-note"><span>☝️</span><div><strong>หลังสแกน ใช้นิ้วชี้เป็น Pointer ได้</strong><small>ชี้ค้างบนปุ่มประมาณ 0.7 วินาทีเพื่อกด · Gesture จะยังไม่ทำงานจนกว่าจะขึ้น “มือพร้อมใช้งาน”</small></div></div>}
            {controlMode === "hand" && <><small className="privacy-note"><ShieldCheck size={15} /> ภาพกล้องประมวลผลบนอุปกรณ์และไม่ถูกบันทึก</small><div className={`hand-status ${handReady ? "ready" : ""}`}><Hand size={16} /><span>{gestureLabel}</span></div></>}
            {controlMode === "mouse" && <div className="mouse-ready-note compact"><span>🖱️</span><div><strong>Mouse Mode พร้อมเล่น</strong><small>คลิก “ไม่สำคัญ / เก็บไว้” หรือคำตอบ Multiple Choice ได้โดยตรง</small></div></div>}
          </div>
          <div className="hero-orb" aria-hidden="true"><div className="orb-halo halo-one" /><div className="orb-halo halo-two" /><div className="orb-core"><span>AH</span></div><div className="float-label label-a"><Hand size={16} /> OPEN PALM <small>LOCK / START</small></div><div className="float-label label-b"><ArrowRight size={16} /> SWIPE <small>SMART TRACK</small></div><div className="float-label label-c"><Zap size={16} /> 2 HANDS <small>OWN POWER</small></div></div>
          <div className="level-ribbon glass-panel">{levels.map(item => <div key={item.id} className="ribbon-item"><span>0{item.id}</span><div><strong>{item.title}</strong><small>{item.subject}</small></div></div>)}</div>
        </div>}

        {screen === "game" && card && mode === "solo" && <div className="game-shell">{controlMode === "hand" && !handReady && <div className="hand-reconnect-overlay"><div className="hand-reconnect-card glass-panel"><span>✋</span><strong>{handSetupStep === 1 ? "กำลังสแกนมือ…" : "ระบบมือยังไม่พร้อม"}</strong><p>ยกฝ่ามือให้กล้องเห็นครบ 5 นิ้ว แล้วค้างประมาณ 1 วินาที</p><div className="hand-scan-bar"><i style={{ width: `${handScanProgress}%` }} /></div><small>{handScanProgress}%</small></div></div>}
          <aside className="mission-panel glass-panel"><div className="level-id">LEVEL 0{level.id}</div><p className="eyebrow">{level.eyebrow}</p><h2>{level.title}</h2><p>{level.mission}</p><div className="subject-chip"><span>{level.subjectIcon}</span><div><small>กำลังสร้างนามธรรมของ</small><strong>{level.subject}</strong></div></div><div className="enemy-card"><span>{level.id === 5 ? "🤖" : "👾"}</span><div><small>ตรวจพบศัตรู</small><strong>{level.enemy}</strong></div></div></aside>
          <section className="play-zone" aria-live="polite"><div className="timer-ring" style={{ "--timer": `${Math.min(100, timeLeft / 16 * 100)}%` } as CSSProperties}><span>{timeLeft}</span><small>วินาที</small></div>{questionMode(card) !== "mcq" && <div ref={floatingAnswerRef} className={`floating-answer-box ${ultraSpaceMode ? "ultra-space" : ""} ${players[0].feedback ? "answer-fast" : ""}`}><span className="answer-orbit orbit-a" /><span className="answer-orbit orbit-b" /><div className="floating-answer-icon">{card.icon}</div><div className="floating-answer-copy"><small>คำตอบ</small><strong>{card.label}</strong></div></div>}<div className={`data-card floating-question-card ${questionMode(card) !== "mcq" ? "question-only-card" : ""} ${players[0].feedback ? `motion-${players[0].feedback.motion} ${players[0].feedback.correct ? "is-correct" : "is-wrong"}` : ""}`}><span className="card-aura" /><span className="card-scan" /><div className="card-label">{questionMode(card) === "mcq" ? "MULTI CHOICE" : "QUESTION"} · {cardIndex + 1}/{deck.length}</div>{questionMode(card) === "mcq" ? <div className="card-icon">{card.icon}</div> : <span className="question-title">คำถาม</span>}{questionMode(card) === "mcq" && <h3>{card.label}</h3>}<p className={questionMode(card) !== "mcq" ? "question-prompt-only" : undefined}>{questionPrompt(card, level)}</p>{players[0].feedback && <span className={`score-pop ${players[0].feedback.correct ? "good" : "bad"}`}>{players[0].feedback.points > 0 ? "+" : ""}{players[0].feedback.points}</span>}</div>{questionMode(card) === "mcq" ? <div className="mcq-grid floating-answers">{(card.choices ?? []).map((choice, i) => <button key={`${choice}-${i}`} className={`mcq-option ${players[0].choiceIndex === i ? "selected" : ""}`} onClick={() => answerMcqForPlayer(0, i)} disabled={!!soloFeedback}><span>{String.fromCharCode(65 + i)}</span><strong>{choice}</strong>{players[0].choiceIndex === i && <em>เลือกอยู่</em>}</button>)}</div> : <div className="decision-buttons floating-answers"><button className="reject-button" onClick={() => classifyForPlayer(0, "noise")} disabled={!!soloFeedback}><ArrowLeft size={24} /><span>{card.leftLabel || "ไม่สำคัญ"}</span></button><button className="keep-button" onClick={() => classifyForPlayer(0, "essential")} disabled={!!soloFeedback}><span>{card.rightLabel || "เก็บไว้"}</span><ArrowRight size={24} /></button></div>}<button className="power-button" onClick={() => activatePower(0)} disabled={players[0].power === 0 || !!soloFeedback}><Zap size={17} fill="currentColor" /> Focus Vision<span>{players[0].power}</span></button></section>
          <aside className="hud-panel glass-panel"><div className="hud-score"><small>SCORE</small><strong>{players[0].score.toLocaleString("th-TH")}</strong></div><div className="hud-row"><span>ความแม่นยำ</span><strong>{soloAccuracy}%</strong></div><div className="accuracy-bar"><i style={{ width: `${soloAccuracy}%` }} /></div><div className="hud-row"><span>Combo</span><strong className="combo-text">×{players[0].combo}</strong></div><div className="life-row">{[0, 1, 2].map(life => <span key={life} className={life < players[0].lives ? "alive" : ""}>◆</span>)}</div><button className="pause-button" onClick={() => setPaused(v => !v)}>{paused ? <Play size={17} /> : <Pause size={17} />} {paused ? "เล่นต่อ" : "หยุดชั่วคราว"}</button><div className="gesture-tip"><Hand size={20} /><div><strong>Gesture Engine</strong><small>{gestureLabel}</small></div></div></aside>
          <div className="bottom-progress"><div><span style={{ width: `${progress}%` }} /></div><small>{Math.round(progress)}% ของภารกิจ</small></div>
          {soloFeedback && <div className="feedback-backdrop"><div ref={feedbackRef} className={`feedback-card ${soloFeedback.correct ? "correct" : "wrong"}`}><span className="feedback-icon">{soloFeedback.correct ? <Check size={31} /> : <X size={31} />}</span><p>{soloFeedback.correct ? "+ คะแนนความเข้าใจ" : "เรียนรู้จากข้อผิดพลาด"}</p><h3>{soloFeedback.title}</h3><div className="why-box"><strong>เพราะอะไร?</strong><span>{soloFeedback.body}</span></div><button ref={feedbackNextRef} className="primary-button hand-next-button" onClick={advanceCard}>ไปต่อ <ArrowRight size={19} /></button></div></div>}
        </div>}

        {screen === "game" && card && mode === "versus" && <div className="versus-game-shell">
          <div className="versus-topline"><div><span>LEVEL 0{level.id}</span><strong>{level.title}</strong></div><div className="versus-timer"><small>ROUND TIME</small><strong>{timeLeft}</strong></div><button className="pause-button" onClick={() => setPaused(v => !v)}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "เล่นต่อ" : "พักเกม"}</button></div>
          <div className="versus-lanes">
            {([0, 1] as PlayerId[]).map(player => { const p = players[player]; const name = player === 0 ? (studentName || "Player 1") : (player2Name || "Player 2"); return <section key={player} className={`versus-lane player-${player + 1} ${p.answered ? "answered" : ""}`}><div className="versus-player-hud"><div><span>P{player + 1}</span><strong>{name}</strong><small>{playerGesture[player]}</small></div><div className="versus-score"><small>SCORE</small><strong>{p.score}</strong><span>COMBO ×{p.combo}</span></div></div><div className={`versus-card floating-question-card ${p.feedback ? `motion-${p.feedback.motion} ${p.feedback.correct ? "is-correct" : "is-wrong"}` : ""}`}><span className="card-aura" /><div className="card-label">{questionMode(card) === "mcq" ? "MULTI CHOICE" : "DATA OBJECT"} · {cardIndex + 1}/{deck.length}</div><div className="card-icon">{card.icon}</div><h3>{card.label}</h3><p>{questionPrompt(card, level)}</p>{p.feedback && <span className={`score-pop ${p.feedback.correct ? "good" : "bad"}`}>{p.feedback.points > 0 ? "+" : ""}{p.feedback.points}</span>}{p.feedback ? <div className={`lane-feedback ${p.feedback.correct ? "correct" : "wrong"}`}>{p.feedback.correct ? <Check size={20} /> : <X size={20} />}<strong>{p.feedback.title}</strong></div> : <div className="lane-ready"><Hand size={18} /> {questionMode(card) === "mcq" ? "ปัดเพื่อเลื่อน · จีบ+กำเพื่อยืนยัน" : "ปัดประมาณ 1 ฝ่ามือ"}</div>}</div><div className={`lane-actions floating-lane-actions ${questionMode(card) === "mcq" ? "mcq-lane-actions" : ""}`}>{questionMode(card) === "mcq" ? <>{(card.choices ?? []).map((choice, i) => <button key={`${player}-${i}`} className={p.choiceIndex === i ? "selected" : ""} onClick={() => answerMcqForPlayer(player, i)} disabled={p.answered}><span>{String.fromCharCode(65 + i)}</span>{choice}</button>)}</> : <><button onClick={() => classifyForPlayer(player, "noise")} disabled={p.answered}><ArrowLeft size={20} /> {card.leftLabel || "ตัดออก"}</button><button onClick={() => classifyForPlayer(player, "essential")} disabled={p.answered}>{card.rightLabel || "เก็บไว้"} <ArrowRight size={20} /></button></>}</div><div className="lane-meta"><span>ชีวิต {"◆".repeat(p.lives)}{"◇".repeat(3 - p.lives)}</span><span><Zap size={14} /> Power {p.power}</span></div></section>; })}
          </div>
          <div className="versus-footer"><span>Player 1 ถูกล็อกกับมือของตัวเอง</span><strong>SAFE ZONE · มือข้ามกลางไม่สลับเจ้าของ</strong><span>Player 2 ถูกล็อกกับมือของตัวเอง</span></div>
          <div className="bottom-progress"><div><span style={{ width: `${progress}%` }} /></div><small>{Math.round(progress)}% ของการแข่งขัน</small></div>
        </div>}

        {paused && screen === "game" && <div className="pause-overlay"><div className="glass-panel"><Pause size={34} /><h3>หยุดเวลาแล้ว</h3><p>{mode === "versus" ? "ใช้ปุ่มเล่นต่อเพื่อให้ทั้งสองฝั่งเริ่มพร้อมกัน" : "ยกมือหรือกด P เพื่อกลับเข้าสู่ภารกิจ"}</p><button className="primary-button" onClick={() => setPaused(false)}><Play size={19} /> เล่นต่อ</button></div></div>}

        {screen === "summary" && <div className="summary-shell"><button className="back-link" onClick={() => setScreen("lobby")}><ChevronLeft size={18} /> หน้าหลัก</button>{mode === "solo" ? <section className="victory-card glass-panel"><div className="trophy-orb"><Trophy size={42} /></div><p className="eyebrow">MISSION COMPLETE</p><h1>โลกข้อมูลกลับมาชัดเจนแล้ว!</h1><p>{studentName || "Abstract Hero"} สามารถแยกแก่นสำคัญออกจากรายละเอียดที่ไม่จำเป็นได้</p><div className="stars">{stars.map((active, index) => <span key={index} className={active ? "active" : ""}>★</span>)}</div><div className="result-grid"><div><small>คะแนนรวม</small><strong>{players[0].score}</strong></div><div><small>ความแม่นยำ</small><strong>{soloAccuracy}%</strong></div><div><small>ตอบถูก</small><strong>{players[0].records.filter(r => r.correct).length}/{players[0].records.length}</strong></div></div><div className="summary-actions"><button className="primary-button" onClick={() => { void startCamera(); beginGame(); }}><RotateCcw size={19} /> เล่นอีกครั้ง</button><button className="secondary-button" onClick={() => window.print()}><GraduationCap size={19} /> พิมพ์ใบประกาศ</button></div></section> : <section className="victory-card versus-summary glass-panel"><div className="trophy-orb"><Swords size={42} /></div><p className="eyebrow">VS MATCH COMPLETE</p><h1>{winner === null ? "เสมอกัน!" : `ผู้ชนะ: ${winner === 0 ? (studentName || "Player 1") : (player2Name || "Player 2")}`}</h1><div className="versus-result-grid">{([0, 1] as PlayerId[]).map(player => { const p = players[player]; const accuracy = p.records.length ? Math.round(p.records.filter(r => r.correct).length / p.records.length * 100) : 0; return <div key={player} className={winner === player ? "winner" : ""}><span>P{player + 1}</span><h3>{player === 0 ? (studentName || "Player 1") : (player2Name || "Player 2")}</h3><strong>{p.score}</strong><small>แม่นยำ {accuracy}% · ถูก {p.records.filter(r => r.correct).length}/{p.records.length}</small></div>; })}</div><div className="summary-actions"><button className="primary-button" onClick={() => { void startCamera(); beginGame(); }}><RotateCcw size={19} /> แข่งอีกครั้ง</button><button className="secondary-button" onClick={() => setScreen("lobby")}><ChevronLeft size={19} /> เปลี่ยนผู้เล่น</button></div></section>}</div>}

        {screen === "teacher" && <div className="teacher-shell"><section className="teacher-dashboard glass-panel"><div className="teacher-heading"><div><p className="eyebrow">TEACHER CONTROL CENTER</p><h1>จัดการเกมและคลังคำถาม</h1><p>เพิ่มคำถามเอง · เพิ่มคำตอบเอง · บันทึกอัตโนมัติในเครื่อง</p></div><div className="dashboard-actions"><button className={`secondary-button ${teacherTab === "results" ? "active" : ""}`} onClick={() => setTeacherTab("results")}><BarChart3 size={18} /> ผลการเล่น</button><button className={`primary-button ${teacherTab === "questions" ? "active" : ""}`} onClick={() => setTeacherTab("questions")}><ListChecks size={18} /> คลังคำถาม</button></div></div>{teacherTab === "results" ? <><div className="metric-grid"><div><Users size={20} /><span><small>ผลการเล่นทั้งหมด</small><strong>{reports.length}</strong></span></div><div><Trophy size={20} /><span><small>คะแนนเฉลี่ย</small><strong>{reports.length ? Math.round(reports.reduce((sum, item) => sum + item.score, 0) / reports.length) : 0}</strong></span></div><div><BarChart3 size={20} /><span><small>ความแม่นยำเฉลี่ย</small><strong>{reports.length ? Math.round(reports.reduce((sum, item) => sum + item.accuracy, 0) / reports.length) : 0}%</strong></span></div><div><Swords size={20} /><span><small>ผลจากโหมด VS</small><strong>{reports.filter(item => item.mode === "versus").length}</strong></span></div></div><div className="dashboard-actions teacher-export"><button className="secondary-button" onClick={exportCsv} disabled={!reports.length}><Download size={18} /> Export CSV</button><button className="primary-button" onClick={openGoogleSheets} disabled={!reports.length}><FileSpreadsheet size={18} /> Google Sheets</button></div><div className="report-table-wrap"><table><thead><tr><th>ผู้เรียน</th><th>โหมด</th><th>คะแนน</th><th>ความแม่นยำ</th><th>ตอบถูก</th><th>เวลา</th></tr></thead><tbody>{reports.length ? reports.map(report => <tr key={report.id}><td><strong>{report.name}</strong><small>{report.date}</small></td><td>{report.mode === "versus" ? "VS" : "SOLO"}</td><td>{report.score}</td><td><span className={`accuracy-pill ${report.accuracy >= 80 ? "good" : ""}`}>{report.accuracy}%</span></td><td>{report.correct}/{report.total}</td><td>{Math.floor(report.seconds / 60)}:{String(report.seconds % 60).padStart(2, "0")}</td></tr>) : <tr><td colSpan={6} className="empty-report">ยังไม่มีผลการเล่น</td></tr>}</tbody></table></div></> : <div className="question-builder"><div className="question-builder-toolbar"><div><strong>คลังคำถาม {levels.reduce((sum,l)=>sum+l.items.length,0)} ข้อ</strong><small>รองรับ Classify ด้วย Swipe และ Multiple Choice ที่ปัดเพื่อเลื่อนคำตอบแล้วจีบ→กำเพื่อยืนยัน</small></div><div><button className="secondary-button" onClick={exportQuestionBank}><Download size={17} /> Export JSON</button><button className="secondary-button" onClick={() => importQuestionsRef.current?.click()}><Upload size={17} /> Import JSON</button><input ref={importQuestionsRef} type="file" accept="application/json,.json" hidden onChange={e => { void importQuestionBank(e.target.files?.[0]); e.currentTarget.value = ""; }} /><button className="secondary-button danger-soft" onClick={resetQuestionBank}><RotateCcw size={17} /> คืนค่าตัวอย่าง</button></div></div><div className="question-builder-grid"><form className="question-form" onSubmit={e => { e.preventDefault(); saveQuestionDraft(); }}><div className="form-title"><Plus size={19} /><div><strong>{questionDraft.editingId ? "แก้ไขคำถาม" : "เพิ่มคำถามใหม่"}</strong><small>ข้อมูลจะถูกบันทึกลง Browser อัตโนมัติ</small></div></div><label>ด่าน<select value={questionDraft.levelIndex} onChange={e => setQuestionDraft(d => ({ ...d, levelIndex: Number(e.target.value) }))}>{levels.map((lvl,i)=><option key={lvl.id} value={i}>ด่าน {i+1} · {lvl.title}</option>)}</select></label><label>ประเภทคำถาม<select value={questionDraft.mode} onChange={e => setQuestionDraft(d => ({ ...d, mode: e.target.value as QuestionMode }))}><option value="classify">Swipe 2 คำตอบ</option><option value="mcq">Multiple Choice 2–6 คำตอบ</option></select></label><div className="form-two"><label>ไอคอน<input value={questionDraft.icon} onChange={e => setQuestionDraft(d => ({ ...d, icon: e.target.value }))} /></label><label>ข้อความบนการ์ด<input value={questionDraft.label} onChange={e => setQuestionDraft(d => ({ ...d, label: e.target.value }))} placeholder="เช่น มี 4 ขา" /></label></div><label>คำถาม<input value={questionDraft.prompt} onChange={e => setQuestionDraft(d => ({ ...d, prompt: e.target.value }))} placeholder="ปล่อยว่างให้ระบบสร้างจากหัวข้อด่าน" /></label><label>คำอธิบายหลังตอบ<textarea value={questionDraft.detail} onChange={e => setQuestionDraft(d => ({ ...d, detail: e.target.value }))} placeholder="อธิบายเหตุผลของคำตอบ" /></label>{questionDraft.mode === "classify" ? <div className="classify-editor"><div className="form-two"><label>คำตอบซ้าย<input value={questionDraft.leftLabel} onChange={e => setQuestionDraft(d => ({ ...d, leftLabel: e.target.value }))} /></label><label>คำตอบขวา<input value={questionDraft.rightLabel} onChange={e => setQuestionDraft(d => ({ ...d, rightLabel: e.target.value }))} /></label></div><label className="correct-toggle">คำตอบที่ถูก<select value={questionDraft.essential ? "right" : "left"} onChange={e => setQuestionDraft(d => ({ ...d, essential: e.target.value === "right" }))}><option value="left">ซ้าย · {questionDraft.leftLabel}</option><option value="right">ขวา · {questionDraft.rightLabel}</option></select></label></div> : <div className="choice-editor"><div className="choice-editor-head"><strong>คำตอบหลายตัวเลือก</strong><button type="button" onClick={() => setQuestionDraft(d => d.choices.length >= 6 ? d : ({ ...d, choices: [...d.choices, `คำตอบ ${d.choices.length + 1}`] }))}><Plus size={15} /> เพิ่มคำตอบ</button></div>{questionDraft.choices.map((choice,i)=><div className={`choice-row ${questionDraft.correctChoice === i ? "correct" : ""}`} key={i}><button type="button" className="choice-correct" onClick={() => setQuestionDraft(d => ({ ...d, correctChoice: i }))}>{questionDraft.correctChoice === i ? <Check size={16}/> : String.fromCharCode(65+i)}</button><input value={choice} onChange={e => setQuestionDraft(d => ({ ...d, choices: d.choices.map((v,ci)=>ci===i?e.target.value:v) }))} /><button type="button" className="choice-delete" disabled={questionDraft.choices.length <= 2} onClick={() => setQuestionDraft(d => { const next=d.choices.filter((_,ci)=>ci!==i); return { ...d, choices: next, correctChoice: clamp(d.correctChoice > i ? d.correctChoice - 1 : d.correctChoice,0,next.length-1) }; })}><Trash2 size={15}/></button></div>)}</div>}<div className="question-form-actions"><button type="submit" className="primary-button"><Save size={17} /> {questionDraft.editingId ? "บันทึกการแก้ไข" : "เพิ่มคำถาม"}</button>{questionDraft.editingId && <button type="button" className="secondary-button" onClick={() => setQuestionDraft(blankQuestionDraft())}>ยกเลิก</button>}</div></form><div className="question-bank-list">{levels.map((lvl,li)=><section className="question-level" key={lvl.id}><header><span>0{li+1}</span><div><strong>{lvl.title}</strong><small>{lvl.subject} · {lvl.items.length} ข้อ</small></div></header><div>{lvl.items.length ? lvl.items.map((item,qi)=><article className="question-bank-card" key={item.id || qi}><div className="question-bank-icon">{item.icon}</div><div className="question-bank-copy"><span>{questionMode(item) === "mcq" ? `MCQ · ${item.choices?.length ?? 0} คำตอบ` : "SWIPE · 2 คำตอบ"}</span><strong>{item.label}</strong><p>{questionPrompt(item,lvl)}</p><small>{item.detail}</small></div><div className="question-bank-actions"><button onClick={() => editQuestion(li,item)}>แก้ไข</button><button className="danger" onClick={() => deleteQuestion(li,item.id)}><Trash2 size={15}/></button></div></article>) : <div className="empty-question-level">ยังไม่มีคำถามในด่านนี้</div>}</div></section>)}</div></div></div>}</section></div>}
      </section>
    </main>
  );
}


const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("ไม่พบ #root สำหรับเริ่ม Abstract Hero AR");
createRoot(rootElement).render(<Home />);
