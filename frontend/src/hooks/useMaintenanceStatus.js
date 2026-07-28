import { useCallback, useEffect, useState } from "react";

const DEFAULT_STATUS = {
  maintenance_enabled: false,
  maintenance_title: "Estamos poniendo todo a punto.",
  maintenance_message: (
    "La agenda hizo una pausa breve. Volvé en unos minutos y reservá "
    + "tu espacio con normalidad."
  ),
  maintenance_note: "Pronto estaremos de vuelta.",
  loading: true,
  checking: false,
};

function normalizeStatus(value = {}) {
  return {
    maintenance_enabled: value.maintenance_enabled === true,
    maintenance_title: (
      typeof value.maintenance_title === "string"
      && value.maintenance_title.trim()
    ) || DEFAULT_STATUS.maintenance_title,
    maintenance_message: (
      typeof value.maintenance_message === "string"
      && value.maintenance_message.trim()
    ) || DEFAULT_STATUS.maintenance_message,
    maintenance_note: (
      typeof value.maintenance_note === "string"
      && value.maintenance_note.trim()
    ) || DEFAULT_STATUS.maintenance_note,
    configured: value.configured === true,
    loading: false,
    checking: false,
  };
}

export default function useMaintenanceStatus(enabled = true) {
  const preview = (
    import.meta.env.DEV
    && new URLSearchParams(window.location.search).get("preview-maintenance")
      === "1"
  );
  const [status, setStatus] = useState(() => ({
    ...DEFAULT_STATUS,
    maintenance_enabled: preview,
    loading: enabled && !preview,
  }));

  const refresh = useCallback(async () => {
    if (preview) {
      const next = {
        ...DEFAULT_STATUS,
        maintenance_enabled: true,
        loading: false,
        checking: false,
      };
      setStatus(next);
      return next;
    }

    if (!enabled) {
      const next = { ...DEFAULT_STATUS, loading: false };
      setStatus(next);
      return next;
    }

    setStatus((current) => ({ ...current, checking: true }));
    try {
      const response = await fetch("/api/site-status", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Estado no disponible");
      const next = normalizeStatus(await response.json());
      setStatus(next);
      return next;
    } catch {
      setStatus((current) => {
        const next = {
          ...current,
          loading: false,
          checking: false,
          available: false,
        };
        return next;
      });
      return null;
    }
  }, [enabled, preview]);

  useEffect(() => {
    let active = true;

    const check = async () => {
      const next = await refresh();
      if (!active) return;
      return next;
    };

    check();
    const timer = enabled && !preview
      ? window.setInterval(check, 2 * 60 * 1000)
      : null;

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, [enabled, refresh]);

  return { ...status, refresh };
}
