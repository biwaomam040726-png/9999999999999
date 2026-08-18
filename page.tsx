import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import {
  Accessibility, ArrowLeft, ArrowRight, BarChart3, Camera, Check, ChevronLeft,
  Download, FileSpreadsheet, Gamepad2, GraduationCap, Hand, Keyboard, LogOut,
  Pause, Play, RotateCcw, Settings, ShieldCheck, Sparkles, Swords, Trophy, Users,
  Volume2, VolumeX, X, Zap,
} from "lucide-react";
import * as THREE from "three";
import { gsap } from "gsap";

type Screen = "lobby" | "game" | "summary" | "teacher";
type GameMode = "solo" | "versus";
type PlayerId = 0 | 1;
type AnswerKind = "essential" | "noise";
type CardItem = { label: string; detail: string; essential: boolean; icon: string };
type Level = { id: number; eyebrow: string; title: string; mission: string; subject: string; subjectIcon: string; enemy: string; items: CardItem[] };
type AnswerRecord = CardItem & { level: number; correct: boolean; chosen: AnswerKind; timeout?: boolean };
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
  feedback: null | { correct: boolean; title: string };
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
};

type GestureAction = {
  screen: Screen;
  mode: GameMode;
  paused: boolean;
  soloFeedback: unknown;
  beginGame: () => void;
  classify: (player: PlayerId, kind: AnswerKind) => void;
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

const EMPTY_PLAYER = (): PlayerGame => ({ score: 0, combo: 0, lives: 3, power: 2, answered: false, feedback: null, records: [] });
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
  const [screen, setScreen] = useState<Screen>("lobby"); const [mode, setMode] = useState<GameMode>("solo");
  const [studentName, setStudentName] = useState(""); const [player2Name, setPlayer2Name] = useState("");
  const [levelIndex, setLevelIndex] = useState(0); const [deck, setDeck] = useState<CardItem[]>(() => shuffle(LEVELS[0].items)); const [cardIndex, setCardIndex] = useState(0); const [timeLeft, setTimeLeft] = useState(14);
  const [players, setPlayers] = useState<[PlayerGame, PlayerGame]>([EMPTY_PLAYER(), EMPTY_PLAYER()]); const playersRef = useRef(players); useEffect(() => { playersRef.current = players; }, [players]);
  const [paused, setPaused] = useState(false); const [soloFeedback, setSoloFeedback] = useState<{ correct: boolean; title: string; body: string } | null>(null); const [burst, setBurst] = useState(0);
  const [cameraOn, setCameraOn] = useState(false); const [cameraMessage, setCameraMessage] = useState("กำลังเตรียมกล้อง…"); const [soundOn, setSoundOn] = useState(true); const [voiceOn, setVoiceOn] = useState(true);
  const [largeText, setLargeText] = useState(false); const [colorBlind, setColorBlind] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false);
  const [gestureLabel, setGestureLabel] = useState("กำลังเตรียม Hand AI"); const [handReady, setHandReady] = useState(false); const [handSelected, setHandSelected] = useState(false);
  const [playerReady, setPlayerReady] = useState<[boolean, boolean]>([false, false]); const playerReadyRef = useRef(playerReady); useEffect(() => { playerReadyRef.current = playerReady; }, [playerReady]);
  const [playerGesture, setPlayerGesture] = useState<[string, string]>(["รอมือผู้เล่น 1", "รอมือผู้เล่น 2"]);
  const [xrSupported, setXrSupported] = useState(false); const [xrActive, setXrActive] = useState(false); const [reports, setReports] = useState<StudentReport[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null); const feedbackRef = useRef<HTMLDivElement>(null); const cursorRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)] as const;
  const xrRendererRef = useRef<THREE.WebGLRenderer | null>(null); const startTimeRef = useRef(0); const actionRef = useRef<GestureAction | null>(null); const playSound = useSound(soundOn); const roundAdvanceRef = useRef<number | null>(null);
  const level = LEVELS[levelIndex]; const card = deck[cardIndex];
  const totalQuestions = LEVELS.reduce((sum, item) => sum + item.items.length, 0); const completedQuestions = LEVELS.slice(0, levelIndex).reduce((sum, item) => sum + item.items.length, 0) + cardIndex; const progress = completedQuestions / totalQuestions * 100;
  const soloAccuracy = players[0].records.length ? Math.round(players[0].records.filter((record) => record.correct).length / players[0].records.length * 100) : 100;
  const onRendererReady = useCallback((renderer: THREE.WebGLRenderer | null) => { xrRendererRef.current = renderer; }, []);

  const speak = useCallback((text: string) => { if (!voiceOn || typeof window === "undefined" || !("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "th-TH"; utterance.rate = .95; window.speechSynthesis.speak(utterance); }, [voiceOn]);
  const stopCamera = useCallback(() => { const stream = videoRef.current?.srcObject as MediaStream | null; stream?.getTracks().forEach((track) => track.stop()); if (videoRef.current) videoRef.current.srcObject = null; setCameraOn(false); }, []);
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraMessage("อุปกรณ์นี้ไม่รองรับกล้อง — เล่นด้วยสัมผัสได้"); return false; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: false });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraOn(true); setCameraMessage("Camera AR พร้อมใช้งาน"); return true;
    } catch { setCameraOn(false); setCameraMessage("กล้องถูกปิด — ยังเล่นด้วยปุ่มหรือคีย์บอร์ดได้"); return false; }
  }, []);

  useEffect(() => { const task = window.setTimeout(() => void startCamera(), 0); return () => { window.clearTimeout(task); stopCamera(); }; }, [startCamera, stopCamera]);
  useEffect(() => {
    const task = window.setTimeout(() => { try { const saved = localStorage.getItem("abstract-hero-reports"); if (saved) setReports(JSON.parse(saved) as StudentReport[]); } catch { /* optional */ } }, 0);
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr; if (xr) void xr.isSessionSupported("immersive-ar").then(setXrSupported).catch(() => setXrSupported(false));
    return () => window.clearTimeout(task);
  }, []);

  const saveReport = useCallback((player: PlayerGame, name: string) => {
    const total = player.records.length; const accuracy = total ? Math.round(player.records.filter(r => r.correct).length / total * 100) : 0;
    const report: StudentReport = { id: Date.now() + Math.random(), name: name.trim() || "Abstract Hero", score: player.score, accuracy, correct: player.records.filter(r => r.correct).length, total, seconds: Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)), level: 5, date: new Date().toLocaleString("th-TH"), mode };
    setReports(current => { const next = [report, ...current].slice(0, 80); try { localStorage.setItem("abstract-hero-reports", JSON.stringify(next)); } catch { /* optional */ } return next; });
  }, [mode]);

  const finishGame = useCallback(() => {
    const finalPlayers = playersRef.current; saveReport(finalPlayers[0], studentName || (mode === "versus" ? "Player 1" : "Abstract Hero")); if (mode === "versus") saveReport(finalPlayers[1], player2Name || "Player 2");
    setScreen("summary"); playSound("victory"); speak(mode === "versus" ? "การแข่งขันจบแล้ว มาดูผลผู้ชนะกัน" : "ภารกิจสำเร็จ เธอแยกข้อมูลสำคัญออกจากรายละเอียดที่ไม่จำเป็นได้แล้ว");
  }, [mode, playSound, player2Name, saveReport, speak, studentName]);

  const resetRoundState = useCallback(() => {
    setSoloFeedback(null); setPlayers(current => [{ ...current[0], answered: false, feedback: null }, { ...current[1], answered: false, feedback: null }]); setHandSelected(false);
  }, []);

  const advanceCard = useCallback(() => {
    if (roundAdvanceRef.current) { window.clearTimeout(roundAdvanceRef.current); roundAdvanceRef.current = null; }
    resetRoundState();
    if (cardIndex < deck.length - 1) {
      setCardIndex(value => value + 1); const accuracy = soloAccuracy; const adaptiveTime = accuracy >= 85 ? 11 : accuracy < 60 ? 16 : 13; setTimeLeft(levelIndex === 4 ? Math.max(8, adaptiveTime - 2) : adaptiveTime); return;
    }
    if (levelIndex < LEVELS.length - 1) {
      const nextLevel = levelIndex + 1; setLevelIndex(nextLevel); setDeck(shuffle(LEVELS[nextLevel].items)); setCardIndex(0); setTimeLeft(nextLevel === 4 ? 10 : 13); setPlayers(current => [{ ...current[0], combo: 0, power: Math.min(3, current[0].power + 1) }, { ...current[1], combo: 0, power: Math.min(3, current[1].power + 1) }]); speak(`เข้าสู่ด่านที่ ${nextLevel + 1} ${LEVELS[nextLevel].title}`); return;
    }
    finishGame();
  }, [cardIndex, deck.length, finishGame, levelIndex, resetRoundState, soloAccuracy, speak]);

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
      next[player] = { ...p, score: Math.max(0, p.score + points), combo: nextCombo, lives: correct ? p.lives : Math.max(0, p.lives - 1), answered: true, feedback: { correct, title: feedbackTitle }, records: [...p.records, record] };
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

  const activatePower = useCallback((player: PlayerId) => {
    const p = playersRef.current[player]; if (!card || p.power <= 0 || screen !== "game" || p.answered || paused) return;
    setPlayers(current => { const next = [...current] as [PlayerGame, PlayerGame]; next[player] = { ...next[player], power: Math.max(0, next[player].power - 1) }; playersRef.current = next; return next; });
    setTimeLeft(value => value + 6); playSound("power"); if (mode === "solo") speak(card.essential ? "โฟกัสวิชันตรวจพบแก่นสำคัญ" : "โฟกัสวิชันตรวจพบรายละเอียดที่ตัดออกได้");
  }, [card, mode, paused, playSound, screen, speak]);

  const beginGame = useCallback(() => {
    startTimeRef.current = Date.now(); setLevelIndex(0); setDeck(shuffle(LEVELS[0].items)); setCardIndex(0); setTimeLeft(14); setPlayers([EMPTY_PLAYER(), EMPTY_PLAYER()]); setSoloFeedback(null); setPaused(false); setScreen("game"); playSound("power"); speak(mode === "versus" ? "เริ่มการแข่งขัน ผู้เล่นหนึ่งฝั่งซ้าย ผู้เล่นสองฝั่งขวา ปัดมือเฉพาะการ์ดของตัวเอง" : "ยินดีต้อนรับ Abstract Hero ปัดขวาเพื่อเก็บข้อมูลสำคัญ และปัดซ้ายเพื่อตัดรายละเอียดที่ไม่จำเป็น");
  }, [mode, playSound, speak]);

  useEffect(() => {
    if (screen !== "game" || paused || (mode === "solo" && soloFeedback)) return;
    const timer = window.setInterval(() => setTimeLeft(value => {
      if (value > 1) return value - 1;
      window.clearInterval(timer);
      if (mode === "solo") {
        const fallback: AnswerKind = card?.essential ? "noise" : "essential"; window.setTimeout(() => classifyForPlayer(0, fallback), 0);
      } else {
        const current = playersRef.current; const fallback: AnswerKind = card?.essential ? "noise" : "essential";
        if (!current[0].answered) window.setTimeout(() => classifyForPlayer(0, fallback), 0);
        if (!current[1].answered) window.setTimeout(() => classifyForPlayer(1, fallback), 0);
        window.setTimeout(() => scheduleAdvance(850), 50);
      }
      return 0;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [card?.essential, classifyForPlayer, mode, paused, scheduleAdvance, screen, soloFeedback]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (screen === "lobby" && event.key === "Enter" && (mode === "solo" || playerReadyRef.current.every(Boolean))) beginGame();
      if (screen !== "game") return;
      if (mode === "solo") { if (event.key === "ArrowLeft") classifyForPlayer(0, "noise"); if (event.key === "ArrowRight") classifyForPlayer(0, "essential"); if (event.code === "Space") { event.preventDefault(); activatePower(0); } }
      else { if (event.key.toLowerCase() === "a") classifyForPlayer(0, "noise"); if (event.key.toLowerCase() === "d") classifyForPlayer(0, "essential"); if (event.key === "ArrowLeft") classifyForPlayer(1, "noise"); if (event.key === "ArrowRight") classifyForPlayer(1, "essential"); }
      if (event.key.toLowerCase() === "p") setPaused(value => !value);
    };
    window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey);
  }, [activatePower, beginGame, classifyForPlayer, mode, screen]);

  useEffect(() => { actionRef.current = { screen, mode, paused, soloFeedback, beginGame, classify: classifyForPlayer, usePower: activatePower, togglePause: () => setPaused(value => !value) }; }, [activatePower, beginGame, classifyForPlayer, mode, paused, screen, soloFeedback]);

  // Robust hand tracking + gesture state machine.
  useEffect(() => {
    if (!cameraOn || !videoRef.current) return;
    let cancelled = false; let animationFrame = 0; let landmarker: { detectForVideo: (video: HTMLVideoElement, now: number) => HandResult; close: () => void } | null = null;
    let lastVideoTime = -1; let nextTrackId = 1; let lastInferenceAt = 0; let lastLabel = "";
    const tracks = new Map<number, HandTrack>(); const primaryByPlayer: [number | null, number | null] = [null, null]; const powerHoldSince: [number, number] = [0, 0]; const powerLatched: [boolean, boolean] = [false, false];

    const setLabel = (label: string) => { if (label !== lastLabel) { lastLabel = label; setGestureLabel(label); } };
    const setPlayerLabel = (player: PlayerId, label: string) => setPlayerGesture(current => { if (current[player] === label) return current; const next = [...current] as [string, string]; next[player] = label; return next; });
    const ownerZone = (x: number): PlayerId | null => x <= .43 ? 0 : x >= .57 ? 1 : null;
    const canActAtX = (owner: PlayerId, x: number) => owner === 0 ? x < .64 : x > .36;

    const boot = async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const wasm = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const options = {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" as const },
          runningMode: "VIDEO" as const,
          numHands: mode === "versus" ? 4 : 2,
          minHandDetectionConfidence: .5,
          minHandPresenceConfidence: .5,
          minTrackingConfidence: .5,
        };
        try { landmarker = await vision.HandLandmarker.createFromOptions(wasm, options) as typeof landmarker; }
        catch { landmarker = await vision.HandLandmarker.createFromOptions(wasm, { ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" as const } }) as typeof landmarker; }
        if (cancelled || !landmarker) { landmarker?.close(); return; }
        setHandReady(true); setLabel(mode === "versus" ? "Hand AI พร้อม · ยกฝ่ามือในฝั่งของตัวเองเพื่อ Lock Player" : "Hand AI พร้อม · แสดงมือหน้ากล้อง");
      } catch { if (!cancelled) { setHandReady(false); setLabel("Hand AI เปิดไม่สำเร็จ · ยังใช้ปุ่ม/คีย์บอร์ดได้"); } return; }

      const loop = () => {
        if (cancelled || !landmarker || !videoRef.current) return;
        const video = videoRef.current; const now = performance.now();
        // Cap hand inference near 30fps. This makes the gesture history time-based and reduces UI jitter.
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastInferenceAt >= 28) {
          lastInferenceAt = now; lastVideoTime = video.currentTime;
          const result = landmarker.detectForVideo(video, now); const hands = result.landmarks ?? []; const handedness = result.handedness ?? [];
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
              track = { id: nextTrackId++, owner: mode === "solo" ? 0 : null, primary: mode === "solo" && primaryByPlayer[0] === null, candidateOwner: null, candidateSince: 0, lastSeen: now, handedness: obs.handedness, x: obs.x, y: obs.y, palmWidth: obs.palmWidth, trail: [], lastActionAt: 0, armed: true, neutralSince: now, pinchState: false, pinchOnFrames: 0, pinchOffFrames: 0, selectedLatch: false, fistSince: 0, openSince: 0, raisedSince: 0 };
              if (track.primary) primaryByPlayer[0] = track.id; tracks.set(track.id, track);
            }
            used.add(track.id); track.lastSeen = now; track.handedness = obs.handedness; track.x = track.x * .58 + obs.x * .42; track.y = track.y * .58 + obs.y * .42; track.palmWidth = track.palmWidth * .7 + obs.palmWidth * .3;

            const ext = fingerCount(obs.hand); const pinchRatio = distance(obs.hand[4], obs.hand[8]) / Math.max(.035, obs.palmWidth); const fist = ext <= 1 && [8, 12, 16, 20].reduce((sum, i) => sum + distance(obs.hand[i], obs.hand[0]), 0) / 4 < [5, 9, 13, 17].reduce((sum, i) => sum + distance(obs.hand[i], obs.hand[0]), 0) / 4 * 1.55;
            const open = ext >= 3 && !fist && pinchRatio > .55;

            // Pinch hysteresis: requires multiple frames to engage/release.
            if (!track.pinchState) { track.pinchOnFrames = pinchRatio < .48 ? track.pinchOnFrames + 1 : 0; if (track.pinchOnFrames >= 3) { track.pinchState = true; track.pinchOffFrames = 0; } }
            else { track.pinchOffFrames = pinchRatio > .62 ? track.pinchOffFrames + 1 : 0; if (track.pinchOffFrames >= 3) { track.pinchState = false; track.pinchOnFrames = 0; } }
            track.openSince = open ? (track.openSince || now) : 0; track.fistSince = fist ? (track.fistSince || now) : 0;

            // VS calibration / re-acquisition. A primary hand is only acquired inside its own home zone with an open palm.
            if (mode === "versus" && track.owner === null) {
              const candidate = ownerZone(track.x);
              if (candidate !== null && open && primaryByPlayer[candidate] === null) {
                if (track.candidateOwner !== candidate) { track.candidateOwner = candidate; track.candidateSince = now; }
                if (now - track.candidateSince >= 520) { track.owner = candidate; track.primary = true; primaryByPlayer[candidate] = track.id; setPlayerReady(current => { if (current[candidate]) return current; const next = [...current] as [boolean, boolean]; next[candidate] = true; return next; }); setPlayerLabel(candidate, `LOCKED · ${track.handedness === "Unknown" ? "มือหลัก" : track.handedness}`); }
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
            const cursor = cursorRefs[owner].current; if (track.primary && cursor) { cursor.style.opacity = "1"; cursor.style.transform = `translate(${track.x * innerWidth}px,${track.y * innerHeight}px)`; }
            if (!track.primary) return; // Only the locked primary hand may classify cards.

            track.trail.push({ x: track.x, y: track.y, at: now }); while (track.trail.length && now - track.trail[0].at > 680) track.trail.shift();
            const recentNeutral = track.trail.filter(s => now - s.at <= 150); const neutralDx = recentNeutral.length > 1 ? Math.abs(recentNeutral[recentNeutral.length - 1].x - recentNeutral[0].x) : 0;
            if (!track.armed && now - track.lastActionAt > 260 && neutralDx < .028 && !track.pinchState && !fist) { if (!track.neutralSince) track.neutralSince = now; if (now - track.neutralSince > 100) track.armed = true; } else if (neutralDx >= .028) track.neutralSince = 0;

            if (active.screen === "lobby") {
              if (mode === "solo" && open && track.openSince && now - track.openSince > 650 && now - track.lastActionAt > 1100) { setLabel("Open Palm · START"); active.beginGame(); track.lastActionAt = now; track.openSince = 0; }
              return;
            }
            if (active.screen !== "game" || (mode === "solo" && active.soloFeedback)) return;

            // Raise open palm to pause in solo only. VS pause remains a shared explicit control to avoid one player stopping the race.
            if (mode === "solo" && open && track.y < .27) {
              track.raisedSince = track.raisedSince || now;
              if (now - track.raisedSince > 500 && now - track.lastActionAt > 700) { setLabel("Raise Palm · PAUSE"); active.togglePause(); track.lastActionAt = now; track.raisedSince = 0; track.armed = false; }
            } else track.raisedSince = 0;
            if (active.paused || playersRef.current[owner].answered || !canActAtX(owner, track.x)) return;

            // Pinch -> select. Fist after pinch -> keep. Both use time hysteresis, not one-frame poses.
            if (track.pinchState) { track.selectedLatch = true; setHandSelected(true); setPlayerLabel(owner, "PINCH · เลือกการ์ด"); if (mode === "solo") setLabel("Pinch · เลือกการ์ด"); }
            if (track.selectedLatch && fist && track.fistSince && now - track.fistSince > 230 && now - track.lastActionAt > 360) {
              setPlayerLabel(owner, "FIST · เก็บข้อมูล"); active.classify(owner, "essential"); track.selectedLatch = false; track.lastActionAt = now; track.armed = false; track.trail.length = 0; setHandSelected(false); return;
            }

            // Swipe = roughly one palm width, horizontal-dominant, velocity constrained, one-shot until neutral re-arm.
            if (!track.armed || track.pinchState || fist || ext < 2 || now - track.lastActionAt < 360 || track.trail.length < 4) return;
            const windowSamples = track.trail.filter(s => now - s.at <= 560); if (windowSamples.length < 4) return;
            let min = windowSamples[0]; let max = windowSamples[0]; windowSamples.forEach(s => { if (s.x < min.x) min = s; if (s.x > max.x) max = s; });
            const currentSample = windowSamples[windowSamples.length - 1]; const rightDx = currentSample.x - min.x; const leftDx = max.x - currentSample.x; const dir = rightDx >= leftDx ? 1 : -1; const start = dir > 0 ? min : max; const dx = currentSample.x - start.x; const dy = currentSample.y - start.y; const duration = Math.max(1, (currentSample.at - start.at) / 1000); const velocity = Math.abs(dx) / duration;
            const threshold = clamp(track.palmWidth * 1.02, .095, .165);
            if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.45 && duration >= .11 && duration <= .56 && velocity >= .24) {
              const kind: AnswerKind = dx > 0 ? "essential" : "noise"; const label = dx > 0 ? "SWIPE RIGHT · เก็บ" : "SWIPE LEFT · ตัด";
              setPlayerLabel(owner, label); if (mode === "solo") setLabel(label); active.classify(owner, kind); track.lastActionAt = now; track.armed = false; track.neutralSince = 0; track.trail.length = 0; track.selectedLatch = false; setHandSelected(false);
            }
          });

          // Hide cursors for missing primaries and allow controlled re-acquisition after a real loss.
          ([0, 1] as PlayerId[]).forEach(owner => {
            const pid = primaryByPlayer[owner]; const primary = pid ? tracks.get(pid) : null;
            if (!primary || now - primary.lastSeen > 280) { if (cursorRefs[owner].current) cursorRefs[owner].current!.style.opacity = "0"; }
            if (primary && now - primary.lastSeen > 1650) { primary.primary = false; primary.owner = null; primaryByPlayer[owner] = null; if (mode === "versus") { setPlayerReady(current => { const next = [...current] as [boolean, boolean]; next[owner] = false; return next; }); setPlayerLabel(owner, "หลุดการติดตาม · ยกฝ่ามือในฝั่งตัวเองเพื่อล็อกใหม่"); } }
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
        animationFrame = requestAnimationFrame(loop);
      };
      loop();
    };
    void boot();
    return () => { cancelled = true; cancelAnimationFrame(animationFrame); landmarker?.close(); setHandReady(false); };
  }, [cameraOn, mode]);

  const startWebXR = useCallback(async () => {
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr; const renderer = xrRendererRef.current;
    if (!xr || !renderer) { setCameraMessage("WebXR ไม่พร้อม — ใช้ Camera AR แทน"); return; }
    try { const session = await xr.requestSession("immersive-ar", { requiredFeatures: ["local"], optionalFeatures: ["local-floor", "dom-overlay"], domOverlay: { root: document.body } }); await renderer.xr.setSession(session as never); setXrActive(true); setCameraMessage("WebXR Immersive AR ทำงานอยู่"); session.addEventListener("end", () => { setXrActive(false); setCameraMessage("Camera AR พร้อมใช้งาน"); }); }
    catch { setCameraMessage("เปิด WebXR ไม่สำเร็จ — ใช้ Camera AR ต่อได้"); }
  }, []);

  const exitGame = useCallback(() => { if (roundAdvanceRef.current) window.clearTimeout(roundAdvanceRef.current); setPaused(false); setSoloFeedback(null); setScreen("lobby"); setPlayers([EMPTY_PLAYER(), EMPTY_PLAYER()]); setTimeLeft(14); }, []);
  const exportCsv = useCallback(() => { const rows = [["ชื่อผู้เรียน", "โหมด", "คะแนน", "ความแม่นยำ", "ตอบถูก", "จำนวนข้อ", "เวลา (วินาที)", "ด่านสูงสุด", "วันที่"], ...reports.map(r => [r.name, r.mode ?? "solo", r.score, `${r.accuracy}%`, r.correct, r.total, r.seconds, r.level, r.date])]; const csv = "\uFEFF" + rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "abstract-hero-learning-report.csv"; link.click(); URL.revokeObjectURL(url); }, [reports]);
  const openGoogleSheets = useCallback(() => { const rows = [["ชื่อผู้เรียน", "โหมด", "คะแนน", "ความแม่นยำ", "ตอบถูก", "จำนวนข้อ", "เวลา (วินาที)", "ด่านสูงสุด", "วันที่"], ...reports.map(r => [r.name, r.mode ?? "solo", r.score, `${r.accuracy}%`, r.correct, r.total, r.seconds, r.level, r.date])]; void navigator.clipboard?.writeText(rows.map(row => row.join("\t")).join("\n")); window.open("https://sheets.new", "_blank", "noopener,noreferrer"); setGestureLabel("คัดลอกรายงานแล้ว · วางใน Google Sheets ได้ทันที"); }, [reports]);

  const winner = mode === "versus" ? (players[0].score === players[1].score ? null : players[0].score > players[1].score ? 0 : 1) : 0;
  const stars = useMemo(() => { const value = soloAccuracy >= 90 ? 3 : soloAccuracy >= 70 ? 2 : 1; return Array.from({ length: 3 }, (_, i) => i < value); }, [soloAccuracy]);

  return (
    <main className={`${largeText ? "large-text" : ""} ${colorBlind ? "color-blind" : ""} ${mode === "versus" ? "versus-mode" : ""}`}>
      <section className="ar-stage" aria-label="พื้นที่เล่นเกม Abstract Hero AR">
        <video ref={videoRef} className={`camera-feed ${cameraOn ? "is-on" : ""}`} muted playsInline aria-label="ภาพจากกล้องของผู้เล่น" />
        <div className="camera-vignette" /><div className="scanlines" /><HologramScene burst={burst} onRendererReady={onRendererReady} />
        <div ref={cursorRefs[0]} className={`hand-cursor player-one-cursor ${handSelected ? "pinched" : ""}`}><span /></div>
        {mode === "versus" && <div ref={cursorRefs[1]} className="hand-cursor player-two-cursor"><span /></div>}
        {mode === "versus" && <div className="player-zone-overlay" aria-hidden="true"><div className="zone-left">P1</div><div className="zone-dead"><span>SAFE<br />ZONE</span></div><div className="zone-right">P2</div></div>}

        <header className="topbar glass-panel">
          <button className="brand" onClick={() => setScreen("lobby")} aria-label="กลับหน้าหลัก"><span className="brand-mark"><Sparkles size={18} /></span><span><strong>ABSTRACT</strong><small>HERO AR</small></span></button>
          <div className="top-status" aria-live="polite"><span className={`status-dot ${cameraOn && handReady ? "active" : ""}`} />{handReady ? `HAND AI ACTIVE · ${gestureLabel}` : cameraMessage}</div>
          <nav className="top-actions" aria-label="เครื่องมือ">
            {screen === "game" && <button className="exit-game-button" onClick={exitGame}><LogOut size={17} /><span>ออกจากเกม</span></button>}
            <button className="teacher-nav-button" onClick={() => setScreen(screen === "teacher" ? "lobby" : "teacher")}><BarChart3 size={17} /><span>สำหรับครู</span></button>
            {xrSupported && <button className={`xr-button ${xrActive ? "active" : ""}`} onClick={() => void startWebXR()}><Sparkles size={16} /><span>{xrActive ? "AR ACTIVE" : "ENTER AR"}</span></button>}
            <button className="icon-button" onClick={() => setSoundOn(v => !v)} aria-label={soundOn ? "ปิดเสียง" : "เปิดเสียง"}>{soundOn ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
            <button className="icon-button" onClick={() => setSettingsOpen(v => !v)} aria-label="ตั้งค่าการเข้าถึง"><Settings size={19} /></button>
          </nav>
        </header>

        {settingsOpen && <aside className="settings-panel glass-panel" aria-label="ตั้งค่าการเข้าถึง"><div className="panel-heading"><Accessibility size={18} /><strong>การเข้าถึง</strong></div><label><span>ตัวอักษรขนาดใหญ่</span><input type="checkbox" checked={largeText} onChange={e => setLargeText(e.target.checked)} /></label><label><span>โหมดแยกสี</span><input type="checkbox" checked={colorBlind} onChange={e => setColorBlind(e.target.checked)} /></label><label><span>เสียงบรรยายไทย</span><input type="checkbox" checked={voiceOn} onChange={e => setVoiceOn(e.target.checked)} /></label></aside>}

        {screen !== "teacher" && <div className={`hand-ai-visible-hud ${handReady ? "is-ready" : ""}`} aria-live="polite"><div className="hand-ai-state"><span className="hand-ai-icon">✋</span><span><strong>{handReady ? "HAND AI ACTIVE" : "กำลังเปิด HAND AI"}</strong><small>{gestureLabel}</small></span></div><div className="hand-command-row"><div className="hand-command"><b>👈</b><span>ปัดซ้าย</span><em>ตัดออก</em></div><div className="hand-command"><b>👉</b><span>ปัดขวา</span><em>เก็บไว้</em></div><div className="hand-command"><b>🤏</b><span>จีบนิ้ว</span><em>เลือก</em></div><div className="hand-command"><b>✊</b><span>กำมือ</span><em>เก็บ</em></div><div className="hand-command"><b>✋</b><span>ยกฝ่ามือ</span><em>Pause/Start</em></div><div className="hand-command"><b>🙌</b><span>สองมือ</span><em>Power</em></div></div></div>}

        {screen === "lobby" && <div className="lobby-shell">
          <div className="hero-copy">
            <div className="mission-tag"><span /> ภารกิจฝึก Abstraction</div><h1>มองให้เห็น<br /><em>“แก่นสำคัญ”</em></h1>
            <p>ระบบ Gesture Engine ใหม่จะล็อกมือผู้เล่น ลดการปัดไม่ติด และป้องกันผู้เล่นอีกฝั่งมาควบคุมการ์ดของเรา</p>
            <div className="mode-switch" role="group" aria-label="เลือกโหมดเกม"><button className={mode === "solo" ? "active" : ""} onClick={() => { setMode("solo"); setPlayerReady([false, false]); }}><Gamepad2 size={18} /> SOLO</button><button className={mode === "versus" ? "active" : ""} onClick={() => { setMode("versus"); setPlayerReady([false, false]); }}><Swords size={18} /> VS 2 PLAYERS</button></div>
            <div className={`player-name-grid ${mode === "versus" ? "two" : ""}`}>
              <div className="name-field"><label htmlFor="student-name">{mode === "versus" ? "ผู้เล่น 1 · ฝั่งซ้าย" : "ชื่อฮีโร่ของคุณ"}</label><input id="student-name" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder={mode === "versus" ? "Player 1" : "เช่น น้องฟ้า"} autoComplete="name" /></div>
              {mode === "versus" && <div className="name-field"><label htmlFor="player-two-name">ผู้เล่น 2 · ฝั่งขวา</label><input id="player-two-name" value={player2Name} onChange={e => setPlayer2Name(e.target.value)} placeholder="Player 2" autoComplete="off" /></div>}
            </div>
            {mode === "versus" && <div className="calibration-panel glass-panel"><div className="calibration-head"><ShieldCheck size={18} /><strong>Player Lock Calibration</strong><small>แต่ละคนยืนในฝั่งตัวเอง แล้วยกฝ่ามือค้างประมาณ 0.5 วินาที</small></div><div className="calibration-players"><div className={playerReady[0] ? "ready" : ""}><span>P1</span><strong>{playerReady[0] ? "LOCKED" : "ยกฝ่ามือฝั่งซ้าย"}</strong><small>{playerGesture[0]}</small></div><div className={playerReady[1] ? "ready" : ""}><span>P2</span><strong>{playerReady[1] ? "LOCKED" : "ยกฝ่ามือฝั่งขวา"}</strong><small>{playerGesture[1]}</small></div></div><p>พื้นที่กลาง 14% เป็น Safe Zone: มือที่ยังไม่ถูกล็อกจะไม่ถูกยกให้ผู้เล่นคนใด จึงลดการสลับคนเมื่อยืนใกล้กัน</p></div>}
            <div className="hero-actions"><button className="primary-button" onClick={beginGame} disabled={mode === "versus" && !playerReady.every(Boolean)}><Play size={20} fill="currentColor" /> {mode === "versus" ? "เริ่มการแข่งขัน" : "เริ่มภารกิจ"}</button>{!cameraOn && <button className="secondary-button" onClick={() => void startCamera()}><Camera size={20} /> เปิดกล้อง AR</button>}</div>
            {mode === "solo" && <div className="hand-ai-calibration-note"><span>✋</span><div><strong>Hand AI เป็นการควบคุมหลัก</strong><small>ยกฝ่ามือให้เห็นเต็มมือ · ค้างประมาณ 0.6 วินาทีเพื่อเริ่มด้วยมือ หรือกดปุ่มเริ่มเป็นโหมดสำรอง</small></div></div>}
            <small className="privacy-note"><ShieldCheck size={15} /> ภาพกล้องประมวลผลบนอุปกรณ์และไม่ถูกบันทึก</small><div className={`hand-status ${handReady ? "ready" : ""}`}><Hand size={16} /><span>{gestureLabel}</span></div>
          </div>
          <div className="hero-orb" aria-hidden="true"><div className="orb-halo halo-one" /><div className="orb-halo halo-two" /><div className="orb-core"><span>AH</span></div><div className="float-label label-a"><Hand size={16} /> OPEN PALM <small>LOCK / START</small></div><div className="float-label label-b"><ArrowRight size={16} /> SWIPE <small>SMART TRACK</small></div><div className="float-label label-c"><Zap size={16} /> 2 HANDS <small>OWN POWER</small></div></div>
          <div className="level-ribbon glass-panel">{LEVELS.map(item => <div key={item.id} className="ribbon-item"><span>0{item.id}</span><div><strong>{item.title}</strong><small>{item.subject}</small></div></div>)}</div>
        </div>}

        {screen === "game" && card && mode === "solo" && <div className="game-shell">
          <aside className="mission-panel glass-panel"><div className="level-id">LEVEL 0{level.id}</div><p className="eyebrow">{level.eyebrow}</p><h2>{level.title}</h2><p>{level.mission}</p><div className="subject-chip"><span>{level.subjectIcon}</span><div><small>กำลังสร้างนามธรรมของ</small><strong>{level.subject}</strong></div></div><div className="enemy-card"><span>{level.id === 5 ? "🤖" : "👾"}</span><div><small>ตรวจพบศัตรู</small><strong>{level.enemy}</strong></div></div></aside>
          <section className="play-zone" aria-live="polite"><div className="timer-ring" style={{ "--timer": `${Math.min(100, timeLeft / 16 * 100)}%` } as CSSProperties}><span>{timeLeft}</span><small>วินาที</small></div><div className={`data-card ${soloFeedback ? "answered" : ""}`}><span className="card-scan" /><div className="card-label">DATA OBJECT · {cardIndex + 1}/{deck.length}</div><div className="card-icon">{card.icon}</div><h3>{card.label}</h3><p>ข้อมูลนี้จำเป็นต่อการอธิบาย “{level.subject}” หรือไม่?</p><div className="pinch-cue"><span className="pinch-dot" /> PINCH → FIST หรือ SWIPE</div></div><div className="decision-buttons"><button className="reject-button" onClick={() => classifyForPlayer(0, "noise")} disabled={!!soloFeedback}><ArrowLeft size={24} /><span><small>SWIPE LEFT</small>ไม่สำคัญ</span></button><button className="keep-button" onClick={() => classifyForPlayer(0, "essential")} disabled={!!soloFeedback}><span><small>SWIPE RIGHT</small>เก็บไว้</span><ArrowRight size={24} /></button></div><button className="power-button" onClick={() => activatePower(0)} disabled={players[0].power === 0 || !!soloFeedback}><Zap size={17} fill="currentColor" /> Focus Vision<span>{players[0].power}</span></button></section>
          <aside className="hud-panel glass-panel"><div className="hud-score"><small>SCORE</small><strong>{players[0].score.toLocaleString("th-TH")}</strong></div><div className="hud-row"><span>ความแม่นยำ</span><strong>{soloAccuracy}%</strong></div><div className="accuracy-bar"><i style={{ width: `${soloAccuracy}%` }} /></div><div className="hud-row"><span>Combo</span><strong className="combo-text">×{players[0].combo}</strong></div><div className="life-row">{[0, 1, 2].map(life => <span key={life} className={life < players[0].lives ? "alive" : ""}>◆</span>)}</div><button className="pause-button" onClick={() => setPaused(v => !v)}>{paused ? <Play size={17} /> : <Pause size={17} />} {paused ? "เล่นต่อ" : "หยุดชั่วคราว"}</button><div className="gesture-tip"><Hand size={20} /><div><strong>Gesture Engine</strong><small>{gestureLabel}</small></div></div></aside>
          <div className="bottom-progress"><div><span style={{ width: `${progress}%` }} /></div><small>{Math.round(progress)}% ของภารกิจ</small></div>
          {soloFeedback && <div className="feedback-backdrop"><div ref={feedbackRef} className={`feedback-card ${soloFeedback.correct ? "correct" : "wrong"}`}><span className="feedback-icon">{soloFeedback.correct ? <Check size={31} /> : <X size={31} />}</span><p>{soloFeedback.correct ? "+ คะแนนความเข้าใจ" : "เรียนรู้จากข้อผิดพลาด"}</p><h3>{soloFeedback.title}</h3><div className="why-box"><strong>เพราะอะไร?</strong><span>{soloFeedback.body}</span></div><button className="primary-button" onClick={advanceCard}>ไปต่อ <ArrowRight size={19} /></button></div></div>}
        </div>}

        {screen === "game" && card && mode === "versus" && <div className="versus-game-shell">
          <div className="versus-topline"><div><span>LEVEL 0{level.id}</span><strong>{level.title}</strong></div><div className="versus-timer"><small>ROUND TIME</small><strong>{timeLeft}</strong></div><button className="pause-button" onClick={() => setPaused(v => !v)}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "เล่นต่อ" : "พักเกม"}</button></div>
          <div className="versus-lanes">
            {([0, 1] as PlayerId[]).map(player => { const p = players[player]; const name = player === 0 ? (studentName || "Player 1") : (player2Name || "Player 2"); return <section key={player} className={`versus-lane player-${player + 1} ${p.answered ? "answered" : ""}`}><div className="versus-player-hud"><div><span>P{player + 1}</span><strong>{name}</strong><small>{playerGesture[player]}</small></div><div className="versus-score"><small>SCORE</small><strong>{p.score}</strong><span>COMBO ×{p.combo}</span></div></div><div className="versus-card"><div className="card-label">DATA OBJECT · {cardIndex + 1}/{deck.length}</div><div className="card-icon">{card.icon}</div><h3>{card.label}</h3><p>จำเป็นต่อ “{level.subject}” หรือไม่?</p>{p.feedback ? <div className={`lane-feedback ${p.feedback.correct ? "correct" : "wrong"}`}>{p.feedback.correct ? <Check size={20} /> : <X size={20} />}<strong>{p.feedback.title}</strong></div> : <div className="lane-ready"><Hand size={18} /> ปัดประมาณ 1 ฝ่ามือ</div>}</div><div className="lane-actions"><button onClick={() => classifyForPlayer(player, "noise")} disabled={p.answered}><ArrowLeft size={20} /> ตัดออก</button><button onClick={() => classifyForPlayer(player, "essential")} disabled={p.answered}>เก็บไว้ <ArrowRight size={20} /></button></div><div className="lane-meta"><span>ชีวิต {"◆".repeat(p.lives)}{"◇".repeat(3 - p.lives)}</span><span><Zap size={14} /> Power {p.power}</span></div></section>; })}
          </div>
          <div className="versus-footer"><span>Player 1 ถูกล็อกกับมือของตัวเอง</span><strong>SAFE ZONE · มือข้ามกลางไม่สลับเจ้าของ</strong><span>Player 2 ถูกล็อกกับมือของตัวเอง</span></div>
          <div className="bottom-progress"><div><span style={{ width: `${progress}%` }} /></div><small>{Math.round(progress)}% ของการแข่งขัน</small></div>
        </div>}

        {paused && screen === "game" && <div className="pause-overlay"><div className="glass-panel"><Pause size={34} /><h3>หยุดเวลาแล้ว</h3><p>{mode === "versus" ? "ใช้ปุ่มเล่นต่อเพื่อให้ทั้งสองฝั่งเริ่มพร้อมกัน" : "ยกมือหรือกด P เพื่อกลับเข้าสู่ภารกิจ"}</p><button className="primary-button" onClick={() => setPaused(false)}><Play size={19} /> เล่นต่อ</button></div></div>}

        {screen === "summary" && <div className="summary-shell"><button className="back-link" onClick={() => setScreen("lobby")}><ChevronLeft size={18} /> หน้าหลัก</button>{mode === "solo" ? <section className="victory-card glass-panel"><div className="trophy-orb"><Trophy size={42} /></div><p className="eyebrow">MISSION COMPLETE</p><h1>โลกข้อมูลกลับมาชัดเจนแล้ว!</h1><p>{studentName || "Abstract Hero"} สามารถแยกแก่นสำคัญออกจากรายละเอียดที่ไม่จำเป็นได้</p><div className="stars">{stars.map((active, index) => <span key={index} className={active ? "active" : ""}>★</span>)}</div><div className="result-grid"><div><small>คะแนนรวม</small><strong>{players[0].score}</strong></div><div><small>ความแม่นยำ</small><strong>{soloAccuracy}%</strong></div><div><small>ตอบถูก</small><strong>{players[0].records.filter(r => r.correct).length}/{players[0].records.length}</strong></div></div><div className="summary-actions"><button className="primary-button" onClick={() => { void startCamera(); beginGame(); }}><RotateCcw size={19} /> เล่นอีกครั้ง</button><button className="secondary-button" onClick={() => window.print()}><GraduationCap size={19} /> พิมพ์ใบประกาศ</button></div></section> : <section className="victory-card versus-summary glass-panel"><div className="trophy-orb"><Swords size={42} /></div><p className="eyebrow">VS MATCH COMPLETE</p><h1>{winner === null ? "เสมอกัน!" : `ผู้ชนะ: ${winner === 0 ? (studentName || "Player 1") : (player2Name || "Player 2")}`}</h1><div className="versus-result-grid">{([0, 1] as PlayerId[]).map(player => { const p = players[player]; const accuracy = p.records.length ? Math.round(p.records.filter(r => r.correct).length / p.records.length * 100) : 0; return <div key={player} className={winner === player ? "winner" : ""}><span>P{player + 1}</span><h3>{player === 0 ? (studentName || "Player 1") : (player2Name || "Player 2")}</h3><strong>{p.score}</strong><small>แม่นยำ {accuracy}% · ถูก {p.records.filter(r => r.correct).length}/{p.records.length}</small></div>; })}</div><div className="summary-actions"><button className="primary-button" onClick={() => { void startCamera(); beginGame(); }}><RotateCcw size={19} /> แข่งอีกครั้ง</button><button className="secondary-button" onClick={() => setScreen("lobby")}><ChevronLeft size={19} /> เปลี่ยนผู้เล่น</button></div></section>}</div>}

        {screen === "teacher" && <div className="teacher-shell"><section className="teacher-dashboard glass-panel"><div className="teacher-heading"><div><p className="eyebrow">TEACHER DASHBOARD</p><h1>ภาพรวมการเรียนรู้</h1><p>รองรับทั้ง Solo และ VS 2 Players</p></div><div className="dashboard-actions"><button className="secondary-button" onClick={exportCsv} disabled={!reports.length}><Download size={18} /> Export CSV</button><button className="primary-button" onClick={openGoogleSheets} disabled={!reports.length}><FileSpreadsheet size={18} /> Google Sheets</button></div></div><div className="metric-grid"><div><Users size={20} /><span><small>ผลการเล่นทั้งหมด</small><strong>{reports.length}</strong></span></div><div><Trophy size={20} /><span><small>คะแนนเฉลี่ย</small><strong>{reports.length ? Math.round(reports.reduce((sum, item) => sum + item.score, 0) / reports.length) : 0}</strong></span></div><div><BarChart3 size={20} /><span><small>ความแม่นยำเฉลี่ย</small><strong>{reports.length ? Math.round(reports.reduce((sum, item) => sum + item.accuracy, 0) / reports.length) : 0}%</strong></span></div><div><Swords size={20} /><span><small>ผลจากโหมด VS</small><strong>{reports.filter(item => item.mode === "versus").length}</strong></span></div></div><div className="report-table-wrap"><table><thead><tr><th>ผู้เรียน</th><th>โหมด</th><th>คะแนน</th><th>ความแม่นยำ</th><th>ตอบถูก</th><th>เวลา</th></tr></thead><tbody>{reports.length ? reports.map(report => <tr key={report.id}><td><strong>{report.name}</strong><small>{report.date}</small></td><td>{report.mode === "versus" ? "VS" : "SOLO"}</td><td>{report.score}</td><td><span className={`accuracy-pill ${report.accuracy >= 80 ? "good" : ""}`}>{report.accuracy}%</span></td><td>{report.correct}/{report.total}</td><td>{Math.floor(report.seconds / 60)}:{String(report.seconds % 60).padStart(2, "0")}</td></tr>) : <tr><td colSpan={6} className="empty-report">ยังไม่มีผลการเล่น</td></tr>}</tbody></table></div></section></div>}
      </section>
    </main>
  );
}


const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("ไม่พบ #root สำหรับเริ่ม Abstract Hero AR");
createRoot(rootElement).render(<Home />);
