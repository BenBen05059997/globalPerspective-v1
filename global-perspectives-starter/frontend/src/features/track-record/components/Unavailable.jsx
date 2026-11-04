import Button from '@/shared/ui/Button.jsx';

// Unavailable — a read that failed: says what could not be read and offers one retry. No "try again later" filler.
export default function Unavailable({ children, onRetry, className }) {
  return (
    <div className={className}>
      <p>{children}</p>
      {onRetry && <Button compact onClick={onRetry}>Retry</Button>}
    </div>
  );
}
