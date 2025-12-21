/**
 * Content chunking utilities
 */

/**
 * Chunk content with overlap for better context continuity
 * @param content - The content to chunk
 * @param maxChars - Maximum characters per chunk (default 1000)
 * @param overlapChars - Characters to overlap between chunks (default 200)
 */
export function chunkContent(
  content: string,
  maxChars: number = 1000,
  overlapChars: number = 200
): string[] {
  const lines = content.split("\n");
  const chunks: string[] = [];
  let currentChunk = "";
  let overlapBuffer = ""; // Store last N chars for overlap

  for (const line of lines) {
    if (
      currentChunk.length + line.length > maxChars &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());

      // Keep overlap from end of current chunk
      overlapBuffer = currentChunk.slice(-overlapChars);
      currentChunk = overlapBuffer;
    }
    currentChunk += line + "\n";
  }

  if (currentChunk.trim() && currentChunk.trim() !== overlapBuffer.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
