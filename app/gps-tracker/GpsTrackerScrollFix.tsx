"use client";

import { useEffect } from "react";

/**
 * Override overflow:hidden dari globals.css (yang dipakai halaman peta)
 * agar gps-tracker bisa discroll normal di mobile.
 */
export default function GpsTrackerScrollFix() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;

    html.style.overflow = "auto";
    body.style.overflow = "auto";

    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  return null;
}
