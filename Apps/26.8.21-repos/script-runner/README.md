# Script Runner

An integrated copy of `/Users/arfan3/developer/gh/script-runner`, adapted to run inside sites5 in
the same style as `cmux1` and `my-repos-v1`.

## Integration

- The original HTML, CSS, JavaScript, ANSI renderer, highlighter, and favicon live in this app
  folder.
- Browser calls are namespaced under `/api/apps/script-runner/`.
- `backends/apps/script-runner/` owns catalog discovery, source-file reads, editor opening, streamed
  subprocess runs, and cancellation.
- The copied script catalog and its shared shell/TypeScript helpers live under
  `Apps/_shared/script-runner/data/`.
- Authentication is inherited from sites5; there is no second server, port, or build step.

Run `deno task dev`, restart after adding the app, and open
`/apps/26.8.21-repos/script-runner/`.

The scripts execute locally with their copied script directory as the working directory. Some
setup scripts intentionally inspect or change the Mac; their own flags, prompts, and safeguards are
preserved from the source repository.
