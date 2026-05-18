import React from 'react';
import { useFandangoData } from './hooks/useFandangoData';
import { KPIGrid } from './components/KPIGrid';
import { DataTable } from './components/DataTable';
import './App.css'; // Make sure the styles are imported

function App() {
  const { loading, kpis, tables, metadata, error } = useFandangoData();

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (loading) {
    return <div className="loading-message">Loading Fandango Data...</div>;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Fandango Dashboard</h1>
        {metadata && (
          <div className="metadata">
            <p><strong>Show Date:</strong> {metadata.showDate}</p>
            <p><strong>Last Updated:</strong> {metadata.lastUpdated}</p>
          </div>
        )}
      </header>

      <main className="app-content">
        <KPIGrid kpis={kpis} />
        
        <div className="tables-grid">
          {tables?.formats && (
            <DataTable title="By Format" data={tables.formats} />
          )}
          {tables?.languages && (
            <DataTable title="By Language" data={tables.languages} />
          )}
        </div>

        <div className="tables-grid">
          {tables?.states && (
            <DataTable title="By State" data={tables.states} />
          )}
          {tables?.theaters && (
             <DataTable title="By Theater" data={tables.theaters} isAccentName={true} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
