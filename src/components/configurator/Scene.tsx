"use client";

// 3D-сцена конфигуратора. Грузится только в браузере (next/dynamic, ssr: false).

import { Suspense, useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CATEGORY_IDS, type CategoryId } from "@/lib/pricing/catalog";
import { CHARACTERS } from "@/lib/characters";

export type SceneProps = {
  category: CategoryId;
  /** prefers-reduced-motion: без анимаций, перерисовка только по запросу */
  reducedMotion: boolean;
  /** сцена в зоне видимости; иначе кадры не считаются */
  active: boolean;
  /** увеличивается — вернуть камеру в исходный ракурс */
  resetSignal: number;
  /** увеличивается — персонаж машет рукой */
  waveSignal: number;
  /** реплика: сцена сама ставит её над головой персонажа */
  bubbleRef: RefObject<HTMLDivElement | null>;
  onReady: () => void;
  onInteract: () => void;
  onPoke: () => void;
};

const USE_DRACO = false; // модели сжаты meshopt, Draco не нужен
const USE_MESHOPT = true;
const CAMERA_POSITION = new THREE.Vector3(0.35, 0.42, 1).normalize().multiplyScalar(4.3);
/** радиус, в который вписывается любая модель: камера одна на все категории */
const FIT_RADIUS = 1;
/** общая линия пола: при смене категории мебель «стоит» на одном месте, сверху — место для реплики */
const FLOOR_Y = -0.72;

export function clearModels() {
  for (const id of CATEGORY_IDS) useGLTF.clear(CHARACTERS[id].model);
}

export default function Scene(props: SceneProps) {
  const frameloop = props.active && !props.reducedMotion ? "always" : "demand";
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      frameloop={frameloop}
      camera={{ fov: 30, near: 0.1, far: 40, position: CAMERA_POSITION.toArray() }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Lights />
      <Characters {...props} />
      <Controls resetSignal={props.resetSignal} onInteract={props.onInteract} />
    </Canvas>
  );
}

function Lights() {
  const gl = useThree((s) => s.gl);
  // Мягкое окружение без загрузки HDR: процедурная «комната» из three.js.
  const envMap = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return texture;
  }, [gl]);
  useEffect(() => () => envMap.dispose(), [envMap]);

  return (
    <>
      <Environment map={envMap} environmentIntensity={0.55} />
      <hemisphereLight args={["#ffffff", "#d9cfc2", 1.1]} />
      <directionalLight
        position={[-2.4, 5, 3.4]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-2.4}
        shadow-camera-right={2.4}
        shadow-camera-top={2.4}
        shadow-camera-bottom={-2.4}
        shadow-camera-near={1}
        shadow-camera-far={14}
      />
    </>
  );
}

function Controls({ resetSignal, onInteract }: { resetSignal: number; onInteract: () => void }) {
  const ref = useRef<ComponentRef<typeof OrbitControls>>(null);
  const firstReset = useRef(resetSignal);

  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    // Вертикальный свайп на телефоне листает страницу, горизонтальный — вращает мебель.
    const el = controls.domElement as HTMLElement | undefined;
    if (el) el.style.touchAction = "pan-y";
    controls.addEventListener("start", onInteract);
    return () => controls.removeEventListener("start", onInteract);
  }, [onInteract]);

  useEffect(() => {
    if (resetSignal !== firstReset.current) ref.current?.reset();
  }, [resetSignal]);

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={[0, 0, 0]}
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      minPolarAngle={Math.PI * 0.24}
      maxPolarAngle={Math.PI * 0.49}
      minAzimuthAngle={-Math.PI * 0.42}
      maxAzimuthAngle={Math.PI * 0.42}
    />
  );
}

// ─── Персонажи и смена категории ────────────────────────────────────

type Slot = { key: number; category: CategoryId; leaving: boolean };

function Characters(props: SceneProps) {
  const { category } = props;
  const [slots, setSlots] = useState<Slot[]>([{ key: 0, category, leaving: false }]);
  const [shown, setShown] = useState(category);

  // Смена категории: текущий уходит, новый появляется. Держим не больше двух сразу,
  // поэтому быстрые переключения не копят модели в сцене.
  if (category !== shown) {
    setShown(category);
    setSlots((prev) => {
      const current = prev.filter((s) => !s.leaving);
      const nextKey = Math.max(...prev.map((s) => s.key)) + 1;
      const leaving = props.reducedMotion ? [] : current.map((s) => ({ ...s, leaving: true }));
      return [...leaving, { key: nextKey, category, leaving: false }];
    });
  }

  const preloaded = useRef(false);
  const handleReady = () => {
    props.onReady();
    if (preloaded.current) return;
    preloaded.current = true;
    // Остальные модели — заранее, чтобы следующая смена была мгновенной.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    idle(() => {
      for (const id of CATEGORY_IDS) useGLTF.preload(CHARACTERS[id].model, USE_DRACO, USE_MESHOPT);
    });
  };

  return (
    <>
      {slots.map((slot) => (
        <Suspense key={slot.key} fallback={null}>
          <Character
            slot={slot}
            reducedMotion={props.reducedMotion}
            waveSignal={props.waveSignal}
            bubbleRef={slot.leaving ? null : props.bubbleRef}
            onReady={slot.leaving ? undefined : handleReady}
            onPoke={props.onPoke}
            onGone={() => setSlots((prev) => prev.filter((s) => s.key !== slot.key))}
          />
        </Suspense>
      ))}
    </>
  );
}

type Prepared = {
  root: THREE.Object3D;
  clips: THREE.AnimationClip[];
  scale: number;
  offset: THREE.Vector3;
  floorY: number;
};

function usePrepared(category: CategoryId): Prepared {
  const gltf = useGLTF(CHARACTERS[category].model, USE_DRACO, USE_MESHOPT);
  return useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = (FIT_RADIUS / (size.length() / 2)) * CHARACTERS[category].fit;
    const offset = new THREE.Vector3(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return { root, clips: gltf.animations, scale, offset, floorY: FLOOR_Y + (CHARACTERS[category].lift ?? 0) };
  }, [gltf, category]);
}

type CharacterProps = {
  slot: Slot;
  reducedMotion: boolean;
  waveSignal: number;
  bubbleRef: RefObject<HTMLDivElement | null> | null;
  onReady?: () => void;
  onPoke: () => void;
  onGone: () => void;
};

const ENTER_S = 0.5;
const LEAVE_S = 0.22;

function Character({ slot, reducedMotion, waveSignal, bubbleRef, onReady, onPoke, onGone }: CharacterProps) {
  const { root, clips, scale, offset, floorY } = usePrepared(slot.category);
  const group = useRef<THREE.Group>(null);
  const progress = useRef(reducedMotion ? 1 : 0);
  const gone = useRef(false);
  const invalidate = useThree((s) => s.invalidate);

  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root]);
  const actions = useMemo(() => {
    const map = new Map<string, THREE.AnimationAction>();
    for (const clip of clips) map.set(clip.name, mixer.clipAction(clip));
    return map;
  }, [clips, mixer]);

  useEffect(() => {
    onReady?.();
    invalidate();
    // onReady меняется на каждом рендере родителя; вызываем один раз при появлении.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Дыхание, приветствие при появлении и редкое моргание.
  useEffect(() => {
    if (reducedMotion || slot.leaving) return;
    actions.get("Idle")?.play();
    const wave = actions.get("Wave");
    const blink = actions.get("Blink");
    wave?.setLoop(THREE.LoopOnce, 1);
    blink?.setLoop(THREE.LoopOnce, 1);
    const waveTimer = window.setTimeout(() => wave?.reset().play(), 380);
    let blinkTimer = 0;
    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(() => {
        blink?.reset().play();
        scheduleBlink();
      }, 2800 + Math.random() * 4200);
    };
    scheduleBlink();
    return () => {
      window.clearTimeout(waveTimer);
      window.clearTimeout(blinkTimer);
      mixer.stopAllAction();
    };
  }, [actions, mixer, reducedMotion, slot.leaving]);

  // Повторное приветствие по нажатию на персонажа.
  const firstWave = useRef(waveSignal);
  useEffect(() => {
    if (waveSignal === firstWave.current || reducedMotion || slot.leaving) return;
    actions.get("Wave")?.reset().play();
    invalidate();
  }, [waveSignal, actions, reducedMotion, slot.leaving, invalidate]);

  useEffect(() => () => void mixer.uncacheRoot(root), [mixer, root]);

  const anchors = useMemo(
    () => ({ bubble: root.getObjectByName("anchor_bubble"), face: root.getObjectByName("anchor_face") }),
    [root],
  );
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), f: new THREE.Vector3() }), []);
  const bubbleLift = CHARACTERS[slot.category].bubbleLift ?? 0;

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    mixer.update(dt);

    // Появление «из пола» с лёгким перелётом, уход — быстрое сжатие.
    const g = group.current;
    if (g) {
      if (slot.leaving) {
        progress.current = Math.max(0, progress.current - dt / LEAVE_S);
        const s = easeInCubic(progress.current);
        g.scale.setScalar(s);
        if (progress.current === 0 && !gone.current) {
          gone.current = true;
          onGone();
        }
      } else if (progress.current < 1) {
        progress.current = Math.min(1, progress.current + dt / ENTER_S);
        g.scale.setScalar(easeOutBack(progress.current));
      } else if (g.scale.x !== 1) {
        g.scale.setScalar(1);
      }
    }

    if (bubbleRef?.current && anchors.bubble && anchors.face) {
      placeBubble(bubbleRef.current, anchors.bubble, anchors.face, bubbleLift, state.camera, state.size, tmp);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    // Короткое нажатие — «помахать»; перетаскивание — это вращение.
    if (e.delta < 6) {
      e.stopPropagation();
      onPoke();
    }
  };

  return (
    <group ref={group} position-y={floorY} scale={reducedMotion ? 1 : 0}>
      <group position={offset} scale={scale}>
        <primitive object={root} onClick={handleClick} />
      </group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <shadowMaterial transparent opacity={0.16} />
      </mesh>
    </group>
  );
}

function easeOutBack(t: number) {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function easeInCubic(t: number) {
  return t * t * t;
}

/**
 * Реплика над головой: проекция якоря на экран, не выходит за край сцены
 * и не закрывает лицо (если сверху места нет — уходит вбок).
 */
function placeBubble(
  el: HTMLDivElement,
  bubbleAnchor: THREE.Object3D,
  faceAnchor: THREE.Object3D,
  lift: number,
  camera: THREE.Camera,
  size: { width: number; height: number },
  tmp: { a: THREE.Vector3; f: THREE.Vector3 },
) {
  const toPx = (o: THREE.Object3D, v: THREE.Vector3, dy = 0) => {
    o.getWorldPosition(v);
    v.y += dy;
    v.project(camera);
    return { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height };
  };
  const a = toPx(bubbleAnchor, tmp.a, lift);
  const f = toPx(faceAnchor, tmp.f);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const m = 10;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

  let x = clamp(a.x, m + w / 2, size.width - m - w / 2);
  let bottom = Math.max(a.y - 6, h + m);
  const faceTop = f.y - 34;
  if (bottom > faceTop) {
    // Над головой не помещается — ставим сбоку от лица.
    const side = f.x > size.width / 2 ? -1 : 1;
    x = clamp(f.x + side * (w / 2 + 56), m + w / 2, size.width - m - w / 2);
    bottom = clamp(f.y - 20, h + m, size.height - m);
  }
  const left = x - w / 2;
  const tail = clamp(a.x - left, 18, w - 18);
  el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(bottom - h)}px, 0)`;
  el.style.setProperty("--tail-x", `${Math.round(tail)}px`);
}
