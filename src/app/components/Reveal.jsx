'use client'

import { useEffect } from 'react'

// One-shot entrance for blocks that start below the fold. Content is visible without
// JavaScript and under reduced motion; anything already in view is never animated.
export default function Reveal() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const pending = [...document.querySelectorAll('[data-reveal]')].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight,
    )
    if (pending.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.replace('reveal-pending', 'reveal-in')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    for (const el of pending) {
      el.classList.add('reveal-pending')
      observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return null
}
