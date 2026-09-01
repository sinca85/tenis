export function displayMemberName(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "Socio";
  const ordered = words.length > 1 ? [words.at(-1)!, ...words.slice(0, -1)] : words;
  return ordered
    .map((word) => word.toLocaleLowerCase("es-AR").replace(/(^|[-'])\p{L}/gu, (letter) => letter.toLocaleUpperCase("es-AR")))
    .join(" ");
}
