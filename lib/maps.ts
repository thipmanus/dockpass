export function createGoogleMapsLink(lat?: number | null, lng?: number | null) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  return `https://www.google.com/maps?q=${lat},${lng}`;
}
