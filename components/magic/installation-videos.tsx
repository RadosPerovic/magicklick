"use client";

import { Camera, Heart, Play } from "lucide-react";
import { useRef, useState } from "react";

interface AutoInstallationVideoProps {
  label: string;
  poster: string;
  src?: string;
}

const autoVideos: AutoInstallationVideoProps[] = [
  { label: "Video montaže 1", poster: "/images/auto-montaza-01-poster.jpg", src: "/videos/auto-montaza-01-bez-zvuka.mp4" },
  { label: "Video montaže 2", poster: "/images/auto-montaza-02-poster.jpg", src: "/videos/auto-montaza-02-bez-zvuka.mp4" },
  { label: "Video montaže 3", poster: "/images/auto-montaza-03-poster.jpg", src: "/videos/auto-montaza-03-bez-zvuka.mp4" },
];

function InstallationVideoPlayer({ label, poster, src, width, height }: {
  label: string; poster: string; src: string; width: number; height: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="installation-video-poster installation-video-ready" style={{ aspectRatio: `${width}/${height}` }}>
      <video ref={videoRef} className="installation-video-player" src={src} poster={poster}
        width={width} height={height} controls muted playsInline preload="none" aria-label={label}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}>
        Tvoj pregledač ne podržava video. <a href={src}>Otvori snimak</a>.
      </video>
      {!playing && (
        <button type="button" className="installation-video-play" aria-label={`Pusti: ${label}`}
          onClick={() => { void videoRef.current?.play().catch(() => {}); }}>
          <Play size={28} fill="currentColor" strokeWidth={1} aria-hidden="true"/>
        </button>
      )}
    </div>
  );
}

function AutoInstallationVideo({ label, poster, src }: AutoInstallationVideoProps) {
  const [liked, setLiked] = useState(false);

  return (
    <article className="installation-video-card" aria-label={label}>
      {src ? <InstallationVideoPlayer label={label} poster={poster} src={src} width={720} height={1280}/> : (
        <div className="installation-video-poster">
          <img src={poster} alt="" loading="lazy"/>
          <button type="button" className="installation-video-play" disabled
            aria-label={`${label} — snimak još nije dodat`}>
            <Play size={28} fill="currentColor" strokeWidth={1} aria-hidden="true"/>
          </button>
        </div>
      )}
      <div className="installation-video-social">
        <button type="button" className="installation-video-like"
          aria-label={`Sviđa mi se: ${label}`} aria-pressed={liked}
          onClick={() => setLiked((current) => !current)}>
          <Heart size={22} fill={liked ? "currentColor" : "none"} aria-hidden="true"/>
        </button>
        <p>Originalni video sa <a href="https://www.instagram.com/magic.klick/" target="_blank" rel="noreferrer">@magic.klick</a> profila.</p>
      </div>
    </article>
  );
}

export function InstallationVideos({ productId = "auto" }: { productId?: "auto" | "moto" }) {
  const isMoto = productId === "moto";
  const [liked, setLiked] = useState(false);
  return (
    <section className="installation-videos" id="montaza" aria-labelledby="installation-videos-title">
      <div className="wrap">
        <div className="section-heading">
          <div>
            <h2 id="installation-videos-title">Montaža<span>.</span><br/><em>Pogledaj kako.</em></h2>
          </div>
          <p>{isMoto ? "Video vodič za postavljanje MAGic KLICK držača na registarsku tablicu motocikla." : <>Video vodiči za postavljanje MAGic KLICK držača<br className="desktop-break"/> na prednju i zadnju tablicu automobila.</>}</p>
        </div>
        <div className={`installation-video-grid${isMoto ? " installation-video-grid-single" : " installation-video-grid-auto"}`}>
          {isMoto ? (
            <article className="installation-video-card">
              <InstallationVideoPlayer
                src="/videos/moto-montaza-bez-zvuka.mp4"
                poster="/images/moto-montaza-poster.jpg"
                width={1280}
                height={738}
                label="Montaža MAGic KLICK držača na motociklu"
              />
              <div className="installation-video-social">
                <button
                  type="button"
                  className="installation-video-like"
                  aria-label="Sviđa mi se video"
                  aria-pressed={liked}
                  onClick={() => setLiked((current) => !current)}
                >
                  <Heart size={22} fill={liked ? "currentColor" : "none"} aria-hidden="true"/>
                </button>
                <p>Za još videa pogledaj naš Instagram <a href="https://www.instagram.com/magic.klick/" target="_blank" rel="noreferrer">@magic.klick</a>.</p>
              </div>
            </article>
          ) : autoVideos.map((video) => (
            <AutoInstallationVideo key={video.label} {...video}/>
          ))}
        </div>
        {!isMoto && (
          <div className="installation-video-note">
            <a href="https://www.instagram.com/magic.klick/" className="text-link" target="_blank" rel="noreferrer">Za još videa poseti naš Instagram <Camera size={15} aria-hidden="true"/></a>
          </div>
        )}
      </div>
    </section>
  );
}
