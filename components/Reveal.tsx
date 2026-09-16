"use client";

// Scroll-reveal wrapper: fades/translates a section into view once, with the
// captured timing (opacity 0 -> 1, translateY 20px, 1s linear).
//
// Two rules this file exists to enforce, both learned from measurement:
//
// 1. Progressive enhancement. The section renders *visible*; the hidden start
//    state is armed from the client. A page whose JS never runs stays readable
//    instead of being blank forever.
// 2. Geometry, not one observer per section. With an IntersectionObserver per
//    section, two of nine sections stayed at opacity 0 on a real page even
//    though a freshly attached observer on the very same nodes reported
//    intersectionRatio 1 - a section that never un-hides is worse than no
//    animation at all. One shared scroll/resize pass reads getBoundingClientRect
//    for every registered node, so a section cannot be forgotten, and a node is
//    only hidden while it is genuinely below the fold (no flash for what the
//    visitor is already looking at).
import { useEffect, useRef, type ElementType, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** extra delay in ms before the transition starts */
  delay?: number;
}

/** Fraction of the viewport a node's top must cross before it opens. */
const ENTER_RATIO = 0.9;

const pending = new Set<HTMLElement>();
let scheduled = false;
let listening = false;

function open(node: HTMLElement): void {
  node.classList.add("is-visible");
  pending.delete(node);
}

function pass(): void {
  scheduled = false;
  const limit = window.innerHeight * ENTER_RATIO;
  for (const node of [...pending]) {
    const rect = node.getBoundingClientRect();
    // Below the fold: keep it armed. Anything else - in view, already scrolled
    // past, or collapsed to zero height - opens.
    if (rect.top < limit) open(node);
    else node.classList.add("reveal-armed");
  }
  if (pending.size === 0 && listening) {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    listening = false;
  }
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(pass);
}

function register(node: HTMLElement): () => void {
  pending.add(node);
  if (!listening) {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    listening = true;
  }
  schedule();
  return () => {
    pending.delete(node);
  };
}

export default function Reveal({ children, as, className = "", delay = 0 }: RevealProps) {
  const Tag = as ?? "div";
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (delay) node.style.transitionDelay = `${delay}ms`;
    return register(node);
  }, [delay]);

  return (
    <Tag ref={ref} className={`reveal ${className}`}>
      {children}
    </Tag>
  );
}
