import { Link } from 'react-router-dom';

export default function TrialBanner({ daysLeft }) {
  if (!daysLeft || daysLeft <= 0) return null;

  const urgent = daysLeft <= 3;

  return (
    <div className={`trial-banner ${urgent ? 'urgent' : ''}`}>
      <span className="trial-banner-text">
        {urgent
          ? `Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}!`
          : `Free trial — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
        }
      </span>
    </div>
  );
}
