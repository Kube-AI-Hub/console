import * as React from 'react';

export interface ParticleFieldProps {
  className?: string;
  /** Ink colour as an "r, g, b" triple. */
  color?: string;
  /** Rough particles per 100x100 px cell, before the hard ceiling. */
  density?: number;
  /** Maximum opacity of a dot at rest (0-1). */
  dotOpacity?: number;
  /** Cap on particle count; protects low-end devices. */
  maxParticles?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const MAX_DPR = 2;
const LINK_DISTANCE = 120;

/**
 * Decorative constellation background.
 *
 * Discipline borrowed from the dongba implementation:
 *   - one requestAnimationFrame loop, cancelled on unmount
 *   - paused when the tab is hidden and when scrolled out of view
 *   - a single static frame under `prefers-reduced-motion`
 *   - DPR capped at 2 and a hard particle ceiling
 *
 * It never receives pointer events and is hidden from the accessibility tree:
 * it is atmosphere, not content.
 */
export function ParticleField({
  className,
  color = '255, 255, 255',
  density = 1,
  dotOpacity = 0.35,
  maxParticles = 90,
}: ParticleFieldProps): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const particlesRef = React.useRef<Particle[]>([]);
  const frameRef = React.useRef<number | null>(null);
  const visibleRef = React.useRef(true);
  const reducedRef = React.useRef(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = query.matches;
    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedRef.current = event.matches;
      if (event.matches) draw(true);
    };
    query.addEventListener('change', onMotionChange);

    const draw = (staticFrame: boolean) => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      context.fillStyle = `rgba(${color}, ${dotOpacity})`;
      for (const particle of particles) {
        if (!staticFrame) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < 0 || particle.x > width) particle.vx *= -1;
          if (particle.y < 0 || particle.y > height) particle.vy *= -1;
        }
        context.beginPath();
        context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        context.fill();
      }

      // Hairline links between near neighbours: the "constellation" read.
      context.strokeStyle = `rgba(${color}, ${dotOpacity * 0.4})`;
      context.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          if (!a || !b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (dx * dx + dy * dy > LINK_DISTANCE * LINK_DISTANCE) continue;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }
    };

    const seed = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const target = Math.min(maxParticles, Math.round(((width * height) / 10000) * density));
      particlesRef.current = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.2 + 0.5,
      }));
    };

    const loop = () => {
      if (reducedRef.current || !visibleRef.current) {
        frameRef.current = null;
        return;
      }
      draw(false);
      frameRef.current = window.requestAnimationFrame(loop);
    };

    const start = () => {
      if (frameRef.current !== null) return;
      if (reducedRef.current) {
        draw(true);
        return;
      }
      frameRef.current = window.requestAnimationFrame(loop);
    };

    const stop = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    seed();
    draw(true);
    start();

    const onVisibility = () => {
      visibleRef.current = document.visibilityState === 'visible';
      if (visibleRef.current) start();
      else stop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Scrolling the canvas out of view must not keep burning frames.
    let intersection: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      intersection = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            visibleRef.current = entry.isIntersecting;
            if (entry.isIntersecting) start();
            else stop();
          }
        },
        { threshold: 0 },
      );
      intersection.observe(canvas);
    }

    const onResize = () => {
      seed();
      draw(true);
      start();
    };
    window.addEventListener('resize', onResize);

    return () => {
      stop();
      query.removeEventListener('change', onMotionChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      intersection?.disconnect();
    };
  }, [color, density, dotOpacity, maxParticles]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
