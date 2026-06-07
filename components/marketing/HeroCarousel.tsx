"use client";

import Image, { type StaticImageData } from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import heroImage from "@/public/Hero Image.png";
import heroImageTwo from "@/public/Hero Image 2.png";
import heroImageThree from "@/public/Hero Image 3.png";

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
      className="group relative aspect-[2/1] overflow-hidden bg-[#f4f4f2] sm:aspect-[3/1]"
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
            className="object-contain object-center sm:object-cover sm:object-left"
            sizes="100vw"
            priority={index === 0}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={showPreviousSlide}
        className="absolute bottom-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#0f1a3b] shadow-md transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1a3b] sm:bottom-auto sm:left-5 sm:top-1/2 sm:h-10 sm:w-10 sm:-translate-y-1/2"
        aria-label="Tampilkan slide sebelumnya"
        title="Slide sebelumnya"
      >
        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      <button
        type="button"
        onClick={showNextSlide}
        className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#0f1a3b] shadow-md transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1a3b] sm:bottom-auto sm:right-5 sm:top-1/2 sm:h-10 sm:w-10 sm:-translate-y-1/2"
        aria-label="Tampilkan slide berikutnya"
        title="Slide berikutnya"
      >
        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1.5 shadow-sm sm:bottom-4 sm:gap-2 sm:px-3 sm:py-2">
        {slides.map((slide, index) => (
          <button
            key={slide.src.src}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`h-2 rounded-full transition-all sm:h-2.5 ${
              index === activeIndex
                ? "w-5 bg-[#0f1a3b] sm:w-7"
                : "w-2 bg-slate-300 hover:bg-slate-400 sm:w-2.5"
            }`}
            aria-label={`Tampilkan slide ${index + 1}`}
            aria-current={index === activeIndex}
          />
        ))}
      </div>
    </div>
  );
}
