// Calls Canvas REST API using the teacher's existing session cookie.
// credentials: 'include' is the whole point — no token handoff from page.
// Only call from pages under *.instructure.com (content scripts, service worker).

export async function canvasGet<T>(
  canvasUrl: string,
  path: string
): Promise<T> {
  const res = await fetch(`${canvasUrl}/api/v1${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Canvas GET ${path} → ${res.status}`);
  return res.json();
}

export async function canvasPost<T>(
  canvasUrl: string,
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${canvasUrl}/api/v1${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Canvas POST ${path} → ${res.status}`);
  return res.json();
}

export async function canvasPut<T>(
  canvasUrl: string,
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${canvasUrl}/api/v1${path}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Canvas PUT ${path} → ${res.status}`);
  return res.json();
}

/**
 * List the teacher's active courses. Used by the class-picker bubble.
 * Canvas returns up to 100 per page; for hackathon, one page is enough.
 */
export async function listCourses(canvasUrl: string) {
  return canvasGet<
    Array<{
      id: number;
      name: string;
      term?: { name: string };
      total_students?: number;
      course_code: string;
    }>
  >(canvasUrl, "/courses?enrollment_type=teacher&per_page=100");
}
