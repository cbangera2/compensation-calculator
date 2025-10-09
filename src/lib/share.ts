import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { z } from 'zod';
import { Offer, TOffer } from '@/models/types';

const SharePayloadSchema = z.object({
  version: z.literal(1),
  offers: z.array(Offer),
  activeIndex: z.number().int().nonnegative(),
  uiMode: z.enum(['simple', 'advanced']).default('simple'),
});

export type SharePayload = z.infer<typeof SharePayloadSchema>;

type SnapshotInput = {
  offers: TOffer[];
  activeIndex: number;
  uiMode: 'simple' | 'advanced';
};

export function snapshotToPayload(input: SnapshotInput): SharePayload {
  const offersClone = JSON.parse(JSON.stringify(input.offers)) as TOffer[];
  const activeIndex = Math.min(
    Math.max(input.activeIndex, 0),
    Math.max(offersClone.length - 1, 0),
  );

  return SharePayloadSchema.parse({
    version: 1,
    offers: offersClone,
    activeIndex,
    uiMode: input.uiMode ?? 'simple',
  });
}

export function encodeSharePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  return compressToEncodedURIComponent(json);
}

export function buildShareToken(snapshot: SnapshotInput): string {
  return encodeSharePayload(snapshotToPayload(snapshot));
}

export function decodeShareToken(token: string): SharePayload | null {
  try {
    const json = decompressFromEncodedURIComponent(token);
    if (!json) return null;
    const parsed = JSON.parse(json);
    return SharePayloadSchema.parse(parsed);
  } catch (err) {
    console.warn('Failed to decode share token', err);
    return null;
  }
}

export function payloadToSnapshot(payload: SharePayload): SnapshotInput {
  return {
    offers: JSON.parse(JSON.stringify(payload.offers)) as TOffer[],
    activeIndex: payload.activeIndex,
    uiMode: payload.uiMode ?? 'simple',
  };
}
