import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Clapperboard,
  Loader2,
  Newspaper,
  Play,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { StoryCard } from '@/components/story-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchStatus,
  fetchStories,
  triggerRunA,
  triggerRunB,
  type DashboardStatus,
  type Story,
} from '@/lib/api';

export default function App() {
  const [status, setStatus] = useState<DashboardStatus | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [source, setSource] = useState<'kv' | 'local'>('local');
  const [loading, setLoading] = useState(true);
  const [runningA, setRunningA] = useState(false);
  const [runningB, setRunningB] = useState(false);
  const [dryRun, setDryRun] = useState(false);
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
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const onRunA = async () => {
    setRunningA(true);
    try {
      const result = await triggerRunA(dryRun);
      setToast(
        dryRun
          ? `Dry run: would enqueue ${result.enqueued} stories from ${result.crawled} crawled`
          : `Enqueued ${result.enqueued} stories`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run A failed');
    } finally {
      setRunningA(false);
    }
  };

  const onRunB = async () => {
    setRunningB(true);
    try {
      await triggerRunB();
      setToast('Generation pipeline accepted — processing in background');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run B failed');
    } finally {
      setRunningB(false);
    }
  };

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
              We read the news so you can doomscroll memes. Crawl headlines, score the chaos, ship
              captioned videos — automatically every morning.
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
          { label: 'Total stories', value: status?.total_stories ?? '—', icon: Newspaper },
          { label: 'In pipeline', value: status?.pending_count ?? '—', icon: Activity },
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline controls</CardTitle>
            <CardDescription>
              API keys stay server-side in <code className="rounded bg-muted px-1">.env</code> — the
              UI only triggers routes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button onClick={onRunA} disabled={runningA || runningB} size="lg">
                {runningA ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4" />}
                Run Person A
              </Button>
              <Button
                variant={dryRun ? 'accent' : 'outline'}
                onClick={() => setDryRun((v) => !v)}
                disabled={runningA || runningB}
              >
                Dry run {dryRun ? 'ON' : 'OFF'}
              </Button>
              <Button onClick={onRunB} disabled={runningA || runningB} variant="accent" size="lg">
                {runningB ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Person B
              </Button>
              <Button variant="ghost" onClick={refresh} disabled={loading}>
                <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Refresh
              </Button>
            </div>
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
              Status board
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {status &&
              (Object.entries(status.counts) as [keyof typeof status.counts, number][]).map(
                ([key, count]) => (
                  <div key={key} className="flex justify-between rounded-lg bg-white/80 px-3 py-2">
                    <span className="capitalize text-muted-foreground">{key.replace('_', ' ')}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ),
              )}
            <p className="pt-2 text-xs text-muted-foreground">
              Updated {status ? new Date(status.updated_at).toLocaleTimeString() : '—'}
            </p>
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="all" className="animate-fade-up">
        <TabsList>
          <TabsTrigger value="all">All ({stories.length})</TabsTrigger>
          <TabsTrigger value="progress">In progress ({inProgress.length})</TabsTrigger>
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
          <Newspaper className="h-10 w-10 text-muted-foreground" />
          <p className="font-display text-xl">No stories yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Hit <strong>Run Person A</strong> to crawl headlines, or run <code>npm start</code> locally
            to populate <code>./output/</code>.
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