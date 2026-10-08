# Common Ground design

An instrument for choosing a meeting place, not a landing page. Desktop uses a narrow group editor beside a wide comparison table; mobile stacks the same workflow. No illustration or generated image is needed for this code-native surface.

## Visual system

- Warm paper `#f5f3eb`, white working surfaces, charcoal `#232b27`, muted olive `#687269`, pale borders `#d8ddd4`, dark green `#254d3b`, lime `#dbe99d` for a selected result.
- Georgia for the main heading; system sans-serif for body and all controls. Heading 54px/1.04 desktop, 39px mobile; body 16px/1.55; controls 14px/1.4; labels 12px/1.4. No remote fonts.
- Open header and numbered sections. Rounded buttons (8px), inputs (6px), and a single comparison surface (12px). Member rows are separated with rules, not floating dashboard cards.
- No decorative icons, gradients, claims, invented metrics, hero badges or above-heading eyebrow. The mode notice is required provenance, not decoration.
- Short control-color transitions; honor reduced motion. Keyboard focus, text selection, caret and scrollbars use the same palette. Every input and select has a visible label.

## First viewport and copy

Header: “Common Ground” and “Start over”. Heading: “Find a place together.” Supporting line: “Keep each person’s interests in the conversation.” The provenance line identifies live or fixture evidence and, on the hosted app, shows the remaining allowance. Main sections: “1. Build your group” and “2. Compare the shortlist”.

Each anonymous member can search cultural works, inspect all possible matches and explicitly select a match. Selected interests can be removed. The group has two to six members. Live mode also provides a labeled venue-type select. The public-example action loads a fixed snapshot and states that it costs zero requests; fixture mode keeps its separate fictional sample.

The comparison shows each member’s confirmed interests, ordinal rank on exactly the same candidate set, the worst rank sacrifice and the reason for the compromise order. Selecting a venue reveals its retained Qloo nomination contributions. Snapshot and live evidence have different, explicit cache copy. Excluding a venue updates the table and an explicit excluded list; restoration requires an intentional action. Missing evidence and provider failure never become sample data.

## Components and acceptance

- App shell owns the current server session, provenance and errors.
- Group editor owns anonymous member rows, confirmed interest controls, the public area and venue type.
- Entity search owns pending resolution choices; no automatic first-match selection.
- Comparison owns the ranked table, interest headers, nomination explanation, evidence timing and excluded list.
- Mobile keeps controls reachable, does not overflow the viewport and scrolls only the rank table if necessary.

Verify the sample flow, ambiguous resolution, member edits, veto/restore, reset, keyboard access, mobile layout and backend error states in the running browser. Fixture-mode verification does not prove live Qloo behavior.
