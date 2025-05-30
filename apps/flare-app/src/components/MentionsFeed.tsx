'use client';

import { Button } from "@/components/ui/button";
import MentionCard from "./MentionCard"; // Ensure correct path
import { NewspaperIcon, MessageSquareTextIcon, TwitterIcon, AlertTriangleIcon, Loader2Icon } from 'lucide-react'; // Added more specific icons
import type { DisplayArticle } from '../app/page'; // Import DisplayArticle

// Re-using Article type, ideally this would be in a shared types file
interface Article {
  source?: { id?: string | null; name?: string };
  author?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  urlToImage?: string | null;
  publishedAt?: string | null;
  content?: string | null;
  // Adding an ID for the key prop, assuming NewsAPI provides something like url or a unique field
  // If not, we might need to generate one or use the index (less ideal)
  id?: string; // Could be article.url or a combination to ensure uniqueness
}

interface MentionsFeedProps {
  articles: DisplayArticle[]; // Use DisplayArticle
  isLoading: boolean;
  isError: boolean;
  errorMsg?: string;
}

const MentionsFeed = ({ articles, isLoading, isError, errorMsg }: MentionsFeedProps) => {
  // Placeholder icons for different sources - can be made more dynamic
  const getSourceIcon = (sourceName?: string) => {
    if (sourceName?.toLowerCase().includes('twitter')) return <TwitterIcon className="w-5 h-5" />;
    if (sourceName?.toLowerCase().includes('blog')) return <MessageSquareTextIcon className="w-5 h-5" />;
    return <NewspaperIcon className="w-5 h-5" />;
  };

  if (isLoading) {
    return (
      <main className="flex-1 p-6 flex flex-col items-center justify-center bg-muted/30 overflow-y-auto">
        <Loader2Icon className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading mentions...</p>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="flex-1 p-6 flex flex-col items-center justify-center bg-muted/30 overflow-y-auto">
        <AlertTriangleIcon className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive-foreground mb-2">Error fetching mentions</p>
        <p className="text-xs text-muted-foreground">{errorMsg || 'An unexpected error occurred.'}</p>
      </main>
    );
  }
  
  if (!articles || articles.length === 0) {
     return (
      <main className="flex-1 p-6 flex flex-col items-center justify-center bg-muted/30 overflow-y-auto">
        <NewspaperIcon className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No mentions found. Try a different keyword or search again.</p>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6 space-y-6 bg-muted/30 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Search Results</h1>
        {/* Pause Stream button might not be relevant for on-demand search, or could be a "Clear Results" */}
        {/* <Button variant="outline">
          Pause Stream
        </Button> */}
      </div>
      <div className="space-y-4">
        {articles.map((article) => (
          <MentionCard 
            key={article.display_id} // Use display_id for key
            author={article.author || 'Unknown'}
            time={article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'N/A'}
            title={article.title || 'No title'}
            description={article.description}
            sourceIcon={getSourceIcon(article.source?.name)}
            articleUrl={article.url}
            sentimentLabel={article.sentiment_label} // Pass sentiment
            sentimentScore={article.sentiment_score} // Pass sentiment
            isEnriched={article.isEnriched}
          />
        ))}
      </div>
    </main>
  );
};

export default MentionsFeed; 