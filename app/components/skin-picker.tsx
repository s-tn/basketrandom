"use client"

import { useEffect } from "react"

const SKINS = [
  { id: 'default', name: 'Default', color: '#ffffff' },
  { id: 'red', name: 'Fire', color: '#ef4444' },
  { id: 'blue', name: 'Ice', color: '#3b82f6' },
  { id: 'green', name: 'Forest', color: '#22c55e' },
  { id: 'gold', name: 'Gold', color: '#eab308' },
  { id: 'purple', name: 'Royal', color: '#a855f7' },
  { id: 'pink', name: 'Flamingo', color: '#ec4899' },
  { id: 'orange', name: 'Blaze', color: '#f97316' },
];

export { SKINS };

interface SkinPickerProps {
  onSelect: (skin: string) => void
  currentSkin: string
}

export function SkinPicker({ onSelect, currentSkin }: SkinPickerProps) {
  useEffect(() => {
    const stored = localStorage.getItem('playerSkin');
    if (stored && stored !== currentSkin) {
      onSelect(stored);
    }
  }, []);

  function handleSelect(skinId: string) {
    localStorage.setItem('playerSkin', skinId);
    onSelect(skinId);
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Character Color</h3>
      <div className="grid grid-cols-8 gap-2">
        {SKINS.map((skin) => {
          const isSelected = currentSkin === skin.id;
          return (
            <button
              key={skin.id}
              title={skin.name}
              onClick={() => handleSelect(skin.id)}
              className={
                "w-8 h-8 rounded-full border-2 transition-all focus:outline-none " +
                (isSelected
                  ? "border-white ring-2 ring-white scale-110"
                  : "border-transparent hover:scale-105")
              }
              style={{ backgroundColor: skin.color }}
            />
          );
        })}
      </div>
    </div>
  );
}
