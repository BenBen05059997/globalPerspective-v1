import React from 'react';
import { useLang } from '../contexts/LanguageContext';

const CONTENT = {
  en: {
    title: "Get in Touch",
    intro: "We welcome feedback, collaboration ideas, and press inquiries. The fastest way to reach the Global Perspectives team is by email.",
    email: "Email",
    note: "Please include any relevant context so we can respond quickly. We aim to reply within two business days.",
    other: "Prefer other channels? You can also reach us via the links in the site footer.",
  },
  ja: {
    title: "お問い合わせ",
    intro: "フィードバック、コラボレーションのアイデア、報道関係のお問い合わせを歓迎します。Global Perspectivesチームに最も早く連絡する方法はメールです。",
    email: "メール",
    note: "迅速な対応のため、関連する背景情報をお含めください。通常2営業日以内にご返信いたします。",
    other: "他のチャンネルをご希望ですか？サイトフッターのリンクからもご連絡いただけます。",
  },
  zh: {
    title: "联系我们",
    intro: "我们欢迎反馈、合作建议和媒体咨询。联系Global Perspectives团队最快捷的方式是电子邮件。",
    email: "电子邮件",
    note: "请提供相关背景信息以便我们快速回复。我们通常在两个工作日内回复。",
    other: "希望通过其他渠道联系？您也可以通过网站页脚中的链接联系我们。",
  },
};

export default function Contact() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  return (
    <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>{c.title}</h1>
      <p style={{ fontSize: '1rem', lineHeight: 1.6 }}>
        {c.intro}
      </p>
      <div
        style={{
          backgroundColor: 'var(--surface-subtle)',
          borderRadius: '10px',
          padding: '1.25rem',
          margin: '1.5rem 0',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{c.email}</h2>
        <a
          href="mailto:globalperspectives.app@gmail.com"
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          globalperspectives.app@gmail.com
        </a>
      </div>
      <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
        {c.note}
      </p>
      <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
        {c.other}
      </p>
    </div>
  );
}
