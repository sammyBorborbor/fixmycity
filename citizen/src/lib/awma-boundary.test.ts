import { describe, it, expect } from 'vitest';
import { pointInAwma } from './awma-boundary.ts';

// The 8 official AWMA pilot neighbourhoods (centroids mirror GEO in store.tsx).
// All must be accepted — the enforced boundary is the OSM admin polygon widened
// by a ~500 m tolerance precisely so these three edge estates (Abelemkpe,
// Airport Residential, Roman Ridge), which sit just outside the raw polygon,
// still count as in-jurisdiction.
const NEIGHBOURHOODS: Array<[string, number, number]> = [
  ['East Legon', 5.636, -0.161],
  ['Okponglo', 5.635, -0.185],
  ['Dzorwulu', 5.606, -0.19],
  ['Abelemkpe', 5.601, -0.203],
  ['Airport Residential Area', 5.6, -0.178],
  ['Roman Ridge', 5.593, -0.192],
  ['Shiashie', 5.626, -0.174],
  ['Legon (near University of Ghana)', 5.65, -0.187],
];

// Points genuinely outside AWMA that must be rejected.
const OUTSIDE: Array<[string, number, number]> = [
  ['East Legon Hills (Kpone-Katamanso, ~1.4 km E)', 5.66, -0.13],
  ['Kwame Nkrumah Circle (central Accra, S)', 5.56, -0.205],
  ['Kumasi (far)', 6.69, -1.62],
  ['Tema (east coast)', 5.67, 0.01],
];

describe('pointInAwma', () => {
  it.each(NEIGHBOURHOODS)('accepts %s (a pilot neighbourhood)', (_name, lat, lng) => {
    expect(pointInAwma(lat, lng)).toBe(true);
  });

  it.each(OUTSIDE)('rejects %s', (_name, lat, lng) => {
    expect(pointInAwma(lat, lng)).toBe(false);
  });

  it('rejects non-finite coordinates', () => {
    expect(pointInAwma(NaN, -0.185)).toBe(false);
    expect(pointInAwma(5.635, Infinity)).toBe(false);
  });
});
