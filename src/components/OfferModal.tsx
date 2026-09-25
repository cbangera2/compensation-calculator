'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/state/store';
import { TOffer } from '@/models/types';

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

  // Reset fields when modal opens
  useEffect(() => {
    if (open) {
      setName(existing?.name || '');
      setLocation(existing?.location || '');
    }
  }, [open, existing?.name, existing?.location]);

  function handleSubmit() {
    const trimmedName = name.trim();
    if (isEdit && editIndex !== null) {
      updateOfferAt(editIndex, (o) => ({
        ...o,
        name: trimmedName || o.name,
        location: location.trim() || o.location,
      }));
    } else {
      const newOffer: Partial<TOffer> = {
        name: trimmedName || `Offer ${offers.length + 1}`,
        location: location.trim() || undefined,
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
          <Input
            id="offer-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. San Francisco Bay Area"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
          />
          <p className="text-xs text-muted-foreground">
            Used for cost-of-living adjustments in comparisons.
          </p>
        </div>
      </div>
    </Modal>
  );
}
