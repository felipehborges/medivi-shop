/**
 * `<`/`>` inside the JSON must be escaped — otherwise a string value
 * containing "</script>" would prematurely close this tag when inlined.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
