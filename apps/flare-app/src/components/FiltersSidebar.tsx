'use client';

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Label is often used with Checkbox/Input

const FiltersSidebar = () => (
  <aside className="w-72 bg-card p-6 space-y-6 border-r border-border">
    <h2 className="text-xl font-semibold">Filters</h2>
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Sources</h3>
      <div className="space-y-2">
        {['News', 'Twitter', 'Blogs'].map((source) => (
          <div key={source} className="flex items-center space-x-2">
            <Checkbox id={source.toLowerCase()} />
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
            <Checkbox id={sentiment.toLowerCase()} />
            <Label htmlFor={sentiment.toLowerCase()} className="text-sm font-normal">{sentiment}</Label>
          </div>
        ))}
      </div>
    </div>
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Keywords/Brands</h3>
      <Input type="text" placeholder="Enter keywords or brands" />
    </div>
    <Button className="w-full">
      Apply Filters
    </Button>
  </aside>
);

export default FiltersSidebar; 