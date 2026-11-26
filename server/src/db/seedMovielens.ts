import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { pool } from './pool';
import { resolveSchemaPath } from './store';
import { MoodTag, ProviderName } from '../types';

const PROVIDERS: ProviderName[] = ['NETFLIX', 'HBOmax', 'Disney+', 'sky cinema', 'sky one'];

const BACKDROP_POOL = [
  '/backdrops/interstellar.jpg',
  '/backdrops/blade-runner-2049.jpg',
  '/backdrops/arrival.jpg',
  '/backdrops/inception.jpg',
  '/backdrops/dune.jpg',
  '/backdrops/the-martian.jpg',
  '/backdrops/nobody.jpg',
  '/backdrops/alita.jpg',
];

function inferMoods(genres: string[]): MoodTag[] {
  const g = genres.map((x) => x.toUpperCase());
  const moods = new Set<MoodTag>();
  if (g.includes('SCI-FI') || g.includes('MYSTERY')) moods.add('mind-bending');
  if (g.includes('ACTION') || g.includes('THRILLER')) moods.add('intense');
  if (g.includes('DRAMA')) moods.add('dramatic');
  if (g.includes('COMEDY') || g.includes('ANIMATION')) moods.add('fun');
  if (g.includes('ADVENTURE') || g.includes('FANTASY')) moods.add('epic');
  if (moods.size === 0) moods.add('calm');
  return Array.from(moods);
}

function parseTitleYear(rawTitle: string): { title: string; year: number } {
  const match = rawTitle.match(/^(.*)\((\d{4})\)\s*$/);
  if (match) {
    return { title: match[1].trim().toUpperCase(), year: Number(match[2]) };
  }
  return { title: rawTitle.trim().toUpperCase(), year: 2000 };
}

async function seedMovieLens() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const dirArg = args.find((a) => !a.startsWith('--'));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 1000;
  const datasetDir = path.resolve(
    dirArg || path.resolve(__dirname, '..', '..', 'data', 'ml-latest-small')
  );

  const requiredFiles = ['movies.csv', 'links.csv', 'ratings.csv', 'tags.csv'];
  for (const file of requiredFiles) {
    const full = path.join(datasetDir, file);
    if (!fs.existsSync(full)) {
      console.error(`[MovieLens Seed] Missing file: ${full}`);
      console.error(
        'Download ml-latest-small.zip from https://grouplens.org/datasets/movielens/latest/ and extract into server/data/ml-latest-small/'
      );
      process.exit(1);
    }
  }

  console.log(`[MovieLens Seed] Reading CSV files from ${datasetDir} (limit=${limit})...`);

  const linksRows = parse(fs.readFileSync(path.join(datasetDir, 'links.csv'), 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  }) as Array<{ movieId: string; imdbId: string; tmdbId: string }>;
  const linkMap = new Map<number, { imdbId: string; tmdbId: number }>();
  for (const row of linksRows) {
    const tmdb = Number(row.tmdbId);
    if (Number.isFinite(tmdb) && tmdb > 0) {
      linkMap.set(Number(row.movieId), { imdbId: `tt${row.imdbId}`, tmdbId: tmdb });
    }
  }

  const tagsRows = parse(fs.readFileSync(path.join(datasetDir, 'tags.csv'), 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  }) as Array<{ movieId: string; tag: string }>;
  const tagsMap = new Map<number, Set<string>>();
  for (const row of tagsRows) {
    const mlId = Number(row.movieId);
    const set = tagsMap.get(mlId) ?? new Set<string>();
    set.add(row.tag.trim().toLowerCase());
    tagsMap.set(mlId, set);
  }

  const movieRows = parse(fs.readFileSync(path.join(datasetDir, 'movies.csv'), 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  }) as Array<{ movieId: string; title: string; genres: string }>;

  const schemaSql = fs.readFileSync(resolveSchemaPath(), 'utf-8');
  await pool.query(schemaSql);

  const mlToDbId = new Map<number, number>();
  let insertedMovies = 0;

  for (const row of movieRows) {
    if (insertedMovies >= limit) break;
    const mlId = Number(row.movieId);
    const link = linkMap.get(mlId);
    if (!link) continue;

    const { title, year } = parseTitleYear(row.title);
    const genres = row.genres
      .split('|')
      .map((g) => g.trim().toUpperCase())
      .filter((g) => g && g !== '(NO GENRES LISTED)');
    const tags = Array.from(tagsMap.get(mlId) ?? []).slice(0, 8);
    const moods = inferMoods(genres);
    const provider = PROVIDERS[mlId % PROVIDERS.length];
    const backdropUrl = BACKDROP_POOL[mlId % BACKDROP_POOL.length];

    const res = await pool.query(
      `INSERT INTO movies (
        movielens_id, tmdb_id, imdb_id, media_type, title, provider,
        release_year, runtime_minutes, age_rating, resolution,
        genres, tags, moods, synopsis, backdrop_url
      ) VALUES ($1,$2,$3,'movie',$4,$5,$6,115,'15','4K',$7,$8,$9,$10,$11)
      ON CONFLICT (movielens_id) DO UPDATE SET tmdb_id = EXCLUDED.tmdb_id
      RETURNING id`,
      [
        mlId,
        link.tmdbId,
        link.imdbId,
        title,
        provider,
        year,
        genres,
        tags,
        moods,
        `MovieLens catalog release (${year}) in ${genres.join(', ') || 'Cinema'}. Stream via VidLink TMDB #${link.tmdbId}.`,
        backdropUrl,
      ]
    );
    mlToDbId.set(mlId, Number(res.rows[0].id));
    insertedMovies++;
  }

  const ratingsRows = parse(fs.readFileSync(path.join(datasetDir, 'ratings.csv'), 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  }) as Array<{ userId: string; movieId: string; rating: string }>;

  let insertedRatings = 0;
  const createdUsers = new Set<number>();
  for (const r of ratingsRows) {
    const mlMovieId = Number(r.movieId);
    const dbMovieId = mlToDbId.get(mlMovieId);
    if (!dbMovieId) continue;
    const dbUserId = 1000 + Number(r.userId);
    if (!createdUsers.has(dbUserId)) {
      await pool.query(
        `INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [dbUserId, `MOVIELENS USER ${r.userId}`]
      );
      createdUsers.add(dbUserId);
    }
    await pool.query(
      `INSERT INTO ratings (user_id, movie_id, rating) VALUES ($1, $2, $3) ON CONFLICT (user_id, movie_id) DO NOTHING`,
      [dbUserId, dbMovieId, Number(r.rating)]
    );
    insertedRatings++;
  }

  await pool.query(
    `SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))`
  );
  await pool.query(
    `SELECT setval(pg_get_serial_sequence('movies', 'id'), COALESCE((SELECT MAX(id) FROM movies), 1))`
  );

  console.log(
    `[MovieLens Seed] Imported ${insertedMovies} movies and ${insertedRatings} community ratings into PostgreSQL.`
  );
  await pool.end();
}

seedMovieLens().catch((err) => {
  console.error('[MovieLens Seed] Error:', err.message);
  process.exit(1);
});
