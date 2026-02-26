import { createSlice } from "@reduxjs/toolkit";

export const DASHBOARD_RANGE_DAYS = [1, 2, 3, 7, 14, 30, 90, 365] as const;
export type RangeDays = (typeof DASHBOARD_RANGE_DAYS)[number];

export type RangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last14"
  | "last30"
  | "last90"
  | "last365"
  | "lastMonth";

export interface DashboardState {
  /** Legacy: used when rangePreset is lastN and rangeCustom is null. Kept for compatibility. */
  rangeDays: RangeDays;
  selectedDay: string | null;
  /** Preset key when user selects a preset. null when using custom range. */
  rangePreset: RangePreset | null;
  /** Custom from/to (YYYY-MM-DD) when user picks custom dates. null when using preset. */
  rangeCustom: { from: string; to: string } | null;
  /** Whether to request comparison (previous period) from API. */
  isComparing: boolean;
  /** Shop timezone from sync status (e.g. America/Mexico_City). Used to format dates and compute yesterday/lastMonth. */
  timezoneIana: string | null;
}

const initialState: DashboardState = {
  rangeDays: 7,
  selectedDay: null,
  rangePreset: "last7",
  rangeCustom: null,
  isComparing: false,
  timezoneIana: null,
};

export const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    setRangeDays: (state, action: { payload: RangeDays }) => {
      state.rangeDays = action.payload;
      state.selectedDay = null;
      state.rangePreset = null;
      state.rangeCustom = null;
    },
    setSelectedDay: (state, action: { payload: string | null }) => {
      state.selectedDay = action.payload;
    },
    setRangePreset: (state, action: { payload: RangePreset | null }) => {
      state.rangePreset = action.payload;
      state.rangeCustom = null;
      state.selectedDay = null;
    },
    setRangeCustom: (state, action: { payload: { from: string; to: string } | null }) => {
      state.rangeCustom = action.payload;
      state.rangePreset = null;
      state.selectedDay = null;
    },
    setComparing: (state, action: { payload: boolean }) => {
      state.isComparing = action.payload;
    },
    setTimezoneIana: (state, action: { payload: string | null }) => {
      state.timezoneIana = action.payload;
    },
  },
});

export const {
  setRangeDays,
  setSelectedDay,
  setRangePreset,
  setRangeCustom,
  setComparing,
  setTimezoneIana,
} = dashboardSlice.actions;
