import { IExternalMediaProvider } from './interfaces/ServiceInterfaces';

export interface ArtworkLookupItem {
  tmdbId: number;
  imdbId?: string | null;
  mediaType: 'movie' | 'tv';
  title: string;
}

export interface HydratableMedia extends ArtworkLookupItem {
  id: number;
  backdropUrl: string;
}

export interface IArtworkResolver {
  needsHydration(backdropUrl?: string): boolean;
  resolveArtworkUrl(item: ArtworkLookupItem): Promise<string | null>;
  hydrateItems<T extends HydratableMedia>(
    items: T[],
    persist?: (id: number, backdropUrl: string) => Promise<void>
  ): Promise<T[]>;
}

/**
 * Resolves real movie/TV artwork from public APIs (IMDb Suggestion, TVMaze, iTunes, or TMDB)
 * with in-memory caching and background PostgreSQL persistence.
 */
export class ArtworkResolverService implements IArtworkResolver {
  private readonly externalProvider: IExternalMediaProvider;
  private readonly cache = new Map<string, string | null>();

  public constructor(externalProvider: IExternalMediaProvider) {
    this.externalProvider = externalProvider;
  }

  public needsHydration(backdropUrl?: string): boolean {
    if (!backdropUrl) return true;
    return backdropUrl.startsWith('/backdrops/');
  }

  private cleanTitle(rawTitle: string): string {
    return rawTitle
      .replace(/\(\d{4}\)\s*$/g, '')
      .replace(/,\s*(The|A|An)\s*$/i, '')
      .trim();
  }

  private normalizeImdbImageUrl(url: string): string {
    return url.replace(/_V1_.*\.jpg$/i, '_V1_FMjpg_UX1000_.jpg');
  }

  private async fetchFromImdbSuggestion(
    item: ArtworkLookupItem
  ): Promise<string | null> {
    const clean = this.cleanTitle(item.title);
    const hasValidImdb =
      Boolean(item.imdbId) && /^tt\d+$/i.test(String(item.imdbId).trim());
    const lookupKey = hasValidImdb
      ? String(item.imdbId).trim().toLowerCase()
      : clean.toLowerCase().slice(0, 40);

    if (!lookupKey) return null;

    const firstChar = /^[a-z0-9]$/i.test(lookupKey[0])
      ? lookupKey[0].toLowerCase()
      : 'x';
    const url = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(
      lookupKey
    )}.json`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        d?: Array<{
          id?: string;
          l?: string;
          qid?: string;
          i?: { imageUrl?: string };
        }>;
      };
      const entries = data.d ?? [];
      if (hasValidImdb) {
        const exact = entries.find(
          (e) =>
            e.id?.toLowerCase() === lookupKey && Boolean(e.i?.imageUrl)
        );
        if (exact?.i?.imageUrl) {
          return this.normalizeImdbImageUrl(exact.i.imageUrl);
        }
      }

      const preferred = entries.find(
        (e) =>
          Boolean(e.i?.imageUrl) &&
          (e.qid === 'movie' ||
            e.qid === 'tvSeries' ||
            e.qid === 'tvMiniSeries' ||
            !e.qid)
      );
      const fallback = preferred ?? entries.find((e) => Boolean(e.i?.imageUrl));
      return fallback?.i?.imageUrl
        ? this.normalizeImdbImageUrl(fallback.i.imageUrl)
        : null;
    } catch {
      return null;
    }
  }

  private async fetchFromTvMaze(title: string): Promise<string | null> {
    const clean = this.cleanTitle(title);
    if (!clean) return null;

    try {
      const res = await fetch(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(clean)}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(2500),
        }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        image?: { original?: string; medium?: string };
      };
      return data.image?.original || data.image?.medium || null;
    } catch {
      return null;
    }
  }

  private async fetchFromItunes(title: string): Promise<string | null> {
    const clean = this.cleanTitle(title);
    if (!clean) return null;

    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(
          clean
        )}&media=movie&limit=1`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(2500),
        }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        results?: Array<{ artworkUrl100?: string }>;
      };
      const art = data.results?.[0]?.artworkUrl100;
      return art ? art.replace('100x100bb', '1280x720bb') : null;
    } catch {
      return null;
    }
  }

  public async resolveArtworkUrl(
    item: ArtworkLookupItem
  ): Promise<string | null> {
    const cacheKey = `${item.mediaType}:${item.imdbId || item.tmdbId || item.title}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    if (this.externalProvider.isConfigured()) {
      const tmdbRes = await this.externalProvider.searchMulti(
        this.cleanTitle(item.title),
        1,
        item.mediaType
      );
      const tmdbArt = tmdbRes.items.find(
        (m) => m.backdropUrl && !m.backdropUrl.startsWith('/backdrops/')
      )?.backdropUrl;
      if (tmdbArt) {
        this.cache.set(cacheKey, tmdbArt);
        return tmdbArt;
      }
    }

    let resolved = await this.fetchFromImdbSuggestion(item);
    if (!resolved) {
      resolved =
        item.mediaType === 'tv'
          ? await this.fetchFromTvMaze(item.title)
          : await this.fetchFromItunes(item.title);
    }

    this.cache.set(cacheKey, resolved ?? null);
    return resolved ?? null;
  }

  public async hydrateItems<T extends HydratableMedia>(
    items: T[],
    persist?: (id: number, backdropUrl: string) => Promise<void>
  ): Promise<T[]> {
    const uniqueTargets = new Map<number, T>();
    for (const item of items) {
      if (
        this.needsHydration(item.backdropUrl) &&
        !uniqueTargets.has(item.id)
      ) {
        uniqueTargets.set(item.id, item);
        if (uniqueTargets.size >= 24) break;
      }
    }

    if (uniqueTargets.size === 0) {
      return items;
    }

    const entries = Array.from(uniqueTargets.values());
    const results = await Promise.allSettled(
      entries.map(async (item) => ({
        id: item.id,
        url: await this.resolveArtworkUrl(item),
      }))
    );

    const resolvedMap = new Map<number, string>();
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.url) {
        resolvedMap.set(result.value.id, result.value.url);
        if (persist && result.value.id > 0) {
          void persist(result.value.id, result.value.url).catch(
            () => undefined
          );
        }
      }
    }

    if (resolvedMap.size === 0) {
      return items;
    }

    return items.map((item) => {
      const nextUrl = resolvedMap.get(item.id);
      return nextUrl ? { ...item, backdropUrl: nextUrl } : item;
    });
  }
}
