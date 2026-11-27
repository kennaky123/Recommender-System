import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { MoodTag, PlaybackDevice } from '@/types';

interface PreferencesState {
  activeMood: MoodTag;
  selectedDevice: PlaybackDevice;
  cabinVolume: number;
}

const initialState: PreferencesState = {
  activeMood: 'all',
  selectedDevice: 'CABIN DISPLAY 8K',
  cabinVolume: 49,
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setActiveMood(state, action: PayloadAction<MoodTag>) {
      state.activeMood = action.payload;
    },
    setSelectedDevice(state, action: PayloadAction<PlaybackDevice>) {
      state.selectedDevice = action.payload;
    },
    setCabinVolume(state, action: PayloadAction<number>) {
      state.cabinVolume = Math.max(0, Math.min(100, Math.round(action.payload)));
    },
  },
});

export const { setActiveMood, setSelectedDevice, setCabinVolume } =
  preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;
