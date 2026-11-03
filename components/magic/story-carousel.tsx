"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const photos = [
  { id: 1, alt: "Zadnji deo sivog Audija iz ugla" },
  { id: 3, alt: "Prednji deo crvenog Porschea" },
  { id: 4, alt: "Prednji deo crnog Mercedesa" },
  { id: 5, alt: "Automobil sa MAGic KLICK držačem tablice" },
  { id: 6, alt: "Prednji deo sive Alfa Romeo" },
  { id: 7, alt: "Tamni BMW iz prednjeg ugla" },
  { id: 8, alt: "Prednji deo sivog Volkswagena" },
  { id: 9, alt: "Beli Audi pored jezera" },
  { id: 11, alt: "Crni Audi iz prednjeg ugla" },
  { id: 12, alt: "Sivi Audi iz prednjeg ugla" },
  { id: 13, alt: "Prednji deo crnog Audija" },
  { id: "sneg", alt: "Zadnji deo crnog Audija na snegu, pored skija" },
];

export function StoryCarousel() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const photo = photos[index];
  const step = (direction: number) =>
    setIndex((current) => (current + direction + photos.length) % photos.length);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    }, { threshold: 0.2 });
    observer.observe(frame);
    const timer = window.setInterval(() => {
      if (visible && !document.hidden && !motion.matches && !frame.matches(":hover, :focus-within")) {
        setIndex((current) => (current + 1) % photos.length);
      }
    }, 5000);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [index]);

  return (
    <div ref={frameRef} className="story-visual story-carousel" role="group" aria-label="Galerija automobila">
      <img key={photo.id} src={`/images/auto-galerija/auto-${photo.id}.webp`} alt={photo.alt} loading="lazy"/>
      <button type="button" className="story-carousel-prev" aria-label="Prethodna slika automobila" onClick={() => step(-1)}><ChevronLeft size={20} aria-hidden="true"/></button>
      <button type="button" className="story-carousel-next" aria-label="Sledeća slika automobila" onClick={() => step(1)}><ChevronRight size={20} aria-hidden="true"/></button>
    </div>
  );
}
