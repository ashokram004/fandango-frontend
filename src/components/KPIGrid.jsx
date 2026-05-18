import React from 'react';

const formatCurrency = (val) => {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
};

const formatDelta = (val, isCurrency = false) => {
  if (val === 0) return { text: '0', class: 'neutral' };
  const sign = val > 0 ? '+' : '';
  const num = isCurrency ? formatCurrency(Math.abs(val)) : Math.abs(val).toLocaleString();
  return { 
    text: `${sign}${val < 0 && isCurrency ? '-' : ''}${num}`, 
    class: val > 0 ? 'positive' : 'negative' 
  };
};

export const KPIGrid = ({ kpis }) => {
  if (!kpis) return null;

  const dGross = formatDelta(kpis.totalGross.delta, true);
  const dTickets = formatDelta(kpis.totalTickets.delta);
  const dVenues = formatDelta(kpis.totalVenues.delta);
  const dShows = formatDelta(kpis.totalShows.delta);

  return (
    <div className="kpi-grid">
      <div className="glass-panel kpi-card">
        <div className="strip"></div>
        <div className="kpi-header">
          <span className="kpi-label">Total Gross</span>
          <span className={`kpi-sub ${dGross.class}`}>{dGross.text}</span>
        </div>
        <div className="kpi-val">{formatCurrency(kpis.totalGross.val)}</div>
      </div>

      <div className="glass-panel kpi-card">
        <div className="strip"></div>
        <div className="kpi-header">
          <span className="kpi-label">Tickets Sold</span>
          <span className={`kpi-sub ${dTickets.class}`}>{dTickets.text}</span>
        </div>
        <div className="kpi-val">{kpis.totalTickets.val.toLocaleString()}</div>
      </div>

      <div className="glass-panel kpi-card">
        <div className="strip"></div>
        <div className="kpi-header">
          <span className="kpi-label">Total Venues</span>
          <span className={`kpi-sub ${dVenues.class}`}>{dVenues.text}</span>
        </div>
        <div className="kpi-val">{kpis.totalVenues.val.toLocaleString()}</div>
      </div>

      <div className="glass-panel kpi-card">
        <div className="strip"></div>
        <div className="kpi-header">
          <span className="kpi-label">Total Shows</span>
          <span className={`kpi-sub ${dShows.class}`}>{dShows.text}</span>
        </div>
        <div className="kpi-val">{kpis.totalShows.val.toLocaleString()}</div>
      </div>

      <div className="glass-panel kpi-card">
        <div className="strip"></div>
        <div className="kpi-header">
          <span className="kpi-label">Occupancy</span>
          <span className="kpi-sub neutral">{kpis.occupancy.capacity.toLocaleString()} seats</span>
        </div>
        <div className="kpi-val">{kpis.occupancy.val.toFixed(1)}%</div>
      </div>
    </div>
  );
};
