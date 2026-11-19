import { ExternalLink } from 'lucide-react';
import type { LessonResource } from '../api';
import { resourceMeta, youtubeId } from '../resources';
import { Markdown } from './Markdown';

/** Read-only rendering of one lesson resource (used in editor preview and lesson viewer). */
export function ResourceView({ resource }: { resource: LessonResource }) {
  const meta = resourceMeta[resource.type];
  const title = resource.title || meta.label;

  if (resource.type === 'text' && resource.content) return <Markdown>{resource.content}</Markdown>;
  if (resource.type === 'code' && resource.content) {
    return (
      <figure className="space-y-1">
        {resource.title && (
          <figcaption className="text-sm font-medium">{resource.title}</figcaption>
        )}
        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
          <code>{resource.content}</code>
        </pre>
      </figure>
    );
  }
  if (!resource.url) return null;

  if (resource.type === 'youtube') {
    const id = youtubeId(resource.url);
    if (id) {
      return (
        <div className="aspect-video overflow-hidden rounded-lg bg-muted">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`}
            title={title}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full"
          />
        </div>
      );
    }
  }
  if (resource.type === 'image') {
    return (
      <img
        src={resource.url}
        alt={resource.title}
        loading="lazy"
        className="max-h-[32rem] rounded-lg"
      />
    );
  }

  const Icon = meta.icon;
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-14 items-center gap-3 rounded-lg border bg-card p-3 hover:border-primary/50"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{meta.label} · เปิดในแท็บใหม่</span>
      </span>
      <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </a>
  );
}
