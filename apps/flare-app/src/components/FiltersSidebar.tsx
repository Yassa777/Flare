'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Label is often used with Checkbox/Input

interface FiltersSidebarProps {
  onKeywordSearch: (keyword: string) => void;
  isSearching: boolean;
}

const FiltersSidebar = ({ onKeywordSearch, isSearching }: FiltersSidebarProps) => {
  const [keywordInput, setKeywordInput] = useState('');

  const handleSearch = () => {
    if (keywordInput.trim()) {
      onKeywordSearch(keywordInput.trim());
    }
  };

  return (
    <aside className="w-72 bg-card p-6 space-y-6 border-r border-border">
      <h2 className="text-xl font-semibold">Filters</h2>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Sources</h3>
        <div className="space-y-2">
          {['News', 'Twitter', 'Blogs'].map((source) => (
            <div key={source} className="flex items-center space-x-2">
              <Checkbox id={source.toLowerCase()} disabled />
              <Label htmlFor={source.toLowerCase()} className="text-sm font-normal">{source}</Label>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Sentiment</h3>
        <div className="space-y-2">
          {['Positive', 'Neutral', 'Negative'].map((sentiment) => (
            <div key={sentiment} className="flex items-center space-x-2">
              <Checkbox id={sentiment.toLowerCase()} disabled />
              <Label htmlFor={sentiment.toLowerCase()} className="text-sm font-normal">{sentiment}</Label>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Search by Keyword</h3>
        <div className="flex space-x-2">
          <Input 
            type="text" 
            placeholder="Enter keyword..." 
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
      </div>
      <Button className="w-full" onClick={handleSearch} disabled={isSearching || !keywordInput.trim()}>
        {isSearching ? 'Searching...' : 'Search Mentions'}
      </Button>
    </aside>
  );
};

export default FiltersSidebar; 