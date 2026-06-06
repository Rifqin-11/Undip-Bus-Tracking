"use client";

import Image, { type StaticImageData } from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import heroImage from "@/public/Hero Image.png";
import heroImageTwo from "@/public/Hero Image 2.png";
import heroImageThree from "@/public/Hero Image 3.png"

type HeroSlide = {
  src: StaticImageData;
  alt: string;
};

const slides: HeroSlide[] = [
  {
    src: heroImageThree,
    alt: "SIMOBI",
  },
  {
    src: heroImage,
    alt: "Ilustrasi fitur SIMOBI untuk memantau lokasi buggy, kepadatan penumpang, rute kampus, dan notifikasi geofence",
  },
  {
    src: heroImageTwo,
    alt: "Informasi layanan mobilitas kampus melalui platform SIMOBI",
  },
];

const AUTO_PLAY_INTERVAL_MS = 5000;

export default function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  const showNextSlide = useCallback(() => {
    setActiveIndex((currentIndex) => (currentIndex + 1) % slides.length);
  }, []);

  const showPreviousSlide = () => {
    setActiveIndex(
      (currentIndex) => (currentIndex - 1 + slides.length) % slides.length,
    );
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (mediaQuery.matches) {
      return;
    }

    const intervalId = window.setInterval(
      showNextSlide,
      AUTO_PLAY_INTERVAL_MS,
    );

    return () => window.clearInterval(intervalId);
  }, [showNextSlide]);

  return (
    <div
      className="group relative aspect-[3/1] min-h-[330px] overflow-hidden bg-[#f4f4f2] sm:min-h-0"
      aria-roledescription="carousel"
      aria-label="Informasi utama SIMOBI"
    >
      {slides.map((slide, index) => (
        <div
          key={slide.src.src}
          className={`absolute inset-0 transition-opacity duration-700 ${
            index === activeIndex
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          aria-hidden={index !== activeIndex}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            className="object-cover object-left"
            sizes="100vw"
            priority={index === 0}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={showPreviousSlide}
        className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#0f1a3b] shadow-md transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1a3b] sm:left-5"
        aria-label="Tampilkan slide sebelumnya"
        title="Slide sebelumnya"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={showNextSlide}
        className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#0f1a3b] shadow-md transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1a3b] sm:right-5"
        aria-label="Tampilkan slide berikutnya"
        title="Slide berikutnya"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow-sm">
        {slides.map((slide, index) => (
          <button
            key={slide.src.src}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`h-2.5 rounded-full transition-all ${
              index === activeIndex
                ? "w-7 bg-[#0f1a3b]"
                : "w-2.5 bg-slate-300 hover:bg-slate-400"
            }`}
            aria-label={`Tampilkan slide ${index + 1}`}
            aria-current={index === activeIndex}
          />
        ))}
      </div>
    </div>
  );
}
