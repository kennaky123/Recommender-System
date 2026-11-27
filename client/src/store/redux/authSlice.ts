import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { AUTH_TOKEN_KEY } from '@/lib/httpClient';
import { AuthUser } from '@/types';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

const initialState: AuthState = {
  user: null,
  token:
    typeof window !== 'undefined'
      ? window.localStorage.getItem(AUTH_TOKEN_KEY)
      : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthSession(
      state,
      action: PayloadAction<{ token: string; user: AuthUser }>
    ) {
      state.token = action.payload.token;
      state.user = action.payload.user;
    },
    setAuthUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
    },
    clearAuthSession(state) {
      state.token = null;
      state.user = null;
    },
  },
});

export const { setAuthSession, setAuthUser, clearAuthSession } =
  authSlice.actions;
export const authReducer = authSlice.reducer;
