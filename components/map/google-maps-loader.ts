import type { Locale } from "@/lib/i18n/config";
import type { GoogleMapsWindow, MapsApi } from "@/types/map-canvas";

const SCRIPT_ID = "google-maps-script";
const CALLBACK_NAME = "__simobiGoogleMapsReady";

function getMapsApi(): MapsApi | null {
  return (window as GoogleMapsWindow).google?.maps ?? null;
}

function isMapsApiReady(maps: MapsApi | null): maps is MapsApi {
  return typeof maps?.Map === "function" && typeof maps.Marker === "function";
}

function waitForMapsApiReady(timeoutMs = 10_000): Promise<MapsApi> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const maps = getMapsApi();

      if (isMapsApiReady(maps)) {
        resolve(maps);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("Google Maps JavaScript API tidak siap setelah load."));
        return;
      }

      window.setTimeout(check, 50);
    };

    check();
  });
}

export function loadGoogleMapsScript(
  apiKey: string,
  locale: Locale,
): Promise<MapsApi> {
  const mapsApi = getMapsApi();
  if (isMapsApiReady(mapsApi)) return Promise.resolve(mapsApi);

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      waitForMapsApiReady().then(resolve).catch(reject);
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps script")),
      );
      return;
    }

    (
      window as unknown as GoogleMapsWindow &
        Record<typeof CALLBACK_NAME, () => void>
    )[CALLBACK_NAME] = () => {
      waitForMapsApiReady().then(resolve).catch(reject);
    };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=marker&language=${locale}&callback=${CALLBACK_NAME}`;
    script.async = true;
    script.defer = true;
    script.onerror = () =>
      reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
}
