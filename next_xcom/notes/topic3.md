## Introduction to No-BS Remote Dev Productivity & Life Hacks

This is the raw, unfiltered notes dump from 7+ years as a remote SDE across startups, scale-ups, and fully distributed teams. No motivational fluff, no affiliate links, no "10x your output overnight" hype. Just the exact systems, tools, routines, and brutal truths that let me maintain 6-8 hours of true deep flow coding per day while avoiding the burnout that kills most remote devs within 18 months. Remote work is a super power if you treat it like an engineering problem: inputs (energy, focus, tools) → outputs (shipped code, promotions, sanity). The default path is distraction hell, isolation, and 10-hour "work" days that deliver 2 hours of value. These notes fix that.

Core philosophy: Async-first everything. Ruthless notification blocking. Morning routines that actually prime your brain instead of TikTok rituals. A minimal but battle-tested stack for flow state. Honest post-mortems on tools that sounded good but wasted weeks. Burnout isn't inevitable—it's a failure of systems. Every section here is written so you can rip out one ## and turn it into a 15-30 tweet thread with zero filler.

Key metrics I track personally: deep work hours (via RescueTime), context switches per day (<8 target), weekly shipped PRs, and subjective energy score 1-10 at EOD. When these dip, I audit the system, not my "discipline." This doc is dense on purpose—each segment contains enough specifics (workflows, settings, alternatives, failure modes) for long-form threads, comparisons, and "before/after" stories.

## Why Remote Dev Life Requires Its Own Productivity Operating System

Office life had built-in guardrails: commute as transition ritual, visible peers for accountability, scheduled meetings as forced focus resets. Remote removes all of that and amplifies noise. Result: average remote dev loses 2.5 hours daily to context switching (per industry studies I validated with my own logs). Time zones turn "quick sync" into 3-day email chains. Home environment blurs boundaries so work leaks into evenings and weekends.

No-BS reality check:
- You are now the manager, the executor, and the auditor of your own time.
- Without systems, motivation dies after week 3 of solo grinding.
- Global teams mean you must default to async or drown in overlapping meetings.
- Burnout markers appear slower but hit harder: subtle dread on Sunday nights, zero motivation for side projects, creeping health issues.
- Career risk: invisible devs get passed over for promotions even if output is high.

Fix: Treat productivity like code—version control your routines (track changes in Notion or Obsidian), unit test new habits for 14 days, refactor when metrics tank. This is why generic advice fails remote SDEs: it ignores the unique stack of async comms, notification warfare, and energy management required.

## Morning Routines That Prime a Remote SDE for Flow (Not Instagram-Worthy BS)

My current 45-minute routine is engineered for a 9 AM first deep block. It is repeatable even when traveling or jet-lagged. No 4 AM wakeups unless you're naturally wired that way.

Exact sequence (tracked via Streaks app for 18 months):
- 7:00 AM alarm (same every weekday; weekend ±45 min). Phone in another room on Do Not Disturb overnight.
- Immediate 500ml room-temp water + pinch Himalayan salt + squeeze lemon (rehydrates after 7-8h sleep, stabilizes cortisol).
- 5 min box breathing (4-4-4-4) or Headspace "Daily Calm" while still in bed—prevents morning anxiety spike.
- 15-20 min movement: brisk outdoor walk (no podcast first 10 min for mental clarity) or 10 min bodyweight circuit (pushups, squats, planks). Goal: raise heart rate without exhaustion.
- Cold shower (30s cold at end)—dopamine boost without caffeine crash.
- 7:30 AM: black coffee or green tea + high-protein breakfast (3 eggs + spinach or Greek yogurt + berries). No sugar bombs.
- 7:40-7:50 AM: 3-minute daily planning in physical notebook (not app): write top 3 MITs (Most Important Tasks), one "win" from yesterday, and one blocker to unblock today.
- 7:50 AM: quick workspace reset (clear desk, open curtains, start white noise).
- 8:00 AM: first 90-minute deep work block starts—no Slack/email until 9:30 AM.

Why this works: It front-loads physiology (hydration, movement, light) before any digital input. Studies and my logs show +35% focus duration vs "roll out of bed and check Slack" days. Night owls: shift everything 2-3 hours later but keep the sequence.

Common failures I see in other remote devs:
- Phone as alarm → immediate dopamine hit and 20 min doomscroll.
- Zero movement → 11 AM energy crash.
- Overly complex routines (smoothie bowls, 20 min journaling) → abandoned after week 1.

Experiment rule: change only one variable every 14 days and measure energy at 11 AM and 4 PM.

## Building a Distraction-Proof Home Workspace That Supports 8-Hour Coding Days

Ergonomics and environment are 40% of sustained output. I learned this after two years of wrist pain and lower back issues.

Non-negotiable setup:
- Desk: 160x80 cm height-adjustable (Flexispot or Uplift). Alternate sit/stand every 45-60 min via timer.
- Chair: Used Herman Miller Aeron (second-hand, $400) or Secretlab Titan if budget. Mesh for breathability.
- Monitor: 34" ultrawide (LG or Dell) at eye level on monitor arm + 27" vertical secondary for docs/Slack.
- Peripherals: Mechanical keyboard (Keychron K2 low-profile), Logitech MX Master 3S mouse, wrist rest only if needed.
- Lighting: Bias LED strip behind monitors + natural window light. Philips Hue for circadian-friendly warm/cool shifts.
- Audio: Sony WH-1000XM5 headphones + Loop Quiet earplugs for ultra focus. Brown noise playlist via Endel app.
- Power: UPS battery backup + cable management so no visual clutter.
- Background for Loom/Zoom: plain wall + plants or virtual blur. Never messy bedroom visible.

Daily maintenance: 2-minute desk reset at EOD. Weekly deep clean. Standing desk mat + barefoot shoes for circulation.

No-BS failures: Gaming chairs destroy posture after 4 hours. Cheap Amazon "ergonomic" kits last 3 months. Under-desk treadmills gather dust 90% of the time.

Pro tip: Use a small fan pointed at feet—keeps you alert without AC bills.

## The Exact Tech Stack I Use Daily to Stay in Flow as a Remote SDE

This is the minimal viable stack refined over years. Total cost ~$120/month. Zero bloat.

Core layers:
- OS: macOS Sonoma (or Linux Pop!_OS for pure dev). Clean install, no unnecessary apps.
- Editor: VS Code with these extensions only: GitLens, GitHub Copilot (paid, worth every cent), Prettier, ESLint, Error Lens, Tabnine (fallback), Live Share, Remote-SSH/Containers, Vim keybindings.
- Terminal: Warp (AI commands + sessions) + zsh + Oh My Zsh + starship prompt. Aliases for every repeated git/flow command.
- Browser: Arc (spaces for work/personal) + Raycast for instant everything. uBlock Origin + News Feed Eradicator.
- Passwords/secret management: 1Password + SSH keys in ~/.ssh/config.
- Local dev: Docker Desktop + Devcontainers. Colima for lighter alternative.
- Note-taking: Obsidian (local Markdown vault synced via Syncthing or iCloud). Daily note template with tasks.
- Task/project: Linear (issues + cycles + triage) + GitHub Projects for personal backlog.
- Async video: Loom (Chrome extension hotkey).
- Focus timer: Focus@Will or built-in Focus mode tied to shortcuts.

Daily workflow integration: Raycast opens everything. Morning: open VS Code workspace, Warp terminal, Linear cycle view, Obsidian daily note. All in one keyboard shortcut.

Why this stack wins: <5 seconds to context switch between tools. Everything keyboard-driven. No Electron bloat where avoidable. Copilot handles 30% boilerplate.

## Deep Work Engineering: Protocols to Hit Flow State Reliably

Flow isn't luck. It's engineered with these triggers:

1. 90-120 minute blocks (ultradian rhythm match).
2. Clear next action written before break (eliminates "where was I?" tax).
3. Music: Endel generative or Brain.fm—algorithmic, no lyrics, volume 40%.
4. Phone in kitchen drawer + Mac Focus mode "Deep Work" (blocks everything except emergency contacts).
5. Pre-block ritual: 60s deep breathing + state the exact problem I'm solving out loud.
6. Post-block: 5 min walk + quick win log (even small).

Advanced: "Flow stacking"—caffeine 30 min before block + 10g L-theanine. Cold exposure morning. 7-9h sleep minimum (Oura ring tracked).

Failure modes: Open Slack tab "just in case" destroys flow in <3 minutes. Multitasking (PR reviews during coding) costs 23 minutes recovery per switch (per my RescueTime data).

## Async Tools That Replaced 70% of My Meetings

Meetings are the silent killer. My async stack:

- Linear: Replaces Jira/Asana for issue tracking. Cycles + automations + AI summaries. Every ticket has acceptance criteria + Loom walkthrough before review.
- Notion: Team wiki + meeting notes database. Async standups via daily template (yesterday/today/blockers). No live standups unless critical.
- Loom: 80% of status updates. 2-5 min video > 30 min call. Auto-transcript + chapters.
- GitHub Discussions + PR comments: Design decisions live here with screenshots/GIFs.
- Slack: Only for urgent pings or watercooler. Huddles replaced by scheduled async Loom drops.
- FigJam or Excalidraw for async whiteboarding.

Workflow: New feature? Ticket in Linear → design doc in Notion → Loom walkthrough → async comments → implement → PR with Loom demo. Saves 12+ hours/week.

## Notification Systems: My Warfare Setup Against Distraction

Default state: total silence. I reclaimed 3+ hours/day.

Mac Focus modes (automated via Shortcuts):
- "Deep Work": Blocks Slack, email, Linear, GitHub, Twitter, WhatsApp. Allows only phone calls from starred contacts.
- "Shallow Work": Allows Slack mentions + Linear assigned-to-me.
- "Off Hours": Everything except calendar.

Slack specifics:
- Status: "Focus mode - replies async" with emoji.
- Do Not Disturb 9 AM-12 PM and 2-5 PM daily.
- Custom keywords only for @here/@channel in my channels.
- Snooze all non-urgent channels.
- Use Threads for everything; never read inbox live.

Email: Superhuman or Spark with 2x daily processing (10 AM, 4 PM). Filters auto-archive 80%. Rules: newsletters to Read Later folder.

Phone: Grayscale mode always. One Sec app forces 8-second delay on social apps. Notifications off except calendar + 2FA.

Result: Context switches dropped from 47/day to 6/day. Measured via RescueTime.

## Email and Slack Hacks That Save 10+ Hours Weekly

Email zero-inbox is dead. My system:
- Process twice daily in 20 min batches.
- 2-minute rule: act, delegate, defer, or delete.
- Templates in Spark for common replies (code review feedback, blocker updates).
- CC filter: anything I'm CC'd on auto-snoozed unless keyword match.

Slack:
- Star only 3 channels.
- /remind me commands for follow-ups.
- Custom emoji reactions for quick ack without typing.
- Huddle only if >3 back-and-forth messages in thread.
- Weekly "async update" channel post instead of meetings.

## Calendar and Time Blocking That Actually Survives Reality

Google Calendar + Reclaim.ai for auto-blocking focus time.
- 4x 90-min deep blocks daily (protected).
- Buffer blocks between meetings (15 min).
- No meeting >30 min unless pre-read async doc provided.
- Weekly review every Friday 4 PM: drag unfinished tasks, audit time spent.

Rule: If it doesn't have a 30-min pre-read Loom, it gets declined or async-ified.

## Honest Tool Reviews: What Delivered vs What Wasted My Time

Jira: Sucks for velocity. Too heavy. Switched to Linear—50% faster triage.
Notion: Great for personal wiki, bloated for team docs. Use sparingly.
Asana: Pretty but notifications nightmare. Abandoned.
Linear: 10/10 for SDEs. Cycles + roadmaps actually useful.
Slack: Necessary evil. Huddles are clutch but overuse kills flow.
Zoom: Replaced 90% with Loom. Only for 1:1s now.
Copilot: Game changer. 25-40% faster boilerplate. Worth $10/mo.
Obsidian: Local, future-proof, plugins endless. Beats Notion for speed.
RescueTime + Toggl Track: Truth serum on where hours go.

Tools I regret buying: Fancy mechanical keyboard without testing ergonomics first, multiple monitor arms that broke, overpriced standing desk mat.

## Burnout Prevention Systems That Kept Me Coding 5+ Years Remotely

Burnout signals I track: dread opening laptop, zero side-project energy, 3+ nights poor sleep, caffeine tolerance spike.

Prevention stack:
- Strict 6 PM shutdown ritual: close laptop, 10 min walk, no screens until next morning.
- Weekly "no-code Saturday" or at minimum 4-hour block.
- Quarterly 1-week "digital detox" vacation (laptop left home).
- Therapy or coach check-ins every 6 weeks (remote isolation tax is real).
- Energy audit: Sunday 10-question journal on sleep, exercise, social contact, meaning.
- Micro-recoveries: 5 min breathing every 2 hours, 10k steps daily target.
- Social: Weekly non-work call with friend or in-person coffee.

Recovery protocol when it hits: 3-day "maintenance mode" (only 2h light tasks), full sleep reset, then root-cause audit.

No-BS: "Hustle culture" remote advice is how you get 18-month career gaps.

## Health and Wellness Hacks Integrated Into Dev Life

- Standing desk + walking pad for 8k steps while in shallow meetings.
- Blue-light glasses after 6 PM + f.lux/Night Shift aggressive.
- 10g creatine + 5g omega-3 daily (cognitive edge, tracked via bloodwork).
- Meal prep Sundays: high-protein, low processed.
- Eye yoga + 20-20-20 + Lumify drops for long screen days.
- Strength training 3x/week (home gym minimal: dumbbells, pull-up bar).
- Sleep: 10 PM-6 AM window, magnesium glycinate + consistent temp 18C room.

## Automation and Scripts I Run Daily for 20% Time Savings

- Raycast + custom scripts for git workflows, PR creation, ticket linking.
- Zapier/Make for Linear → Slack → GitHub automations.
- VS Code tasks for build/test/deploy sequences.
- Keyboard Maestro for repetitive mouse actions.
- Git aliases + pre-commit hooks for linting.

## Remote Collaboration Best Practices Without Meeting Hell

- Async decision log in Notion.
- Loom-first culture: propose → video → comment → decide.
- Written culture over spoken.
- Rotating "async facilitator" role for big initiatives.

## Dealing With Time Zone Differences as a Remote SDE

- Overlap hours sacred for sync only.
- Record everything.
- Buffer 4-hour async windows.
- Use World Time Buddy + calendar layer.

## Weekly Review and Planning Rituals That Prevent Drift

Friday 60 min:
- Review RescueTime report.
- Close open loops in Linear.
- Plan next week's cycles.
- Gratitude + lessons journal.

## Common Remote Dev Pitfalls and How I Dodge Them

- "Always available" syndrome → hard boundaries.
- Isolation → scheduled social.
- Tool churn → 30-day rule before adopting new.

## Scaling Productivity: From Junior to Staff Remote Engineer

- Junior: focus blocks + mentorship async.
- Mid: own systems + delegate.
- Staff: multiply via docs/templates/automation for team.

## Advanced Hacks: AI, Voice, and Future-Proofing

- Cursor.sh for AI-native editing.
- Voice dictation for PR descriptions.
- Local LLMs for offline coding help.

## My Personal Sample Daily Schedule (Real One From Last Month)

7:00-8:00: Routine
8:00-9:30: Deep block 1 (feature coding)
9:30-10:00: Async comms batch
10:00-11:30: Deep block 2
... (full breakdown with buffers)

## Measuring and Iterating Your Own System

Tools: RescueTime, Oura/Whoop, Linear velocity charts. Review monthly. Tweak one thing.

This document is intentionally massive so every ## becomes multiple high-value X threads. Steal, adapt, measure, repeat. No-BS remote life is 100% solvable with engineering discipline.