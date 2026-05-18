import React from 'react';

const formatCurrency = (val) => {
    return `$${val.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
};

export const DataTable = ({ title, data, isAccentName = false }) => {
  return (
    <div className="glass-panel table-container">
      <h2 className="table-title">{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th className="align-right">Shows</th>
            <th className="align-right">Booked</th>
            <th className="align-right">Gross</th>
            <th className="align-right">Occ %</th>
            <th className="align-right">Δ Gross</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const isRemaining = row.name.startsWith('Remaining');
            const dGross = row.d_gross;
            const deltaClass = dGross > 0 ? 'td-positive' : (dGross < 0 ? 'td-negative' : 'td-muted');
            const deltaSign = dGross > 0 ? '+' : '';

            return (
              <tr key={i}>
                <td className={isRemaining ? 'td-muted' : (isAccentName ? 'td-accent' : 'td-highlight')}>
                  {row.name.length > 35 ? row.name.substring(0, 32) + '...' : row.name}
                </td>
                <td className="align-right">{row.shows.toLocaleString()}</td>
                <td className="align-right">{row.booked.toLocaleString()}</td>
                <td className="align-right td-highlight">{formatCurrency(row.gross)}</td>
                <td className="align-right td-highlight">{row.occ.toFixed(1)}%</td>
                <td className={`align-right ${deltaClass}`}>
                  {deltaSign}{formatCurrency(dGross)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
