import { useMemo } from 'react';

const formatCurrency = (val) => {
  if (!Number.isFinite(Number(val))) return '$0';
  const n = Number(val);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

const getOccupancyColor = (occ) => {
  if (occ >= 60) return '#4ade80';
  if (occ >= 50) return '#fb923c';
  if (occ >= 30) return '#facc15';
  return '#f87171';
};

const formatToIst = (timestamp) => {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return String(timestamp);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).replace(/am|pm/i, match => match.toUpperCase()) + ' IST';
  } catch {
    return String(timestamp);
  }
};

export const HistoryTable = ({ data }) => {
  const sorted = useMemo(() => {
    return [...(data || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [data]);

  return (
    <div className="summary-section" style={{ marginTop: '20px' }}>
      <h2>
        Historical Tracking
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {sorted.length.toLocaleString()} snapshots
        </span>
      </h2>

      <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Timestamp</th>
              <th>Gross</th>
              <th>Tickets</th>
              <th>Venues</th>
              <th>Shows</th>
              <th>Occupancy</th>
              <th>Growth</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i}>
                <td style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                  {formatToIst(r.timestamp)}
                </td>
                <td className="gross-val">{formatCurrency(r.total_gross || r.totalGross || 0)}</td>
                <td>{(r.booked_tickets || r.bookedTickets || 0).toLocaleString()}</td>
                <td>{(r.venues || 0).toLocaleString()}</td>
                <td>{(r.shows || 0).toLocaleString()}</td>
                <td style={{ color: getOccupancyColor(r.occupancy || 0) }}>
                  {Number(r.occupancy || 0).toFixed(1)}%
                </td>
                <td style={{ color: (r.growth || 0) > 0 ? '#4ade80' : (r.growth || 0) < 0 ? '#f87171' : 'inherit', fontWeight: 'bold' }}>
                  {(r.growth || 0) > 0 ? '+' : ''}{formatCurrency(r.growth || 0)}
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  No historical data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
