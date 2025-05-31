'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Label is often used with Checkbox/Input

// Define available sentiment options, ensuring consistency (e.g., uppercase)
const SENTIMENT_OPTIONS = [
  { id: 'POSITIVE', label: 'Positive' },
  { id: 'NEUTRAL', label: 'Neutral' },
  { id: 'NEGATIVE', label: 'Negative' },
];

interface FiltersSidebarProps {
  onKeywordSearch: (keyword: string) => void;
  isSearching: boolean;
  onSentimentChange: (selectedSentiments: string[]) => void;
  // No need to pass initialSelectedSentiments if we manage it internally and call back
}

const FiltersSidebar = ({ 
  onKeywordSearch, 
  isSearching, 
  onSentimentChange 
}: FiltersSidebarProps) => {
  const [keywordInput, setKeywordInput] = useState('');
  const [selectedSentimentIds, setSelectedSentimentIds] = useState<string[]>([]);

  const handleSearch = () => {
    if (keywordInput.trim()) {
      onKeywordSearch(keywordInput.trim());
    }
  };

  const handleSentimentCheckboxChange = (sentimentId: string) => {
    setSelectedSentimentIds(prevIds => {
      const newIds = prevIds.includes(sentimentId)
        ? prevIds.filter(id => id !== sentimentId)
        : [...prevIds, sentimentId];
      onSentimentChange(newIds); // Call the callback with the new array of selected sentiment IDs
      return newIds;
    });
  };

  return (
    <aside className="w-72 bg-card p-6 space-y-6 border-r border-border">
      <h2 className="text-xl font-semibold">Filters</h2>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Sources</h3>
        <div className="space-y-2">
          {['News', 'Twitter', 'Blogs'].map((source) => (
            <div key={source} className="flex items-center space-x-2">
              <Checkbox id={`source-${source.toLowerCase()}`} disabled />
              <Label htmlFor={`source-${source.toLowerCase()}`} className="text-sm font-normal">{source}</Label>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Sentiment</h3>
        <div className="space-y-2">
          {SENTIMENT_OPTIONS.map((sentiment) => (
            <div key={sentiment.id} className="flex items-center space-x-2">
              <Checkbox 
                id={`sentiment-${sentiment.id.toLowerCase()}`}
                checked={selectedSentimentIds.includes(sentiment.id)}
                onCheckedChange={() => handleSentimentCheckboxChange(sentiment.id)}
              />
              <Label htmlFor={`sentiment-${sentiment.id.toLowerCase()}`} className="text-sm font-normal">
                {sentiment.label}
              </Label>
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