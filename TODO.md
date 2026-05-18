# TODO - Glassmorphism UI Rebuild

## Step 1: Port reporter layout to React
- [x] Update `src/App.jsx` to use reporter-like structure (orbs bg + header + filter drawer + KPI grid + summary sections + all showtimes)


## Step 2: Replace CSS with reporter glassmorphism theme
- [ ] Rewrite `src/index.css` to match reporter tokens (bg gradients, glass panels, animations)
- [ ] Update `src/App.css` with reporter-class names + motion styles


## Step 3: Update filtering UX
- [ ] Integrate `src/components/FilterPanel.jsx` into `App.jsx`
- [ ] Add animated “active filters chips” + smooth clear

## Step 4: Update/replace tables styling
- [ ] Rewrite `src/components/ShowsTable.jsx` markup & classnames to match reporter “summary-section”/table styles
- [ ] Remove dependency on old table styles from `App.css`

## Step 5: Make it mobile-first
- [ ] Ensure KPI grid auto-fit
- [ ] Ensure tables scroll horizontally and fit small screens
- [ ] Add media queries mirroring reporter (e.g. dashboard-row stacking)

## Step 6: Verify & test
- [ ] Run `npm run dev`
- [ ] Confirm realtime updates from Firebase
- [ ] Confirm filters update instantly
- [ ] Check performance (no expensive re-renders)


