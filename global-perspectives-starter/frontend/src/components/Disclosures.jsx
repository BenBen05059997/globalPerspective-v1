import React from 'react';
import { useLang } from '../contexts/LanguageContext';

const CONTENT = {
  en: {
    title: "Disclosures",
    aiTitle: "AI-Generated Content",
    ai: "Summaries and forecasts are produced by large language models. They may include outdated, biased, or incomplete interpretations of source material. Always consult the referenced articles before acting on the information provided.",
    dataTitle: "Data Sources",
    data: [
      "Topic detection: Google Gemini using globally syndicated publishers.",
      "Geocoding and map layers: Google Maps Platform.",
      "Supplementary analysis: OpenAI GPT models.",
    ],
    dataNote: "None of the data displayed should be treated as official government information or financial advice.",
    biasTitle: "Accuracy & Bias",
    bias: "AI systems can mirror the limitations of their training data. Regions with limited media coverage may appear underrepresented. Feedback helps calibrate prompts and data sourcing strategies.",
    affiliateTitle: "Affiliate Links & Sponsorships",
    affiliate: "The project does not participate in affiliate programs and receives no compensation from the organizations mentioned. If that changes, the disclosure will be updated here prior to launch.",
  },
  ja: {
    title: "開示情報",
    aiTitle: "AI生成コンテンツ",
    ai: "要約と予測は大規模言語モデルによって生成されます。これらには、情報源の資料に対する古い、偏った、または不完全な解釈が含まれる場合があります。提供された情報に基づいて行動する前に、必ず参照記事を確認してください。",
    dataTitle: "データソース",
    data: [
      "トピック検出：グローバルに配信される出版社を使用したGoogle Gemini。",
      "ジオコーディングと地図レイヤー：Google Maps Platform。",
      "補足分析：OpenAI GPTモデル。",
    ],
    dataNote: "表示されるデータを公式な政府情報や財務アドバイスとして扱うべきではありません。",
    biasTitle: "正確性とバイアス",
    bias: "AIシステムはトレーニングデータの限界を反映する場合があります。メディア報道が限られている地域は過小表現される可能性があります。フィードバックはプロンプトとデータソース戦略の調整に役立ちます。",
    affiliateTitle: "アフィリエイトリンクとスポンサーシップ",
    affiliate: "本プロジェクトはアフィリエイトプログラムに参加しておらず、言及された組織からの報酬も受け取っていません。変更がある場合は、開始前にここで開示を更新します。",
  },
  zh: {
    title: "信息披露",
    aiTitle: "AI生成内容",
    ai: "摘要和预测由大型语言模型生成。它们可能包含对源材料的过时、偏见或不完整的解读。在根据所提供的信息采取行动之前，请务必查阅参考文章。",
    dataTitle: "数据来源",
    data: [
      "话题检测：使用全球联合出版商的Google Gemini。",
      "地理编码和地图图层：Google Maps Platform。",
      "补充分析：OpenAI GPT模型。",
    ],
    dataNote: "显示的数据不应被视为官方政府信息或财务建议。",
    biasTitle: "准确性与偏见",
    bias: "AI系统可能反映其训练数据的局限性。媒体报道有限的地区可能被低估。反馈有助于优化提示词和数据采集策略。",
    affiliateTitle: "推广链接与赞助",
    affiliate: "本项目不参与任何推广计划，也不从提及的组织获取报酬。如有变更，将在启动前在此更新披露信息。",
  },
};

function Disclosures() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  return (
    <div className="card" style={{ maxWidth: '880px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>{c.title}</h1>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.aiTitle}</h2>
        <p>{c.ai}</p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.dataTitle}</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          {c.data.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p>{c.dataNote}</p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>{c.biasTitle}</h2>
        <p>{c.bias}</p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem' }}>{c.affiliateTitle}</h2>
        <p>{c.affiliate}</p>
      </section>
    </div>
  );
}

export default Disclosures;
