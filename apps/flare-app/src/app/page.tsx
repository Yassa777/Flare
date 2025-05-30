import TopNav from "@/components/TopNav";
import FiltersSidebar from "@/components/FiltersSidebar";
import MentionsFeed from "@/components/MentionsFeed";

export default function HomePage() {
  return (
    <div className="flex flex-col h-screen bg-background">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <FiltersSidebar />
        <MentionsFeed />
      </div>
    </div>
  );
}
