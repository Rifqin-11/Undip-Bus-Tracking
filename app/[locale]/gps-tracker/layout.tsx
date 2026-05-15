import type { Metadata } from "next";
import GpsTrackerScrollFix from "./GpsTrackerScrollFix";

export const metadata: Metadata = {
  title: "Pelacak GPS — SIMOBI",
  description: "Kirim data GPS buggy listrik ke server SIMOBI secara realtime.",
};

export default function GpsTrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Override overflow:hidden dari globals.css yang dipakai halaman peta */}
      <GpsTrackerScrollFix />
      {children}
    </>
  );
}
