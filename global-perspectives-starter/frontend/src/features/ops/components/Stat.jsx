import Card from '@/shared/ui/Card.jsx';

// One labelled figure on the ops panels; renders nothing when the value is missing.
export default function Stat({ label, value, sub }) {
  if (value == null) return null;
  return (
    <Card level={2} pad="sm" className="ops-stat">
      <div className="ops-stat__label">{label}</div>
      <div className="ops-stat__value">{value}</div>
      {sub ? <div className="ops-stat__sub">{sub}</div> : null}
    </Card>
  );
}
