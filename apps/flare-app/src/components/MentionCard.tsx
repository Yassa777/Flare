'use client';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import React from "react";

interface MentionCardProps {
  source?: string; // Made optional as not directly visible in card body per image
  author: string;
  time: string;
  content: string;
  sourceIcon: React.ReactNode;
}

const MentionCard = ({ author, time, content, sourceIcon }: MentionCardProps) => (
  <Card className="flex items-start space-x-4 p-4">
    <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
      {sourceIcon}
    </div>
    <div className="flex-grow">
      <CardContent className="p-0">
        <p className="text-sm text-foreground leading-relaxed">{content}</p>
      </CardContent>
      <CardFooter className="p-0 mt-1 text-xs text-muted-foreground">
        <span>{time} ago</span> - <span>{author}</span>
      </CardFooter>
    </div>
    <Button variant="secondary" size="sm" className="ml-auto whitespace-nowrap">
      Add as Lead
    </Button>
  </Card>
);

export default MentionCard; 