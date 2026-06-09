import { AppError } from '../error.ts';

// rawg_client.rs の移植。API キーをエラーに含めない。

export interface GameReleaseEntry {
  id: number;
  name: string;
  released: string;
  platforms: string[];
  backgroundImage: string | null;
  slug: string;
}

interface RawgGame {
  id: number;
  name: string;
  released?: string | null;
  background_image?: string | null;
  slug: string;
  platforms?: Array<{ platform: { name: string } }> | null;
}

interface RawgResp {
  results: RawgGame[];
}

export async function fetchGameReleases(
  apiKey: string,
  startDate: string,
  endDate: string,
): Promise<GameReleaseEntry[]> {
  const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(apiKey)}&dates=${startDate},${endDate}&ordering=released&page_size=40`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'OtakuPulse/1.0.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new AppError('network', `RAWG API error: ${res.status}`);

  const data = (await res.json()) as RawgResp;
  const out: GameReleaseEntry[] = [];
  for (const g of data.results) {
    if (g.released === null || g.released === undefined) continue;
    out.push({
      id: g.id,
      name: g.name,
      released: g.released,
      platforms: (g.platforms ?? []).map((p) => p.platform.name),
      backgroundImage: g.background_image ?? null,
      slug: g.slug,
    });
  }
  return out;
}
