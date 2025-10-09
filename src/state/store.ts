import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TOffer, TEquityGrant } from '@/models/types';

type State = {
  offer: TOffer; // mirrors offers[activeIndex] for backward-compat
  offers: TOffer[];
  activeIndex: number;
  // history
  past: TOffer[];
  future: TOffer[];
  setOffer: (o: TOffer) => void;
  setOffers: (offers: TOffer[]) => void;
  addOffer: (o?: TOffer) => void;
  duplicateActiveOffer: () => void;
  removeOffer: (index: number) => void;
  setActiveIndex: (i: number) => void;
  setYoY: (values: number[]) => void;
  addGrant: (g: TEquityGrant) => void;
  updateGrant: (index: number, g: Partial<TEquityGrant>) => void;
  removeGrant: (index: number) => void;
  addRaise: (r: { effectiveDate: string; type: 'percent' | 'absolute'; value: number }) => void;
  updateRaise: (index: number, r: Partial<{ effectiveDate: string; type: 'percent' | 'absolute'; value: number }>) => void;
  removeRaise: (index: number) => void;
  uiMode: 'simple' | 'advanced';
  setUiMode: (m: 'simple' | 'advanced') => void;
  setBonusKind: (kind: 'percent' | 'fixed') => void;
  setBonusValue: (value: number) => void;
  undo: () => void;
  redo: () => void;
  resetAll: () => void;
  loadSnapshot: (snapshot: { offers: TOffer[]; activeIndex?: number; uiMode?: 'simple' | 'advanced' }) => void;
};

const initialOffer: TOffer = {
  name: 'DemoCo',
  currency: 'USD',
  startDate: '2025-01-01',
  base: { startAnnual: 110000 },
  raises: [
    { effectiveDate: '2026-06-01', type: 'percent', value: 0.05 }
  ],
  equityGrants: [
    {
      type: 'RSU',
      shares: 40000,
      vesting: {
        model: 'standard',
        years: 4,
        cliffMonths: 12,
        frequency: 'monthly',
        distribution: 'even',
        cliffPercent: 0.25
      },
      grantStartDate: '2025-01-01',
      targetValue: 15000
    }
  ],
  performanceBonus: { kind: 'percent', value: 0.08, expectedPayout: 1 },
  growth: { startingPrice: 100, yoy: [0, 0, 0, 0] },
  signingBonuses: [
    { amount: 5000, payDate: '2025-01-01' }
  ],
  relocationBonuses: [
    { amount: 7500, payDate: '2025-01-01' }
  ],
  benefits: [
    { name: 'Free dinner', annualValue: 2600, enabled: false },
    { name: 'Free lunch', annualValue: 2600, enabled: false },
    { name: 'Free breakfast', annualValue: 2600, enabled: false },
    { name: 'HSA', annualValue: 1000, enabled: true },
    { name: 'Learning stipend', annualValue: 1500, enabled: true },
    { name: 'Gym stipend', annualValue: 1200, enabled: true }
  ],
  miscRecurring: [],
  assumptions: { horizonYears: 4, colAdjust: 1 },
};

export const useStore = create<State>()(
  persist(
  (set) => ({
      offer: initialOffer,
      offers: [initialOffer],
      activeIndex: 0,
      past: [],
      future: [],
      uiMode: 'simple',
      resetAll: () => set(() => {
        try { localStorage.removeItem('compcalc-store'); } catch {}
        // Reset to initial defaults
        const freshOffer = JSON.parse(JSON.stringify(initialOffer)) as TOffer;
        return {
          offer: freshOffer,
          offers: [freshOffer],
          activeIndex: 0,
          past: [],
          future: [],
          uiMode: 'simple',
        };
      }),
      setOffer: (offer) => set((state) => {
        const offers = state.offers.slice();
        offers[state.activeIndex] = offer;
        return { offer, offers, past: [...state.past, state.offer], future: [] };
      }),
      setOffers: (offers) => set(() => {
        const safeOffers = (offers.length ? offers : [initialOffer]).map((offer) => JSON.parse(JSON.stringify(offer)) as TOffer);
        const activeIndex = safeOffers.length ? Math.min(0, safeOffers.length - 1) : 0;
        const offer = safeOffers[activeIndex] ?? initialOffer;
        return { offers: safeOffers, activeIndex, offer };
      }),
      addOffer: (o) => set((state) => {
        const clone = (x: TOffer) => JSON.parse(JSON.stringify(x)) as TOffer;
        const offer = o ? clone(o) : { ...clone(initialOffer), name: `Offer ${state.offers.length + 1}` };
        const offers = [...state.offers, offer];
        const activeIndex = offers.length - 1;
        return { offers, activeIndex, offer: offers[activeIndex] };
      }),
      duplicateActiveOffer: () => set((state) => {
        const base = state.offers[state.activeIndex];
        const copy = { ...(JSON.parse(JSON.stringify(base)) as TOffer), name: `${base.name} (copy)` } as TOffer;
        const offers = [...state.offers, copy];
        const activeIndex = offers.length - 1;
        return { offers, activeIndex, offer: offers[activeIndex] };
      }),
      removeOffer: (index) => set((state) => {
        const offers = state.offers.filter((_, i) => i !== index);
        const activeIndex = Math.max(0, state.activeIndex >= index ? state.activeIndex - 1 : state.activeIndex);
        const offer = offers[activeIndex] ?? initialOffer;
        return { offers: offers.length ? offers : [initialOffer], activeIndex: offers.length ? activeIndex : 0, offer };
      }),
      setActiveIndex: (i) => set((state) => {
        const clamped = Math.max(0, Math.min(i, state.offers.length - 1));
        return { activeIndex: clamped, offer: state.offers[clamped] };
      }),
      setYoY: (values) => set((state) => {
        const nextOffer = { ...state.offer, growth: { ...(state.offer.growth ?? {}), yoy: values } };
        const offers = state.offers.map((o, i) => i === state.activeIndex ? nextOffer : o);
        return { offer: nextOffer, offers, past: [...state.past, state.offer], future: [] };
      }),
      addGrant: (g) => set((state) => {
        const nextOffer = { ...state.offer, equityGrants: [...(state.offer.equityGrants ?? []), g] };
        const offers = state.offers.map((o, i) => i === state.activeIndex ? nextOffer : o);
        return { offer: nextOffer, offers, past: [...state.past, state.offer], future: [] };
      }),
      updateGrant: (index, g) => set((state) => {
        const nextOffer = {
          ...state.offer,
          equityGrants: (state.offer.equityGrants ?? []).map((x, i) => (i === index ? { ...x, ...g } : x)),
        };
        const offers = state.offers.map((o, ai) => ai === state.activeIndex ? nextOffer : o);
        return { offer: nextOffer, offers, past: [...state.past, state.offer], future: [] };
      }),
      removeGrant: (index) => set((state) => {
        const nextOffer = {
          ...state.offer,
          equityGrants: (state.offer.equityGrants ?? []).filter((_, i) => i !== index),
        };
        const offers = state.offers.map((o, ai) => ai === state.activeIndex ? nextOffer : o);
        return { offer: nextOffer, offers, past: [...state.past, state.offer], future: [] };
      }),
      addRaise: (r) => set((state) => {
        const nextOffer = { ...state.offer, raises: [...(state.offer.raises ?? []), r] };
        const offers = state.offers.map((o, i) => i === state.activeIndex ? nextOffer : o);
        return { offer: nextOffer, offers, past: [...state.past, state.offer], future: [] };
      }),
      updateRaise: (index, r) => set((state) => {
        const nextOffer = {
          ...state.offer,
          raises: (state.offer.raises ?? []).map((x, i) => (i === index ? { ...x, ...r } : x)),
        };
        const offers = state.offers.map((o, ai) => ai === state.activeIndex ? nextOffer : o);
        return { offer: nextOffer, offers, past: [...state.past, state.offer], future: [] };
      }),
      removeRaise: (index) => set((state) => {
        const nextOffer = { ...state.offer, raises: (state.offer.raises ?? []).filter((_, i) => i !== index) };
        const offers = state.offers.map((o, ai) => ai === state.activeIndex ? nextOffer : o);
        return { offer: nextOffer, offers, past: [...state.past, state.offer], future: [] };
      }),
      setUiMode: (m) => set({ uiMode: m }),
      setBonusKind: (kind) => set((state) => {
        const nextOffer = {
          ...state.offer,
          performanceBonus: { ...(state.offer.performanceBonus ?? { kind: 'percent', value: 0, expectedPayout: 1 }), kind },
        };
        const offers = state.offers.map((o, i) => i === state.activeIndex ? nextOffer : o);
        return { offer: nextOffer, offers, past: [...state.past, state.offer], future: [] };
      }),
      setBonusValue: (value) => set((state) => {
        const nextOffer = {
          ...state.offer,
          performanceBonus: { ...(state.offer.performanceBonus ?? { kind: 'percent', value: 0, expectedPayout: 1 }), value },
        };
        const offers = state.offers.map((o, i) => i === state.activeIndex ? nextOffer : o);
        return { offer: nextOffer, offers, past: [...state.past, state.offer], future: [] };
      }),
      undo: () => set((state) => {
        if (state.past.length === 0) return state;
        const prev = state.past[state.past.length - 1];
        const past = state.past.slice(0, -1);
        const future = [state.offer, ...state.future];
        const offers = state.offers.map((o, i) => i === state.activeIndex ? prev : o);
        return { offer: prev, offers, past, future };
      }),
      redo: () => set((state) => {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const future = state.future.slice(1);
        const past = [...state.past, state.offer];
        const offers = state.offers.map((o, i) => i === state.activeIndex ? next : o);
        return { offer: next, offers, past, future };
      }),
      loadSnapshot: ({ offers: incomingOffers, activeIndex: incomingActiveIndex, uiMode }) => set(() => {
        const offers = (incomingOffers?.length ? incomingOffers : [initialOffer]).map((offer) => JSON.parse(JSON.stringify(offer)) as TOffer);
        const activeIndex = Math.max(0, Math.min(incomingActiveIndex ?? 0, offers.length - 1));
        const offer = offers[activeIndex] ?? initialOffer;
        return {
          offers,
          activeIndex,
          offer,
          past: [],
          future: [],
          ...(uiMode ? { uiMode } : {}),
        };
      }),
    }),
    {
      name: 'compcalc-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ offers: s.offers, activeIndex: s.activeIndex, offer: s.offer }),
    }
  )
);
