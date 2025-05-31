'use client';

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import React from "react";
import { Loader2Icon } from 'lucide-react';
import type { DisplayArticle } from "../app/page"; // Import DisplayArticle

export interface MentionCardProps {
  article: DisplayArticle; // Pass the whole article object
  sourceIcon: React.ReactNode;
  onViewDetails: (article: DisplayArticle) => void;
}

const MentionCard = ({ article, sourceIcon, onViewDetails }: MentionCardProps) => {
  const { 
    author, 
    publishedAt, 
    title, 
    description, 
    sentiment_label,
    sentiment_score,
    isEnriched, 
    url,
    lead
  } = article;

  const time = publishedAt ? new Date(publishedAt).toLocaleDateString() : 'N/A';

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
    <Card 
      className={`flex items-start space-x-4 p-4 hover:shadow-md transition-shadow cursor-pointer ${lead ? 'border-purple-500 border-2' : ''}`}
      onClick={() => onViewDetails(article)}
    >
      <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
        {sourceIcon}
      </div>
      <div className="flex-grow">
        <div className="flex justify-between items-start">
            {description ? 
              <p className="text-sm font-semibold text-foreground mb-1 leading-snug line-clamp-2 mr-2 flex-1">{title}</p> 
              : 
              <p className="text-sm font-semibold text-foreground mb-1 leading-snug line-clamp-2 mr-2 flex-1">{title}</p>
            }
            {lead && (
                <Badge variant="default" className="text-xs bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap">
                    Lead
                </Badge>
            )}
        </div>
        {description && <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 break-words">{description}</p>}
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-muted-foreground">
            <span>{time}</span> - <span>{author || 'Unknown'}</span>
          </div>
          <div className="flex items-center">
            {!isEnriched && (
              <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
            )}
            {isEnriched && sentiment_label && (
              <Badge variant="outline" className={`text-xs ${getSentimentColor(sentiment_label)} text-white`}>
                {sentiment_label}
                {typeof sentiment_score === 'number' && ` (${sentiment_score.toFixed(2)})`}
              </Badge>
            )}
            {isEnriched && !sentiment_label && (
                <Badge variant="outline" className="text-xs border-dashed">
                    N/A
                </Badge>
            )}
          </div>
        </div>
      </div>
      {url && (
        <Button variant="outline" size="sm" asChild className="ml-auto whitespace-nowrap shrink-0 self-start" onClick={(e) => e.stopPropagation()}>
          <a href={url} target="_blank" rel="noopener noreferrer">Read More</a>
        </Button>
      )}
    </Card>
  );
};

export default MentionCard; 