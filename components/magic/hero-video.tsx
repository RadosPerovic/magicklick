"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const poster = "/images/pocetna-video-poster.jpg";

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    video.muted = true;
    if (preference.matches) video.pause();
    else void video.play().catch(() => setPlaying(false));
    const onPreferenceChange = () => { if (preference.matches) video.pause(); };
    preference.addEventListener("change", onPreferenceChange);
    return () => { preference.removeEventListener("change", onPreferenceChange); video.pause(); };
  }, []);

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setPlaying(false));
    else video.pause();
  }

  return <div className="hero-photo hero-video">
    {failed ? <img className="hero-video-fallback" src={poster} alt="MAGic KLICK držači na registarskoj tablici automobila"/> : <>
      <video ref={videoRef} src="/videos/pocetna.mp4" poster={poster} muted loop playsInline preload="metadata"
        aria-label="MAGic KLICK — prikaz automobila i registarskih tablica bez rama"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)}/>
      <button type="button" className="hero-video-control" onClick={togglePlayback} aria-label={playing ? "Pauziraj video" : "Pusti video"}>
        {playing ? <Pause size={18} aria-hidden="true"/> : <Play size={18} aria-hidden="true"/>}
      </button>
    </>}
  </div>;
}
