# Blog Post Diagram Prompts for Gemini

Use these prompts with Gemini Image Generation (or Midjourney, DALL-E, etc.) to create technical diagrams for your blog post.

---

## Diagram 1: System Architecture (High-Level)

**Purpose:** Show the overall architecture without revealing secrets

**Prompt:**

```
Create a clean, professional system architecture diagram in a modern tech style with the following components:

Left side:
- Box labeled "Brave Search API" (blue color)
- Arrow pointing right to next box

Center-left:
- Box labeled "AWS Lambda: Topic Clustering" (orange color)
- Small text below: "Runs hourly"
- Arrow pointing right to next box

Center:
- Database icon labeled "DynamoDB: Topics Cache" (green color)
- Small text: "staging → active swap"
- Two arrows: one going down, one going right

Center-right:
- Box labeled "AWS Lambda: AI Analysis" (orange color)
- Small text below: "xAI Grok API"
- Arrow pointing to database below

Bottom-center:
- Database icon labeled "DynamoDB: Summaries Cache" (green color)
- Small text: "1-hour TTL"
- Arrow pointing right

Right side:
- Box labeled "AWS Lambda: REST API" (orange color)
- Arrow pointing right to final box
- Box labeled "React Frontend" (cyan color)
- Small text: "GitHub Pages"

Top of diagram:
- Add label "User Request" with arrow pointing to REST API box

Style:
- Clean, minimal design
- Use rounded rectangles for services
- Use cylinder shapes for databases
- Use solid arrows for data flow
- Light background (white or very light gray)
- Modern tech diagram aesthetic
- Include small icons: cloud for AWS, gear for API, database cylinders
- Sans-serif font, professional spacing
```

**Alternative simplified prompt:**
```
Technical architecture diagram showing: Brave Search API → AWS Lambda (Topic Clustering) → DynamoDB (Topics) → AWS Lambda (AI Analysis with xAI Grok) → DynamoDB (Summaries) → AWS Lambda (REST API) → React Frontend. Use blue/orange/green color scheme, rounded boxes, cylinder database icons, clean modern style.
```

---

## Diagram 2: Before/After Cache Problem

**Purpose:** Illustrate the race condition problem and solution

**Prompt:**

```
Create a before/after comparison diagram showing a technical problem and solution:

BEFORE (Left side, labeled "❌ Race Condition Problem"):

Timeline from top to bottom:
- Time 14:00: Box "Old Topics (gen-1)" with checkmark, labeled "Users see this"
- Time 14:01: Red alert box "New Topics (gen-2) written immediately"
- Time 14:02: Yellow warning box "Users click 'Summarize'"
- Time 14:02: Red X box "ERROR 503: Summaries not ready yet"
- Time 14:05: Small text "Old data deleted, new data incomplete"

Visual: Show a stressed user icon with confusion marks

AFTER (Right side, labeled "✅ Blue-Green Deployment Solution"):

Timeline from top to bottom:
- Time 14:00: Two boxes side by side:
  - Left: "Active (gen-1)" with checkmark → "Users see this"
  - Right: "Staging (gen-2)" with gear icon → "Being processed"
- Time 14:01-14:04: Arrow showing "Generate all analysis"
- Time 14:05: Large green arrow labeled "Atomic Swap"
- Time 14:05: Two boxes:
  - Left: "Active (gen-2)" with checkmark → "Users now see this (complete)"
  - Right: "Staging (empty)" → "Ready for next cycle"

Visual: Show a happy user icon with thumbs up

Style:
- Split screen layout (50/50)
- Red/yellow colors for "before" problems
- Green/blue colors for "after" solution
- Timeline arrows going downward
- Include clock icons for time markers
- Clean, professional technical diagram
- Sans-serif font
```

**Alternative simplified prompt:**
```
Split-screen technical diagram. LEFT (❌): Timeline showing "Old Topics" → "New Topics written" → "User clicks" → "503 ERROR", red/yellow colors, stressed user. RIGHT (✅): Timeline showing "Active Data" and "Staging Data" side-by-side → "Atomic Swap" → "New Active Data (complete)", green/blue colors, happy user. Clean tech diagram style.
```

---

## Diagram 3: Hourly Refresh Flow (Optional)

**Purpose:** Show the complete refresh cycle

**Prompt:**

```
Create a circular flow diagram showing an hourly automated process:

Center of diagram:
- Clock icon showing "Every Hour"

Around the clock in clockwise order, 6 numbered steps:

1. Top: "Fetch News"
   - Icon: Magnifying glass
   - Box: "Brave Search API"
   - Text: "10+ global regions"

2. Top-right: "Cluster Topics"
   - Icon: Brain/AI
   - Box: "xAI Grok"
   - Text: "Find top 10 topics"

3. Right: "Write to Staging"
   - Icon: Database
   - Box: "DynamoDB staging"
   - Text: "gen-{timestamp}"

4. Bottom-right: "Generate Analysis"
   - Icon: Gears
   - Box: "Summary + Predict + Trace"
   - Text: "For all 10 topics"

5. Bottom: "Atomic Swap"
   - Icon: Arrows swapping
   - Box: "staging → active"
   - Text: "Make visible to users"

6. Bottom-left: "Cleanup"
   - Icon: Trash/broom
   - Box: "Delete old generation"
   - Text: "Remove stale cache"

Arrows:
- Curved arrows connecting each step in clockwise direction
- Green checkmarks at each completed step
- Final arrow returning to "Every Hour" to show cycle

Style:
- Circular layout
- Modern tech diagram
- Blue/green/orange color scheme
- Include small icons for each step
- Clean, professional look
- Sans-serif font
```

**Alternative simplified prompt:**
```
Circular flow diagram with 6 steps around a central clock: 1) Fetch News (Brave API), 2) Cluster Topics (xAI), 3) Write Staging (DB), 4) Generate Analysis, 5) Atomic Swap, 6) Cleanup. Curved arrows connecting steps clockwise. Blue/green colors, modern tech style, include icons.
```

---

## Diagram 4: Cost Breakdown (Pie Chart)

**Purpose:** Visual representation of monthly costs

**Prompt:**

```
Create a clean, modern pie chart showing monthly cost breakdown:

Title: "Monthly Operating Cost: $81 CAD (~$2.70/day)"

Slices (with percentages and amounts):
- 24.7% - Brave Search API ($20) - Blue
- 17.3% - xAI Grok (clustering) ($14) - Orange
- 25.9% - xAI Grok (analysis) ($21) - Light orange
- 12.3% - AWS Lambda ($10) - Purple
- 12.3% - AWS DynamoDB ($10) - Green
- 7.4% - GitHub Pro ($6) - Gray

Each slice labeled with:
- Service name
- Percentage
- Dollar amount

Below pie chart, add comparison text:
"Half the cost of Netflix ($16.49/month) - Less than a coffee per day"

Style:
- Modern, clean design
- Pastel or professional color scheme
- Clear labels
- 3D effect (subtle) or flat design
- White or light background
- Professional typography
```

**Alternative simplified prompt:**
```
Modern pie chart showing costs: Brave Search $20 (blue), xAI Grok clustering $14 (orange), xAI Grok analysis $21 (light orange), AWS Lambda $10 (purple), DynamoDB $10 (green), GitHub $6 (gray). Total $81/month. Clean professional style, labeled slices with percentages.
```

---

## Tips for Using These Prompts

### With Gemini:
1. Go to Gemini (gemini.google.com)
2. Paste the prompt
3. If the result isn't perfect, refine with: "Make it more professional" or "Use simpler colors" or "Increase spacing between elements"
4. Download as PNG or SVG

### With DALL-E or Midjourney:
- Same prompts work, but you may need to add: "high quality, professional technical diagram, clean design"
- For Midjourney, add `--ar 16:9` for wide diagrams or `--ar 1:1` for square

### Manual Editing:
If AI-generated diagrams aren't perfect, you can:
- Use Figma (free) to recreate based on the AI output
- Use Excalidraw (free, open-source) for hand-drawn style diagrams
- Use Draw.io (free) for traditional flowcharts

---

## Which Diagrams Are Essential?

**Must have:**
1. **Diagram 1** (System Architecture) - Shows you built something real
2. **Diagram 2** (Before/After Cache) - Shows you solve real problems

**Nice to have:**
3. **Diagram 3** (Hourly Flow) - Extra technical credibility
4. **Diagram 4** (Cost Breakdown) - Visual reinforcement of affordability

**Recommendation:** Start with Diagrams 1 and 2. Add 3 and 4 if you have time.

---

## Inserting into Blog Post

Once you have the images, add them to your blog post like this:

```markdown
## How I Built It (Without Breaking the Bank)

Here's the architecture at a high level:

![System Architecture](./images/architecture-diagram.png)
*Figure 1: Global Perspectives system architecture*

### The Monthly Cost Breakdown

![Cost Breakdown](./images/cost-breakdown.png)
*Figure 2: Monthly operating costs (~$164 CAD)*

...

## The Technical Challenge That Almost Broke Everything

![Before/After Cache Problem](./images/cache-problem-solution.png)
*Figure 3: Race condition problem and blue-green deployment solution*
```

---

## Alternative: Text-Based Diagrams (ASCII Art)

If AI image generation doesn't work well, you can use ASCII diagrams in code blocks:

```
System Architecture:

┌─────────────┐
│Brave Search │
│     API     │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│AWS Lambda   │      │  DynamoDB    │
│Topic        │─────▶│  Topics      │
│Clustering   │      │  Cache       │
└─────────────┘      └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │AWS Lambda    │
                     │AI Analysis   │◀──┐
                     │(xAI Grok)    │   │
                     └──────┬───────┘   │
                            │           │
                            ▼           │
                     ┌──────────────┐   │
                     │  DynamoDB    │   │
                     │  Summaries   │   │
                     │  Cache       │   │
                     └──────┬───────┘   │
                            │           │
                            ▼           │
                     ┌──────────────┐   │
                     │AWS Lambda    │   │
User Request ───────▶│  REST API    │───┘
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │    React     │
                     │   Frontend   │
                     │(GitHub Pages)│
                     └──────────────┘
```

These work well on Dev.to and Hacker News where readers appreciate technical clarity over visual polish.
