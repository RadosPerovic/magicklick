"use client";

import { Camera, Heart, Play } from "lucide-react";
import { useState } from "react";
import { imagePath } from "@/lib/catalog";

const autoPreviews = [
  { title: "Prednja tablica", image: "f6a1a55882e760cf", number: "01" },
  { title: "Zadnja tablica", image: "df6b22664384b3c8", number: "02" },
];

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
        <div className={`installation-video-grid${isMoto ? " installation-video-grid-single" : ""}`}>
          {isMoto ? (
            <article className="installation-video-card">
              <video
                className="installation-video-player"
                src="/videos/moto-montaza-bez-zvuka.mp4"
                poster="/images/moto-montaza-poster.jpg"
                width={1280}
                height={738}
                controls
                muted
                playsInline
                preload="none"
                aria-label="Montaža MAGic KLICK držača na motociklu"
              >
                Tvoj pregledač ne podržava video. <a href="/videos/moto-montaza-bez-zvuka.mp4">Otvori snimak</a>.
              </video>
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
          ) : autoPreviews.map((preview) => (
            <article className="installation-video-card" key={preview.number}>
              <div className="installation-video-poster">
                <img src={imagePath(preview.image)} alt="" loading="lazy"/>
                <span className="installation-video-status">VIDEO USKORO</span>
                <span className="installation-video-play" aria-hidden="true"><Play size={28} fill="currentColor" strokeWidth={1}/></span>
                <div className="installation-video-caption">
                  <span>MONTAŽA · {preview.number}</span>
                  <h3>{preview.title}</h3>
                </div>
              </div>
              <div className="installation-video-footer"><Camera size={16} aria-hidden="true"/><span>@magic.klick</span><span>Demo prikaz</span></div>
            </article>
          ))}
        </div>
        {!isMoto && (
          <div className="installation-video-note">
            <p>Uskoro ovde možeš da pogledaš video uputstva za montažu.</p>
            <a href="https://www.instagram.com/magic.klick/" className="text-link" target="_blank" rel="noreferrer">Za još videa poseti naš Instagram <Camera size={15} aria-hidden="true"/></a>
          </div>
        )}
      </div>
    </section>
  );
}
