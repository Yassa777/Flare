'use client';

import React, { useState, useEffect, useMemo } from 'react';
import TopNav from "@/components/TopNav";
import FiltersSidebar from "@/components/FiltersSidebar";
import MentionsFeed from "@/components/MentionsFeed";
import ArticleDetailModal from "@/components/ArticleDetailModal";
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { supabase } from '@/lib/supabaseClient'; // Import your Supabase client
import { Toaster } from "sonner";

// Article from NewsAPI
interface NewsArticle {
  source?: { id?: string | null; name?: string };
  author?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null; // url from NewsAPI can be an ID
  urlToImage?: string | null;
  publishedAt?: string | null;
  content?: string | null;
}

// Enriched mention structure from Supabase (align with your table)
interface EnrichedMention extends NewsArticle {
  id: number; // Supabase row id
  keyword: string;
  sentiment_label?: string | null;
  sentiment_score?: number | null;
}

// Combined type for display
export interface DisplayArticle extends NewsArticle { // Extends NewsArticle
  display_id: string | number | null; // Use a distinct id for display keys, can be url or supabase id
  sentiment_label?: string | null;
  sentiment_score?: number | null;
  isEnriched?: boolean;
  supabase_id?: number; // Keep original Supabase ID if available
  raw_data?: any; // Add raw_data (can be more specific like Record<string, any> if preferred)
  lead?: boolean | null; // Add lead status
  note?: string | null; // Add note
  // body will be inherited from NewsArticle's description field in the merging logic
}

const queryClient = new QueryClient();

// Fetches initial articles from NewsAPI via our edge function
const fetchNewsFromAPI = async (keyword: string): Promise<{ articles: NewsArticle[] }> => {
  if (!keyword.trim()) return { articles: [] };
  const response = await fetch(`/api/ingest/news?keyword=${encodeURIComponent(keyword)}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch news from API');
  }
  return response.json(); // Expects { articles: NewsArticle[] }
};

// Fetches enriched mentions from Supabase
const fetchEnrichedMentionsFromSupabase = async (keyword: string): Promise<EnrichedMention[]> => {
  if (!keyword.trim()) return [];
  const { data, error } = await supabase
    .from('mentions')
    .select('*') // Select all columns or specify what you need
    .eq('keyword', keyword) // Filter by the keyword used for the search
    .order('published_at', { ascending: false }); // Example order

  if (error) {
    console.error('Error fetching from Supabase:', error);
    throw new Error(error.message || 'Failed to fetch enriched mentions from Supabase');
  }
  return data || [];
};

function MentionsPageContent() {
  const [currentKeyword, setCurrentKeyword] = useState<string>('');
  const [combinedArticles, setCombinedArticles] = useState<DisplayArticle[]>([]);
  const [selectedSentiments, setSelectedSentiments] = useState<string[]>([]);
  const [selectedArticleForModal, setSelectedArticleForModal] = useState<DisplayArticle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Query 1: Fetch initial news from our API (which calls NewsAPI)
  const { 
    data: newsApiData,
    isLoading: isLoadingNews,
    isError: isErrorNews,
    error: errorNews,
    isSuccess: isSuccessNews
  } = useQuery<{ articles: NewsArticle[] }, Error>({
    queryKey: ['newsApiMentions', currentKeyword],
    queryFn: () => fetchNewsFromAPI(currentKeyword),
    enabled: !!currentKeyword,
  });

  // Query 2: Fetch enriched mentions from Supabase, enabled after NewsAPI fetch OR if keyword exists
  const { 
    data: supabaseData,
    refetch: refetchSupabaseMentions, // To manually refetch Supabase data
  } = useQuery<EnrichedMention[], Error>({
    queryKey: ['supabaseMentions', currentKeyword],
    queryFn: () => fetchEnrichedMentionsFromSupabase(currentKeyword),
    enabled: !!currentKeyword, // Always try to fetch from Supabase if keyword is present
    staleTime: 1000 * 10, // Consider data stale after 10 seconds
    refetchInterval: 1000 * 15, // Poll Supabase every 15 seconds for updates
  });

  useEffect(() => {
    // This effect now primarily merges newsApiData with supabaseData whenever either changes.
    // It ensures that newly fetched NewsAPI articles are shown, and then enhanced/replaced by Supabase data.
    if (!currentKeyword) {
      setCombinedArticles([]);
      return;
    }

    let articlesToDisplay: DisplayArticle[] = [];

    // Start with NewsAPI data if available
    if (newsApiData?.articles) {
      articlesToDisplay = newsApiData.articles.map(article => ({
        ...article,
        display_id: article.url || `temp-news-${Math.random()}`,
        isEnriched: false,
      }));
    }

    // Merge or replace with Supabase data
    if (supabaseData) {
      const enrichedArticleMap = new Map<string, EnrichedMention>();
      supabaseData.forEach(supaArticle => {
        if (supaArticle.url) {
          enrichedArticleMap.set(supaArticle.url, supaArticle);
        }
      });

      articlesToDisplay = articlesToDisplay.map(apiArticle => {
        if (apiArticle.url && enrichedArticleMap.has(apiArticle.url)) {
          const enriched = enrichedArticleMap.get(apiArticle.url)!; // Safe due to .has check
          return {
            ...apiArticle, // Keep some base fields
            ...enriched,   // Overwrite with enriched data
            display_id: enriched.id, // Use Supabase ID for key once enriched
            supabase_id: enriched.id,
            isEnriched: true,
          };
        }
        return apiArticle; // Return original NewsAPI article if no match in Supabase yet
      });

      // Add any Supabase articles that weren't in the initial NewsAPI fetch (e.g., older articles)
      supabaseData.forEach(supaArticle => {
        if (supaArticle.url && !articlesToDisplay.some(a => a.url === supaArticle.url)) {
          articlesToDisplay.push({
            ...supaArticle,
            display_id: supaArticle.id,
            supabase_id: supaArticle.id,
            isEnriched: true,
          });
        }
      });
    }

    // Sort by publishedAt after merging
    articlesToDisplay.sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
    setCombinedArticles(articlesToDisplay);

  }, [newsApiData, supabaseData, currentKeyword, isSuccessNews]);

  // Memoized filtered articles based on selectedSentiments
  const filteredArticles = useMemo(() => {
    if (selectedSentiments.length === 0) {
      return combinedArticles;
    }
    return combinedArticles.filter(article => 
      article.isEnriched && article.sentiment_label && selectedSentiments.includes(article.sentiment_label)
    );
  }, [combinedArticles, selectedSentiments]);

  const handleKeywordSearch = (keywordFromSidebar: string) => {
    setCurrentKeyword(keywordFromSidebar);
    setSelectedSentiments([]);
    setIsModalOpen(false);
  };

  const handleSentimentChange = (sentiments: string[]) => {
    setSelectedSentiments(sentiments);
  };

  const handleViewArticleDetails = (article: DisplayArticle) => {
    setSelectedArticleForModal(article);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedArticleForModal(null);
  };

  const handleArticleUpdateInList = (updatedArticle: DisplayArticle) => {
    setCombinedArticles(prevArticles => 
      prevArticles.map(art => 
        art.supabase_id === updatedArticle.supabase_id ? { ...art, ...updatedArticle } : art
      )
    );
  };
  
  const overallIsLoading = isLoadingNews && !!currentKeyword;
  const overallIsError = isErrorNews;
  const overallErrorMsg = errorNews?.message;

  return (
    <>
      <div className="flex flex-col h-screen bg-background">
        <TopNav />
        <div className="flex flex-1 overflow-hidden">
          <FiltersSidebar 
            onKeywordSearch={handleKeywordSearch} 
            isSearching={overallIsLoading} 
            onSentimentChange={handleSentimentChange}
          />
          <MentionsFeed 
            articles={filteredArticles}
            isLoading={overallIsLoading}
            isError={overallIsError}
            errorMsg={overallErrorMsg}
            onViewArticleDetails={handleViewArticleDetails}
          />
        </div>
      </div>
      {selectedArticleForModal && (
        <ArticleDetailModal 
          article={selectedArticleForModal}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onArticleUpdate={handleArticleUpdateInList}
        />
      )}
      <Toaster richColors position="top-right" />
    </>
  );
}

export default function HomePage() {
  return (
    <QueryClientProvider client={queryClient}>
      <MentionsPageContent />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
