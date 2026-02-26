export function toTitleCase(value: string) {
  return value
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function lineAddress(parts: string[]) {
  const value = parts.map((v) => v.trim()).filter(Boolean).join(", ");
  return value || null;
}
