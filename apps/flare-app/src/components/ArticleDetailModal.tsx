'use client';

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DisplayArticle } from '../app/page'; // Assuming DisplayArticle is exported from page.tsx
import { toast } from "sonner"; // For showing notifications

interface ArticleDetailModalProps {
  article: DisplayArticle | null;
  isOpen: boolean;
  onClose: () => void;
  onArticleUpdate: (updatedArticle: DisplayArticle) => void; // Callback to update article in parent state
}

const ArticleDetailModal = ({ article, isOpen, onClose, onArticleUpdate }: ArticleDetailModalProps) => {
  const [isLead, setIsLead] = useState(false);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (article) {
      setIsLead(!!article.lead); 
      setNote(article.note || '');
    }
  }, [article]);

  if (!article) return null;

  const handleSaveChanges = async () => {
    if (!article || !article.supabase_id) {
      toast.error("Cannot update article without a Supabase ID.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`/api/mentions/${article.supabase_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: isLead, note: note }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update mention.');
      }
      const updatedArticleFromServer = await response.json();
      onArticleUpdate(updatedArticleFromServer); // Update state in parent
      toast.success("Mention updated successfully!");
      onClose(); // Close modal on successful save
    } catch (error) {
      console.error("Error updating mention:", error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred.");
    } finally {
      setIsSaving(false);
    }
  };
  
  // Format date for display
  const formattedPublishedAt = article.publishedAt 
    ? new Date(article.publishedAt).toLocaleString() 
    : 'N/A';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl line-clamp-2">{article.title || 'Article Details'}</DialogTitle>
          {article.url && (
            <DialogDescription>
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">
                Read full article
              </a>
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">Source</h4>
            <p className="text-sm">{typeof article.source === 'string' ? article.source : article.source?.name || 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">Published</h4>
            <p className="text-sm">{formattedPublishedAt}</p>
          </div>
          {article.author && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Author</h4>
              <p className="text-sm">{article.author}</p>
            </div>
          )}
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">Description/Body</h4>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {article.description || 'No description available.'}
            </p>
          </div>
          
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="isLeadCheckbox"
                checked={isLead}
                onCheckedChange={(checkedState) => setIsLead(Boolean(checkedState))}
              />
              <Label htmlFor="isLeadCheckbox" className="text-sm font-medium">
                Mark as Lead
              </Label>
            </div>
            <div>
              <Label htmlFor="noteTextarea" className="text-sm font-medium block mb-1">
                Notes
              </Label>
              <Textarea 
                id="noteTextarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any relevant notes for this lead..."
                rows={3}
              />
            </div>
          </div>

          {/* Raw Data for debugging/info - can be made collapsible or removed */}
          {article.raw_data && (
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer text-muted-foreground">View Raw Data</summary>
              <pre className="bg-muted p-2 rounded-md overflow-x-auto mt-1">
                {JSON.stringify(article.raw_data, null, 2)}
              </pre>
            </details>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ArticleDetailModal; 