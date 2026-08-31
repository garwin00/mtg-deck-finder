/**
 * Card-name normalisation. Must stay in step with the same function in
 * scripts/build-data.mjs — the alias map is built with it.
 */
export function normalise(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Keys a name should be looked up under: the whole name and each DFC face. */
export function lookupKeys(name: string): string[] {
  const keys = [normalise(name)];
  if (name.includes("//")) {
    for (const face of name.split("//")) {
      const key = normalise(face);
      if (key && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}
