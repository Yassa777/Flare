'use client';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import React from "react";
import { Loader2Icon } from 'lucide-react';

export interface MentionCardProps {
  author: string;
  time: string;
  title: string;
  description?: string | null;
  sourceIcon: React.ReactNode;
  articleUrl?: string | null;
  sentimentLabel?: string | null;
  sentimentScore?: number | null;
  isEnriched?: boolean;
}

const MentionCard = ({ author, time, title, description, sourceIcon, articleUrl, sentimentLabel, sentimentScore, isEnriched }: MentionCardProps) => {
  const cardContent = description || title;
  const cardTitle = description ? title : "";

  const getSentimentColor = (label?: string | null) => {
    if (!label) return "secondary";
    switch (label.toUpperCase()) {
      case 'POSITIVE': return "bg-green-500 hover:bg-green-600";
      case 'NEGATIVE': return "bg-red-500 hover:bg-red-600";
      case 'NEUTRAL': return "bg-yellow-500 hover:bg-yellow-600";
      default: return "secondary";
    }
  };

  return (
    <Card className="flex items-start space-x-4 p-4">
      <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
        {sourceIcon}
      </div>
      <div className="flex-grow">
        {cardTitle && <p className="text-sm font-semibold text-foreground mb-1 leading-snug">{cardTitle}</p>}
        <p className="text-sm text-muted-foreground leading-relaxed break-words">{cardContent}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-muted-foreground">
            <span>{time}</span> - <span>{author}</span>
          </div>
          <div className="flex items-center">
            {!isEnriched && (
              <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
            )}
            {isEnriched && sentimentLabel && (
              <Badge variant="outline" className={`text-xs ${getSentimentColor(sentimentLabel)} text-white`}>
                {sentimentLabel}
                {typeof sentimentScore === 'number' && ` (${sentimentScore.toFixed(2)})`}
              </Badge>
            )}
            {isEnriched && !sentimentLabel && (
                <Badge variant="outline" className="text-xs border-dashed">
                    N/A
                </Badge>
            )}
          </div>
        </div>
      </div>
      {articleUrl && (
        <Button variant="outline" size="sm" asChild className="ml-auto whitespace-nowrap shrink-0 self-start">
          <a href={articleUrl} target="_blank" rel="noopener noreferrer">Read More</a>
        </Button>
      )}
    </Card>
  );
};

export default MentionCard; 