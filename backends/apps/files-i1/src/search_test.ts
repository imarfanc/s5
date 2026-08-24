import { assertEquals } from "@std/assert";
import { parseRgJson } from "./search.ts";

const SAMPLE = `{"type":"begin","data":{"path":{"text":"/tmp/a.ts"}}}
{"type":"match","data":{"path":{"text":"/tmp/a.ts"},"lines":{"text":"hello world\\n"},"line_number":12,"absolute_offset":40,"submatches":[{"match":{"text":"hello"},"start":0,"end":5}]}}
{"type":"end","data":{"path":{"text":"/tmp/a.ts"}}}
`;

Deno.test("parseRgJson extracts file, line, column, and text", () => {
  const hits = parseRgJson(SAMPLE, 10);
  assertEquals(hits.length, 1);
  assertEquals(hits[0], {
    file: "/tmp/a.ts",
    line: 12,
    column: 1,
    text: "hello world",
  });
});

Deno.test("parseRgJson respects the hit cap", () => {
  const line =
    `{"type":"match","data":{"path":{"text":"/x"},"lines":{"text":"a\\n"},"line_number":1,"submatches":[{"start":2}]}}\n`;
  const hits = parseRgJson(line + line + line, 2);
  assertEquals(hits.length, 2);
  assertEquals(hits[0]?.column, 3);
});
