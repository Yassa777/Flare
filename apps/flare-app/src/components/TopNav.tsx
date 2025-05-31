'use client';

import { BellIcon } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Assuming shadcn/ui button is in ui subdir
import Link from 'next/link';

const TopNav = () => (
  <nav className="bg-card border-b border-border p-4 flex justify-between items-center h-16">
    <div className="flex items-center space-x-2">
      {/* Placeholder for logo - replace with actual Image or SVG */}
      <div className="w-7 h-7 bg-purple-600 rounded-full"></div> 
      <span className="font-semibold text-lg">SalesIntel</span>
    </div>
    <div className="flex items-center space-x-1">
      {[
        { href: '/', label: 'Home' },
        { href: '/leads', label: 'Leads' },
        { href: '#', label: 'Campaigns' },
        { href: '#', label: 'Analytics' },
        { href: '#', label: 'Settings' },
      ].map((item) => (
        <Button variant="link" asChild key={item.label}>
          <Link href={item.href} className="text-muted-foreground hover:text-foreground">
            {item.label}
          </Link>
        </Button>
      ))}
    </div>
    <div className="flex items-center space-x-4">
      <Button variant="ghost" size="icon">
        <BellIcon className="h-5 w-5" />
      </Button>
      {/* Placeholder for user avatar - replace with Avatar component from shadcn/ui */}
      <div className="w-8 h-8 bg-primary rounded-full"></div> 
    </div>
  </nav>
);

export default TopNav; 