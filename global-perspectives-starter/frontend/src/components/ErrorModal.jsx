import { useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import { useLang } from '../contexts/LanguageContext';

const ERROR_MESSAGES = {
  en: {
    errorTitle: "Something went wrong",
    serviceUnavailable: "Service temporarily unavailable. Please try again in a moment.",
    cacheMiss: "Content not yet generated. Please try again in a few seconds.",
    networkError: "Network error. Please check your connection and try again.",
    unknownError: "An unexpected error occurred.",
    close: "Close",
    retry: "Retry",
  },
  ja: {
    errorTitle: "エラーが発生しました",
    serviceUnavailable: "サービスが一時的に利用できません。しばらくしてから再度お試しください。",
    cacheMiss: "コンテンツがまだ生成されていません。数秒後に再度お試しください。",
    networkError: "ネットワークエラーが発生しました。接続を確認して再度お試しください。",
    unknownError: "予期しないエラーが発生しました。",
    close: "閉じる",
    retry: "再試行",
  },
  zh: {
    errorTitle: "发生错误",
    serviceUnavailable: "服务暂时不可用。请稍后再试。",
    cacheMiss: "内容尚未生成。请几秒后重试。",
    networkError: "网络错误。请检查您的连接并重试。",
    unknownError: "发生意外错误。",
    close: "关闭",
    retry: "重试",
  },
};

function getFriendlyMessage(errorMessage, lang) {
  const messages = ERROR_MESSAGES[lang] || ERROR_MESSAGES.en;

  if (!errorMessage) return messages.unknownError;

  const msg = errorMessage.toLowerCase();
  if (msg.includes('503') || msg.includes('service unavailable')) {
    return messages.serviceUnavailable;
  }
  if (msg.includes('cache miss') || msg.includes('not found')) {
    return messages.cacheMiss;
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return messages.networkError;
  }

  return errorMessage;
}

export default function ErrorModal() {
  const { error, clearError } = useError();
  const { lang } = useLang();
  const messages = ERROR_MESSAGES[lang] || ERROR_MESSAGES.en;

  useEffect(() => {
    if (error) {
      const handleEscape = (e) => {
        if (e.key === 'Escape') clearError();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [error, clearError]);

  if (!error) return null;

  const title = error.title || messages.errorTitle;
  const message = getFriendlyMessage(error.message, lang);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) clearError();
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
            {title}
          </h3>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0',
              lineHeight: '1',
              color: '#666',
            }}
            aria-label={messages.close}
          >
            ×
          </button>
        </div>

        <p style={{ margin: '0 0 1.5rem', color: '#333', lineHeight: '1.6' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={clearError}
            className="btn btn-primary"
            style={{ minWidth: '100px' }}
          >
            {messages.close}
          </button>
        </div>
      </div>
    </div>
  );
}
