"use client";

import { useEffect, useRef, type ReactNode } from "react";

const targets = [
  ".kadik-section-heading", ".kadik-intro > div:last-child", ".kadik-two-col > div:last-child",
  ".kadik-principle-card", ".kadik-post-card", ".kadik-issue-grid > article",
  ".kadik-timeline > article", ".kadik-stat-grid > div", ".kadik-wide-image",
  ".kadik-image-band .kadik-container", ".kadik-contact-items", ".kadik-form:not(.kadik-form-compact)",
  ".kadik-gallery-grid > button", ".kadik-legal > section", ".kadik-article > section", ".kadik-article-image",
].join(",");

/** Progressive enhancement: HTML is visible before JS and when motion is reduced. */
export function KadikMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet<Element>();
    const reveal = (node: HTMLElement) => { node.dataset.motionState = "visible"; };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        reveal(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -32px 0px" });
    const scan = () => {
      root.querySelectorAll<HTMLElement>(targets).forEach((node) => {
        if (seen.has(node)) return;
        seen.add(node);
        node.dataset.motion = node.tagName === "IMG" ? "zoom" : "up";
        const siblings = node.parentElement ? [...node.parentElement.children] : [];
        node.style.setProperty("--reveal-delay", `${Math.min(siblings.indexOf(node) % 3, 2) * 85}ms`);
        // Never hide first-screen/LCP content or restored-scroll content.
        if (preference.matches || node.getBoundingClientRect().top < window.innerHeight) reveal(node);
        else { node.dataset.motionState = "pending"; observer.observe(node); }
      });
    };
    const showAll = () => {
      if (!preference.matches) return;
      observer.disconnect();
      root.querySelectorAll<HTMLElement>("[data-motion]").forEach(reveal);
    };
    const focus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const node = event.target.closest<HTMLElement>("[data-motion]");
      if (node) { reveal(node); observer.unobserve(node); }
    };
    scan();
    const mutation = new MutationObserver(scan);
    mutation.observe(root, { childList: true, subtree: true });
    root.addEventListener("focusin", focus);
    preference.addEventListener("change", showAll);
    return () => {
      observer.disconnect(); mutation.disconnect();
      root.removeEventListener("focusin", focus); preference.removeEventListener("change", showAll);
      root.querySelectorAll<HTMLElement>("[data-motion]").forEach((node) => { delete node.dataset.motion; delete node.dataset.motionState; });
    };
  }, []);
  return <div ref={rootRef} className="kadik-site">{children}</div>;
}
