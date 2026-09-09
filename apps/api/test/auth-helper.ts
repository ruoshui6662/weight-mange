export async function bootstrapSession(base: string) {
  const response = await fetch(`${base}/api/v1/auth/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: "Test owner", password: "correct horse battery staple" }),
  });
  if (response.status !== 201) throw new Error(`bootstrap failed: ${response.status}`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

export function withCookie(cookie: string, headers: Record<string, string> = {}) {
  return { ...headers, cookie };
}
