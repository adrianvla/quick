import { getToDoTasks } from '../storage/storage.js';
import { calculatePERT, calculatePERTSchedule } from '../logic/pert.js';

export const showCalendar = () => {
    const content = document.querySelector('.content');
    const todolist = getToDoTasks();

    // Flatten tasks with metadata
    const tasks = [];
    const taskIdToColor = {};
    todolist.forEach(cat => {
        cat.tasks.forEach(t => {
            tasks.push({
                id: t.id,
                name: t.name,
                description: t.description || '',
                category: cat.name,
                color: cat.color || 'grey'
            });
            taskIdToColor[t.id] = cat.color || 'grey';
        });
    });

    if (!tasks.length) {
        content.innerHTML = '<div class="title"><h1>Calendar</h1></div><div class="text">No tasks to display.</div>';
        return;
    }

    // Use a persistent baseline so dates don't drift each render
    const baselineKey = 'pertBaselineTs';
    let baselineNow = Number(localStorage.getItem(baselineKey));
    if (!baselineNow || !Number.isFinite(baselineNow)) {
        baselineNow = Date.now();
        localStorage.setItem(baselineKey, String(baselineNow));
    }
    const schedule = calculatePERTSchedule(todolist, { now: baselineNow });
    const pert = calculatePERT(todolist);
    // Collect date range
    const parsed = tasks
        .map(t => {
            const s = schedule[t.id];
            // Window in which the task can be placed: [minStart, maxFinish]
            let minStart = s?.minStartDate ? new Date(s.minStartDate) : null;
            let maxFinish = s?.maxFinishDate ? new Date(s.maxFinishDate) : null;
            // Fallbacks for older fields
            if (!(minStart instanceof Date) || isNaN(minStart)) minStart = s?.minDate ? new Date(s.minDate) : null;
            if (!(maxFinish instanceof Date) || isNaN(maxFinish)) maxFinish = s?.maxDate ? new Date(s.maxDate) : null;
            return { ...t, min: minStart, max: maxFinish };
        })
        .filter(t => t.min instanceof Date && !isNaN(t.min) && t.max instanceof Date && !isNaN(t.max));

    if (!parsed.length) {
        content.innerHTML = '<div class="title"><h1>Calendar</h1></div><div class="text">No scheduled dates available.</div>';
        return;
    }

    const rangeStart = new Date(Math.min(...parsed.map(t => t.min.getTime())));
    const rangeEnd = new Date(Math.max(...parsed.map(t => t.max.getTime())));
    const rangeMs = Math.max(1, rangeEnd.getTime() - rangeStart.getTime());

    // Sort by earliest min date
    parsed.sort((a, b) => a.min.getTime() - b.min.getTime());

    const fmt = (d) => d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // Build markup
    let html = '';
    html += '<div class="title"><h1>Calendar</h1></div>';
    html += '<div class="text">Schedule window: ' + fmt(rangeStart) + ' — ' + fmt(rangeEnd) + '</div>';
    html += '<div class="calendar" style="display:flex;flex-direction:column;gap:10px;overflow:auto;max-height:100%;padding-right:10px;">';

    // Optional scale ticks by day (compact): up to 14 ticks
    const DAY_MS = 24 * 60 * 60 * 1000;
    const daysSpan = Math.max(1, Math.round(rangeMs / DAY_MS));
    const tickCount = Math.min(14, daysSpan + 1);
    html += '<div class="scale" style="position:relative;height:24px;margin:6px 0 2px 180px;background:transparent;"><div class="scale-inner" style="position:relative;height:100%;"></div></div>';

    parsed.forEach(t => {
        // Bar spans the full feasible window where the task can fit
        const leftPct = ((t.min.getTime() - rangeStart.getTime()) / rangeMs) * 100;
        let widthPct = ((t.max.getTime() - t.min.getTime()) / rangeMs) * 100;
        if (!isFinite(widthPct) || widthPct < 0.8) widthPct = 0.8; // ensure visible
        const barColor = `var(--${t.color})`;
        const barBg = `var(--${t.color}2)`;

    // Compute the most-likely (m) duration span as a solid marker bar within [min,max]
    const p = pert[t.id] || { a: 0, m: 0 };
    const mlDurationMs = Math.max(0, (p.m || 0) * DAY_MS);
    // Default marker at earliest start, but ensure it fits entirely in the window
    let mlStartMs = t.min.getTime();
    const latestStartAllowedMs = Math.max(t.min.getTime(), t.max.getTime() - mlDurationMs);
    if (mlStartMs > latestStartAllowedMs) mlStartMs = latestStartAllowedMs;
    let mlEndMs = mlStartMs + mlDurationMs;
    if (!Number.isFinite(mlStartMs)) mlStartMs = t.min.getTime();
    if (!Number.isFinite(mlEndMs)) mlEndMs = t.min.getTime();
    // Clamp to the visible window [min,max]
    mlStartMs = Math.max(t.min.getTime(), Math.min(latestStartAllowedMs, mlStartMs));
    mlEndMs = Math.max(t.min.getTime(), Math.min(t.max.getTime(), mlEndMs));
    if (mlEndMs < mlStartMs) mlEndMs = mlStartMs; // avoid negative width
    const markerStartLeftPct = ((mlStartMs - rangeStart.getTime()) / rangeMs) * 100;
    let markerWidthPct = ((mlEndMs - mlStartMs) / rangeMs) * 100;
    if (!isFinite(markerWidthPct) || markerWidthPct < 0) markerWidthPct = 0;
    // Marker label: show project length (most-likely m) in days
    const lenDays = Math.max(0, p.m || 0);
    const lenRounded = Math.round(lenDays * 10) / 10;
    const lenLabel = (Math.abs(lenRounded - Math.round(lenRounded)) < 1e-9)
        ? `${Math.round(lenRounded)}d`
        : `${lenRounded}d`;
    const markerTitle = `Most-likely length: ${lenLabel}`;

        html += '<div class="row" style="display:flex;align-items:center;gap:12px;">';
        // Left label
        html += `<div class="label" title="${t.description}" style="width:170px;min-width:170px;display:flex;flex-direction:column;gap:2px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span class="small-pill" style="background:${barColor};box-shadow:0 0 0 2px rgba(0,0,0,0.2);">&nbsp;</span>
                        <b>${t.name}</b>
                    </div>
                    <small style="opacity:0.8;">${t.category}</small>
                 </div>`;
        // Timeline bar
    html += `<div class="timeline" style="position:relative;flex:1;height:24px;background:rgba(255,255,255,0.05);border-radius:6px;overflow:visible;">
        <div class="bar" title="${fmt(t.min)} — ${fmt(t.max)}" style="position:absolute;left:${leftPct}%;width:${widthPct}%;min-width:6px;height:100%;background:${barBg};border:1px solid ${barColor};border-radius:6px;box-sizing:border-box;opacity:0.5;"></div>
        <div class="marker" title="${markerTitle}" data-window-start="${t.min.getTime()}" data-window-end="${t.max.getTime()}" data-len-ms="${mlDurationMs}" style="position:absolute;left:${markerStartLeftPct}%;width:${markerWidthPct}%;min-width:6px;top:0px;height:100%;box-sizing:border-box;background:${barColor};border:1px solid ${barColor};border-radius:4px;opacity:1;z-index:2;box-shadow:0 0 0 1px rgba(0,0,0,0.2);cursor:grab;"></div>
        <div class="marker-date" style="position:absolute;left:${markerStartLeftPct}%;width:${markerWidthPct}%;top:50%;transform:translateY(-50%);font-size:11px;font-weight:600;color:#fff;text-align:center;background:transparent;padding:0 2px;border-radius:4px;white-space:nowrap;opacity:1;z-index:3;pointer-events:none;">${lenLabel}</div>
                 </div>`;
        // Dates text
    html += `<div class="dates" style="width:360px;min-width:360px;font-size:12px;opacity:0.9;display:flex;flex-direction:column;">
        <span>Min Start: <b>${fmt(t.min)}</b></span>
        <span>Max Finish: <b>${fmt(t.max)}</b></span>
         </div>`;
        html += '</div>';
    });

    html += '</div>';
    content.innerHTML = html;

    // After render, size the scale to the first row timeline width and render ticks within it
    const scale = content.querySelector('.scale');
    const scaleInner = content.querySelector('.scale .scale-inner');
    const firstTimeline = content.querySelector('.row .timeline');
    const updateScale = () => {
        if (!scale || !scaleInner) return;
        const tl = content.querySelector('.row .timeline');
        if (!tl) return;
        const rect = tl.getBoundingClientRect();
        scale.style.width = rect.width + 'px';
        // Populate ticks sized to this width
        let ticksHtml = '';
        for (let i = 0; i < tickCount; i++) {
            const t = rangeStart.getTime() + (rangeMs * i) / (tickCount - 1);
            const left = (i / (tickCount - 1)) * 100;
            const label = new Date(t).toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
            ticksHtml += `<div style=\"position:absolute;left:${left}%;top:0;transform:translateX(-50%);font-size:10px;color:#888;white-space:nowrap;\">${label}</div>`;
            ticksHtml += `<div style=\"position:absolute;left:${left}%;bottom:0;transform:translateX(-50%);width:1px;height:8px;background:#555;\"></div>`;
        }
        scaleInner.innerHTML = ticksHtml;
    };
    if (scale && scaleInner && firstTimeline) {
        updateScale();
        // Update on resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(updateScale, 100);
        });
    }

    // Lightweight drag: allow moving the marker within its bar window (visual only)
    const rows = content.querySelectorAll('.row');
    rows.forEach(row => {
        const timeline = row.querySelector('.timeline');
        const marker = row.querySelector('.marker');
        const markerLabel = row.querySelector('.marker-date');
        if (!timeline || !marker || !markerLabel) return;
        let dragging = false;
        let startX = 0;

        const onMouseDown = (e) => {
            dragging = true;
            startX = e.clientX;
            marker.style.cursor = 'grabbing';
            e.preventDefault();
        };
        const onMouseMove = (e) => {
            if (!dragging) return;
            const rect = timeline.getBoundingClientRect();
            const windowStart = Number(marker.dataset.windowStart);
            const windowEnd = Number(marker.dataset.windowEnd);
            const lenMs = Number(marker.dataset.lenMs) || 0;
            const latestStart = Math.max(windowStart, windowEnd - lenMs);
            const pctToMs = (pct) => (pct / 100) * (rangeEnd.getTime() - rangeStart.getTime());
            const msToPct = (ms) => (ms / (rangeEnd.getTime() - rangeStart.getTime())) * 100;
            let px = Math.min(rect.right, Math.max(rect.left, e.clientX));
            const pct = ((px - rect.left) / rect.width) * 100;
            // Convert to absolute start time and clamp to window
            let startMs = rangeStart.getTime() + pctToMs(pct);
            startMs = Math.max(windowStart, Math.min(latestStart, startMs));
            const leftPct = msToPct(startMs - rangeStart.getTime());
            const widthPct = msToPct(lenMs);
            marker.style.left = leftPct + '%';
            markerLabel.style.left = leftPct + '%';
            marker.style.width = widthPct + '%';
            markerLabel.style.width = widthPct + '%';
        };
        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            marker.style.cursor = 'grab';
        };
        marker.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });
}; 