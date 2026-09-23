"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import {
  DEFAULT_ASSUMPTIONS,
  DEFAULT_WEIGHTS,
  emptyQuote,
  type ScenarioAssumptions,
  type ScoringWeights,
  type SupplierQuote,
} from "@/lib/types";
import { getDemoQuotes } from "@/lib/demo-data";
import { uid } from "@/lib/utils";

const STORAGE_KEY = "supplier-quote-comparison:v1";

interface PersistedState {
  quotes: SupplierQuote[];
  assumptions: ScenarioAssumptions;
  weights: ScoringWeights;
  isDemo: boolean;
}

interface AppState extends PersistedState {
  hydrated: boolean;
}

type Action =
  | { type: "ADD_QUOTE"; quote?: SupplierQuote }
  | { type: "UPDATE_QUOTE"; id: string; quote: SupplierQuote }
  | { type: "REMOVE_QUOTE"; id: string }
  | { type: "SET_ASSUMPTIONS"; assumptions: ScenarioAssumptions }
  | { type: "SET_WEIGHTS"; weights: ScoringWeights }
  | { type: "LOAD_DEMO" }
  | { type: "CLEAR_ALL" }
  | { type: "HYDRATE"; state: PersistedState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "ADD_QUOTE":
      return { ...state, quotes: [...state.quotes, action.quote ?? emptyQuote(uid("supplier"))], isDemo: false };
    case "UPDATE_QUOTE":
      return {
        ...state,
        quotes: state.quotes.map((q) => (q.id === action.id ? action.quote : q)),
        isDemo: false,
      };
    case "REMOVE_QUOTE":
      return { ...state, quotes: state.quotes.filter((q) => q.id !== action.id) };
    case "SET_ASSUMPTIONS":
      return { ...state, assumptions: action.assumptions };
    case "SET_WEIGHTS":
      return { ...state, weights: action.weights };
    case "LOAD_DEMO":
      return {
        ...state,
        quotes: getDemoQuotes(),
        assumptions: DEFAULT_ASSUMPTIONS,
        weights: DEFAULT_WEIGHTS,
        isDemo: true,
      };
    case "CLEAR_ALL":
      return { ...state, quotes: [], isDemo: false };
    case "HYDRATE":
      return { ...state, ...action.state, hydrated: true };
    default:
      return state;
  }
}

function initialState(): AppState {
  return {
    quotes: getDemoQuotes(),
    assumptions: DEFAULT_ASSUMPTIONS,
    weights: DEFAULT_WEIGHTS,
    isDemo: true,
    hydrated: false,
  };
}

interface AppContextValue {
  state: AppState;
  addQuote: (quote?: SupplierQuote) => void;
  updateQuote: (id: string, quote: SupplierQuote) => void;
  removeQuote: (id: string) => void;
  setAssumptions: (assumptions: ScenarioAssumptions) => void;
  setWeights: (weights: ScoringWeights) => void;
  loadDemo: () => void;
  clearAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        dispatch({ type: "HYDRATE", state: parsed });
      } else {
        dispatch({ type: "HYDRATE", state: initialState() });
      }
    } catch {
      dispatch({ type: "HYDRATE", state: initialState() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      const toPersist: PersistedState = {
        quotes: state.quotes,
        assumptions: state.assumptions,
        weights: state.weights,
        isDemo: state.isDemo,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
    } catch {
      // Storage unavailable (private browsing, quota) — fail silently, state still works in-memory.
    }
  }, [state.hydrated, state.quotes, state.assumptions, state.weights, state.isDemo]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      addQuote: (quote) => dispatch({ type: "ADD_QUOTE", quote }),
      updateQuote: (id, quote) => dispatch({ type: "UPDATE_QUOTE", id, quote }),
      removeQuote: (id) => dispatch({ type: "REMOVE_QUOTE", id }),
      setAssumptions: (assumptions) => dispatch({ type: "SET_ASSUMPTIONS", assumptions }),
      setWeights: (weights) => dispatch({ type: "SET_WEIGHTS", weights }),
      loadDemo: () => dispatch({ type: "LOAD_DEMO" }),
      clearAll: () => dispatch({ type: "CLEAR_ALL" }),
    }),
    [state]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}
