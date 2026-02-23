import { createSlice } from "@reduxjs/toolkit";

export const DASHBOARD_RANGE_DAYS = [1, 2, 3, 7, 30] as const;
export type RangeDays = (typeof DASHBOARD_RANGE_DAYS)[number];

export interface DashboardState {
  rangeDays: RangeDays;
  selectedDay: string | null;
}

const initialState: DashboardState = {
  rangeDays: 30,
  selectedDay: null,
};

export const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    setRangeDays: (state, action: { payload: RangeDays }) => {
      state.rangeDays = action.payload;
      state.selectedDay = null;
    },
    setSelectedDay: (state, action: { payload: string | null }) => {
      state.selectedDay = action.payload;
    },
  },
});

export const { setRangeDays, setSelectedDay } = dashboardSlice.actions;
