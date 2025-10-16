"use client";
import GrowthYoyEditor from '@/components/GrowthYoyEditor';
import GrantsPanel from '@/components/GrantsPanel';
import RaisesEditor from '@/components/RaisesEditor';
import CashPerksPanel from '@/components/CashPerksPanel';
import { useStore } from '@/state/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function AdvancedPanels() {
  const { uiMode } = useStore();
  const [expandedSections, setExpandedSections] = useState({
    growth: true,
    grants: false,
    raises: false,
    perks: false,
    export: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (uiMode !== 'advanced') return null;
  
  return (
    <div className="mt-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Advanced Settings</CardTitle>
            <div className="text-sm text-muted-foreground">
              Configure detailed scenarios & assumptions
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <SectionWrapper
              title="📈 Stock Growth Projections"
              description="Model how your equity value may change over time"
              isExpanded={expandedSections.growth}
              onToggle={() => toggleSection('growth')}
            >
              <GrowthYoyEditor />
            </SectionWrapper>

            <SectionWrapper
              title="💎 Equity Grants & Refreshers"
              description="Add initial grants and annual refresher equity"
              isExpanded={expandedSections.grants}
              onToggle={() => toggleSection('grants')}
            >
              <GrantsPanel />
            </SectionWrapper>

            <SectionWrapper
              title="📊 Salary Raises & Adjustments"
              description="Model mid-year raises and salary changes"
              isExpanded={expandedSections.raises}
              onToggle={() => toggleSection('raises')}
            >
              <RaisesEditor />
            </SectionWrapper>

            <SectionWrapper
              title="💰 Additional Benefits & Perks"
              description="Include retirement match, bonuses, and other perks"
              isExpanded={expandedSections.perks}
              onToggle={() => toggleSection('perks')}
            >
              <CashPerksPanel />
            </SectionWrapper>

            <SectionWrapper
              title="💾 Import / Export"
              description="Save or load your compensation scenarios"
              isExpanded={expandedSections.export}
              onToggle={() => toggleSection('export')}
            >
              <PersistencePanel />
            </SectionWrapper>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionWrapper({ 
  title, 
  description, 
  isExpanded, 
  onToggle, 
  children 
}: { 
  title: string; 
  description: string; 
  isExpanded: boolean; 
  onToggle: () => void; 
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors rounded-t-lg"
      >
        <div className="text-left">
          <h3 className="font-semibold text-base">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="p-4 pt-2 border-t">
          {children}
        </div>
      )}
    </div>
  );
}

function PersistencePanel() {
  const { offer, setOffer } = useStore();
  
  function exportJSON() {
    const blob = new Blob([JSON.stringify(offer, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = `${(offer.name || 'offer').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`; 
    a.click();
    URL.revokeObjectURL(url);
  }
  
  function importJSON(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        // Basic shape guard: rely on zod at form submit, here we accept and let UI reflect
        setOffer(obj);
        alert(`Successfully imported offer: ${obj.name || 'Unnamed Offer'}`);
      } catch {
        alert('Invalid JSON file. Please check the file format and try again.');
      }
    };
    reader.readAsText(file);
  }
  
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💾</div>
            <div className="flex-1">
              <h4 className="font-medium text-sm mb-1">Export Configuration</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Save your current offer details as a JSON file to share or backup
              </p>
              <Button type="button" onClick={exportJSON} className="w-full">
                📥 Export to JSON
              </Button>
            </div>
          </div>
        </div>
        
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="text-2xl">📂</div>
            <div className="flex-1">
              <h4 className="font-medium text-sm mb-1">Import Configuration</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Load a previously saved offer configuration from a JSON file
              </p>
              <label className="block cursor-pointer">
                <Button type="button" variant="secondary" className="w-full" asChild>
                  <span>📤 Import from JSON</span>
                </Button>
                <input 
                  type="file" 
                  accept="application/json" 
                  className="hidden" 
                  onChange={importJSON} 
                />
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-muted/50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground">
          <strong>💡 Tip:</strong> Exported files include all your settings, assumptions, and calculations. 
          You can share these files with others or use them to compare multiple offers.
        </p>
      </div>
    </div>
  );
}
