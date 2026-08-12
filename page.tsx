"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Accessibility, ArrowLeft, ArrowRight, BarChart3, Camera, Check, ChevronLeft,
  Download, FileSpreadsheet, Gamepad2, GraduationCap, Hand, Keyboard, Pause,
  Play, RotateCcw, Settings, ShieldCheck, Sparkles, Trophy, Users, Volume2,
  VolumeX, X, Zap,
} from "lucide-react";
import * as THREE from "three";
import { gsap } from "gsap";

type Screen = "lobby" | "game" | "summary" | "teacher";
type AnswerKind = "essential" | "noise";
type CardItem = { label: string; detail: string; essential: boolean; icon: string };
type Level = { id: number; eyebrow: string; title: string; mission: string; subject: string; subjectIcon: string; enemy: string; items: CardItem[] };
type AnswerRecord = CardItem & { level: number; correct: boolean; chosen: AnswerKind };
type StudentReport = { id: number; name: string; score: number; accuracy: number; correct: number; total: number; seconds: number; level: number; date: string };
type Landmark = { x: number; y: number; z: number };
type XRSystemLike = {
  isSessionSupported: (mode: string) => Promise<boolean>;
  requestSession: (mode: string, options?: Record<string, unknown>) => Promise<{ addEventListener: (name: string, callback: () => void) => void }>;
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

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

function useSound(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback((kind: "success" | "error" | "power" | "victory") => {
    if (!enabled || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = ctxRef.current ?? new AudioCtx();
    ctxRef.current = ctx;
    const notes = kind === "success" ? [523, 659] : kind === "error" ? [180, 130] : kind === "power" ? [330, 523, 784] : [392, 523, 659, 1046];
    notes.forEach((note, index) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = kind === "error" ? "sawtooth" : "sine"; osc.frequency.value = note;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + index * .08);
      gain.gain.exponentialRampToValueAtTime(.12, ctx.currentTime + index * .08 + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + index * .08 + .16);
      osc.connect(gain).connect(ctx.destination); osc.start(ctx.currentTime + index * .08); osc.stop(ctx.currentTime + index * .08 + .18);
    });
  }, [enabled]);
}

function HologramScene({ burst, onRendererReady }: { burst: number; onRendererReady: (renderer: THREE.WebGLRenderer | null) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<THREE.Mesh | null>(null);
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, .1, 100); camera.position.z = 7;
    let renderer: THREE.WebGLRenderer;
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!context) {
      mount.classList.add("webgl-fallback");
      return;
    }
    renderer.xr.enabled = true;
    onRendererReady(renderer);
    try {
      renderer = new THREE.WebGLRenderer({ canvas: probe, context, alpha: true, antialias: true });
    } catch {
      mount.classList.add("webgl-fallback");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8)); renderer.setSize(mount.clientWidth, mount.clientHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; mount.appendChild(renderer.domElement);
    const group = new THREE.Group(); scene.add(group);
    [1.75, 2.35, 2.95].forEach((radius, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .014 + index * .005, 12, 100), new THREE.MeshBasicMaterial({ color: 0x77e9ff, transparent: true, opacity: .3 }));
      ring.rotation.x = 1.1 + index * .32; ring.rotation.y = index * .6; group.add(ring);
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 1), new THREE.MeshBasicMaterial({ color: 0xb99cff, wireframe: true, transparent: true, opacity: .55 }));
    core.position.set(0, -.1, -.5); coreRef.current = core; group.add(core);
    const count = 170; const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) { positions[i * 3] = (Math.random() - .5) * 11; positions[i * 3 + 1] = (Math.random() - .5) * 8; positions[i * 3 + 2] = (Math.random() - .5) * 5; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x8eeeff, size: .028, transparent: true, opacity: .7 })); scene.add(points);
    const clock = new THREE.Clock();
    const animate = () => { const elapsed = clock.getElapsedTime(); group.rotation.z = elapsed * .09; group.rotation.y = Math.sin(elapsed * .28) * .16; points.rotation.y = elapsed * .018; core.rotation.x = elapsed * .3; core.rotation.y = elapsed * .45; renderer.render(scene, camera); };
    renderer.setAnimationLoop(animate);
    const resize = () => { camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight); };
    window.addEventListener("resize", resize);
    return () => { renderer.setAnimationLoop(null); onRendererReady(null); window.removeEventListener("resize", resize); renderer.dispose(); geometry.dispose(); if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement); };
  }, [onRendererReady]);
  useEffect(() => { if (coreRef.current && burst) gsap.fromTo(coreRef.current.scale, { x: .5, y: .5, z: .5 }, { x: 2.2, y: 2.2, z: 2.2, duration: .38, yoyo: true, repeat: 1, ease: "power2.out" }); }, [burst]);
  return <div ref={mountRef} className="hologram-scene" aria-hidden="true" />;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("lobby"); const [studentName, setStudentName] = useState("");
  const [levelIndex, setLevelIndex] = useState(0); const [deck, setDeck] = useState<CardItem[]>(() => shuffle(LEVELS[0].items)); const [cardIndex, setCardIndex] = useState(0);
  const [score, setScore] = useState(0); const [combo, setCombo] = useState(0); const [lives, setLives] = useState(3); const [bossHealth, setBossHealth] = useState(100); const [timeLeft, setTimeLeft] = useState(14);
  const [paused, setPaused] = useState(false); const [feedback, setFeedback] = useState<{ correct: boolean; title: string; body: string } | null>(null); const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [cameraOn, setCameraOn] = useState(false); const [cameraMessage, setCameraMessage] = useState("กำลังเตรียมกล้อง…"); const [soundOn, setSoundOn] = useState(true); const [voiceOn, setVoiceOn] = useState(true);
  const [largeText, setLargeText] = useState(false); const [colorBlind, setColorBlind] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false); const [burst, setBurst] = useState(0);
  const [power, setPower] = useState(2); const [powerLabel, setPowerLabel] = useState("Focus Vision");
  const [gestureLabel, setGestureLabel] = useState("กำลังเตรียม Hand AI"); const [handReady, setHandReady] = useState(false); const [handSelected, setHandSelected] = useState(false);
  const [xrSupported, setXrSupported] = useState(false); const [xrActive, setXrActive] = useState(false); const [reports, setReports] = useState<StudentReport[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null); const feedbackRef = useRef<HTMLDivElement>(null); const cursorRef = useRef<HTMLDivElement>(null);
  const xrRendererRef = useRef<THREE.WebGLRenderer | null>(null); const startTimeRef = useRef(0); const actionRef = useRef<Record<string, unknown>>({}); const playSound = useSound(soundOn);
  const level = LEVELS[levelIndex]; const card = deck[cardIndex];
  const totalQuestions = LEVELS.reduce((sum, item) => sum + item.items.length, 0); const completedQuestions = LEVELS.slice(0, levelIndex).reduce((sum, item) => sum + item.items.length, 0) + cardIndex;
  const progress = completedQuestions / totalQuestions * 100; const accuracy = records.length ? Math.round(records.filter((record) => record.correct).length / records.length * 100) : 100;
  const onRendererReady = useCallback((renderer: THREE.WebGLRenderer | null) => { xrRendererRef.current = renderer; }, []);

  const speak = useCallback((text: string) => { if (!voiceOn || typeof window === "undefined" || !("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "th-TH"; utterance.rate = .93; window.speechSynthesis.speak(utterance); }, [voiceOn]);
  const stopCamera = useCallback(() => { const stream = videoRef.current?.srcObject as MediaStream | null; stream?.getTracks().forEach((track) => track.stop()); if (videoRef.current) videoRef.current.srcObject = null; setCameraOn(false); }, []);
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraMessage("อุปกรณ์นี้ไม่รองรับกล้อง — เล่นด้วยการสัมผัสได้"); return false; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); } setCameraOn(true); setCameraMessage("Camera AR พร้อมใช้งาน"); return true; }
    catch { setCameraOn(false); setCameraMessage("กล้องถูกปิด — ยังเล่นด้วยปุ่มหรือคีย์บอร์ดได้"); return false; }
  }, []);
  useEffect(() => { const task = window.setTimeout(() => void startCamera(), 0); return () => { window.clearTimeout(task); stopCamera(); }; }, [startCamera, stopCamera]);
  useEffect(() => {
    const task = window.setTimeout(() => { try { const saved = window.localStorage.getItem("abstract-hero-reports"); if (saved) setReports(JSON.parse(saved) as StudentReport[]); } catch { /* Local history remains optional. */ } }, 0);
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr;
    if (xr) void xr.isSessionSupported("immersive-ar").then(setXrSupported).catch(() => setXrSupported(false));
    return () => window.clearTimeout(task);
  }, []);

  const beginGame = useCallback(() => {
    startTimeRef.current = Date.now(); setLevelIndex(0); setDeck(shuffle(LEVELS[0].items)); setCardIndex(0); setScore(0); setCombo(0); setLives(3); setBossHealth(100); setTimeLeft(14); setRecords([]); setFeedback(null); setPaused(false); setPower(2); setPowerLabel("Focus Vision"); setScreen("game"); playSound("power"); speak("ยินดีต้อนรับ Abstract Hero ภารกิจของเธอคือเก็บข้อมูลสำคัญ และปัดสิ่งรบกวนออกไป");
  }, [playSound, speak]);
  const finishGame = useCallback(() => {
    const report: StudentReport = { id: Date.now(), name: studentName.trim() || "Abstract Hero", score, accuracy, correct: records.filter((record) => record.correct).length, total: records.length, seconds: Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)), level: 5, date: new Date().toLocaleString("th-TH") };
    setReports((current) => { const next = [report, ...current].slice(0, 50); try { window.localStorage.setItem("abstract-hero-reports", JSON.stringify(next)); } catch { /* Local history remains optional. */ } return next; });
    setScreen("summary"); stopCamera(); playSound("victory"); speak("ภารกิจสำเร็จ เธอแยกข้อมูลสำคัญออกจากรายละเอียดที่ไม่จำเป็นได้แล้ว");
  }, [accuracy, playSound, records, score, speak, stopCamera, studentName]);
  const advanceCard = useCallback(() => {
    if (cardIndex < deck.length - 1) { setCardIndex((value) => value + 1); const adaptiveTime = accuracy >= 85 ? 10 : accuracy < 60 ? 16 : 13; setTimeLeft(levelIndex === 4 ? Math.max(7, adaptiveTime - 3) : adaptiveTime); return; }
    if (levelIndex < LEVELS.length - 1) { const nextLevel = levelIndex + 1; setLevelIndex(nextLevel); setDeck(shuffle(LEVELS[nextLevel].items)); setCardIndex(0); setTimeLeft(nextLevel === 4 ? 8 : 12); setCombo(0); setPower((value) => Math.min(3, value + 1)); setPowerLabel(["Focus Vision", "Slow Motion", "Freeze Time", "Double Score"][nextLevel % 4]); speak(`เข้าสู่ด่านที่ ${nextLevel + 1} ${LEVELS[nextLevel].title}`); return; }
    finishGame();
  }, [accuracy, cardIndex, deck.length, finishGame, levelIndex, speak]);
  const classify = useCallback((kind: AnswerKind) => {
    if (!card || paused || feedback) return;
    const correct = (kind === "essential") === card.essential; const nextCombo = correct ? combo + 1 : 0; let points = correct ? 10 : -5;
    if (correct && nextCombo >= 2) points += 5; if (correct && nextCombo > 0 && nextCombo % 5 === 0) points += 20; if (correct && timeLeft >= 8) points += 3;
    setScore((value) => Math.max(0, value + points)); setCombo(nextCombo); if (!correct) setLives((value) => Math.max(0, value - 1)); if (correct && levelIndex === 4) setBossHealth((value) => Math.max(0, value - 13));
    setRecords((value) => [...value, { ...card, level: level.id, correct, chosen: kind }]);
    setFeedback({ correct, title: correct ? (card.essential ? "ใช่เลย — นี่คือแก่นสำคัญ" : "เยี่ยม — ตัดรายละเอียดรบกวนแล้ว") : "เกือบถูกแล้ว ลองดูเหตุผลนี้", body: card.detail });
    setBurst((value) => value + 1); playSound(correct ? "success" : "error"); speak(`${correct ? "ถูกต้อง" : "คำตอบนี้ยังไม่ถูก"} ${card.detail}`);
    requestAnimationFrame(() => { if (feedbackRef.current) gsap.fromTo(feedbackRef.current, { y: 24, opacity: 0, scale: .96 }, { y: 0, opacity: 1, scale: 1, duration: .4, ease: "back.out(1.4)" }); });
  }, [card, combo, feedback, level.id, levelIndex, paused, playSound, speak, timeLeft]);
  useEffect(() => { if (screen !== "game" || paused || feedback) return; const timer = window.setInterval(() => setTimeLeft((value) => { if (value <= 1) { window.clearInterval(timer); window.setTimeout(() => classify(card?.essential ? "noise" : "essential"), 0); return 0; } return value - 1; }), 1000); return () => window.clearInterval(timer); }, [card?.essential, classify, feedback, paused, screen]);
  const activatePower = useCallback(() => { if (power <= 0 || screen !== "game" || feedback) return; setPower((value) => value - 1); setTimeLeft((value) => value + 7); setPowerLabel(card?.essential ? "Focus Vision · สำคัญ" : "Focus Vision · รายละเอียดรอง"); playSound("power"); speak(card?.essential ? "โฟกัสวิชันตรวจพบแก่นสำคัญ" : "โฟกัสวิชันตรวจพบรายละเอียดที่ตัดออกได้"); window.setTimeout(() => setPowerLabel("Focus Vision"), 2600); }, [card?.essential, feedback, playSound, power, screen, speak]);
  useEffect(() => { const handleKey = (event: KeyboardEvent) => { if (screen === "lobby" && event.key === "Enter") beginGame(); if (screen !== "game") return; if (event.key === "ArrowLeft") classify("noise"); if (event.key === "ArrowRight") classify("essential"); if (event.key.toLowerCase() === "p") setPaused((value) => !value); if (event.code === "Space") { event.preventDefault(); activatePower(); } }; window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }, [activatePower, beginGame, classify, screen]);
  useEffect(() => { actionRef.current = { screen, beginGame, classify, usePower: activatePower, feedback, paused }; }, [activatePower, beginGame, classify, feedback, paused, screen]);

  useEffect(() => {
    if (!cameraOn || !videoRef.current) return;
    let cancelled = false; let animationFrame = 0; let landmarker: { detectForVideo: (video: HTMLVideoElement, now: number) => { landmarks?: Landmark[][] }; close: () => void } | null = null;
    let lastVideoTime = -1; let lastActionAt = 0; let openStartedAt = 0; let raisedLatch = false; let selectedLatch = false; let lastLabel = ""; const swipeTrail: { x: number; at: number }[] = [];
    const setLabel = (label: string) => { if (label !== lastLabel) { lastLabel = label; setGestureLabel(label); } };
    const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);
    const boot = async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const wasm = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
        const options = { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" as const }, runningMode: "VIDEO" as const, numHands: 2, minHandDetectionConfidence: .55, minTrackingConfidence: .55 };
        try { landmarker = await vision.HandLandmarker.createFromOptions(wasm, options); }
        catch { landmarker = await vision.HandLandmarker.createFromOptions(wasm, { ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" as const } }); }
        if (cancelled) { landmarker.close(); return; }
        setHandReady(true); setLabel("Hand AI พร้อม · แสดงมือหน้ากล้อง");
      } catch {
        if (!cancelled) { setHandReady(false); setLabel("เล่นด้วยสัมผัสหรือคีย์บอร์ดได้"); }
        return;
      }
      const loop = () => {
        if (cancelled || !landmarker || !videoRef.current) return;
        const video = videoRef.current; const now = performance.now();
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const hands = landmarker.detectForVideo(video, now).landmarks ?? [];
          if (!hands.length) { setLabel("ยกมือขึ้นเพื่อใช้พลัง"); if (cursorRef.current) cursorRef.current.style.opacity = "0"; openStartedAt = 0; raisedLatch = false; }
          else {
            const hand = hands[0]; const tip = hand[8]; const visualX = 1 - tip.x;
            if (cursorRef.current) { cursorRef.current.style.opacity = "1"; cursorRef.current.style.transform = `translate(${visualX * innerWidth}px,${tip.y * innerHeight}px)`; }
            const extended = [[8,6],[12,10],[16,14],[20,18]].filter(([tipIndex,pipIndex]) => hand[tipIndex].y < hand[pipIndex].y).length;
            const pinched = distance(hand[4], hand[8]) < .055; const palmY = (hand[0].y + hand[5].y + hand[9].y + hand[13].y + hand[17].y) / 5;
            const active = actionRef.current as { screen: Screen; beginGame: () => void; classify: (kind: AnswerKind) => void; usePower: () => void; feedback: unknown; paused: boolean };
            if (hands.length >= 2 && now - lastActionAt > 2200) { setLabel("สองมือ · เปิดพลังพิเศษ"); active.usePower(); lastActionAt = now; }
            else if (active.screen === "lobby" && extended >= 3) {
              if (!openStartedAt) openStartedAt = now; setLabel("Open Palm · ค้างไว้เพื่อเริ่ม");
              if (now - openStartedAt > 850 && now - lastActionAt > 1800) { active.beginGame(); lastActionAt = now; openStartedAt = 0; }
            } else if (active.screen === "game" && !active.feedback) {
              if (palmY < .2 && extended >= 3) {
                setLabel("Raise Hand · หยุดเวลา");
                if (!raisedLatch && now - lastActionAt > 1700) { setPaused((value) => !value); lastActionAt = now; raisedLatch = true; }
              } else raisedLatch = false;
              if (!active.paused) {
                if (pinched) { setLabel("Pinch · เลือกการ์ด"); selectedLatch = true; setHandSelected(true); }
                else if (selectedLatch && extended <= 1 && now - lastActionAt > 1200) { setLabel("Grab · เก็บข้อมูล"); active.classify("essential"); selectedLatch = false; setHandSelected(false); lastActionAt = now; }
                const palmX = 1 - (hand[0].x + hand[5].x + hand[9].x + hand[13].x + hand[17].x) / 5;
                swipeTrail.push({ x: palmX, at: now }); while (swipeTrail.length && now - swipeTrail[0].at > 430) swipeTrail.shift();
                const delta = swipeTrail.length > 1 ? palmX - swipeTrail[0].x : 0;
                if (Math.abs(delta) > .27 && now - lastActionAt > 1200) { const kind: AnswerKind = delta > 0 ? "essential" : "noise"; setLabel(delta > 0 ? "Swipe Right · เก็บไว้" : "Swipe Left · ตัดออก"); active.classify(kind); lastActionAt = now; swipeTrail.length = 0; selectedLatch = false; setHandSelected(false); }
              }
            } else { setLabel(pinched ? "Pinch · เลือก" : "ตรวจพบมือ"); }
          }
        }
        animationFrame = requestAnimationFrame(loop);
      };
      loop();
    };
    void boot();
    return () => { cancelled = true; cancelAnimationFrame(animationFrame); landmarker?.close(); setHandReady(false); };
  }, [cameraOn]);

  const startWebXR = useCallback(async () => {
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr; const renderer = xrRendererRef.current;
    if (!xr || !renderer) { setCameraMessage("WebXR ไม่พร้อม — ใช้ Camera AR แทน"); return; }
    try {
      const session = await xr.requestSession("immersive-ar", { requiredFeatures: ["local"], optionalFeatures: ["local-floor", "dom-overlay"], domOverlay: { root: document.body } });
      await renderer.xr.setSession(session as never); setXrActive(true); setCameraMessage("WebXR Immersive AR ทำงานอยู่");
      session.addEventListener("end", () => { setXrActive(false); setCameraMessage("Camera AR พร้อมใช้งาน"); });
    } catch { setCameraMessage("เปิด WebXR ไม่สำเร็จ — ใช้ Camera AR ต่อได้"); }
  }, []);

  const exportCsv = useCallback(() => {
    const rows = [["ชื่อผู้เรียน","คะแนน","ความแม่นยำ","ตอบถูก","จำนวนข้อ","เวลา (วินาที)","ด่านสูงสุด","วันที่"], ...reports.map((report) => [report.name, report.score, `${report.accuracy}%`, report.correct, report.total, report.seconds, report.level, report.date])];
    const csv = "\uFEFF" + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "abstract-hero-learning-report.csv"; link.click(); URL.revokeObjectURL(url);
  }, [reports]);
  const openGoogleSheets = useCallback(() => {
    const rows = [["ชื่อผู้เรียน","คะแนน","ความแม่นยำ","ตอบถูก","จำนวนข้อ","เวลา (วินาที)","ด่านสูงสุด","วันที่"], ...reports.map((report) => [report.name, report.score, `${report.accuracy}%`, report.correct, report.total, report.seconds, report.level, report.date])];
    void navigator.clipboard?.writeText(rows.map((row) => row.join("\t")).join("\n")); window.open("https://sheets.new", "_blank", "noopener,noreferrer"); setGestureLabel("คัดลอกรายงานแล้ว · วางใน Google Sheets ได้ทันที");
  }, [reports]);
  const stars = useMemo(() => { const value = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1; return Array.from({ length: 3 }, (_, index) => index < value); }, [accuracy]);

  return (
    <main className={`${largeText ? "large-text" : ""} ${colorBlind ? "color-blind" : ""}`}>
      <section className="ar-stage" aria-label="พื้นที่เล่นเกม Abstract Hero AR">
        <video ref={videoRef} className={`camera-feed ${cameraOn ? "is-on" : ""}`} muted playsInline aria-label="ภาพจากกล้องของผู้เล่น" />
        <div className="camera-vignette" /><div className="scanlines" /><HologramScene burst={burst} onRendererReady={onRendererReady} /><div ref={cursorRef} className={`hand-cursor ${handSelected ? "pinched" : ""}`}><span /></div>
        <header className="topbar glass-panel">
          <button className="brand" onClick={() => setScreen("lobby")} aria-label="กลับหน้าหลัก"><span className="brand-mark"><Sparkles size={18} /></span><span><strong>ABSTRACT</strong><small>HERO AR</small></span></button>
          <div className="top-status" aria-live="polite"><span className={`status-dot ${cameraOn ? "active" : ""}`} />{cameraMessage}</div>
          <nav className="top-actions" aria-label="เครื่องมือ"><button className="teacher-nav-button" onClick={() => setScreen(screen === "teacher" ? "lobby" : "teacher")}><BarChart3 size={17} /><span>สำหรับครู</span></button>{xrSupported && <button className={`xr-button ${xrActive ? "active" : ""}`} onClick={() => void startWebXR()}><Sparkles size={16} /><span>{xrActive ? "AR ACTIVE" : "ENTER AR"}</span></button>}<button className="icon-button" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "ปิดเสียง" : "เปิดเสียง"}>{soundOn ? <Volume2 size={19} /> : <VolumeX size={19} />}</button><button className="icon-button" onClick={() => setSettingsOpen((value) => !value)} aria-label="ตั้งค่าการเข้าถึง"><Settings size={19} /></button></nav>
        </header>
        {settingsOpen && <aside className="settings-panel glass-panel" aria-label="ตั้งค่าการเข้าถึง"><div className="panel-heading"><Accessibility size={18} /><strong>การเข้าถึง</strong></div><label><span>ตัวอักษรขนาดใหญ่</span><input type="checkbox" checked={largeText} onChange={(event) => setLargeText(event.target.checked)} /></label><label><span>โหมดแยกสี</span><input type="checkbox" checked={colorBlind} onChange={(event) => setColorBlind(event.target.checked)} /></label><label><span>เสียงบรรยายไทย</span><input type="checkbox" checked={voiceOn} onChange={(event) => setVoiceOn(event.target.checked)} /></label></aside>}

        {screen === "lobby" && <div className="lobby-shell">
          <div className="hero-copy">
            <div className="mission-tag"><span /> ภารกิจฝึก Abstraction</div><h1>มองให้เห็น<br /><em>“แก่นสำคัญ”</em></h1>
            <p>โลกข้อมูลกำลังสับสน ใช้มือของเธอคัดสิ่งสำคัญ เก็บแก่นของปัญหา และกำจัดรายละเอียดที่ไม่จำเป็น</p>
            <div className="control-chips" aria-label="วิธีควบคุม"><span><Hand size={17} /> มือ</span><span><Gamepad2 size={17} /> สัมผัส</span><span><Keyboard size={17} /> คีย์บอร์ด</span></div>
            <div className="name-field"><label htmlFor="student-name">ชื่อฮีโร่ของคุณ</label><input id="student-name" value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="เช่น น้องฟ้า" autoComplete="name" /></div>
            <div className="hero-actions"><button className="primary-button" onClick={beginGame}><Play size={20} fill="currentColor" /> เริ่มภารกิจ</button>{!cameraOn && <button className="secondary-button" onClick={() => void startCamera()}><Camera size={20} /> เปิดกล้อง AR</button>}</div>
            <small className="privacy-note"><ShieldCheck size={15} /> ภาพกล้องประมวลผลบนอุปกรณ์และไม่ถูกบันทึก</small><div className={`hand-status ${handReady ? "ready" : ""}`}><Hand size={16} /><span>{gestureLabel}</span></div>
          </div>
          <div className="hero-orb" aria-hidden="true"><div className="orb-halo halo-one" /><div className="orb-halo halo-two" /><div className="orb-core"><span>AH</span></div><div className="float-label label-a"><Hand size={16} /> OPEN PALM <small>START</small></div><div className="float-label label-b"><ArrowRight size={16} /> SWIPE <small>CLASSIFY</small></div><div className="float-label label-c"><Zap size={16} /> 2 HANDS <small>POWER</small></div></div>
          <div className="level-ribbon glass-panel">{LEVELS.map((item) => <div key={item.id} className="ribbon-item"><span>0{item.id}</span><div><strong>{item.title}</strong><small>{item.subject}</small></div></div>)}</div>
        </div>}

        {screen === "game" && card && <div className="game-shell">
          <aside className="mission-panel glass-panel"><div className="level-id">LEVEL 0{level.id}</div><p className="eyebrow">{level.eyebrow}</p><h2>{level.title}</h2><p>{level.mission}</p><div className="subject-chip"><span>{level.subjectIcon}</span><div><small>กำลังสร้างนามธรรมของ</small><strong>{level.subject}</strong></div></div><div className="map-mini"><strong>Abstraction Map</strong><div className="map-line"><span>ข้อมูลทั้งหมด</span><i>→</i><span className="map-focus">แก่นสำคัญ</span></div></div><div className="enemy-card"><span>{level.id === 5 ? "🤖" : "👾"}</span><div><small>ตรวจพบศัตรู</small><strong>{level.enemy}</strong></div></div></aside>
          <section className="play-zone" aria-live="polite">
            {level.id === 5 && <div className="boss-health"><span>CHAOS AI</span><div><i style={{ width: `${bossHealth}%` }} /></div><strong>{bossHealth}%</strong></div>}
            <div className="timer-ring" style={{ "--timer": `${Math.min(100, timeLeft / 16 * 100)}%` } as React.CSSProperties}><span>{timeLeft}</span><small>วินาที</small></div>
            <div className={`data-card ${feedback ? "answered" : ""}`}><span className="card-scan" /><div className="card-label">DATA OBJECT · {cardIndex + 1}/{deck.length}</div><div className="card-icon">{card.icon}</div><h3>{card.label}</h3><p>ข้อมูลนี้จำเป็นต่อการอธิบาย “{level.subject}” หรือไม่?</p><div className="pinch-cue"><span className="pinch-dot" /> PINCH TO SELECT</div></div>
            <div className="decision-buttons"><button className="reject-button" onClick={() => classify("noise")} disabled={!!feedback}><ArrowLeft size={24} /><span><small>SWIPE LEFT</small>ไม่สำคัญ</span></button><button className="keep-button" onClick={() => classify("essential")} disabled={!!feedback}><span><small>SWIPE RIGHT</small>เก็บไว้</span><ArrowRight size={24} /></button></div>
            <button className="power-button" onClick={activatePower} disabled={power === 0 || !!feedback}><Zap size={17} fill="currentColor" /> {powerLabel}<span>{power}</span></button>
          </section>
          <aside className="hud-panel glass-panel"><div className="hud-score"><small>SCORE</small><strong>{score.toLocaleString("th-TH")}</strong></div><div className="hud-row"><span>ความแม่นยำ</span><strong>{accuracy}%</strong></div><div className="accuracy-bar"><i style={{ width: `${accuracy}%` }} /></div><div className="hud-row"><span>Combo</span><strong className="combo-text">×{combo}</strong></div><div className="life-row" aria-label={`พลังชีวิต ${lives} ดวง`}>{[0, 1, 2].map((life) => <span key={life} className={life < lives ? "alive" : ""}>◆</span>)}</div><button className="pause-button" onClick={() => setPaused((value) => !value)}>{paused ? <Play size={17} /> : <Pause size={17} />} {paused ? "เล่นต่อ" : "หยุดชั่วคราว"}</button><div className="gesture-tip"><Hand size={20} /><div><strong>ท่ามือแนะนำ</strong><small>ปัดขวา = เก็บ · ปัดซ้าย = ตัด</small></div></div></aside>
          <div className="bottom-progress"><div><span style={{ width: `${progress}%` }} /></div><small>{Math.round(progress)}% ของภารกิจ</small></div>
          {feedback && <div className="feedback-backdrop"><div ref={feedbackRef} className={`feedback-card ${feedback.correct ? "correct" : "wrong"}`}><span className="feedback-icon">{feedback.correct ? <Check size={31} /> : <X size={31} />}</span><p>{feedback.correct ? "+ คะแนนความเข้าใจ" : "เรียนรู้จากข้อผิดพลาด"}</p><h3>{feedback.title}</h3><div className="why-box"><strong>เพราะอะไร?</strong><span>{feedback.body}</span></div><button className="primary-button" onClick={() => { setFeedback(null); advanceCard(); }}>ไปต่อ <ArrowRight size={19} /></button></div></div>}
          {paused && <div className="pause-overlay"><div className="glass-panel"><Pause size={34} /><h3>หยุดเวลาแล้ว</h3><p>ยกมือหรือกด P เพื่อกลับเข้าสู่ภารกิจ</p><button className="primary-button" onClick={() => setPaused(false)}><Play size={19} /> เล่นต่อ</button></div></div>}
        </div>}

        {screen === "summary" && <div className="summary-shell"><button className="back-link" onClick={() => setScreen("lobby")}><ChevronLeft size={18} /> หน้าหลัก</button><section className="victory-card glass-panel"><div className="trophy-orb"><Trophy size={42} /></div><p className="eyebrow">MISSION COMPLETE</p><h1>โลกข้อมูลกลับมาชัดเจนแล้ว!</h1><p>{studentName || "Abstract Hero"} สามารถแยกแก่นสำคัญออกจากรายละเอียดที่ไม่จำเป็นได้</p><div className="stars">{stars.map((active, index) => <span key={index} className={active ? "active" : ""}>★</span>)}</div><div className="result-grid"><div><small>คะแนนรวม</small><strong>{score}</strong></div><div><small>ความแม่นยำ</small><strong>{accuracy}%</strong></div><div><small>ตอบถูก</small><strong>{records.filter((record) => record.correct).length}/{records.length}</strong></div></div><div className="reflection-box"><Sparkles size={20} /><div><strong>ข้อคิดของฮีโร่</strong><p>Abstraction คือการเลือกเก็บเฉพาะข้อมูลที่จำเป็นต่อเป้าหมาย ไม่ใช่การลบทุกรายละเอียด แต่คือการรู้ว่า “ตอนนี้อะไรสำคัญ”</p></div></div><div className="achievement-row"><span>🏅 Abstract Master</span>{accuracy >= 90 && <span>⚡ Perfect Classifier</span>}<span>🧠 Logic Hero</span></div><div className="summary-actions"><button className="primary-button" onClick={() => { void startCamera(); beginGame(); }}><RotateCcw size={19} /> เล่นอีกครั้ง</button><button className="secondary-button" onClick={() => window.print()}><GraduationCap size={19} /> พิมพ์ใบประกาศ</button></div></section></div>}

        {screen === "teacher" && <div className="teacher-shell">
          <section className="teacher-dashboard glass-panel">
            <div className="teacher-heading"><div><p className="eyebrow">TEACHER DASHBOARD</p><h1>ภาพรวมการเรียนรู้</h1><p>รายงานบนอุปกรณ์นี้ แสดงความเข้าใจเรื่อง Abstraction ของผู้เรียน</p></div><div className="dashboard-actions"><button className="secondary-button" onClick={exportCsv} disabled={!reports.length}><Download size={18} /> Export CSV</button><button className="primary-button" onClick={openGoogleSheets} disabled={!reports.length}><FileSpreadsheet size={18} /> Google Sheets</button></div></div>
            <div className="metric-grid"><div><Users size={20} /><span><small>ผู้เรียนทั้งหมด</small><strong>{reports.length}</strong></span></div><div><Trophy size={20} /><span><small>คะแนนเฉลี่ย</small><strong>{reports.length ? Math.round(reports.reduce((sum, item) => sum + item.score, 0) / reports.length) : 0}</strong></span></div><div><BarChart3 size={20} /><span><small>ความแม่นยำเฉลี่ย</small><strong>{reports.length ? Math.round(reports.reduce((sum, item) => sum + item.accuracy, 0) / reports.length) : 0}%</strong></span></div><div><Zap size={20} /><span><small>สำเร็จด่าน 5</small><strong>{reports.filter((item) => item.level === 5).length}</strong></span></div></div>
            <div className="report-table-wrap"><table><thead><tr><th>ผู้เรียน</th><th>คะแนน</th><th>ความแม่นยำ</th><th>ตอบถูก</th><th>เวลา</th><th>ความก้าวหน้า</th><th>คำแนะนำ</th></tr></thead><tbody>{reports.length ? reports.map((report) => <tr key={report.id}><td><strong>{report.name}</strong><small>{report.date}</small></td><td>{report.score}</td><td><span className={`accuracy-pill ${report.accuracy >= 80 ? "good" : ""}`}>{report.accuracy}%</span></td><td>{report.correct}/{report.total}</td><td>{Math.floor(report.seconds / 60)}:{String(report.seconds % 60).padStart(2,"0")}</td><td><div className="level-progress"><i style={{ width: `${report.level / 5 * 100}%` }} /></div><small>Level {report.level}/5</small></td><td>{report.accuracy >= 85 ? "พร้อมประยุกต์ใช้กับปัญหาใหม่" : "ทบทวนการแยกแก่นกับรายละเอียดรอง"}</td></tr>) : <tr><td colSpan={7} className="empty-report">ยังไม่มีผลการเล่นบนอุปกรณ์นี้<br /><button className="secondary-button" onClick={() => setScreen("lobby")}><Play size={17} /> เริ่มภารกิจแรก</button></td></tr>}</tbody></table></div>
            <div className="teacher-note"><ShieldCheck size={18} /><span><strong>ความเป็นส่วนตัวในชั้นเรียน</strong><small>รายงานจัดเก็บในเบราว์เซอร์ของอุปกรณ์นี้เท่านั้น และครูเป็นผู้เลือกส่งออกไฟล์</small></span></div>
          </section>
        </div>}
      </section>
    </main>
  );
}
