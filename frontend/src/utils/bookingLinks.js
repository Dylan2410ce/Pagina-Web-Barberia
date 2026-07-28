const PRODUCTION_ORIGIN = "https://sebasbarber.vercel.app";

export function bookingManageUrl(accessCode = "", origin) {
  const baseOrigin = String(
    origin
    || (typeof window !== "undefined" ? window.location.origin : PRODUCTION_ORIGIN),
  ).replace(/\/+$/, "");
  const code = String(accessCode || "").trim();
  if (!code) return `${baseOrigin}/#mis-citas`;
  return `${baseOrigin}/?reserva=${encodeURIComponent(code)}#mis-citas`;
}
