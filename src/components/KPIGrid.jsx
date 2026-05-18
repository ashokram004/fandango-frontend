const formatCurrency = (val) => {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
};

const formatDelta = (val, isCurrency = false) => {
  if (val === 0) return { text: '', class: 'delta-neutral' };
  const sign = val > 0 ? '+' : '';
  const num = isCurrency ? formatCurrency(Math.abs(val)) : Math.abs(val).toLocaleString();
  return { 
    text: `${sign}${val < 0 && isCurrency ? '-' : ''}${isCurrency && val > 0 ? '$' : ''}${num}`, 
    class: val > 0 ? 'delta-positive' : 'delta-negative' 
  };
};

const getOccupancyColor = (occ) => {
  if (occ >= 60) return "#4ade80";
  if (occ >= 50) return "#fb923c";
  if (occ >= 30) return "#facc15";
  return "#f87171";
};

export const KPIGrid = ({ kpis }) => {
  if (!kpis) return null;

  const dGross = formatDelta(kpis.totalGross.delta, true);
  const dTickets = formatDelta(kpis.totalTickets.delta);
  const dVenues = formatDelta(kpis.totalVenues.delta);
  const dShows = formatDelta(kpis.totalShows.delta);

  const avgTicketPrice = kpis.totalTickets.val > 0 ? kpis.totalGross.val / kpis.totalTickets.val : 0;

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-title">Total Gross</div>
        <div className="kpi-value">{formatCurrency(kpis.totalGross.val)}</div>
        <div className={`kpi-sub ${dGross.class}`}>{dGross.text}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">Tickets Sold</div>
        <div className="kpi-value">{kpis.totalTickets.val.toLocaleString()}</div>
        <div className={`kpi-sub ${dTickets.class}`}>{dTickets.text}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">Total Venues</div>
        <div className="kpi-value">{kpis.totalVenues.val.toLocaleString()}</div>
        <div className={`kpi-sub ${dVenues.class}`}>{dVenues.text}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">Total Shows</div>
        <div className="kpi-value">{kpis.totalShows.val.toLocaleString()}</div>
        <div className={`kpi-sub ${dShows.class}`}>{dShows.text}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">Overall Occupancy</div>
        <div className="kpi-value" style={{ color: getOccupancyColor(kpis.occupancy.val) }}>
          {kpis.occupancy.val.toFixed(1)}%
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">Avg Ticket Price</div>
        <div className="kpi-value">${avgTicketPrice.toFixed(0)}</div>
      </div>
    </div>
  );
};
