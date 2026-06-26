import { searchNews } from '../data/search_news';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';

  if (!query) {
    return Response.json({ error: 'query_required', message: 'Pass ?q=your+topic' }, { status: 400 });
  }

  try {
    const result = await searchNews(query);
    return Response.json({
      ok: true,
      query: result.query,
      count: result.stories.length,
      sources_used: result.sources_used,
      stories: result.stories.map((s) => ({
        title: s.title,
        url: s.url,
        source: s.source,
        published_at: s.published_at,
        summary: s.summary,
        relevance: s.relevance,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'search_failed';
    const status = message.includes('required') ? 400 : 404;
    return Response.json({ error: 'search_failed', message }, { status });
  }
}