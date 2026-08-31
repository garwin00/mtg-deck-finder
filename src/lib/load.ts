/** Byte counts for the static data files, written by scripts/build-data.mjs. */
export type Manifest = {
  generatedAt: string;
  files: Record<string, { bytes: number }>;
};

/**
 * Fetch JSON while reporting progress.
 *
 * Progress is measured against a byte total from the manifest, not
 * Content-Length: responses are served brotli-compressed, so Content-Length is
 * the compressed size while the stream yields decompressed bytes — measuring
 * one against the other runs the bar to ~580%.
 */
export async function fetchJsonWithProgress<T>(
  url: string,
  onBytes: (received: number) => void
): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  if (!res.body) return (await res.json()) as T;

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onBytes(received);
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(buffer)) as T;
}
