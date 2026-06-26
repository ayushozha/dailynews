import { Film, ImageIcon, Sparkles, Volume2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Story, StoryStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

const STEPS: StoryStatus[] = ['pending', 'image_done', 'video_done', 'published'];

const STATUS_LABEL: Record<StoryStatus, string> = {
  pending: 'Queued',
  image_done: 'Image ready',
  video_done: 'Video ready',
  published: 'Published',
};

const TONE_VARIANT: Record<Story['tone'], 'default' | 'coral' | 'secondary'> = {
  absurd: 'coral',
  political: 'default',
  wholesome: 'secondary',
};

function stepIndex(status: StoryStatus) {
  return STEPS.indexOf(status);
}

export function StoryCard({ story }: { story: Story }) {
  const active = stepIndex(story.status);
  const mediaUrl = story.output_url || story.video_url || story.image_url;

  return (
    <Card className="overflow-hidden transition-all hover:-translate-y-1 hover:shadow-editorial animate-fade-up">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={TONE_VARIANT[story.tone]}>{story.tone}</Badge>
          <Badge variant="outline">meme {story.meme_score}/10</Badge>
          <Badge variant={story.status === 'published' ? 'success' : 'warning'}>
            {STATUS_LABEL[story.status]}
          </Badge>
        </div>
        <CardTitle className="line-clamp-2 text-xl">{story.headline}</CardTitle>
        {(story.caption_top || story.caption_bottom) && (
          <p className="font-display text-sm italic text-muted-foreground">
            “{story.caption_top}” / “{story.caption_bottom}”
          </p>
        )}
        {story.source_headlines && story.source_headlines.length > 0 && (
          <ul className="space-y-1 border-l-2 border-sky/30 pl-3 text-xs text-muted-foreground">
            {story.source_headlines.map((h) => (
              <li key={h} className="line-clamp-1">
                {h}
              </li>
            ))}
          </ul>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {STEPS.map((step, i) => {
            const icons = [Sparkles, ImageIcon, Film, Volume2];
            const Icon = icons[i];
            const done = i <= active;
            return (
              <div key={step} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border text-xs',
                    done ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white text-muted-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('h-0.5 flex-1 rounded', done ? 'bg-primary/40' : 'bg-border')} />
                )}
              </div>
            );
          })}
        </div>

        {mediaUrl ? (
          story.output_url || story.video_url ? (
            <video
              className="aspect-video w-full rounded-lg border bg-black object-cover"
              src={mediaUrl}
              controls
              playsInline
              poster={story.image_url || undefined}
            />
          ) : (
            <img
              className="aspect-video w-full rounded-lg border object-cover"
              src={mediaUrl}
              alt={story.headline}
            />
          )
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
            Waiting for generation…
          </div>
        )}
      </CardContent>
    </Card>
  );
}