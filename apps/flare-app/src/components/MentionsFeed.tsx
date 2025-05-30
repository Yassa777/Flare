'use client';

import { Button } from "@/components/ui/button";
import MentionCard from "./MentionCard"; // Ensure correct path
import { SearchIcon, SettingsIcon, NewspaperIcon, MessageSquareTextIcon, TwitterIcon } from 'lucide-react'; // Added more specific icons

const MentionsFeed = () => {
  // Placeholder data - this will come from an API later
  // Using more appropriate icons now
  const mentions = [
    {
      id: 1,
      author: 'TechCrunch',
      time: '2 hours',
      content: "New AI startup, 'InnovateAI', secures $10M in seed funding",
      sourceIcon: <NewspaperIcon className="w-5 h-5" />
    },
    {
      id: 2,
      author: 'Twitter User',
      time: '3 hours',
      content: "Excited to see 'InnovateAI' disrupting the AI space! #AI #innovation",
      sourceIcon: <TwitterIcon className="w-5 h-5" /> 
    },
    {
      id: 3,
      author: 'TechBlog',
      time: '4 hours',
      content: "'InnovateAI' launches its groundbreaking AI platform, promising to revolutionize industries.",
      sourceIcon: <MessageSquareTextIcon className="w-5 h-5" /> 
    },
    {
      id: 4,
      author: 'Another User',
      time: '5 hours',
      content: "Just tried 'InnovateAI\'s' new platform. Impressive features and user-friendly interface! #AItools",
      sourceIcon: <TwitterIcon className="w-5 h-5" />
    },
    {
      id: 5,
      author: 'IndustryNews',
      time: '6 hours',
      content: "Experts predict 'InnovateAI' will be a key player in the future of AI.",
      sourceIcon: <NewspaperIcon className="w-5 h-5" />
    }
  ];

  return (
    <main className="flex-1 p-6 space-y-6 bg-muted/30 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Real-time Mentions</h1>
        <Button variant="outline">
          Pause Stream
        </Button>
      </div>
      <div className="space-y-4">
        {mentions.map(mention => <MentionCard key={mention.id} {...mention} />)}
      </div>
    </main>
  );
};

export default MentionsFeed; 