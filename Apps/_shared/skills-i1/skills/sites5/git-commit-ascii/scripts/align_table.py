#!/usr/bin/env python3
"""Align a markdown table whose cells may contain emoji.

Emoji render 2 columns wide in monospace; padding by raw character count
breaks alignment on any row containing one. This script pads by *display*
width instead.

Usage:
    python3 align_table.py <<'EOF'
    | Area | What changed |
    | --- | --- |
    | 🔎 filter.ts | toLowerCase() applied to tag compare |
    EOF

Prints the aligned table. Paste the output verbatim into the commit body —
never hand-edit the padding afterward.
"""
import sys
import unicodedata


def disp_width(s: str) -> int:
    w = 0
    for ch in s:
        cp = ord(ch)
        if cp in (0xFE0F, 0xFE0E, 0x200D) or unicodedata.combining(ch):
            continue  # variation selectors / ZWJ / combining marks: 0 wide
        w += 2 if (0x1F300 <= cp <= 0x1FAFF or 0x2600 <= cp <= 0x27BF) else 1
    return w


def is_separator(cells) -> bool:
    return all(c and set(c) <= {"-", ":", " "} for c in cells)


def main() -> None:
    rows = []
    for line in sys.stdin:
        line = line.strip()
        if not line.startswith("|"):
            continue
        rows.append([c.strip() for c in line.strip("|").split("|")])
    if not rows:
        sys.exit("no table rows found on stdin")

    ncols = max(len(r) for r in rows)
    rows = [r + [""] * (ncols - len(r)) for r in rows]
    widths = [
        max((disp_width(r[i]) for r in rows if not is_separator(r)), default=3)
        for i in range(ncols)
    ]

    for r in rows:
        if is_separator(r):
            print("|" + "|".join(" " + "-" * w + " " for w in widths) + "|")
        else:
            print(
                "|"
                + "|".join(
                    " " + c + " " * (widths[i] - disp_width(c)) + " "
                    for i, c in enumerate(r)
                )
                + "|"
            )


if __name__ == "__main__":
    main()
