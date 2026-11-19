// Server-rendered, non-executable data for search engines; adds no visible UI.
export function StructuredData({ id, data }: { id: string; data: object }) {
  return <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}/>;
}
