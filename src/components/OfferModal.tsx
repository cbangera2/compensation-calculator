'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/state/store';
import { TOffer } from '@/models/types';
import { CITY_PRESETS } from '@/lib/col';

type OfferModalProps = {
  open: boolean;
  onClose: () => void;
  /** If set, we're renaming this offer. If null, we're creating a new one. */
  editIndex: number | null;
};

export default function OfferModal({ open, onClose, editIndex }: OfferModalProps) {
  const { offers, addOffer, updateOfferAt } = useStore();
  const isEdit = editIndex !== null;
  const existing = isEdit ? offers[editIndex] : null;

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [locationKey, setLocationKey] = useState('custom');
  const [customLocation, setCustomLocation] = useState('');

  // Reset fields when modal opens
  useEffect(() => {
    if (open) {
      setName(existing?.name || '');
      const loc = existing?.location || '';
      setLocation(loc);
      const preset = CITY_PRESETS.find((c) => c.name === loc);
      if (preset) {
        setLocationKey(preset.key);
        setCustomLocation('');
      } else {
        setLocationKey('custom');
        setCustomLocation(loc);
      }
    }
  }, [open, existing?.name, existing?.location]);

  if (!open) return null;

  function handleSubmit() {
    const trimmedName = name.trim();
    const finalLocation = locationKey === 'custom'
      ? customLocation.trim()
      : CITY_PRESETS.find((c) => c.key === locationKey)?.name || '';
    const preset = CITY_PRESETS.find((c) => c.key === locationKey);
    if (isEdit && editIndex !== null) {
      updateOfferAt(editIndex, (o) => ({
        ...o,
        name: trimmedName || o.name,
        location: finalLocation || o.location,
        ...(preset ? { colFactor: preset.factor } : {}),
      }));
    } else {
      const newOffer: Partial<TOffer> = {
        name: trimmedName || `Offer ${offers.length + 1}`,
        location: finalLocation || undefined,
        ...(preset ? { colFactor: preset.factor } : {}),
      };
      addOffer(newOffer as TOffer);
    }
    onClose();
  }

  return (
    <Modal
      title={isEdit ? 'Rename offer' : 'New offer'}
      description={isEdit ? 'Update the offer name and location.' : 'Give your new offer a name and location.'}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            {isEdit ? 'Save' : 'Create offer'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="offer-name">Company / offer name</Label>
          <Input
            id="offer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isEdit ? existing?.name : 'e.g. Google'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-location">Location</Label>
          <select
            id="offer-location"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={locationKey}
            onChange={(e) => setLocationKey(e.target.value)}
          >
            <option value="custom">Custom...</option>
            {CITY_PRESETS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          {locationKey === 'custom' && (
            <Input
              id="offer-location-custom"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              placeholder="e.g. San Francisco Bay Area"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Used for cost-of-living adjustments in comparisons.
          </p>
        </div>
      </div>
    </Modal>
  );
}
