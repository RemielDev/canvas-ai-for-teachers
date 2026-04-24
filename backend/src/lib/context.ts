// Retrieval-augmented context layer. Queries course_embeddings (pgvector)
// for top-k chunks relevant to the current action step, then formats for
// the LLM prompt.

import { db } from "./db";

export type ContextChunk = {
  context_id: string;
  chunk_text: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

/**
 * Top-k retrieval by cosine similarity.
 * Relies on a Postgres RPC function `match_course_embeddings` that
 * wraps the pgvector `<=>` cosine-distance operator. Create it in a migration:
 *
 *   create function match_course_embeddings(
 *     p_course_id uuid,
 *     p_embedding vector(1536),
 *     p_match_count int default 8
 *   ) returns table (context_id uuid, chunk_text text,
 *                    metadata jsonb, similarity float)
 *   language sql stable as $$
 *     select context_id, chunk_text, metadata,
 *            1 - (embedding <=> p_embedding) as similarity
 *     from course_embeddings
 *     where course_id = p_course_id
 *     order by embedding <=> p_embedding
 *     limit p_match_count
 *   $$;
 */
export async function retrieveContext(
  courseId: string,
  queryEmbedding: number[],
  k = 8
): Promise<ContextChunk[]> {
  const { data, error } = await db.rpc("match_course_embeddings", {
    p_course_id: courseId,
    p_embedding: queryEmbedding,
    p_match_count: k,
  });
  if (error) throw new Error(`retrieveContext: ${error.message}`);
  return (data ?? []) as ContextChunk[];
}

export function formatContextForPrompt(chunks: ContextChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `--- context #${i + 1} (similarity ${c.similarity.toFixed(2)}) ---\n${c.chunk_text}`
    )
    .join("\n\n");
}
