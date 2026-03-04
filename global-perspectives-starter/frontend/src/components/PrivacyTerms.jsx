import React from 'react';
import { useLang } from '../contexts/LanguageContext';

const CONTENT = {
  en: {
    title: "Privacy & Terms",
    overviewTitle: "Overview",
    overview: "Global Perspectives highlights international news topics sourced from Google Gemini, Google Maps geocoding, and publicly available reporting. This site is provided for informational purposes and does not require account creation or login.",
    dataTitle: "Data Collection",
    data: [
      "The application stores a cached copy of the latest topics in your browser via localStorage.",
      "No personal identifiers are collected, sold, or shared. Aggregated server logs (error messages, request counts) may be retained briefly for reliability monitoring.",
      "Cloudflare Web Analytics records anonymized usage metrics (page views, timestamp, country/region, browser/device). IP addresses are not stored, and the data is used only to understand overall adoption.",
      "Third-party APIs (Google Gemini, Google Maps, OpenAI) receive only the minimum request data needed to fulfill summaries, predictions, or map lookups.",
    ],
    useTitle: "Use of Information",
    use: "Content displayed is generated or summarized by AI services. You may browse, share links, or cite the material with attribution. Automated scraping or commercial redistribution without permission is prohibited.",
    cookiesTitle: "Cookies & Storage",
    cookies: "We do not set tracking cookies. The site only uses client-side storage for topic caching and collapsed panel preferences. Clearing your browser cache removes this data.",
    thirdPartyTitle: "Third-Party Services",
    thirdParty: [
      "Google Gemini — topic discovery and AI summaries",
      "Google Maps Platform — geocoding and visual map tiles",
      "OpenAI — optional predictive narratives",
      "AWS AppSync and Lambda — API gateway and caching",
      "Cloudflare Web Analytics — privacy-first usage metrics (page views, device type, browser locale)",
    ],
    thirdPartyNote: "Usage of those services is subject to their respective terms. By interacting with the site you agree to their processing of requests made on your behalf.",
    liabilityTitle: "Liability",
    liability: 'The material is provided "as is" without warranties of accuracy, completeness, or fitness for any purpose. Decisions should not be based solely on AI-generated content. We are not responsible for damages arising from reliance on the summaries, predictions, or map visualizations.',
    updatesTitle: "Updates",
    updates: "Policies may evolve as new features launch. The page will display the latest revision date and changelog notes. Significant updates will be announced on the About page.",
    lastUpdated: "Last updated",
  },
  ja: {
    title: "プライバシーと利用規約",
    overviewTitle: "概要",
    overview: "Global PerspectivesはGoogle Gemini、Google Mapsジオコーディング、公開されている報道を情報源とした国際ニューストピックを紹介します。本サイトは情報提供目的で提供されており、アカウント作成やログインは不要です。",
    dataTitle: "データ収集",
    data: [
      "アプリケーションはlocalStorageを通じて最新トピックのキャッシュコピーをブラウザに保存します。",
      "個人識別情報は収集、販売、共有されません。集約されたサーバーログ（エラーメッセージ、リクエスト数）は信頼性モニタリングのために一時的に保持される場合があります。",
      "Cloudflare Web Analyticsは匿名化された利用統計（ページビュー、タイムスタンプ、国/地域、ブラウザ/デバイス）を記録します。IPアドレスは保存されず、データは全体的な利用状況の把握のみに使用されます。",
      "サードパーティAPI（Google Gemini、Google Maps、OpenAI）は要約、予測、地図検索を実行するために必要最小限のリクエストデータのみを受信します。",
    ],
    useTitle: "情報の使用",
    use: "表示されるコンテンツはAIサービスによって生成または要約されたものです。閲覧、リンクの共有、または帰属表示付きでの素材の引用が可能です。許可なく自動スクレイピングや商業的再配布を行うことは禁止されています。",
    cookiesTitle: "Cookieとストレージ",
    cookies: "トラッキングCookieは設定しません。サイトはトピックキャッシュとパネル折りたたみ設定のためにクライアント側ストレージのみを使用します。ブラウザキャッシュをクリアすると、このデータは削除されます。",
    thirdPartyTitle: "サードパーティサービス",
    thirdParty: [
      "Google Gemini — トピック検出とAI要約",
      "Google Maps Platform — ジオコーディングとマップタイル",
      "OpenAI — オプション的な予測分析",
      "AWS AppSyncとLambda — APIゲートウェイとキャッシング",
      "Cloudflare Web Analytics — プライバシー重視の利用統計（ページビュー、デバイスタイプ、ブラウザロケール）",
    ],
    thirdPartyNote: "これらのサービスの利用はそれぞれの利用規約に従います。本サイトを利用することにより、お客様のためになされたリクエストの処理に同意したものとみなされます。",
    liabilityTitle: "免責事項",
    liability: "素材は正確性、完全性、または特定目的への適合性に関する保証なしに「現状のまま」提供されます。AIが生成したコンテンツのみに基づいて意思決定を行うべきではありません。要約、予測、地図表示への依存から生じる損害について、当方は責任を負いません。",
    updatesTitle: "更新",
    updates: "ポリシーは新機能の導入に伴い変更される場合があります。最新の改訂日と変更履歴がページに表示されます。重要な更新は概要ページで告知されます。",
    lastUpdated: "最終更新日",
  },
  zh: {
    title: "隐私和条款",
    overviewTitle: "概述",
    overview: "Global Perspectives展示来自Google Gemini、Google Maps地理编码和公开报道的国际新闻话题。本网站仅供信息参考，无需创建账户或登录。",
    dataTitle: "数据收集",
    data: [
      "应用程序通过localStorage在浏览器中存储最新话题的缓存副本。",
      "不收集、出售或共享个人身份信息。聚合服务器日志（错误消息、请求计数）可能会为了可靠性监控而短暂保留。",
      "Cloudflare Web Analytics记录匿名使用指标（页面浏览量、时间戳、国家/地区、浏览器/设备）。不存储IP地址，数据仅用于了解整体使用情况。",
      "第三方API（Google Gemini、Google Maps、OpenAI）仅接收完成摘要、预测或地图查询所需的最少请求数据。",
    ],
    useTitle: "信息使用",
    use: "显示的内容由AI服务生成或总结。您可以浏览、分享链接或在注明出处的情况下引用材料。未经许可，禁止自动抓取或商业再发布。",
    cookiesTitle: "Cookie与存储",
    cookies: "我们不设置跟踪Cookie。网站仅使用客户端存储来缓存话题和面板折叠偏好。清除浏览器缓存将删除此数据。",
    thirdPartyTitle: "第三方服务",
    thirdParty: [
      "Google Gemini — 话题检测和AI摘要",
      "Google Maps Platform — 地理编码和地图图层",
      "OpenAI — 可选的预测性分析",
      "AWS AppSync和Lambda — API网关和缓存",
      "Cloudflare Web Analytics — 隐私优先的使用指标（页面浏览量、设备类型、浏览器语言环境）",
    ],
    thirdPartyNote: "使用这些服务须遵守其各自的条款。通过使用本网站，您同意其代您处理请求。",
    liabilityTitle: "免责声明",
    liability: '材料按"原样"提供，不对准确性、完整性或特定用途的适用性作任何保证。不应仅基于AI生成的内容做出决策。我们不对依赖摘要、预测或地图可视化而产生的损害承担责任。',
    updatesTitle: "更新",
    updates: "政策可能随着新功能的推出而演变。页面将显示最新修订日期和更新日志。重要更新将在关于页面上公布。",
    lastUpdated: "最后更新",
  },
};

function PrivacyTerms() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  return (
    <div className="card" style={{ maxWidth: '880px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>{c.title}</h1>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.overviewTitle}</h2>
        <p>{c.overview}</p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.dataTitle}</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          {c.data.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.useTitle}</h2>
        <p>{c.use}</p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.cookiesTitle}</h2>
        <p>{c.cookies}</p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.thirdPartyTitle}</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          {c.thirdParty.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p>{c.thirdPartyNote}</p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.liabilityTitle}</h2>
        <p>{c.liability}</p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem' }}>{c.updatesTitle}</h2>
        <p>{c.updates}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {c.lastUpdated}: {new Date().toLocaleDateString()}
        </p>
      </section>
    </div>
  );
}

export default PrivacyTerms;
