const UI_STRINGS = {
  en: {
    // Page titles
    todaysTopics: "Today's Global Topics",
    topicsSubtitle: "Trending topics that have impact around the world, organized by region",

    // Actions
    summarize: "Summarize",
    predict: "Predict",
    traceCause: "Trace Cause",
    actions: "Actions",
    retry: "Retry",
    refresh: "Refresh",
    show: "Show",
    hide: "Hide",

    // Navigation
    viewGoogleNews: "View Google News",
    sources: "Sources",
    newTopics: "New topics available",
    topics: "Topics",
    navHome: "Home",
    navMap: "Map",
    navAbout: "About",
    navContact: "Contact",
    navPrivacy: "Privacy",
    navDisclosures: "Disclosures",

    // Footer
    footerTagline: "AI-powered news aggregation",
    footerPrivacy: "Privacy & Terms",

    // Map
    alsoAffects: "Also affects",
    storyFlow: "Story Flow",
    clearStory: "Clear Story",
    earlierToday: "Earlier today",
    noTopicsForCountry: "No topics found for this country.",
    hideSources: "Hide",
    now: "now",
    earlier: "earlier",
    earlierTopics: "earlier topics",

    // Archive
    todayArchive: "Today's Archive",
    searchTopics: "Search topics...",
    noMatching: "No matching topics",

    // AI sections
    aiKeytakeaways: "AI Key Takeaways",
    chainReaction: "Chain Reaction Prediction",
    traceCauseContext: "Trace Cause & Context",

    // Loading states
    loading: "Loading topics...",
    generatingSummary: "Generating concise summary...",
    generatingPrediction: "Analyzing chain reactions...",
    generatingTraceCause: "Analyzing historical context...",

    // Categories
    conflict: "Conflict",
    politics: "Politics",
    economy: "Economy",
    military: "Military",
    disaster: "Disaster",
    technology: "Technology",
    health: "Health",

    // Regions
    asia: "Asia",
    europe: "Europe",
    northAmerica: "North America",
    southAmerica: "South America",
    middleEast: "Middle East",
    africa: "Africa",
    oceania: "Oceania",
    world: "World",
  },
  ja: {
    todaysTopics: "今日のグローバルトピック",
    topicsSubtitle: "世界に影響を与えるトレンドトピック（地域別）",

    summarize: "要約",
    predict: "予測",
    traceCause: "原因追跡",
    actions: "操作",
    retry: "再試行",
    refresh: "更新",
    show: "表示",
    hide: "非表示",

    viewGoogleNews: "Google ニュースを見る",
    sources: "ソース",
    newTopics: "新しいトピックがあります",
    topics: "トピック",
    navHome: "ホーム",
    navMap: "地図",
    navAbout: "概要",
    navContact: "お問い合わせ",
    navPrivacy: "プライバシー",
    navDisclosures: "開示情報",

    footerTagline: "AI搭載ニュース集約",
    footerPrivacy: "プライバシーと利用規約",

    alsoAffects: "関連国",
    storyFlow: "ストーリーフロー",
    clearStory: "クリア",
    earlierToday: "本日の過去トピック",
    noTopicsForCountry: "この国のトピックは見つかりませんでした。",
    hideSources: "非表示",
    now: "現在",
    earlier: "過去",
    earlierTopics: "過去のトピック",

    todayArchive: "今日のアーカイブ",
    searchTopics: "トピックを検索...",
    noMatching: "該当するトピックがありません",

    aiKeytakeaways: "AI 要点",
    chainReaction: "連鎖反応予測",
    traceCauseContext: "原因追跡と文脈",

    loading: "トピックを読み込み中...",
    generatingSummary: "要約を生成中...",
    generatingPrediction: "連鎖反応を分析中...",
    generatingTraceCause: "歴史的背景を分析中...",

    conflict: "紛争",
    politics: "政治",
    economy: "経済",
    military: "軍事",
    disaster: "災害",
    technology: "技術",
    health: "医療",

    asia: "アジア",
    europe: "ヨーロッパ",
    northAmerica: "北米",
    southAmerica: "南米",
    middleEast: "中東",
    africa: "アフリカ",
    oceania: "オセアニア",
    world: "世界",
  },
  zh: {
    todaysTopics: "今日全球热点",
    topicsSubtitle: "对全球产生影响的热门新闻，按地区分类",

    summarize: "摘要",
    predict: "预测",
    traceCause: "溯因",
    actions: "操作",
    retry: "重试",
    refresh: "刷新",
    show: "展开",
    hide: "收起",

    viewGoogleNews: "查看谷歌新闻",
    sources: "来源",
    newTopics: "有新新闻可用",
    topics: "新闻",
    navHome: "首页",
    navMap: "地图",
    navAbout: "关于",
    navContact: "联系我们",
    navPrivacy: "隐私",
    navDisclosures: "信息披露",

    footerTagline: "AI驱动新闻聚合",
    footerPrivacy: "隐私和条款",

    alsoAffects: "相关国家",
    storyFlow: "故事脉络",
    clearStory: "清除",
    earlierToday: "今日早些时候",
    noTopicsForCountry: "未找到该国家的新闻。",
    hideSources: "收起",
    now: "当前",
    earlier: "早些时候",
    earlierTopics: "早期新闻",

    todayArchive: "今日存档",
    searchTopics: "搜索新闻...",
    noMatching: "没有匹配的新闻",

    aiKeytakeaways: "AI 要点提取",
    chainReaction: "连锁反应预测",
    traceCauseContext: "溯因分析与背景",

    loading: "正在加载话题...",
    generatingSummary: "正在生成摘要...",
    generatingPrediction: "正在分析连锁反应...",
    generatingTraceCause: "正在分析历史背景...",

    conflict: "冲突",
    politics: "政治",
    economy: "经济",
    military: "军事",
    disaster: "灾害",
    technology: "科技",
    health: "卫生",

    asia: "亚洲",
    europe: "欧洲",
    northAmerica: "北美",
    southAmerica: "南美",
    middleEast: "中东",
    africa: "非洲",
    oceania: "大洋洲",
    world: "世界",
  },
};

export function t(key, lang = 'en') {
  return UI_STRINGS[lang]?.[key] || UI_STRINGS.en[key] || key;
}

export function tCategory(categoryName, lang = 'en') {
  const key = categoryName?.toLowerCase();
  return UI_STRINGS[lang]?.[key] || categoryName;
}

export function getLocalizedTitle(topic, lang = 'en') {
  if (lang === 'ja') return topic.title_ja || topic.title;
  if (lang === 'zh') return topic.title_zh || topic.title;
  return topic.title;
}
