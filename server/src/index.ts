import cors from 'cors';
import express from 'express';
import { PORT } from './config';
import { initDataStore } from './db/store';
import { moviesRouter } from './routes/movies';
import { recommendationsRouter } from './routes/recommendations';
import { userRouter } from './routes/user';

async function bootstrap() {
  const store = await initDataStore();
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', async (_req, res) => {
    const [movies, ratings] = await Promise.all([
      store.getMovies(),
      store.getAllRatings(),
    ]);
    res.json({
      status: 'ok',
      storageMode: store.getStorageMode(),
      movieCount: movies.length,
      ratingCount: ratings.length,
    });
  });

  app.use('/api', moviesRouter);
  app.use('/api', recommendationsRouter);
  app.use('/api', userRouter);

  app.listen(PORT, () => {
    console.log(
      `[SPACE-X VOD API] Listening on http://localhost:${PORT} (storage: ${store.getStorageMode()})`
    );
  });
}

bootstrap().catch((err) => {
  console.error('[SPACE-X VOD API] Fatal startup error:', err);
  process.exit(1);
});
