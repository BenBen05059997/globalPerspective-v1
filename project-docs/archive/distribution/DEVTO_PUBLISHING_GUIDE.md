# Dev.to Publishing Guide

## ✅ What I've Done

I've converted your blog post to Dev.to format in `BLOG_POST_DEVTO.md` with:

1. **Front matter** (metadata at the top)
2. **Dev.to specific formatting** (like `{% quote %}` for blockquotes)
3. **Proper tags** (max 4 allowed)
4. **Draft mode** (published: false)

---

## 📝 How to Publish on Dev.to

### Step 1: Create Dev.to Account

1. Go to https://dev.to
2. Sign up (can use GitHub, Twitter, or email)
3. Complete your profile

### Step 2: Create New Post

1. Click "Write a Post" button (top right)
2. You'll see an editor with front matter template

### Step 3: Copy-Paste Content

1. Open `BLOG_POST_DEVTO.md`
2. Copy **ENTIRE content** (including front matter at top)
3. Paste into Dev.to editor
4. Preview to check formatting

### Step 4: Add Cover Image (Optional but Recommended)

**Option A: Upload Your Own**
1. Create a cover image (1000x420px recommended)
2. Upload to Imgur, Cloudinary, or similar
3. Add URL to front matter: `cover_image: https://...`

**Option B: Use Unsplash (Dev.to Integration)**
1. In Dev.to editor, click "Add a cover image"
2. Search Unsplash for relevant image
3. Select and it auto-fills

**Suggested search terms for cover image:**
- "global news"
- "world map technology"
- "data visualization"
- "AI technology"
- "world connections"

### Step 5: Review Front Matter

The front matter at the top controls metadata:

```yaml
---
title: Why I Built an AI to See Certainty in an Uncertain World
published: false  # Change to 'true' when ready to publish
description: Building an AI news platform that connects the dots...
tags: ai, serverless, aws, react  # Max 4 tags
cover_image: # Add image URL here
# canonical_url: # If cross-posting from your blog
# series: # If part of a series
---
```

**Important fields:**
- `published: false` = Draft (only you see it)
- `published: true` = Public (everyone sees it)
- `tags:` = Maximum 4 tags (already optimized for you)

### Step 6: Preview

1. Click "Preview" button
2. Check:
   - Formatting looks good
   - Tables render correctly
   - Code blocks display properly
   - Links work
   - Images (if added) show up

### Step 7: Save as Draft

1. Keep `published: false`
2. Click "Save draft"
3. You can edit anytime

### Step 8: Publish When Ready

1. Change `published: false` to `published: true`
2. Click "Publish"
3. Share the link!

---

## 🎨 Cover Image Recommendations

If you want to create a custom cover image, use Canva (free):

**Template:**
- Size: 1000x420px
- Background: Tech gradient (blue/purple)
- Text overlay: "Why I Built an AI to See Certainty in an Uncertain World"
- Subtext: "$2.70/day | AWS Lambda + xAI Grok"
- Icon: Globe or network visualization

**Quick Canva steps:**
1. Go to canva.com
2. Search "Dev.to cover image" template
3. Customize with your title
4. Download as PNG
5. Upload to Imgur.com (free hosting)
6. Copy image URL to front matter

---

## 📋 Tags I Chose (Max 4)

I selected these 4 tags because they're:
- Popular on Dev.to (good discovery)
- Relevant to your content
- Balanced between broad and specific

**Current tags:**
1. `ai` - Broad appeal, trending topic
2. `serverless` - Technical audience, AWS community
3. `aws` - Specific tech stack
4. `react` - Frontend community

**Alternative tag sets you could use:**

**Option B (More startup-focused):**
- `ai, startup, buildinpublic, showdev`

**Option C (More technical):**
- `aws, lambda, dynamodb, serverless`

**Option D (More problem-focused):**
- `ai, news, productivity, javascript`

To change tags, just edit the front matter line:
```yaml
tags: ai, serverless, aws, react
```

---

## 🚀 After Publishing

### 1. Share on Social Media

**Twitter/X:**
```
I just published a post about building an AI news platform for $2.70/day 🚀

It connects news, predicts what's next, and gives you certainty in an uncertain world.

Built with AWS Lambda + xAI Grok + React.

Read it here: [Dev.to link]

#AI #Serverless #BuildInPublic
```

**Reddit:**
Post to:
- r/programming (use "Show HN" flair if allowed)
- r/aws
- r/reactjs
- r/SideProject
- r/webdev

**LinkedIn:**
```
I just wrote about building Global Perspectives - an AI news platform that costs $2.70/day to run.

The challenge: In an over-changing world, reading 1000 fragmented headlines creates confusion, not understanding.

The solution: AI that links events, shows root causes, and predicts what's next.

Built with AWS Lambda, xAI Grok, and React for under $100/month.

[Link to Dev.to post]
```

### 2. Engage With Comments

- Respond to every comment within 24 hours
- Answer technical questions
- Thank people for feedback
- Add value to discussions

### 3. Cross-Post to Medium (Optional)

1. Go to Medium.com
2. Click "Import a story"
3. Paste your Dev.to URL
4. Add canonical URL to Dev.to in front matter

---

## 📊 Analytics

Dev.to provides analytics for your posts:
- Views
- Reactions (likes)
- Comments
- Reading time
- Top referrers

Check these after 24-48 hours to see what's working.

---

## ✏️ Editing After Publishing

You can edit published posts anytime:
1. Go to your post
2. Click "Edit"
3. Make changes
4. Click "Save changes"

Dev.to shows "Edited" badge if you edit after publishing.

---

## 🎯 Best Time to Publish

**For Dev.to:**
- Tuesday-Thursday
- 8-10 AM EST (US morning)
- Avoid Friday/Monday
- Avoid weekends (lower engagement)

**Strategy:**
1. Publish on Dev.to first (Tuesday 9 AM EST)
2. Share on Twitter/LinkedIn immediately
3. Post to Reddit r/SideProject within 2 hours
4. Submit to Hacker News same day (8-10 AM PST)

---

## 🔧 Dev.to Specific Formatting

I've already converted these for you:

**Blockquotes:**
```
{% quote %}
Your quote text here
{% endquote %}
```

**Code blocks:**
Use triple backticks (already done)

**Liquid tags:**
- `{% tweet ID %}` - Embed tweet
- `{% github user/repo %}` - Embed repo
- `{% youtube videoID %}` - Embed video

---

## ❓ FAQ

**Q: Should I publish as draft first?**
A: Yes! Save as draft, preview on mobile/desktop, then publish.

**Q: Can I schedule posts?**
A: No, Dev.to doesn't have scheduling. Publish manually when ready.

**Q: How long should I wait before cross-posting to Medium?**
A: Wait 1-2 days to let Dev.to get traction first.

**Q: What if I get no views?**
A: Share on social media. Dev.to organic discovery is low without promotion.

**Q: Can I add the Kickstarter link later?**
A: Yes! Edit the post after you launch on Kickstarter.

---

## 🎬 Final Checklist Before Publishing

- [ ] Cover image added (1000x420px)
- [ ] Preview looks good on desktop
- [ ] Preview looks good on mobile
- [ ] All links work
- [ ] Code blocks format correctly
- [ ] Tables render properly
- [ ] Changed `published: false` to `published: true`
- [ ] Social media posts drafted
- [ ] Ready to engage with comments

---

Good luck with your post! 🚀
