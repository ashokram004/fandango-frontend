import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebaseConfig';
import * as XLSX from 'xlsx';

const MOVIE_SLUG = 'peddi-2026';
const SHOW_DATE = '2026-06-03';

export const useFandangoData = (diffMode = 'daily') => {
  const [data, setData] = useState({
    loading: true,
    kpis: null,
    tables: null,
    rawRows: [],
    historyData: [],
    filteredKpis: null,
    metadata: null,
    error: null,
    differences: null
  });

  const refs = useRef({
    currentData: null,
    dailySnapshot: null,
    hourlySnapshot: null,
    historyDataRaw: null,
    lastUpdated: 'N/A',
    growthSinceDaily: 'N/A',
    growthSinceHourly: 'N/A'
  });



  const process = useCallback(() => {
    const { currentData, dailySnapshot, hourlySnapshot, historyDataRaw, lastUpdated, growthSinceDaily, growthSinceHourly } = refs.current;

    const currentDiffMode = diffMode;
    const snapshotData = currentDiffMode === 'hourly' ? hourlySnapshot : dailySnapshot;

    if (!currentData || !snapshotData) return;

    const growthSince = currentDiffMode === 'hourly' ? growthSinceHourly : growthSinceDaily;

    const toArray = (value) => {
      if (Array.isArray(value)) return value;
      if (!value) return [];
      return Object.values(value);
    };

    const normalizeNumber = (value) => {
      const normalized = Number(value);
      return Number.isFinite(normalized) ? normalized : 0;
    };

    const rawCurrent = toArray(currentData.data || currentData);
    const rawSnapshot = toArray(snapshotData.data || snapshotData);

    const getChainCategory = (theaterName) => {
      const name = (theaterName || '').toUpperCase();
      if (name.includes('AMC')) return 'AMC Theatres';
      if (name.includes('CINEMARK') || name.includes('CENTURY')) return 'Cinemark';
      if (name.includes('REGAL')) return 'Regal Cinemas';
      if (name.includes('MARCUS')) return 'Marcus Theatres';
      if (name.includes('HARKINS')) return 'Harkins Theatres';
      if (name.includes('APPLE CINEMAS')) return 'Apple Cinemas';
      return 'Other / Independents';
    };

    const getTimeCategory = (timeStr) => {
      try {
        const clean = (timeStr || 'Unknown').trim();
        const cleanTime = clean.replace(/\s*o'clock\s*/gi, ':00 ');
        const t = new Date(`2000-01-01T${cleanTime}`);
        const hours = Number.isFinite(t.getTime()) ? t.getHours() : null;
        if (hours === null) {
          const m = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if (!m) return '7. Unknown Time';
          let h = parseInt(m[1], 10);
          const ampm = m[3].toUpperCase();
          if (ampm === 'PM' && h !== 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          if (h >= 5 && h < 9) return '1. Early Morning (5am-9am)';
          if (h >= 9 && h < 12) return '2. Morning (9am-12pm)';
          if (h >= 12 && h < 16) return '3. Afternoon (12pm-4pm)';
          if (h >= 16 && h < 20) return '4. Evening (4pm-8pm)';
          if (h >= 20 && h < 24) return '5. Night (8pm-12am)';
          return '6. Midnight (12am-5am)';
        }

        if (hours >= 5 && hours < 9) return '1. Early Morning (5am-9am)';
        if (hours >= 9 && hours < 12) return '2. Morning (9am-12pm)';
        if (hours >= 12 && hours < 16) return '3. Afternoon (12pm-4pm)';
        if (hours >= 16 && hours < 20) return '4. Evening (4pm-8pm)';
        if (hours >= 20 && hours < 24) return '5. Night (8pm-12am)';
        return '6. Midnight (12am-5am)';
      } catch {
        return '7. Unknown Time';
      }
    };

    const normalizeFormat = (fmt) => {
      const f = fmt || 'Standard';
      return f?.includes('D-Box') && f?.includes('Premium') ? 'Premium' : f;
    };

    const makeRowId = (r) => {
      const theater = (r.theater || r['Theater Name'] || '').trim().toLowerCase();
      const time = (r.time || r['Show Time'] || '').trim().toLowerCase();
      const format = (normalizeFormat(r.format || r['Format']) || '').trim().toLowerCase();
      const language = (r.language || r['Language'] || '').trim().toLowerCase();
      return `${theater}_${time}_${format}_${language}`;
    };

    const currentMap = new Map();
    rawCurrent.forEach(r => {
      if (r.is_extra || r.t_id === 'EXTRA') return;
      currentMap.set(makeRowId(r), r);
    });

    const snapMap = new Map();
    rawSnapshot.forEach(r => {
      if (r.is_extra || r.t_id === 'EXTRA') return;
      snapMap.set(makeRowId(r), r);
    });

    const differences = {
      addedShows: [],
      removedShows: [],
      ticketsBooked: [],
      ticketsCancelled: []
    };

    currentMap.forEach((currRow, key) => {
      const snapRow = snapMap.get(key);
      const currBooked = normalizeNumber(currRow.booked);
      const currGross = normalizeNumber(currRow.gross);
      const theaterName = currRow.theater || currRow['Theater Name'];

      if (!snapRow) {
        differences.addedShows.push({ ...currRow, theater: theaterName });
      } else {
        const snapBooked = normalizeNumber(snapRow.booked !== undefined ? snapRow.booked : snapRow['Booked']);
        const snapGross = normalizeNumber(snapRow.gross !== undefined ? snapRow.gross : snapRow['Gross ($)']);
        const diffBooked = currBooked - snapBooked;
        const diffGross = currGross - snapGross;
        
        if (diffBooked > 0) {
          differences.ticketsBooked.push({ ...currRow, theater: theaterName, diffBooked, diffGross });
        } else if (diffBooked < 0) {
          differences.ticketsCancelled.push({ ...currRow, theater: theaterName, diffBooked: Math.abs(diffBooked), diffGross: Math.abs(diffGross) });
        }
      }
    });

    snapMap.forEach((snapRow, key) => {
      if (!currentMap.has(key)) {
        const theaterName = snapRow.theater || snapRow['Theater Name'];
        differences.removedShows.push({ ...snapRow, theater: theaterName, time: snapRow.time || snapRow['Show Time'], format: snapRow.format || snapRow['Format'], language: snapRow.language || snapRow['Language'] });
      }
    });

    differences.addedShows.sort((a, b) => normalizeNumber(b.gross) - normalizeNumber(a.gross));
    differences.removedShows.sort((a, b) => normalizeNumber(b.gross || b['Gross ($)']) - normalizeNumber(a.gross || a['Gross ($)']));
    differences.ticketsBooked.sort((a, b) => b.diffBooked - a.diffBooked);
    differences.ticketsCancelled.sort((a, b) => b.diffBooked - a.diffBooked);

    const aggregate = (dataset) => {
      let totalGross = 0;
      let totalTickets = 0;
      let totalBooked = 0;
      
      let validShows = 0;
      let validVenues = new Set();
      let validCapacity = 0;
      let validBooked = 0;

      const summary = {
        formats: {},
        languages: {},
        states: {},
        theaters: {},
        chains: {},
        timeCats: {}
      };

      dataset.forEach(row => {
        const gross = normalizeNumber(row.gross !== undefined ? row.gross : row['Gross ($)']);
        const booked = normalizeNumber(row.booked !== undefined ? row.booked : row['Booked']);
        const tickets = normalizeNumber(row.total !== undefined ? row.total : row['Tickets']);
        const isExtra = row.is_extra || row.t_id === 'EXTRA';

        totalGross += gross;
        totalTickets += tickets;
        totalBooked += booked;

        if (!isExtra) {
          validShows += 1;
          const theaterName = row.theater || row['Theater Name'] || 'Unknown';
          const tId = row.t_id || theaterName; // Fallback to name if t_id missing
          validVenues.add(tId);
          validCapacity += tickets;
          validBooked += booked;

          const rawFormat = row.format || row['Format'] || '';
          const format = rawFormat.includes('D-Box') && rawFormat.includes('Premium') ? 'Premium' : (rawFormat || 'Unknown');
          const lang = row.language || row['Language'] || 'Unknown';
          const state = row.state || row['State'] || 'Unknown';
          
          const chain = getChainCategory(theaterName);
          const timeCat = getTimeCategory(row.time || row['Show Time'] || 'Unknown');

          const inc = (obj, key, nameFallback) => {
            if (!obj[key]) obj[key] = { id: key, name: nameFallback || key, shows: 0, tickets: 0, booked: 0, gross: 0, d_booked: 0, d_gross: 0, d_tickets: 0 };
            obj[key].shows += 1;
            obj[key].tickets += tickets;
            obj[key].booked += booked;
            obj[key].gross += gross;
          };

          inc(summary.formats, format);
          inc(summary.languages, lang);
          inc(summary.states, state);
          inc(summary.theaters, tId, theaterName);
          inc(summary.chains, chain);
          inc(summary.timeCats, timeCat);
        }
      });

      return {
        totalGross,
        totalTickets,
        totalBooked,
        totalShows: validShows,
        totalVenues: validVenues.size,
        occupancy: validCapacity > 0 ? (validBooked / validCapacity) * 100 : 0,
        totalCapacity: validCapacity,
        summary
      };
    };

    const curr = aggregate(rawCurrent);
    const snap = aggregate(rawSnapshot, true);

    const getSnapshotItem = (item, snapDict, isTheater) => {
      if (!snapDict) return null;
      if (isTheater) {
        let sItem = Object.values(snapDict).find((x) => x.id === item.id);
        if (!sItem) sItem = Object.values(snapDict).find((x) => x.name?.toString().toLowerCase() === item.name?.toString().toLowerCase());
        return sItem || null;
      }
      if (snapDict[item.name]) return snapDict[item.name];
      return Object.values(snapDict).find((x) => x.name?.toString().toLowerCase() === item.name?.toString().toLowerCase()) || null;
    };

    const kpis = {
      totalGross: { val: curr.totalGross, delta: curr.totalGross - snap.totalGross },
      totalTickets: { val: curr.totalTickets, delta: curr.totalTickets - snap.totalTickets },
      totalBooked: { val: curr.totalBooked, delta: curr.totalBooked - snap.totalBooked },
      totalVenues: { val: curr.totalVenues, delta: curr.totalVenues - snap.totalVenues },
      totalShows: { val: curr.totalShows, delta: curr.totalShows - snap.totalShows },
      occupancy: { val: curr.occupancy, capacity: curr.totalCapacity }
    };

    const rawRows = rawCurrent.map((row) => {
      const format = normalizeFormat(row.format);
      const state = row.state || 'Unknown';
      const theater = row.theater || 'Unknown';
      const chain = getChainCategory(theater);
      const time = row.time || 'Unknown';
      const timeCat = getTimeCategory(time);

      const total = normalizeNumber(row.total);
      const booked = normalizeNumber(row.booked);
      const gross = normalizeNumber(row.gross);

      const occ = total > 0 ? (booked / total) * 100 : 0;

      const status = row.status || 'Available';
      const price_str = row.price_str || '$0.00';
      const language = row.language || 'Unknown';
      const is_extra = !!(row.is_extra || row.t_id === 'EXTRA');

      const sRow = snapMap.get(makeRowId(row));
      const s_gross = sRow ? normalizeNumber(sRow.gross !== undefined ? sRow.gross : sRow['Gross ($)']) : 0;
      const s_booked = sRow ? normalizeNumber(sRow.booked !== undefined ? sRow.booked : sRow['Booked']) : 0;
      const s_total = sRow ? normalizeNumber(sRow.total !== undefined ? sRow.total : sRow['Tickets']) : 0;

      return {
        t_id: row.t_id || '',
        id: `${row.t_id || ''}_${row.time || ''}_${format || ''}_${language || ''}_${theater || ''}`,
        state,
        theater,
        format,
        language,
        time,
        timeCat,
        chain,
        status,
        price_str,
        total,
        booked,
        gross,
        occ,
        is_extra,
        has_snapshot: !!sRow,
        s_gross,
        s_booked,
        s_total
      };
    });

    const buildTable = (currDict, snapDict, isTheater = false) => {
      return Object.values(currDict).map((item) => {
        const sItem = getSnapshotItem(item, snapDict, isTheater);
        const d_gross = normalizeNumber(item.gross) - normalizeNumber(sItem?.gross);
        const d_booked = normalizeNumber(item.booked) - normalizeNumber(sItem?.booked);
        const d_tickets = normalizeNumber(item.tickets) - normalizeNumber(sItem?.tickets);
        const occ = normalizeNumber(item.tickets) > 0 ? (normalizeNumber(item.booked) / normalizeNumber(item.tickets)) * 100 : 0;
        return { ...item, d_gross, d_booked, d_tickets, occ };
      }).sort((a, b) => b.gross - a.gross);
    };

    const tables = {
      formats: buildTable(curr.summary.formats, snap.summary.formats),
      languages: buildTable(curr.summary.languages, snap.summary.languages),
      states: buildTable(curr.summary.states, snap.summary.states),
      theaters: buildTable(curr.summary.theaters, snap.summary.theaters, true),
      chains: buildTable(curr.summary.chains, snap.summary.chains),
      timeCats: buildTable(curr.summary.timeCats, snap.summary.timeCats)
    };

    const filteredRowsBase = rawRows.filter((r) => !r.is_extra);
    const computeFilteredKpis = (rows) => {
      const totalTickets = rows.reduce((s, r) => s + (r.total || 0), 0);
      const totalBooked = rows.reduce((s, r) => s + (r.booked || 0), 0);
      const totalGross = rows.reduce((s, r) => s + (r.gross || 0), 0);
      const venues = new Set(rows.map((r) => r.t_id || r.theater).filter(Boolean));
      const occupancy = totalTickets > 0 ? (totalBooked / totalTickets) * 100 : 0;
      return {
        totalTickets,
        totalBooked,
        totalGross,
        shows: rows.length,
        venues: venues.size,
        occupancy
      };
    };

    const initialFilteredKpis = computeFilteredKpis(filteredRowsBase);

    function formatDate(dateObj) {
      if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return 'N/A';
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const formattedDay = dateObj.getDate();
      const formattedMonth = months[dateObj.getMonth()];
      const formattedYear = dateObj.getFullYear();
      let displayHours = dateObj.getHours();
      const displayMinutes = String(dateObj.getMinutes()).padStart(2, "0");
      const displaySeconds = String(dateObj.getSeconds()).padStart(2, "0");
      const ampm = displayHours >= 12 ? "PM" : "AM";
      displayHours = displayHours % 12 || 12;
      return `${formattedDay} ${formattedMonth} ${formattedYear}, ${displayHours}:${displayMinutes}:${displaySeconds} ${ampm}`;
    }

    setData({
      loading: false,
      kpis,
      tables,
      rawRows,
      historyData: historyDataRaw || [],
      filteredKpis: initialFilteredKpis,
      differences,
      metadata: {
        lastUpdated: formatDate(lastUpdated),
        growthSince: growthSince,
        showDate: SHOW_DATE
      },
      error: null
    });

  }, [diffMode]);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/ashokram004/fandango_web/master/previous_report.xlsx')
      .then(res => res.arrayBuffer())
      .then(ab => {
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets['Showtime Details'];
        if (ws) {
          const sheetData = XLSX.utils.sheet_to_json(ws);
          refs.current.hourlySnapshot = { data: sheetData };
          
          const kpiSheet = wb.Sheets['Summary KPIs'];
          if (kpiSheet) {
            const kpiData = XLSX.utils.sheet_to_json(kpiSheet);
            if (kpiData.length > 0) {
               const growthKey = Object.keys(kpiData[0]).find(k => k.includes('Growth'));
               if (growthKey) {
                  const m = growthKey.match(/Since (.*)\)/);
                  if (m) refs.current.growthSinceHourly = m[1];
               }
            }
          }
          if (refs.current.growthSinceHourly === 'N/A') {
             refs.current.growthSinceHourly = 'Previous Report';
          }
          if (diffMode === 'hourly') {
            process();
          }
        }
      })
      .catch(err => console.error('Failed to fetch hourly snapshot:', err));
  }, [process, diffMode]);

  useEffect(() => {
    const formatUtcToIst = (value) => {
      try {
        if (value === null || value === undefined || value === '') return 'N/A';
        const ms = typeof value === 'number' ? value : Date.parse(String(value));
        if (!Number.isFinite(ms)) return 'N/A';
        return new Date(ms).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).replace(/am|pm/i, match => match.toUpperCase());
      } catch {
        return 'N/A';
      }
    };

    const currentRef = ref(database, `movies/${MOVIE_SLUG}/${SHOW_DATE}/master_shows_data`);
    const snapshotRef = ref(database, `movies/${MOVIE_SLUG}/${SHOW_DATE}/last_snapshot`);
    const historyRef = ref(database, `movies/${MOVIE_SLUG}/${SHOW_DATE}/history`);

    const unsubCurrent = onValue(currentRef, (snapshot) => {
      refs.current.currentData = snapshot.val() || { data: [] };
      if (refs.current.currentData.last_updated) {
          refs.current.lastUpdated = new Date(refs.current.currentData.last_updated);
      }
      process();
    }, (error) => {
        setData(prev => ({ ...prev, loading: false, error: error.message }));
    });

    const unsubSnapshot = onValue(snapshotRef, (snapshot) => {
      refs.current.dailySnapshot = snapshot.val() || { data: [] };
      if (refs.current.dailySnapshot?.timestamp) {
        refs.current.growthSinceDaily = formatUtcToIst(refs.current.dailySnapshot.timestamp);
      }
      process();
    });

    const unsubHistory = onValue(historyRef, (snapshot) => {
      const hData = snapshot.val();
      if (hData) {
        refs.current.historyDataRaw = Object.values(hData).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      } else {
        refs.current.historyDataRaw = [];
      }
      process();
    });

    return () => {
      unsubCurrent();
      unsubSnapshot();
      unsubHistory();
    };
  }, [process]);

  useEffect(() => {
    process();
  }, [diffMode, process]);

  return data;
};
