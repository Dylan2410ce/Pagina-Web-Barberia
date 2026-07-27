function valorCsv(value) {
  const normalized = Array.isArray(value)
    ? value.join(", ")
    : String(value ?? "");
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function descargarCsv(filename, rows, columns) {
  const header = columns.map((column) => valorCsv(column.label)).join(",");
  const body = rows.map((row) => (
    columns.map((column) => valorCsv(column.value(row))).join(",")
  ));
  const csv = `\uFEFF${[header, ...body].join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
