import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from './authSlice';
import { preferencesReducer } from './preferencesSlice';

export const reduxStore = configureStore({
  reducer: {
    auth: authReducer,
    preferences: preferencesReducer,
  },
});

export type RootState = ReturnType<typeof reduxStore.getState>;
export type AppDispatch = typeof reduxStore.dispatch;
