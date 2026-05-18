import { useFandangoData } from './hooks/useFandangoData';
import { KPIGrid } from './components/KPIGrid';
import { DataTable } from './components/DataTable';
import { ShowsTable } from './components/ShowsTable';
import { FilterPanel } from './components/FilterPanel';
import './App.css';
import { useMemo, useState } from 'react';

function App() {
  const { loading, kpis, tables, metadata, error, rawRows } = useFandangoData();

  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    state: 'ALL',
    chain: 'ALL',
    theater: 'ALL',
    format: 'ALL',
    language: 'ALL',
    timeCat: 'ALL'
  });

  const allRows = useMemo(() => rawRows || [], [rawRows]);

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (filters.state !== 'ALL' && r.state !== filters.state) return false;
      if (filters.chain !== 'ALL' && r.chain !== filters.chain) return false;
      if (filters.theater !== 'ALL' && r.theater !== filters.theater) return false;
      if (filters.format !== 'ALL' && r.format !== filters.format) return false;
      if (filters.language !== 'ALL' && r.language !== filters.language) return false;
      if (filters.timeCat !== 'ALL' && r.timeCat !== filters.timeCat) return false;
      return true;
    });
  }, [allRows, filters]);

  if (error) {
    return <div style={{ color: '#f87171', padding: '20px' }}>Error: {error}</div>;
  }

  if (loading) {
    return <div style={{ color: '#f8fafc', padding: '20px' }}>Loading Fandango Data...</div>;
  }

  return (
    <div id="app">
      <div className="container">
        
        {/* HEADER */}
        <div className="header">
          <h1>Advance Sales Dashboard</h1>
          {metadata && (
            <div className="header-meta">
              Show Date: <strong>{metadata.showDate}</strong>
              <br />
              Last tracked: <strong>{metadata.lastUpdated}</strong>
            </div>
          )}
        </div>

        {/* FILTER TOGGLE */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="toggle-filter-btn"
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {/* FILTER PANEL */}
        {allRows.length > 0 && (
          <FilterPanel
            rawRows={allRows}
            filters={filters}
            setFilters={setFilters}
            showFilters={showFilters}
          />
        )}

        {/* KPI GRID */}
        <KPIGrid kpis={kpis} />

        {/* DASHBOARD ROWS */}
        <div className="dashboard-row">
          {tables?.formats && <DataTable title="Format Distribution" data={tables.formats} isFormat />}
          {tables?.languages && <DataTable title="Language Distribution" data={tables.languages} isLanguage />}
        </div>

        <div className="dashboard-row">
          {tables?.states && <DataTable title="State Distribution" data={tables.states} isState />}
          {tables?.theaters && <DataTable title="Top Theatres" data={tables.theaters} isTheater />}
        </div>

        {/* SHOWS TABLE - using a full-width dashboard row */}
        <div className="dashboard-row" style={{ gridTemplateColumns: '1fr' }}>
          <ShowsTable rows={filteredRows} />
        </div>

        <div className="footer">
          Fandango data dashboard • Elegant visual report with growth insights
        </div>

      </div>
    </div>
  );
}

export default App;
