'use client';

import React, { useState, useEffect } from 'react';
import TopNav from "@/components/TopNav";
import MentionsFeed from "@/components/MentionsFeed"; // Re-use for now, can customize later
import ArticleDetailModal from "@/components/ArticleDetailModal";
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Toaster } from "sonner";
import type { DisplayArticle } from '../page'; // Corrected import path

const queryClient = new QueryClient();

const fetchLeads = async (): Promise<DisplayArticle[]> => {
  const { data, error } = await supabase
    .from('mentions')
    .select('*')
    .eq('lead', true)
    .order('inserted_at', { ascending: false });

  if (error) {
    console.error("Error fetching leads:", error);
    throw new Error(error.message || 'Failed to fetch leads');
  }
  // Ensure data conforms to DisplayArticle, especially for display_id
  return (data || []).map(lead => ({ ...lead, display_id: lead.id })); 
};

function LeadsPageContent() {
  const [selectedArticleForModal, setSelectedArticleForModal] = useState<DisplayArticle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { 
    data: leads = [], 
    isLoading,
    isError,
    error,
    refetch // To refetch leads if an article is unmarked as lead from modal
  } = useQuery<DisplayArticle[], Error>({
    queryKey: ['leads'],
    queryFn: fetchLeads,
  });

  const handleViewArticleDetails = (article: DisplayArticle) => {
    setSelectedArticleForModal(article);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedArticleForModal(null);
  };

  const handleArticleUpdateInList = (updatedArticle: DisplayArticle) => {
    // If the updated article is no longer a lead, it should be removed from this list.
    // Or, more simply, just refetch the leads list.
    refetch(); 
  };

  return (
    <>
      <div className="flex flex-col h-screen bg-background">
        <TopNav />
        <div className="flex-1 p-6">
          <h1 className="text-2xl font-semibold mb-6">Leads</h1>
          <MentionsFeed 
            articles={leads}
            isLoading={isLoading}
            isError={isError}
            errorMsg={error?.message}
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
    </>
  );
}

export default function LeadsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <LeadsPageContent />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
} 