import React from 'react';
import { useLang } from '../contexts/LanguageContext';

const CONTENT = {
  en: {
    title: "About & Contact",
    missionTitle: "Mission",
    mission: "Global Perspectives™ experiments with AI-assisted journalism. The dashboard surfaces emerging international topics, summarizes regional coverage, and gives readers a map-first view of shifting attention. The project was built as a learning tool to explore serverless data pipelines, AI APIs, and accessible storytelling.",
    howTitle: "How It Works",
    how: [
      "Google Gemini identifies trending themes from curated, reputable news sources.",
      "AWS AppSync and Lambda cache responses so visitors receive fresh content with minimal latency.",
      "OpenAI models produce optional forward-looking analysis to spark discussion.",
      "Google Maps visualizes geographic context, highlighting regions driving the conversation.",
    ],
    teamTitle: "Who Is Behind It",
    team: "The application is maintained by a small independent developer team. We welcome feedback, bug reports, feature suggestions, and collaboration ideas.",
    contactTitle: "Contact",
    email: "Email",
    github: "GitHub Issues",
    projectTracker: "project tracker",
    mediaTitle: "Media & Attribution",
    media: 'Screenshots or quotes may be used with credit to "Global Perspectives™" and a link back to the site. For press inquiries please reach out via email with your publication name and deadline.',
  },
  ja: {
    title: "概要とお問い合わせ",
    missionTitle: "ミッション",
    mission: "Global Perspectives™はAI支援型ジャーナリズムの実験プロジェクトです。ダッシュボードでは、新興の国際トピックを表示し、地域別報道を要約し、読者に注目の変遷を地図ファーストで提供します。サーバーレスデータパイプライン、AI API、アクセシブルなストーリーテリングを探求するための学習ツールとして構築されました。",
    howTitle: "仕組み",
    how: [
      "Google Geminiが厳選された信頼性の高いニュースソースからトレンドテーマを特定します。",
      "AWS AppSyncとLambdaがレスポンスをキャッシュし、最小限のレイテンシで新鮮なコンテンツを提供します。",
      "OpenAIモデルが議論を促すためのオプション的な将来予測分析を生成します。",
      "Google Mapsが地理的コンテキストを可視化し、会話を主導する地域をハイライトします。",
    ],
    teamTitle: "運営チーム",
    team: "本アプリケーションは小規模な独立開発チームによって運営されています。フィードバック、バグ報告、機能提案、コラボレーションのアイデアを歓迎します。",
    contactTitle: "お問い合わせ",
    email: "メール",
    github: "GitHub Issues",
    projectTracker: "プロジェクトトラッカー",
    mediaTitle: "メディアと帰属表示",
    media: "スクリーンショットや引用は「Global Perspectives™」のクレジットとサイトへのリンクバックを付けて使用できます。報道関係のお問い合わせは、媒体名と期限を添えてメールでご連絡ください。",
  },
  zh: {
    title: "关于与联系",
    missionTitle: "使命",
    mission: "Global Perspectives™是一个AI辅助新闻实验项目。仪表盘展示新兴的国际话题，总结地区报道，并为读者提供以地图为中心的关注度变化视图。该项目旨在探索无服务器数据管道、AI API和可访问的叙事方式。",
    howTitle: "工作原理",
    how: [
      "Google Gemini从精选的可靠新闻来源中识别热门主题。",
      "AWS AppSync和Lambda缓存响应，以最小延迟提供新鲜内容。",
      "OpenAI模型生成可选的前瞻性分析以激发讨论。",
      "Google Maps可视化地理背景，突出显示引领话题的地区。",
    ],
    teamTitle: "团队介绍",
    team: "本应用由一个小型独立开发团队维护。我们欢迎反馈、错误报告、功能建议和合作想法。",
    contactTitle: "联系方式",
    email: "电子邮件",
    github: "GitHub Issues",
    projectTracker: "项目跟踪",
    mediaTitle: "媒体与署名",
    media: '截图或引用可在注明"Global Perspectives™"并附上网站链接的情况下使用。媒体咨询请通过电子邮件联系，并注明您的出版物名称和截止日期。',
  },
};

function AboutContact() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  return (
    <div className="card" style={{ maxWidth: '880px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>{c.title}</h1>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.missionTitle}</h2>
        <p>{c.mission}</p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.howTitle}</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          {c.how.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.teamTitle}</h2>
        <p>{c.team}</p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.contactTitle}</h2>
        <p>
          {c.email}: <a href="mailto:globalperspectives.app@gmail.com">globalperspectives.app@gmail.com</a>
        </p>
        <p>
          {c.github}: <a href="https://github.com/BenBen05059997/GlobalPerspective/issues" target="_blank" rel="noreferrer noopener">
            {c.projectTracker}
          </a>
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem' }}>{c.mediaTitle}</h2>
        <p>{c.media}</p>
      </section>
    </div>
  );
}

export default AboutContact;
