import { getAll } from "@vercel/edge-config";

const DEFAULT_STATUS = Object.freeze({
  maintenance_enabled: false,
  maintenance_title: "Estamos poniendo todo a punto.",
  maintenance_message: (
    "La agenda hizo una pausa breve. Volvé en unos minutos y reservá "
    + "tu espacio con normalidad."
  ),
  maintenance_note: "Pronto estaremos de vuelta.",
});

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET() {
  if (!process.env.EDGE_CONFIG) {
    return json({
      ...DEFAULT_STATUS,
      configured: false,
    });
  }

  try {
    const values = await getAll([
      "maintenance_enabled",
      "maintenance_title",
      "maintenance_message",
      "maintenance_note",
    ]);

    return json({
      maintenance_enabled: values.maintenance_enabled === true,
      maintenance_title: cleanText(
        values.maintenance_title,
        DEFAULT_STATUS.maintenance_title,
        90,
      ),
      maintenance_message: cleanText(
        values.maintenance_message,
        DEFAULT_STATUS.maintenance_message,
        260,
      ),
      maintenance_note: cleanText(
        values.maintenance_note,
        DEFAULT_STATUS.maintenance_note,
        100,
      ),
      configured: true,
    });
  } catch (error) {
    console.error("No se pudo leer el modo mantenimiento.", {
      name: error?.name,
      message: error?.message,
    });
    return json({
      ...DEFAULT_STATUS,
      configured: true,
      available: false,
    });
  }
}

export function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
    },
  });
}
