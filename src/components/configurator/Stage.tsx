"use client";

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { CategoryId } from "@/lib/pricing/catalog";
import { CHARACTERS } from "@/lib/characters";
import styles from "./Stage.module.css";

// three.js и сцена — отдельным чанком и только в браузере.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

type Props = { category: CategoryId };

export function Stage({ category }: Props) {
  const webgl = useWebGLSupport();
  const reducedMotion = useReducedMotion();
  const [inView, observe] = useInView();
  const character = CHARACTERS[category];

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [touched, setTouched] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [waveSignal, setWaveSignal] = useState(0);
  const [phrase, setPhrase] = useState<string | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef(0);

  const say = useCallback((list: string[]) => {
    window.clearTimeout(hideTimer.current);
    setPhrase(list[Math.floor(Math.random() * list.length)]);
    hideTimer.current = window.setTimeout(() => setPhrase(null), 4800);
  }, []);

  // Реплика при появлении персонажа.
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => say(CHARACTERS[category].phrases), 450);
    return () => window.clearTimeout(t);
  }, [category, ready, say]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const onReady = useCallback(() => setReady(true), []);
  const onInteract = useCallback(() => setTouched(true), []);
  const onPoke = useCallback(() => {
    setWaveSignal((n) => n + 1);
    say(CHARACTERS[category].phrases);
  }, [category, say]);

  const retry = async () => {
    const mod = await import("./Scene");
    mod.clearModels();
    setFailed(false);
    setReady(false);
    setAttempt((n) => n + 1);
  };

  const show3d = webgl === true && !failed;
  const posterHidden = show3d && ready;

  return (
    <div className={styles.stage} ref={observe}>
      <div className={styles.poster} data-hidden={posterHidden}>
        <Image
          key={category}
          src={character.poster}
          alt={character.alt}
          fill
          sizes="(min-width: 900px) 46vw, 92vw"
          loading="eager"
          fetchPriority="high"
        />
      </div>

      {show3d && (
        <SceneBoundary key={attempt} onError={() => setFailed(true)}>
          <div className={styles.canvas} data-ready={ready}>
            <Scene
              category={category}
              reducedMotion={reducedMotion}
              active={inView}
              resetSignal={resetSignal}
              waveSignal={waveSignal}
              bubbleRef={bubbleRef}
              onReady={onReady}
              onInteract={onInteract}
              onPoke={onPoke}
            />
          </div>
        </SceneBoundary>
      )}

      {show3d && (
        <div ref={bubbleRef} className={styles.bubble} data-show={ready && phrase !== null} aria-hidden="true">
          {phrase}
        </div>
      )}

      {show3d && !ready && <p className={styles.status}>Загружаем 3D…</p>}

      {webgl === false && (
        <p className={styles.status}>3D на этом устройстве недоступно — показываем картинку. Выбор и расчёт работают как обычно.</p>
      )}

      {failed && (
        <div className={styles.status} role="alert">
          <span>Не удалось загрузить 3D-модель.</span>
          <button type="button" className={styles.retry} onClick={retry}>
            Повторить
          </button>
        </div>
      )}

      {show3d && ready && (
        <>
          <p className={styles.hint} data-hidden={touched}>
            Покрутите пальцем или мышью
          </p>
          <button
            type="button"
            className={styles.reset}
            onClick={() => setResetSignal((n) => n + 1)}
            aria-label="Сбросить ракурс"
            title="Сбросить ракурс"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { error: boolean }> {
  state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  componentDidCatch(error: unknown) {
    console.error("3D-сцена не загрузилась:", error);
    this.props.onError();
  }

  render() {
    return this.state.error ? null : this.props.children;
  }
}

// ─── Возможности устройства ─────────────────────────────────────────

let webglCache: boolean | undefined;

function detectWebGL(): boolean {
  if (webglCache === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglCache = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
      webglCache = false;
    }
  }
  return webglCache;
}

const noopSubscribe = () => () => {};

/** null — ещё не знаем (сервер и первый проход гидратации). */
function useWebGLSupport(): boolean | null {
  return useSyncExternalStore(noopSubscribe, detectWebGL, () => null);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function useInView(): [boolean, (node: HTMLElement | null) => void] {
  const [inView, setInView] = useState(true);
  const [node, setNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!node) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "120px" });
    io.observe(node);
    return () => io.disconnect();
  }, [node]);
  return [inView, setNode];
}
