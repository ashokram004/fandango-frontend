import { useFandangoData } from './hooks/useFandangoData';
import { KPIGrid } from './components/KPIGrid';
import { DataTable } from './components/DataTable';
import { ShowsTable } from './components/ShowsTable';
import { HistoryTable } from './components/HistoryTable';
import { FilterPanel } from './components/FilterPanel';
import { DifferenceTable } from './components/DifferenceTable';
import { generateImageReport } from './utils/imageGenerator'; // <--- NEW IMPORT
import { PacingChart } from './components/PacingChart';
import './App.css';
import { useMemo, useState } from 'react';

function App() {
  const [diffMode, setDiffMode] = useState('daily');
  const { loading, kpis, tables, metadata, error, rawRows, historyData, differences } = useFandangoData(diffMode);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false); // <--- Added loading state for generation

  const [showFilters, setShowFilters] = useState(false);
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
      theaters: {},
      chains: {},
      timeCats: {}
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
      addItem(summary.chains, r.chain || 'Unknown', r.chain || 'Unknown');
      addItem(summary.timeCats, r.timeCat || 'Unknown', r.timeCat || 'Unknown');
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
        theaters: buildList(summary.theaters),
        chains: buildList(summary.chains),
        timeCats: buildList(summary.timeCats)
      }
    };

  }, [filteredRows]);

  const noFiltersSelected = Object.values(filters).every((value) => value === 'ALL');
  const displayedKpis = noFiltersSelected ? kpis : filteredSummary.kpis;
  const displayedTables = noFiltersSelected ? tables : filteredSummary.tables;

  const handleExportImage = async () => {
    if (isGeneratingImg) return;
    setIsGeneratingImg(true);
    try {
      // Calls our new front-end canvas generator!
      const dataUrl = await generateImageReport(kpis, tables, metadata);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Peddi_BoxOffice_${diffMode}_report.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error("Error generating image:", e);
      alert("Failed to generate image.");
    } finally {
      setIsGeneratingImg(false);
    }
  };

  if (error) {
    return <div style={{ color: '#f87171', padding: '20px' }}>Error: {error}</div>;
  }

  if (loading) {
    return <div style={{ color: '#f8fafc', padding: '20px' }}>Loading Fandango Data...</div>;
  }

  return (
    <div id="app">
      <div className="container">

        <div className="top-layout">
          <img src="/money.jpg" alt="Luck" className="top-image" />
          
          <div className="top-content">
            <div className="header">
              <div className="header-title-container">
                <h1>Peddi US Advance Sales Dashboard</h1>
                {metadata && (
                  <div className="show-date">
                    Show Date: <strong>{metadata.showDate}</strong>
                  </div>
                )}
              </div>
              {metadata && (
                <div className="header-meta">
                  Last update: <strong>{metadata.lastUpdated} IST</strong>
                  {metadata?.growthSince && (
                    <span className="growth-since">
                      <br />
                      Growth since: <strong>{metadata.growthSince} IST</strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="action-buttons">
              <button
                onClick={() => setDiffMode(m => m === 'daily' ? 'hourly' : 'daily')}
                className="toggle-filter-btn"
                style={{ background: diffMode === 'hourly' ? '#8b5cf6' : '#334155' }}
              >
                {diffMode === 'daily' ? 'Viewing: Daily Growth (Click for Hourly)' : 'Viewing: Hourly Growth (Click for Daily)'}
              </button>
              <button
                type="button"
                className="toggle-filter-btn"
                style={{ 
                  background: isGeneratingImg ? '#888' : '#c57e22', 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  cursor: isGeneratingImg ? 'not-allowed' : 'pointer'
                }}
                onClick={handleExportImage}
                disabled={isGeneratingImg}
              >
                {isGeneratingImg ? 'Generating...' : 'Export Image'}
              </button>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="toggle-filter-btn"
              >
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
            </div>
          </div>
        </div>

        {allRows.length > 0 && (
          <FilterPanel
            rawRows={allRows}
            filters={filters}
            setFilters={setFilters}
            showFilters={showFilters}
          />
        )}

        <KPIGrid kpis={displayedKpis} />

        <div className="dashboard-row">
          {displayedTables?.formats && <DataTable title="Format Distribution" data={displayedTables.formats} isFormat />}
          {displayedTables?.languages && <DataTable title="Language Distribution" data={displayedTables.languages} isLanguage />}
        </div>

        <div className="dashboard-row">
          {displayedTables?.states && <DataTable title="State Distribution" data={displayedTables.states} isState />}
          {displayedTables?.theaters && <DataTable title="Top Theatres" data={displayedTables.theaters} isTheater />}
        </div>

        <div className="dashboard-row">
          <DataTable
            title="Theatre Chain Distribution"
            data={displayedTables?.chains || []}
          />
          <DataTable
            title="Time Of Day Analysis"
            data={displayedTables?.timeCats || []}
          />
        </div>

        <div className="dashboard-row" style={{ gridTemplateColumns: '1fr' }}>
          <ShowsTable rows={filteredRows} />
        </div>

        {historyData && historyData.length > 0 && (
          <div className="dashboard-row" style={{ gridTemplateColumns: '1fr' }}>
            <HistoryTable data={historyData} />
          </div>
        )}

        {/* --- NEW GRAPH SECTION --- */}
        {historyData && historyData.length > 0 && diffMode === 'daily' && (
          <div className="dashboard-row" style={{ gridTemplateColumns: '1fr' }}>
            <PacingChart historyData={historyData} />
          </div>
        )}

        {differences && (
          <div className="differences-container" style={{ marginTop: '40px' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
              Difference Details ({diffMode === 'hourly' ? 'Hourly' : 'Daily'})
            </h2>
            <div className="dashboard-row">
              <DifferenceTable title="New Shows Added" data={differences.addedShows} type="added" />
              <DifferenceTable title="Shows Cancelled/Removed" data={differences.removedShows} type="removed" />
            </div>
            <div className="dashboard-row">
              <DifferenceTable title="Existing Shows Tickets Growth" data={differences.ticketsBooked} type="booked" />
              <DifferenceTable title="Existing Shows Cancelled Tickets" data={differences.ticketsCancelled} type="cancelled" />
            </div>
          </div>
        )}

        <div className="footer">
          @TheWkndCinema • US Pre-sales • Data from Fandango
        </div>

      </div>
    </div>
  );
}

export default App;