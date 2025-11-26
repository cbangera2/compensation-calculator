"use client";
import { useStore } from "@/state/store";
import { StockGrowthControl, type StockGrowthValue } from "@/components/ui/stock-growth-control";
import { useCallback } from "react";

export default function GrowthYoyEditor() {
  const { offer, setOffer } = useStore();
  const years = offer.assumptions?.horizonYears ?? 4;

  // Build the value object from offer state
  const value: StockGrowthValue = {
    startingPrice: offer.growth?.startingPrice ?? offer.equityGrants?.[0]?.fmv ?? 10,
    yoy: offer.growth?.yoy ?? Array.from({ length: years }, () => 0),
  };

  // Handle changes from the control
  const handleChange = useCallback(
    (newValue: StockGrowthValue) => {
      setOffer({
        ...offer,
        growth: {
          ...offer.growth,
          startingPrice: newValue.startingPrice,
          yoy: newValue.yoy,
        },
      });
    },
    [offer, setOffer]
  );

  return (
    <StockGrowthControl
      value={value}
      onChange={handleChange}
      years={years}
      variant="default"
      showPresets={true}
      showYearControls={true}
    />
  );
}
