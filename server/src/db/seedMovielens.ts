import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { MoodTag, ProviderName } from '../domain/types';
import { DatabaseConnection } from '../repositories/DatabaseConnection';

const MOVIELENS_ZIP_URL =
  'https://files.grouplens.org/datasets/movielens/ml-latest-small.zip';

const PROVIDERS: ProviderName[] = [
  'NETFLIX',
  'HBOmax',
  'Disney+',
  'sky cinema',
  'sky one',
];

const BACKDROP_POOL = [
  '/backdrops/interstellar.jpg',
  '/backdrops/blade-runner-2049.jpg',
  '/backdrops/arrival.jpg',
  '/backdrops/inception.jpg',
  '/backdrops/dune.jpg',
  '/backdrops/the-martian.jpg',
  '/backdrops/nobody.jpg',
  '/backdrops/alita.jpg',
  '/backdrops/joker.jpg',
  '/backdrops/justice-league.jpg',
  '/backdrops/godzilla-vs-kong.jpg',
];

function inferMoods(genres: string[]): MoodTag[] {
  const g = genres.map((x) => x.toUpperCase());
  const moods = new Set<MoodTag>();
  if (g.includes('SCI-FI') || g.includes('MYSTERY')) moods.add('mind-bending');
  if (g.includes('ACTION') || g.includes('THRILLER') || g.includes('CRIME')) {
    moods.add('intense');
  }
  if (g.includes('DRAMA') || g.includes('ROMANCE') || g.includes('WAR')) {
    moods.add('dramatic');
  }
  if (g.includes('COMEDY') || g.includes('ANIMATION') || g.includes('MUSICAL')) {
    moods.add('fun');
  }
  if (g.includes('ADVENTURE') || g.includes('FANTASY')) moods.add('epic');
  if (g.includes('DOCUMENTARY') || moods.size === 0) moods.add('calm');
  return Array.from(moods);
}

function parseTitleYear(rawTitle: string): { title: string; year: number } {
  const match = rawTitle.match(/^(.*)\((\d{4})\)\s*$/);
  if (match) {
    return { title: match[1].trim().toUpperCase(), year: Number(match[2]) };
  }
  return { title: rawTitle.trim().toUpperCase(), year: 2000 };
}

async function ensureDatasetPresent(datasetDir: string): Promise<void> {
  const moviesFile = path.join(datasetDir, 'movies.csv');
  if (fs.existsSync(moviesFile)) return;

  const dataParent = path.dirname(datasetDir);
  fs.mkdirSync(dataParent, { recursive: true });

  console.log(`[MovieLens Seed] Downloading ${MOVIELENS_ZIP_URL}...`);
  const res = await fetch(MOVIELENS_ZIP_URL);
  if (!res.ok) {
    throw new Error(`Failed to download MovieLens zip: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const zipPath = path.join(dataParent, 'ml-latest-small.zip');
  fs.writeFileSync(zipPath, buffer);

  console.log(`[MovieLens Seed] Extracting archive into ${dataParent}...`);
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(dataParent, true);

  if (!fs.existsSync(moviesFile)) {
    throw new Error(`Extraction completed but ${moviesFile} was not found.`);
  }
}

async function seedMovieLens() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const dirArg = args.find((a) => !a.startsWith('--'));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  const datasetDir = path.resolve(
    dirArg || path.resolve(__dirname, '..', '..', 'data', 'ml-latest-small')
  );

  await ensureDatasetPresent(datasetDir);

  const requiredFiles = ['movies.csv', 'links.csv', 'ratings.csv', 'tags.csv'];
  for (const file of requiredFiles) {
    const full = path.join(datasetDir, file);
    if (!fs.existsSync(full)) {
      throw new Error(`Missing required file: ${full}`);
    }
  }

  console.log(
    `[MovieLens Seed] Parsing CSV files from ${datasetDir} (limit=${
      Number.isFinite(limit) ? limit : 'ALL'
    })...`
  );

  const linksRows = parse(
    fs.readFileSync(path.join(datasetDir, 'links.csv'), 'utf-8'),
    { columns: true, skip_empty_lines: true }
  ) as Array<{ movieId: string; imdbId: string; tmdbId: string }>;

  const linkMap = new Map<number, { imdbId: string; tmdbId: number }>();
  for (const row of linksRows) {
    const tmdb = Number(row.tmdbId);
    if (Number.isFinite(tmdb) && tmdb > 0) {
      linkMap.set(Number(row.movieId), {
        imdbId: row.imdbId ? `tt${row.imdbId}` : '',
        tmdbId: tmdb,
      });
    }
  }

  const tagsRows = parse(
    fs.readFileSync(path.join(datasetDir, 'tags.csv'), 'utf-8'),
    { columns: true, skip_empty_lines: true }
  ) as Array<{ movieId: string; tag: string }>;
  const tagsMap = new Map<number, Set<string>>();
  for (const row of tagsRows) {
    const mlId = Number(row.movieId);
    const set = tagsMap.get(mlId) ?? new Set<string>();
    const cleanTag = row.tag.trim().toLowerCase();
    if (cleanTag) set.add(cleanTag);
    tagsMap.set(mlId, set);
  }

  const movieRows = parse(
    fs.readFileSync(path.join(datasetDir, 'movies.csv'), 'utf-8'),
    { columns: true, skip_empty_lines: true }
  ) as Array<{ movieId: string; title: string; genres: string }>;

  const db = DatabaseConnection.getInstance();
  await db.applySchema();
  await db.seedDefaults();

  const existingRes = await db.pool.query(
    'SELECT id, tmdb_id, media_type FROM movies'
  );
  const existingByTmdb = new Map<number, number>();
  for (const row of existingRes.rows) {
    if (row.media_type === 'movie') {
      existingByTmdb.set(Number(row.tmdb_id), Number(row.id));
    }
  }

  const mlToDbId = new Map<number, number>();
  const toInsert: Array<{
    mlId: number;
    tmdbId: number;
    imdbId: string | null;
    title: string;
    provider: ProviderName;
    year: number;
    genres: string[];
    tags: string[];
    moods: MoodTag[];
    synopsis: string;
    backdropUrl: string;
  }> = [];

  let processed = 0;
  for (const row of movieRows) {
    if (processed >= limit) break;
    const mlId = Number(row.movieId);
    const link = linkMap.get(mlId);
    if (!link) continue;

    processed++;
    const existingDbId = existingByTmdb.get(link.tmdbId);
    if (existingDbId) {
      await db.pool.query(
        'UPDATE movies SET movielens_id = $1 WHERE id = $2 AND movielens_id IS NULL',
        [mlId, existingDbId]
      );
      mlToDbId.set(mlId, existingDbId);
      continue;
    }

    const { title, year } = parseTitleYear(row.title);
    const genres = row.genres
      .split('|')
      .map((g) => g.trim().toUpperCase())
      .filter((g) => g && g !== '(NO GENRES LISTED)');
    const tags = Array.from(tagsMap.get(mlId) ?? []).slice(0, 10);
    const moods = inferMoods(genres);
    const provider = PROVIDERS[mlId % PROVIDERS.length];
    const backdropUrl = BACKDROP_POOL[mlId % BACKDROP_POOL.length];

    toInsert.push({
      mlId,
      tmdbId: link.tmdbId,
      imdbId: link.imdbId || null,
      title,
      provider,
      year,
      genres,
      tags,
      moods,
      synopsis: `MovieLens archive feature (${year}) — ${
        genres.join(', ') || 'Cinema'
      }${tags.length > 0 ? ` • Tags: ${tags.slice(0, 4).join(', ')}` : ''}.`,
      backdropUrl,
    });
  }

  const client = await db.pool.connect();
  let insertedMovies = 0;
  try {
    await client.query('BEGIN');
    const MOVIE_BATCH = 400;
    for (let i = 0; i < toInsert.length; i += MOVIE_BATCH) {
      const chunk = toInsert.slice(i, i + MOVIE_BATCH);
      const values: unknown[] = [];
      const placeholders = chunk
        .map((m, idx) => {
          const base = idx * 11;
          values.push(
            m.mlId,
            m.tmdbId,
            m.imdbId,
            m.title,
            m.provider,
            m.year,
            m.genres,
            m.tags,
            m.moods,
            m.synopsis,
            m.backdropUrl
          );
          return `($${base + 1},$${base + 2},$${base + 3},'movie',$${base + 4},$${base + 5},$${base + 6},112,'15','4K',$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11})`;
        })
        .join(',');

      const res = await client.query(
        `INSERT INTO movies (
          movielens_id, tmdb_id, imdb_id, media_type, title, provider,
          release_year, runtime_minutes, age_rating, resolution,
          genres, tags, moods, synopsis, backdrop_url
        ) VALUES ${placeholders}
        ON CONFLICT (movielens_id) DO UPDATE SET tmdb_id = EXCLUDED.tmdb_id
        RETURNING id, movielens_id`,
        values
      );
      for (const r of res.rows) {
        mlToDbId.set(Number(r.movielens_id), Number(r.id));
      }
      insertedMovies += chunk.length;
    }

    const ratingsRows = parse(
      fs.readFileSync(path.join(datasetDir, 'ratings.csv'), 'utf-8'),
      { columns: true, skip_empty_lines: true }
    ) as Array<{ userId: string; movieId: string; rating: string; timestamp: string }>;

    const mlUserIds = new Set<number>();
    const validRatings: Array<{
      userId: number;
      movieId: number;
      rating: number;
      ratedAt: string;
    }> = [];

    for (const r of ratingsRows) {
      const dbMovieId = mlToDbId.get(Number(r.movieId));
      if (!dbMovieId) continue;
      const dbUserId = 1000 + Number(r.userId);
      mlUserIds.add(dbUserId);
      validRatings.push({
        userId: dbUserId,
        movieId: dbMovieId,
        rating: Number(r.rating),
        ratedAt: new Date(Number(r.timestamp) * 1000).toISOString(),
      });
    }

    const userArray = Array.from(mlUserIds);
    const USER_BATCH = 500;
    for (let i = 0; i < userArray.length; i += USER_BATCH) {
      const chunk = userArray.slice(i, i + USER_BATCH);
      const values: unknown[] = [];
      const placeholders = chunk
        .map((uid, idx) => {
          const base = idx * 2;
          values.push(uid, `MOVIELENS USER ${uid - 1000}`);
          return `($${base + 1}, $${base + 2})`;
        })
        .join(',');
      await client.query(
        `INSERT INTO users (id, name) VALUES ${placeholders} ON CONFLICT (id) DO NOTHING`,
        values
      );
    }

    const RATING_BATCH = 1000;
    for (let i = 0; i < validRatings.length; i += RATING_BATCH) {
      const chunk = validRatings.slice(i, i + RATING_BATCH);
      const values: unknown[] = [];
      const placeholders = chunk
        .map((r, idx) => {
          const base = idx * 4;
          values.push(r.userId, r.movieId, r.rating, r.ratedAt);
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
        })
        .join(',');
      await client.query(
        `INSERT INTO ratings (user_id, movie_id, rating, rated_at)
         VALUES ${placeholders}
         ON CONFLICT (user_id, movie_id) DO NOTHING`,
        values
      );
    }

    await client.query(
      `SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))`
    );
    await client.query(
      `SELECT setval(pg_get_serial_sequence('movies', 'id'), COALESCE((SELECT MAX(id) FROM movies), 1))`
    );

    await client.query('COMMIT');
    const totals = await client.query(
      `SELECT (SELECT COUNT(*)::int FROM movies) AS movies, (SELECT COUNT(*)::int FROM ratings) AS ratings`
    );
    console.log(
      `[MovieLens Seed] Done! Linked/inserted ${insertedMovies} new movies (${validRatings.length} ratings). DB totals -> movies: ${totals.rows[0].movies}, ratings: ${totals.rows[0].ratings}`
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await db.close();
  }
}

seedMovieLens().catch((err) => {
  console.error('[MovieLens Seed] Error:', (err as Error).message);
  process.exit(1);
});
