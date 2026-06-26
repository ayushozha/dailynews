import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Clapperboard,
  ExternalLink,
  Flame,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { StoryCard } from '@/components/story-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchStatus,
  fetchStories,
  generateMeme,
  searchNews,
  type DashboardStatus,
  type NewsHeadline,
  type Story,
} from '@/lib/api';

export default function App() {
  const [status, setStatus] = useState<DashboardStatus | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [source, setSource] = useState<'kv' | 'local'>('local');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [s, st] = await Promise.all([fetchStatus(), fetchStories()]);
      setStatus(s);
      setStories(st.stories);
      setSource(st.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reach API — is `npm run dev` running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const ms = generating ? 4000 : 8000;
    const id = setInterval(refresh, ms);
    return () => clearInterval(id);
  }, [refresh, generating]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const onSearchNews = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setError('Enter a topic to search — e.g. "AI regulation", "Taylor Swift", "Ukraine"');
      return;
    }
    setSearching(true);
    setError(null);
    setHeadlines([]);
    setActiveQuery(null);
    try {
      const result = await searchNews(q);
      setHeadlines(result.stories);
      setActiveQuery(result.query);
      setToast(`Found ${result.count} live headlines from ${result.sources_used.join(', ')}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'News search failed');
    } finally {
      setSearching(false);
    }
  };

  const onGenerateMeme = async () => {
    const q = activeQuery ?? searchQuery.trim();
    if (!q) {
      setError('Search for a topic first — we need 5 live headlines to fuse into a meme.');
      return;
    }
    if (headlines.length < 5) {
      setError('Run a search first so we can scrape 5 related headlines.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await generateMeme(q);
      setToast(result.message);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Meme generation failed');
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!generating) return;
    const pending = stories.some((s) => s.status !== 'published');
    if (!pending && stories.length > 0) setGenerating(false);
  }, [stories, generating]);

  const budgetPct = status
    ? Math.min(100, Math.round((status.spend_usd / status.budget_usd) * 100))
    : 0;

  const published = stories.filter((s) => s.status === 'published');
  const inProgress = stories.filter((s) => s.status !== 'published');

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10 animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Meme Control Room
              </span>
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Daily<span className="text-sky underline decoration-coral decoration-4 underline-offset-4">News</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Search any topic, scrape 5 live headlines from Google News + GDELT, fuse them into one
              unhinged mega-meme, ship it with MiniMax Hailuo + TTS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-white">
              {source === 'kv' ? 'Vercel KV' : 'Local output'}
            </Badge>
            <Badge variant={status?.kv_connected ? 'success' : 'warning'} className="bg-white">
              {status?.kv_connected ? 'KV connected' : 'KV offline — local fallback'}
            </Badge>
          </div>
        </div>
      </header>

      {error && (
        <Card className="mb-6 border-destructive/30 bg-red-50 animate-fade-up">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {toast && (
        <Card className="mb-6 border-sky/30 bg-sky-50 animate-fade-up">
          <CardContent className="py-4 text-sm font-medium text-sky-900">{toast}</CardContent>
        </Card>
      )}

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-up">
        {[
          { label: 'Total memes', value: status?.total_stories ?? '—', icon: Newspaper },
          { label: 'Cooking', value: status?.pending_count ?? '—', icon: Activity },
          { label: 'Published', value: status?.published_count ?? '—', icon: Clapperboard },
          { label: 'Today spend', value: status ? `$${status.spend_usd.toFixed(2)}` : '—', icon: Zap },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{loading ? '…' : value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mb-10 grid gap-6 lg:grid-cols-3 animate-fade-up">
        <Card className="lg:col-span-2 border-sky/20 shadow-editorial">
          <CardHeader>
            <CardTitle>Make today&apos;s meme</CardTitle>
            <CardDescription>
              Type a topic — we scrape 5 live stories in real time (Google News RSS + GDELT), then
              fuse them into a super-funny meme with MiniMax image + video + voiceover.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                placeholder='Search news — e.g. "OpenAI", "climate summit", "NBA finals"'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearchNews()}
                disabled={searching || generating}
                className="flex-1"
              />
              <Button onClick={onSearchNews} disabled={searching || generating} size="lg">
                {searching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
                {searching ? 'Scraping…' : 'Search news'}
              </Button>
            </div>

            {headlines.length > 0 && (
              <div className="space-y-2 rounded-lg border border-sky/20 bg-sky-50/50 p-4">
                <p className="text-sm font-semibold text-sky-900">
                  5 headlines for &ldquo;{activeQuery}&rdquo;
                </p>
                <ol className="space-y-2 text-sm">
                  {headlines.map((h, i) => (
                    <li key={h.url} className="flex gap-2">
                      <span className="font-mono text-muted-foreground">{i + 1}.</span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground hover:text-sky hover:underline"
                        >
                          {h.title}
                          <ExternalLink className="ml-1 inline h-3 w-3 opacity-50" />
                        </a>
                        <span className="ml-2 text-xs text-muted-foreground">({h.source})</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={onGenerateMeme}
                disabled={generating || headlines.length < 5}
                size="lg"
                variant="accent"
                className="min-w-[220px]"
              >
                {generating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Flame className="h-5 w-5" />
                )}
                {generating ? 'Cooking mega-meme…' : 'Generate Mega-Meme'}
              </Button>
              <Button variant="ghost" onClick={refresh} disabled={loading}>
                <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Refresh
              </Button>
            </div>
            {generating && (
              <p className="text-sm text-muted-foreground">
                This takes 2–4 minutes — polling for your new video…
              </p>
            )}
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Daily budget</span>
                <span className="font-medium">
                  ${status?.spend_usd.toFixed(2) ?? '0.00'} / ${status?.budget_usd.toFixed(2) ?? '5.00'}
                </span>
              </div>
              <Progress value={budgetPct} className="h-2.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-white to-sky-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-sky" />
              Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {['Search & scrape 5', 'LLM mega-joke', 'MiniMax image', 'Hailuo video', 'TTS + merge'].map(
              (step) => (
                <div key={step} className="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky" />
                  {step}
                </div>
              ),
            )}
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="all" className="animate-fade-up">
        <TabsList>
          <TabsTrigger value="all">All ({stories.length})</TabsTrigger>
          <TabsTrigger value="progress">Cooking ({inProgress.length})</TabsTrigger>
          <TabsTrigger value="published">Published ({published.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <StoryGrid stories={stories} loading={loading} />
        </TabsContent>
        <TabsContent value="progress">
          <StoryGrid stories={inProgress} loading={loading} />
        </TabsContent>
        <TabsContent value="published">
          <StoryGrid stories={published} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StoryGrid({ stories, loading }: { stories: Story[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="h-80 animate-pulse bg-muted/30" />
        ))}
      </div>
    );
  }
  if (stories.length === 0) {
    return (
      <Card className="mt-4 border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Flame className="h-10 w-10 text-coral" />
          <p className="font-display text-xl">No memes yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Search a topic, then hit <strong>Generate Mega-Meme</strong> — we&apos;ll fuse those 5
            headlines into something unforgivably funny.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      {stories.map((story) => (
        <StoryCard key={story.story_id} story={story} />
      ))}
    </div>
  );
}