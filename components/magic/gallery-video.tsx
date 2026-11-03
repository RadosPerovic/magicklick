"use client";

import { useEffect, useRef } from "react";

interface GalleryVideoProps {
  src: string;
  poster: string;
  label: string;
  active?: boolean;
  onEnded?: () => void;
  className?: string;
}

export function GalleryVideo({ src, poster, label, active = true, onEnded, className }: GalleryVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    video.muted = true;
    const updatePlayback = () => {
      if (active && visible && !document.hidden && !preference.matches) {
        if (!video.ended) void video.play().catch(() => {});
      } else {
        video.pause();
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updatePlayback();
    }, { threshold: 0.2 });
    observer.observe(video);
    document.addEventListener("visibilitychange", updatePlayback);
    preference.addEventListener("change", updatePlayback);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updatePlayback);
      preference.removeEventListener("change", updatePlayback);
      video.pause();
    };
  }, [src, active]);

  return (
    <video ref={videoRef} className={className} src={src} poster={poster}
      muted playsInline controls preload="metadata" aria-label={label}
      onEnded={onEnded} onError={onEnded}>
      Tvoj pregledač ne podržava video. <a href={src}>Otvori snimak</a>.
    </video>
  );
}
