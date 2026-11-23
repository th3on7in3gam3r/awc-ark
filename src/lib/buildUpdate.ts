/** Compare the running bundle with the build served on the current Ark domain. */
export async function fetchArkUpdate(
  currentBuild: string,
  baseUrl: string,
  signal: AbortSignal,
  fetchVersion = fetch,
): Promise<string | null> {
  const url = new URL('build-version.json', baseUrl);
  // Bypass any cached response on the Connect → Ark rewrite as well as in the browser.
  url.searchParams.set('check', String(Date.now()));
  const response = await fetchVersion(url, { cache: 'no-store', signal, headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  const version: unknown = (await response.json())?.version;
  return typeof version === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(version) && version !== currentBuild
    ? version
    : null;
}

export function arkRefreshUrl(currentUrl: string, build: string): string {
  const url = new URL(currentUrl);
  url.searchParams.set('arkBuild', build);
  return url.href;
}
