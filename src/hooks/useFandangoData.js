import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebaseConfig';

const MOVIE_SLUG = 'peddi-2026';
const SHOW_DATE = '2026-06-03';

export const useFandangoData = () => {
  const [data, setData] = useState({
    loading: true,
    kpis: null,
    tables: null,
    metadata: null,
    error: null
  });

  useEffect(() => {
    const currentRef = ref(database, `movies/${MOVIE_SLUG}/${SHOW_DATE}/master_shows_data`);
    const snapshotRef = ref(database, `movies/${MOVIE_SLUG}/${SHOW_DATE}/last_snapshot`);

    let currentData = null;
    let snapshotData = null;
    let lastUpdated = 'N/A';

    const process = () => {
      if (!currentData || !snapshotData) return;

      const rawCurrent = currentData.data || [];
      const rawSnapshot = snapshotData.data || [];

      // --- Helper to aggregate data ---
      const aggregate = (dataset) => {
        let totalGross = 0;
        let totalTickets = 0;
        
        let validShows = 0;
        let validVenues = new Set();
        let validCapacity = 0;
        let validBooked = 0;

        const summary = {
          formats: {},
          languages: {},
          states: {},
          theaters: {}
        };

        dataset.forEach(row => {
          const isExtra = row.is_extra || row.t_id === 'EXTRA';
          
          // KPIs included for all (including EXTRA)
          totalGross += (row.gross || 0);
          totalTickets += (row.booked || 0);

          if (!isExtra) {
            validShows += 1;
            validVenues.add(row.t_id);
            validCapacity += (row.total || 0);
            validBooked += (row.booked || 0);

            // Grouping logic
            const format = row.format?.includes('D-Box') && row.format?.includes('Premium') ? 'Premium' : (row.format || 'Unknown');
            const lang = row.language || 'Unknown';
            const state = row.state || 'Unknown';
            const theater = row.theater || 'Unknown';

            // Format
            if (!summary.formats[format]) summary.formats[format] = { name: format, shows: 0, tickets: 0, booked: 0, gross: 0 };
            summary.formats[format].shows += 1;
            summary.formats[format].tickets += (row.total || 0);
            summary.formats[format].booked += (row.booked || 0);
            summary.formats[format].gross += (row.gross || 0);

            // Language
            if (!summary.languages[lang]) summary.languages[lang] = { name: lang, shows: 0, tickets: 0, booked: 0, gross: 0 };
            summary.languages[lang].shows += 1;
            summary.languages[lang].tickets += (row.total || 0);
            summary.languages[lang].booked += (row.booked || 0);
            summary.languages[lang].gross += (row.gross || 0);

            // State
            if (!summary.states[state]) summary.states[state] = { name: state, shows: 0, tickets: 0, booked: 0, gross: 0 };
            summary.states[state].shows += 1;
            summary.states[state].tickets += (row.total || 0);
            summary.states[state].booked += (row.booked || 0);
            summary.states[state].gross += (row.gross || 0);

            // Theater
            if (!summary.theaters[row.t_id]) summary.theaters[row.t_id] = { id: row.t_id, name: theater, shows: 0, tickets: 0, booked: 0, gross: 0 };
            summary.theaters[row.t_id].shows += 1;
            summary.theaters[row.t_id].tickets += (row.total || 0);
            summary.theaters[row.t_id].booked += (row.booked || 0);
            summary.theaters[row.t_id].gross += (row.gross || 0);
          }
        });

        return {
          totalGross,
          totalTickets,
          totalShows: validShows,
          totalVenues: validVenues.size,
          occupancy: validCapacity > 0 ? (validBooked / validCapacity) * 100 : 0,
          totalCapacity: validCapacity, // used for display text
          summary
        };
      };

      const curr = aggregate(rawCurrent);
      const snap = aggregate(rawSnapshot);

      // --- Build Deltas ---
      const kpis = {
        totalGross: { val: curr.totalGross, delta: curr.totalGross - snap.totalGross },
        totalTickets: { val: curr.totalTickets, delta: curr.totalTickets - snap.totalTickets },
        totalVenues: { val: curr.totalVenues, delta: curr.totalVenues - snap.totalVenues },
        totalShows: { val: curr.totalShows, delta: curr.totalShows - snap.totalShows },
        occupancy: { val: curr.occupancy, capacity: curr.totalCapacity }
      };

      const buildTable = (currDict, snapDict, isTheater = false) => {
        const list = Object.values(currDict).map(item => {
          const sItem = isTheater ? Object.values(snapDict).find(x => x.id === item.id) : snapDict[item.name];
          const d_gross = item.gross - (sItem ? sItem.gross : 0);
          const d_booked = item.booked - (sItem ? sItem.booked : 0);
          const occ = item.tickets > 0 ? (item.booked / item.tickets) * 100 : 0;
          return { ...item, d_gross, d_booked, occ };
        }).sort((a, b) => b.gross - a.gross);

        const limit = 15;
        if (list.length > limit) {
          const top = list.slice(0, limit);
          const rem = list.slice(limit);
          const remAgg = {
            name: `Remaining ${rem.length} ${isTheater ? 'Theaters' : 'States'}`,
            shows: rem.reduce((s, x) => s + x.shows, 0),
            tickets: rem.reduce((s, x) => s + x.tickets, 0),
            booked: rem.reduce((s, x) => s + x.booked, 0),
            gross: rem.reduce((s, x) => s + x.gross, 0),
            d_gross: rem.reduce((s, x) => s + x.d_gross, 0)
          };
          remAgg.occ = remAgg.tickets > 0 ? (remAgg.booked / remAgg.tickets) * 100 : 0;
          return [...top, remAgg];
        }
        return list;
      };

      const tables = {
        formats: buildTable(curr.summary.formats, snap.summary.formats),
        languages: buildTable(curr.summary.languages, snap.summary.languages),
        states: buildTable(curr.summary.states, snap.summary.states),
        theaters: buildTable(curr.summary.theaters, snap.summary.theaters, true)
      };

      setData({
        loading: false,
        kpis,
        tables,
        metadata: {
          lastUpdated: lastUpdated,
          showDate: SHOW_DATE
        },
        error: null
      });
    };

    const unsubCurrent = onValue(currentRef, (snapshot) => {
      currentData = snapshot.val() || { data: [] };
      if (currentData.last_updated) {
          const dt = new Date(currentData.last_updated);
          lastUpdated = dt.toLocaleString();
      }
      process();
    }, (error) => {
        setData(prev => ({ ...prev, loading: false, error: error.message }));
    });

    const unsubSnapshot = onValue(snapshotRef, (snapshot) => {
      snapshotData = snapshot.val() || { data: [] };
      process();
    });

    return () => {
      unsubCurrent();
      unsubSnapshot();
    };
  }, []);

  return data;
};