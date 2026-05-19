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

  const filteredSummary = useMemo(() => {
    const rows = filteredRows.filter((r) => !r.is_extra);
    const summary = {
      formats: {},
      languages: {},
      states: {},
      theaters: {}
    };

    let totalGross = 0;
    let totalTickets = 0;
    let totalBooked = 0;
    const venues = new Set();
    
    let sTotalGross = 0;
    let sTotalTickets = 0;
    let sTotalBooked = 0;
    const sVenues = new Set();
    let sShows = 0;

    rows.forEach((r) => {
      const gross = Number(r.gross || 0);
      const tickets = Number(r.total || 0);
      const booked = Number(r.booked || 0);
      
      const s_gross = Number(r.s_gross || 0);
      const s_tickets = Number(r.s_total || 0);
      const s_booked = Number(r.s_booked || 0);

      totalGross += gross;
      totalTickets += tickets;
      totalBooked += booked;
      
      sTotalGross += s_gross;
      sTotalTickets += s_tickets;
      sTotalBooked += s_booked;

      if (r.t_id) venues.add(r.t_id);
      
      if (r.has_snapshot) {
         sShows += 1;
         if (r.t_id) sVenues.add(r.t_id);
      }

      const addItem = (dict, key, label) => {
        if (!dict[key]) {
          dict[key] = { name: label, shows: 0, tickets: 0, booked: 0, gross: 0, d_booked: 0, d_gross: 0, d_tickets: 0, occ: 0, id: key, s_gross: 0, s_booked: 0, s_tickets: 0 };
        }
        dict[key].shows += 1;
        dict[key].tickets += tickets;
        dict[key].booked += booked;
        dict[key].gross += gross;
        
        dict[key].s_gross += s_gross;
        dict[key].s_booked += s_booked;
        dict[key].s_tickets += s_tickets;

        dict[key].occ = dict[key].tickets > 0 ? (dict[key].booked / dict[key].tickets) * 100 : 0;
        
        dict[key].d_gross = dict[key].gross - dict[key].s_gross;
        dict[key].d_booked = dict[key].booked - dict[key].s_booked;
        dict[key].d_tickets = dict[key].tickets - dict[key].s_tickets;
      };

      addItem(summary.formats, r.format || 'Unknown', r.format || 'Unknown');
      addItem(summary.languages, r.language || 'Unknown', r.language || 'Unknown');
      addItem(summary.states, r.state || 'Unknown', r.state || 'Unknown');
      addItem(summary.theaters, r.t_id || r.theater || 'Unknown', r.theater || 'Unknown');
    });

    const buildList = (dict) => Object.values(dict).sort((a, b) => b.gross - a.gross);

    return {
      kpis: {
        totalGross: { val: totalGross, delta: totalGross - sTotalGross },
        totalTickets: { val: totalTickets, delta: totalTickets - sTotalTickets },
        totalBooked: { val: totalBooked, delta: totalBooked - sTotalBooked },
        totalVenues: { val: venues.size, delta: venues.size - sVenues.size },
        totalShows: { val: rows.length, delta: rows.length - sShows },
        occupancy: { val: totalTickets > 0 ? (totalBooked / totalTickets) * 100 : 0 }
      },
      tables: {
        formats: buildList(summary.formats),
        languages: buildList(summary.languages),
        states: buildList(summary.states),
        theaters: buildList(summary.theaters)
      }
    };
  }, [filteredRows]);

  const noFiltersSelected = Object.values(filters).every((value) => value === 'ALL');
  const displayedKpis = noFiltersSelected ? kpis : filteredSummary.kpis;
  const displayedTables = noFiltersSelected ? tables : filteredSummary.tables;

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
        <KPIGrid kpis={displayedKpis} />

        {/* DASHBOARD ROWS */}
        <div className="dashboard-row">
          {displayedTables?.formats && <DataTable title="Format Distribution" data={displayedTables.formats} isFormat />}
          {displayedTables?.languages && <DataTable title="Language Distribution" data={displayedTables.languages} isLanguage />}
        </div>

        <div className="dashboard-row">
          {displayedTables?.states && <DataTable title="State Distribution" data={displayedTables.states} isState />}
          {displayedTables?.theaters && <DataTable title="Top Theatres" data={displayedTables.theaters} isTheater />}
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
