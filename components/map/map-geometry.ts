export function getPathEndpoints(path: [number, number][]) {
  if (path.length < 2) return [];
  const [startLat, startLng] = path[0];
  const [endLat, endLng] = path[path.length - 1];

  return [
    { lat: startLat, lng: startLng },
    { lat: endLat, lng: endLng },
  ];
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}
