import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebaseConfig';

const MOVIE_SLUG = 'peddi-2026';
const SHOW_DATE = '2026-06-03';

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

    let growthSince = currentDiffMode === 'hourly' ? growthSinceHourly : growthSinceDaily;

    const toArray = (value) => {
      if (Array.isArray(value)) return value;
      if (!value) return [];
      return Object.values(value);
    };

    const normalizeNumber = (value) => {
      if (typeof value === 'string') {
        const parsed = parseFloat(value.replace(/[^0-9.-]+/g, ""));
        return Number.isFinite(parsed) ? parsed : 0;
      }
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

    const parseTimeForSort = (timeStr) => {
      if (!timeStr) return 0;
      const clean = timeStr.toString().trim().toLowerCase().replace(/\s*o'clock\s*/gi, ':00 ');
      const m = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
      if (!m) return 0;
      let h = parseInt(m[1], 10);
      let min = parseInt(m[2] || '0', 10);
      let ampm = m[3];
      if (ampm === 'pm' && h !== 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      return h * 60 + min;
    };

    const makeBaseId = (r) => {
      const theater = (r.t_id || r.theater || r['Theater Name'] || r['Theater'] || '').trim().toLowerCase();
      const format = (normalizeFormat(r.format || r['Format']) || '').trim().toLowerCase();
      const language = (r.language || r['Language'] || '').trim().toLowerCase();
      return `${theater}_${format}_${language}`;
    };

    const makeRowId = (r) => {
      const time = (r.time || r['Show Time'] || r['Time'] || '').trim().toLowerCase();
      return `${makeBaseId(r)}_${time}`;
    };

    const snapMap = new Map();
    rawSnapshot.forEach((r, i) => {
      if (r.is_extra || r.t_id === 'EXTRA') return;
      r._matched = false;
      const id = makeRowId(r);
      if (!snapMap.has(id)) snapMap.set(id, []);
      snapMap.get(id).push(r);
    });

    const currentMatchedSnap = new Map();
    const unmatchedCurrent = [];

    rawCurrent.forEach((r, i) => {
      if (r.is_extra || r.t_id === 'EXTRA') return;
      const id = makeRowId(r);
      const potentialSnaps = snapMap.get(id);

      if (potentialSnaps && potentialSnaps.length > 0) {
        const sMatch = potentialSnaps.find(s => !s._matched);
        if (sMatch) {
          sMatch._matched = true;
          currentMatchedSnap.set(i, sMatch);
        } else {
          unmatchedCurrent.push({ row: r, index: i });
        }
      } else {
        unmatchedCurrent.push({ row: r, index: i });
      }
    });

    const unmatchedSnapByBase = {};
    rawSnapshot.forEach(s => {
      if (s.is_extra || s.t_id === 'EXTRA' || s._matched) return;
      const baseId = makeBaseId(s);
      if (!unmatchedSnapByBase[baseId]) unmatchedSnapByBase[baseId] = [];
      unmatchedSnapByBase[baseId].push(s);
    });

    unmatchedCurrent.forEach(({ row: c, index: i }) => {
      const baseId = makeBaseId(c);
      const cMins = parseTimeForSort(c.time || c['Show Time'] || c['Time']);
      const availableSnaps = unmatchedSnapByBase[baseId] || [];

      let bestMatch = null;
      let minDiff = Infinity;

      availableSnaps.forEach(s => {
        if (s._matched) return;
        const sMins = parseTimeForSort(s.time || s['Show Time'] || s['Time']);
        const diff = Math.abs(cMins - sMins);
        if (diff <= 60 && diff < minDiff) {
          minDiff = diff;
          bestMatch = s;
        }
      });

      if (bestMatch) {
        bestMatch._matched = true;
        currentMatchedSnap.set(i, bestMatch);
      }
    });

    const differences = {
      addedShows: [],
      removedShows: [],
      ticketsBooked: [],
      ticketsCancelled: []
    };

    rawCurrent.forEach((r, idx) => {
      if (r.is_extra || r.t_id === 'EXTRA') return;
      const sRow = currentMatchedSnap.get(idx);
      const currBooked = normalizeNumber(r.booked);
      const currGross = normalizeNumber(r.gross);
      const theaterName = r.theater || r['Theater Name'] || r['Theater'];

      if (!sRow) {
        differences.addedShows.push({ ...r, theater: theaterName });
      } else {
        const snapBooked = normalizeNumber(sRow.booked !== undefined ? sRow.booked : sRow['Booked']);
        const snapGross = normalizeNumber(sRow.gross !== undefined ? sRow.gross : (sRow['Gross ($)'] !== undefined ? sRow['Gross ($)'] : sRow['Gross']));
        const diffBooked = currBooked - snapBooked;
        const diffGross = currGross - snapGross;
        
        if (diffBooked > 0) {
          differences.ticketsBooked.push({ ...r, theater: theaterName, diffBooked, diffGross });
        } else if (diffBooked < 0) {
          differences.ticketsCancelled.push({ ...r, theater: theaterName, diffBooked: Math.abs(diffBooked), diffGross: Math.abs(diffGross) });
        }
      }
    });

    rawSnapshot.forEach(r => {
      if (r.is_extra || r.t_id === 'EXTRA') return;
      if (!r._matched) {
        const theaterName = r.theater || r['Theater Name'] || r['Theater'];
        differences.removedShows.push({ ...r, theater: theaterName, time: r.time || r['Show Time'] || r['Time'], format: r.format || r['Format'], language: r.language || r['Language'] });
      }
    });

    differences.addedShows.sort((a, b) => normalizeNumber(b.gross) - normalizeNumber(a.gross));
    differences.removedShows.sort((a, b) => normalizeNumber(b.gross || b['Gross ($)'] || b['Gross']) - normalizeNumber(a.gross || a['Gross ($)'] || a['Gross']));
    differences.ticketsBooked.sort((a, b) => b.diffBooked - a.diffBooked);
    differences.ticketsCancelled.sort((a, b) => b.diffBooked - a.diffBooked);

    const aggregate = (dataset) => {
      let totalGross = 0;
      let totalTickets = 0;
      let totalBooked = 0;
      
      let validGross = 0;
      let validTickets = 0;
      let validBooked = 0;

      let validShows = 0;
      let validVenues = new Set();
      let validCapacity = 0;

      const summary = {
        formats: {},
        languages: {},
        states: {},
        theaters: {},
        chains: {},
        timeCats: {}
      };

      dataset.forEach(row => {
        const gross = normalizeNumber(row.gross !== undefined ? row.gross : (row['Gross ($)'] !== undefined ? row['Gross ($)'] : row['Gross']));
        const booked = normalizeNumber(row.booked !== undefined ? row.booked : row['Booked']);
        const tickets = normalizeNumber(row.total !== undefined ? row.total : (row['Tickets'] !== undefined ? row['Tickets'] : row['Capacity']));
        const isExtra = row.is_extra || row.t_id === 'EXTRA';

        totalGross += gross;
        totalTickets += tickets;
        totalBooked += booked;

        if (!isExtra) {
          validGross += gross;
          validTickets += tickets;
          validBooked += booked;

          validShows += 1;
          const theaterName = row.theater || row['Theater Name'] || row['Theater'] || 'Unknown';
          const tId = row.t_id || theaterName;
          validVenues.add(tId);
          validCapacity += tickets;

          const rawFormat = row.format || row['Format'] || '';
          const format = rawFormat.includes('D-Box') && rawFormat.includes('Premium') ? 'Premium' : (rawFormat || 'Unknown');
          const lang = row.language || row['Language'] || 'Unknown';
          const state = row.state || row['State'] || 'Unknown';
          
          const chain = getChainCategory(theaterName);
          const timeCat = getTimeCategory(row.time || row['Show Time'] || row['Time'] || 'Unknown');

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
        validGross, 
        validTickets, 
        validBooked,
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
      totalGross: { val: curr.totalGross, delta: curr.validGross - snap.validGross },
      totalTickets: { val: curr.totalTickets, delta: curr.validTickets - snap.validTickets },
      totalBooked: { val: curr.totalBooked, delta: curr.validBooked - snap.validBooked },
      totalVenues: { val: curr.totalVenues, delta: curr.totalVenues - snap.totalVenues },
      totalShows: { val: curr.totalShows, delta: curr.totalShows - snap.totalShows },
      occupancy: { val: curr.occupancy, capacity: curr.totalCapacity }
    };

    const rawRows = rawCurrent.map((row, idx) => {
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

      const sRow = currentMatchedSnap.get(idx);
      
      const s_gross = sRow ? normalizeNumber(sRow.gross !== undefined ? sRow.gross : (sRow['Gross ($)'] !== undefined ? sRow['Gross ($)'] : sRow['Gross'])) : 0;
      const s_booked = sRow ? normalizeNumber(sRow.booked !== undefined ? sRow.booked : sRow['Booked']) : 0;
      const s_total = sRow ? normalizeNumber(sRow.total !== undefined ? sRow.total : (sRow['Tickets'] !== undefined ? sRow['Tickets'] : sRow['Capacity'])) : 0;

      return {
        t_id: row.t_id || '',
        id: `${row.t_id || ''}_${row.time || ''}_${format || ''}_${language || ''}_${theater || ''}_${idx}`,
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
        s_total,
        // ✅ BUG FIXED: Explicitly added seat_map_urls mapping here so frontend can access it
        seat_map_urls: row.seat_map_urls || '' 
      };
    });

    const buildTable = (currDict, snapDict, isTheater = false) => {
      const result = Object.values(currDict).map((item) => {
        const sItem = getSnapshotItem(item, snapDict, isTheater);
        const s_gross = normalizeNumber(sItem?.gross);
        const s_booked = normalizeNumber(sItem?.booked);
        const s_tickets = normalizeNumber(sItem?.tickets);

        const d_gross = normalizeNumber(item.gross) - s_gross;
        const d_booked = normalizeNumber(item.booked) - s_booked;
        const d_tickets = normalizeNumber(item.tickets) - s_tickets;
        const occ = normalizeNumber(item.tickets) > 0 ? (normalizeNumber(item.booked) / normalizeNumber(item.tickets)) * 100 : 0;
        return { ...item, d_gross, d_booked, d_tickets, occ };
      });

      if (snapDict) {
        Object.values(snapDict).forEach(sItem => {
          const exists = result.find(r => r.id === sItem.id || r.name === sItem.name);
          if (!exists) {
            result.push({
              id: sItem.id,
              name: sItem.name,
              shows: 0,
              tickets: 0,
              booked: 0,
              gross: 0,
              d_gross: -normalizeNumber(sItem.gross),
              d_booked: -normalizeNumber(sItem.booked),
              d_tickets: -normalizeNumber(sItem.tickets),
              occ: 0
            });
          }
        });
      }

      return result.sort((a, b) => b.gross - a.gross);
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
    const currentRef = ref(database, `movies/${MOVIE_SLUG}/${SHOW_DATE}/master_shows_data`);
    const snapshotRef = ref(database, `movies/${MOVIE_SLUG}/${SHOW_DATE}/last_snapshot`);
    const hourlySnapshotRef = ref(database, `movies/${MOVIE_SLUG}/${SHOW_DATE}/previous_run_snapshot`);
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

    const unsubHourlySnapshot = onValue(hourlySnapshotRef, (snapshot) => {
      refs.current.hourlySnapshot = snapshot.val() || { data: [] };
      if (refs.current.hourlySnapshot?.timestamp) {
        refs.current.growthSinceHourly = formatUtcToIst(refs.current.hourlySnapshot.timestamp);
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
      unsubHourlySnapshot();
      unsubHistory();
    };
  }, [process]);

  useEffect(() => {
    process();
  }, [diffMode, process]);

  return data;
};