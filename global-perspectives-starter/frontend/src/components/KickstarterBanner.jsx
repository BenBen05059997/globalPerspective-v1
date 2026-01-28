import React, { useState, useEffect } from 'react';
import './KickstarterBanner.css';

function KickstarterBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('kickstarterBannerDismissed');
    if (!isDismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('kickstarterBannerDismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="kickstarter-banner">
      <div className="kickstarter-banner-content">
        <span className="kickstarter-banner-text">
          📱 <strong>Support Mobile App on Kickstarter</strong> — Help bring Global Perspectives to iOS & Android
        </span>
        <a
          href="https://www.kickstarter.com/projects/390812540/global-perspectives-ai-that-reads-the-worlds-news"
          target="_blank"
          rel="noopener noreferrer"
          className="kickstarter-banner-link"
        >
          View Campaign
        </a>
      </div>
      <button
        className="kickstarter-banner-close"
        onClick={handleDismiss}
        aria-label="Dismiss banner"
      >
        ✕
      </button>
    </div>
  );
}

export default KickstarterBanner;
