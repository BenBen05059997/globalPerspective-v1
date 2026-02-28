# World Map Upgrade — Feature Specifications

This document describes the planned upgrades to the Global Perspectives World Map page. The goal is to transform the map from a simple article-count view into a meaningful geopolitical connection visualizer.

## Current State

The current map shows circle markers on countries with a count of "articles" derived by exploding each topic into one entry per mentioned country. This is misleading — the system has ~10 global topics, not hundreds of articles per country. The count metric is meaningless and hides the real value: **how global events connect countries together**.

## Available Data Per Topic

```json
{
  "id": "topic-hash",
  "title": "US-China Trade Tensions Escalate",
  "category": "economy",
  "regions": ["United States", "China", "European Union"],
  "search_keywords": ["trade war", "tariffs"],
  "sources": [
    { "title": "Article Title", "url": "https://...", "source": "reuters.com", "age": "2h ago" }
  ]
}
```

Key insight: `regions` tells us which countries a topic **affects**. A single topic often affects 2-5 countries, creating natural connections between them.

---

## Feature 1: Connection Lines (Spider Web)

### Purpose
Visualize how global events link countries together by drawing arcs/lines between countries that share the same topic. Creates a spider web effect showing geopolitical relationships at a glance.

### How It Works
- For each topic, extract all country codes from `regions`
- Draw a curved line (geodesic arc) between every pair of countries in that topic
- Multiple topics connecting the same two countries = thicker line
- Line color matches the topic category:
  - **Red** — conflict / military
  - **Orange** — disaster
  - **Blue** — politics
  - **Green** — economy
  - **Purple** — technology
  - **Teal** — health
  - **Gray** — other

### Implementation Notes
- Use Google Maps `Polyline` with `geodesic: true` for curved great-circle arcs
- Each line stores a reference to its topic(s) for click interaction
- Lines should have slight transparency (opacity ~0.5) so overlapping lines remain visible
- When hovering a line, highlight it and dim others
- Clicking a line opens the topic detail in the side panel (Feature 9)

### Example
Topic "US-China Trade War" with regions `["United States", "China", "European Union"]` produces 3 lines:
```
US ←→ China
US ←→ EU
China ←→ EU
```

### Edge Cases
- Topics with only 1 country: show a marker but no lines (isolated pulse)
- Topics with "World" or no resolved countries: skip line drawing, show in a global topics list

---

## Feature 2: Topic Markers Instead of Article Counts

### Purpose
Replace misleading "X articles" count markers with meaningful topic-aware markers that show **what news affects this country** and **which other countries are involved**.

### How It Works
- Each country marker shows the **number of topics** affecting it (not "articles")
- Marker size scales with topic count (small 1-2, medium 3-4, large 5+)
- Marker color represents the **dominant category** of topics affecting that country
- Clicking a country marker opens the side panel (Feature 9) with:
  - Country name + flag emoji
  - List of topic titles affecting this country
  - Each topic shows its category badge and connected countries
  - "View Google News" link per topic

### Marker Content (Info Window on Click)
```
[Flag] Country Name — X topics

1. [economy] US-China Trade War
   Also affects: China, EU

2. [conflict] South China Sea Tensions
   Also affects: Philippines, Taiwan

[View details →] (opens side panel)
```

### Changes from Current
| Current | New |
|---------|-----|
| "5 articles found" | "3 topics affect this country" |
| Color = count-based density | Color = dominant category |
| Click shows 1 article preview | Click shows all topic titles with connections |
| No connection context | Shows "Also affects: X, Y, Z" per topic |

---

## Feature 7: Story Flow Visualization

### Purpose
For a single selected topic, animate a visual path showing which countries are involved, highlighting the flow/spread of a global story across regions.

### How It Works
- User selects a topic (from side panel or by clicking a connection line)
- All other topics' lines fade out (dim to ~0.1 opacity)
- The selected topic's connection lines highlight with a bold animated stroke
- Connected country markers pulse with an animation
- An animated dash pattern flows along the lines to suggest movement/spread
- The map auto-zooms to fit all countries involved in the selected topic

### Animation Details
- **Line animation:** CSS-style dashed stroke that moves along the path (animated `strokeDashoffset`)
- **Marker pulse:** Country markers for the selected topic grow/shrink with a subtle pulse animation
- **Transition:** 0.5s ease for fade in/out of other topics
- **Exit:** Click anywhere on the map or press Escape to deselect and restore all lines

### Use Case
User clicks on "Ukraine-Russia Conflict" topic:
1. All other connection lines fade to near-invisible
2. Lines between Ukraine, Russia, NATO countries highlight in red (conflict category)
3. These country markers pulse
4. Map zooms to show all affected countries
5. User sees the geographic scope of this single story

### Fallback
If Google Maps Polyline animation is not performant, use a simpler highlight-only mode without dash animation.

---

## Feature 9: Side Panel with Topic Details

### Purpose
Provide a slide-out panel that shows full topic details when a country or connection line is clicked, without navigating away from the map.

### How It Works
- Panel slides in from the right side of the screen (width: 380px desktop, full-width on mobile)
- Triggered by:
  - Clicking a country marker → shows all topics for that country
  - Clicking a connection line → shows the specific topic
  - Clicking "View details" from an info window
- Panel content:
  - **Header:** Country name + flag (or topic title if triggered from a line)
  - **Topic list:** Each topic as a card with:
    - Title
    - Category badge (colored pill)
    - Connected countries (as flag emojis + names)
    - Source links (collapsible)
    - "View Google News" link
  - **AI Analysis buttons:** Summarize / Predict / Trace Cause (loads from cache via same API as Home page)
  - Close button (X) or click outside to dismiss

### Panel Layout
```
┌──────────────────────────────────┐
│  [X]  China — 3 topics           │
├──────────────────────────────────┤
│                                  │
│  ┌────────────────────────────┐  │
│  │ [economy] US-China Trade   │  │
│  │ Also affects: US, EU       │  │
│  │ Sources: Reuters, BBC (2)  │  │
│  │ [Summarize] [Predict]      │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ [conflict] South China Sea │  │
│  │ Also affects: PH, TW       │  │
│  │ Sources: AP, SCMP (3)      │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

### Interaction with Story Flow (Feature 7)
- Clicking a topic card in the side panel triggers Story Flow mode for that topic
- The map highlights only that topic's connections
- Clicking a different topic card switches the highlighted story

### Mobile Behavior
- Panel slides up from the bottom (bottom sheet pattern)
- Max height: 60vh
- Swipe down or tap outside to dismiss

---

## Implementation Priority

| Priority | Feature | Complexity | Impact |
|----------|---------|------------|--------|
| 1 | Feature 2: Topic Markers | Medium | High — fixes the core data display problem |
| 2 | Feature 1: Connection Lines | Medium | High — the signature visual upgrade |
| 3 | Feature 9: Side Panel | Medium | High — makes the map actually useful |
| 4 | Feature 7: Story Flow | Low-Medium | Medium — polish, depends on 1 + 9 |

Features 1 and 2 should be implemented together as they share the same data transformation. Feature 9 can be built alongside. Feature 7 layers on top of 1 and 9.

---

## Technical Notes

### Data Transformation (Shared by Features 1, 2, 9)
Replace the current `topicsToArticles()` explosion with a proper dual-index structure:

```js
// Country-centric view (for markers)
countryTopicMap = {
  "US": {
    name: "United States",
    code: "US",
    coords: { lat: 39.8, lng: -98.6 },
    topics: [topicObj1, topicObj2]
  }
}

// Connection-centric view (for lines)
connections = [
  {
    from: "US",
    to: "CN",
    topics: [topicObj1],
    category: "economy"   // dominant category
  }
]
```

### Google Maps APIs Used
- `google.maps.Marker` — country markers (existing)
- `google.maps.Polyline` — connection lines (new, `geodesic: true`)
- `google.maps.InfoWindow` — hover preview (existing)
- `google.maps.LatLngBounds` — auto-zoom for Story Flow (new)

### Category Color Map
```js
const CATEGORY_COLORS = {
  conflict:   '#ef4444',  // red
  military:   '#ef4444',  // red
  disaster:   '#f97316',  // orange
  politics:   '#3b82f6',  // blue
  economy:    '#22c55e',  // green
  technology: '#8b5cf6',  // purple
  health:     '#14b8a6',  // teal
  other:      '#6b7280',  // gray
};
```

### Cleanup Before Implementation
- Move hardcoded Google Maps API key out of source → into `docs/config.js`
- Remove debug panel from `FallbackMapComponent`
- Remove duplicate `buildNewsSearchUrl` at bottom of file (after `export default`)
- Remove excessive `console.log` statements throughout `WorldMap.jsx`
