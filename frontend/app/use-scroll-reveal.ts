"use client";

import { useEffect } from "react";

/**
 * Custom hook to trigger Apple/Linear-style scroll reveal animations.
 * When elements with the given selector scroll into the viewport,
 * the `.is-visible` CSS class is attached, sliding them smoothly upward.
 */
export function useScrollReveal(selector = ".scroll-reveal") {
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      // Fallback for environments without IntersectionObserver
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const elements = document.querySelectorAll(selector);
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            // Stop observing once animated so it stays in place
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [selector]);
}

export default useScrollReveal;
