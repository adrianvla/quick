import { getToDoTasks, setToDoTasks } from '../storage/storage.js';
import { calculatePERTSchedule } from '../logic/pert.js';

// Lightweight relative formatter similar to Graph view
function formatRelative(ms) {
	const past = ms < 0;
	ms = Math.abs(ms);
	const s = Math.floor(ms / 1000);
	let r = s;
	const d = Math.floor(r / 86400); r %= 86400;
	const h = Math.floor(r / 3600); r %= 3600;
	const m = Math.floor(r / 60); r %= 60;
	const parts = [];
	if (d) parts.push(`${d}d`);
	if (h || parts.length) parts.push(`${h}h`);
	if (m || parts.length) parts.push(`${m}m`);
	if (parts.length < 2) parts.push(`${r}s`);
	const text = parts.slice(0, 3).join(' ');
	return past ? `${text} ago` : `in ${text}`;
}

function parseDue(value) {
	if (value == null) return NaN;
	if (typeof value === 'number') return value;
	const t = Date.parse(value);
	return Number.isFinite(t) ? t : NaN;
}

export const showImmediateToDo = () => {
	const content = document.querySelector('.content');
	// If rerendering, clear previous timer
	if (content && content.dataset && content.dataset.immediateTimer) {
		try { clearInterval(Number(content.dataset.immediateTimer)); } catch(_) {}
		delete content.dataset.immediateTimer;
	}
	const todolist = getToDoTasks();
	// Flatten and skip completed tasks
	const tasks = [];
	const idByName = {};
	const catById = {};
	todolist.forEach(cat => {
		cat.tasks.forEach(t => {
			idByName[t.name] = t.id;
			catById[t.id] = cat.name;
			if (cat.name === 'Done') return; // don't list finished
			tasks.push({
				id: t.id,
				name: t.name,
				description: t.description || '',
				category: cat.name,
				color: cat.color || 'grey',
				requirements: Array.isArray(t.requirements) ? t.requirements.slice() : [],
				dueMs: parseDue(t.dueDate)
			});
		});
	});

	if (!tasks.length) {
		content.innerHTML = '<div class="title"><h1>Immediate To‑Do</h1></div><div class="text">No pending tasks.</div>';
		return;
	}

	// Baseline to align with other views
	const baselineKey = 'pertBaselineTs';
	let baselineNow = Number(localStorage.getItem(baselineKey));
	if (!baselineNow || !Number.isFinite(baselineNow)) {
		baselineNow = Date.now();
		localStorage.setItem(baselineKey, String(baselineNow));
	}
	const scheduleById = calculatePERTSchedule(todolist, { now: baselineNow });

	// Build graph on ids using requirement names
	const preds = {}; // id -> [predIds]
	const succ = {}; // id -> [succIds]
	const indeg = {}; // id -> number
	tasks.forEach(t => { preds[t.id] = []; succ[t.id] = []; indeg[t.id] = 0; });
	tasks.forEach(t => {
		(t.requirements || []).forEach(rn => {
			const rid = idByName[(rn || '').trim()];
			if (!rid) return;
			// if the requirement is already Done, treat as satisfied and do not add edge
			if (catById[rid] === 'Done') return;
			// Only edge if the predecessor also exists in the pending set
			if (!(rid in indeg)) return;
			preds[t.id].push(rid);
			succ[rid].push(t.id);
			indeg[t.id]++;
		});
	});

	// Build quick lookup for task data
	const taskById = {}; tasks.forEach(t => taskById[t.id] = t);

	// Priority Kahn: order by earliest deadline (user due -> PERT minFinish -> PERT maxFinish)
	const getDeadlineMs = (id) => {
		const t = taskById[id];
		if (t && Number.isFinite(t.dueMs)) return t.dueMs;
		const s = scheduleById[id] || {};
		const mf = s.minFinishDate ? Date.parse(s.minFinishDate) : NaN;
		const xf = s.maxFinishDate ? Date.parse(s.maxFinishDate) : NaN;
		if (Number.isFinite(mf)) return mf;
		if (Number.isFinite(xf)) return xf;
		return Number.POSITIVE_INFINITY;
	};
	const getStartDays = (id) => scheduleById[id]?.minStartDays ?? 0; // tiebreaker
	const q = Object.keys(indeg).filter(id => indeg[id] === 0);
	q.sort((a,b) => getDeadlineMs(a) - getDeadlineMs(b) || getStartDays(a) - getStartDays(b) || a.localeCompare(b));
	const order = [];
	while (q.length) {
		const u = q.shift();
		order.push(u);
		(succ[u] || []).forEach(v => {
			indeg[v]--;
			if (indeg[v] === 0) {
				// insert keeping queue sorted by deadline
				q.push(v);
				q.sort((a,b) => getDeadlineMs(a) - getDeadlineMs(b) || getStartDays(a) - getStartDays(b) || a.localeCompare(b));
			}
		});
	}
	// Add any leftover (cycles/unmapped) at the end
	Object.keys(indeg).forEach(id => { if (!order.includes(id)) order.push(id); });

	// taskById already built above

	// Build rows
	let html = '';
	html += '<div class="title"><h1>Immediate To‑Do</h1></div>';
	html += '<div class="text">Execute from top to bottom. Due dates live‑update.</div>';
	html += '<div class="immediate" style="display:flex;flex-direction:column;gap:8px;">';
	order.forEach((id, idx) => {
		const t = taskById[id];
		if (!t) return;
		const s = scheduleById[id] || {};
		const minStart = s.minStartDate ? new Date(s.minStartDate) : null;
		const minFinish = s.minFinishDate ? new Date(s.minFinishDate) : null;
		const windowText = (minStart && minFinish)
			? `${minStart.toLocaleString()} → ${minFinish.toLocaleString()}`
			: '';
		const dueAttr = Number.isFinite(t.dueMs) ? `data-due="${t.dueMs}"` : '';
		const dueText = Number.isFinite(t.dueMs) ? formatRelative(t.dueMs - Date.now()) : '-';
		html += `
		<div class="row" style="display:flex;align-items:center;gap:12px;padding:10px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:rgba(255,255,255,0.03);">
			<div class="badge" style="width:28px;height:28px;border-radius:50%;background:var(--${t.color});box-shadow:0 0 0 2px rgba(0,0,0,0.2);"></div>
			<div style="flex:1;display:flex;flex-direction:column;gap:2px;">
				<div style="display:flex;align-items:center;gap:8px;">
					<b>${idx + 1}. ${t.name}</b>
					<span class="small-pill" style="background:var(--${t.color});box-shadow:0 0 0 2px rgba(0,0,0,0.2);font-size:0.75em">${t.category}</span>
				</div>
				<small style="opacity:0.8;">Window: ${windowText}</small>
			</div>
			<div class="due" ${dueAttr} style="min-width:160px;text-align:right;font-weight:600;">${dueText}</div>
			<button class="complete-btn" data-id="${id}" title="Mark as Done" style="margin-left:10px;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;">Complete</button>
		</div>`;
	});
	html += '</div>';
	content.innerHTML = html;

	// Live update due every second; red if < 60s
	const updateDue = () => {
		const nodes = content.querySelectorAll('.immediate .due');
		const now = Date.now();
		nodes.forEach(el => {
			const dueStr = el.getAttribute('data-due');
			if (!dueStr) { el.textContent = '-'; el.style.color = ''; return; }
			const due = Number(dueStr);
			const diff = due - now;
			el.textContent = formatRelative(diff);
			el.style.color = diff <= 60000*5 ? '#f00' : '';
		});
	};
	updateDue();
	// Save interval id so switching views can clear it if needed
	let timer = setInterval(updateDue, 1000);
	if (content && content.dataset) content.dataset.immediateTimer = String(timer);
	// Clean up when content is replaced (best effort)
	const obs = new MutationObserver(() => {
		if (!document.body.contains(content)) { clearInterval(timer); obs.disconnect(); }
	});
	obs.observe(document.body, { childList: true, subtree: true });

	// Complete button: move task to Done and rerender
	const onCompleteClick = (e) => {
		const btn = e.target.closest('.complete-btn');
		if (!btn) return;
		const tid = btn.getAttribute('data-id');
		if (!tid) return;
		const lists = getToDoTasks();
		let fromCat = -1, idxInCat = -1, doneIdx = -1, task = null;
		for (let i = 0; i < lists.length; i++) {
			if (lists[i].name === 'Done') doneIdx = i;
			const j = lists[i].tasks.findIndex(t => String(t.id) === String(tid));
			if (j !== -1) { fromCat = i; idxInCat = j; task = lists[i].tasks[j]; }
		}
		if (!task) return;
		if (doneIdx === -1) { lists.push({ name: 'Done', tasks: [], color: 'green' }); doneIdx = lists.length - 1; }
		// Remove and insert
		lists[fromCat].tasks.splice(idxInCat, 1);
		if (!lists[doneIdx].tasks.find(t => String(t.id) === String(tid))) lists[doneIdx].tasks.push(task);
		setToDoTasks(lists);
		try { clearInterval(timer); } catch(_) {}
		if (content && content.dataset) delete content.dataset.immediateTimer;
		showImmediateToDo();
	};
	content.addEventListener('click', onCompleteClick);
};