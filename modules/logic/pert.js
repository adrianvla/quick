// Basic PERT calculator.
// For each task, we assume the current `length` (in ms) is the Most Likely time (m).
// We derive optimistic (a) and pessimistic (b) via simple heuristics unless provided.
// Expected time te = (a + 4m + b) / 6
// Standard deviation sd = (b - a) / 6
export const calculatePERT = (todolist, opts = {}) => {
	const DAY = 24 * 60 * 60 * 1000;
	const aFactor = typeof opts.aFactor === 'number' ? opts.aFactor : 0.75; // a = m * aFactor
	const bFactor = typeof opts.bFactor === 'number' ? opts.bFactor : 1.25; // b = m * bFactor
	const defaultMDays = typeof opts.defaultMDays === 'number' ? Math.max(0.25, opts.defaultMDays) : 1; // sensible fallback for tasks with no length
	const minSpanDays = typeof opts.minSpanDays === 'number' ? Math.max(0, opts.minSpanDays) : 0.25; // ensure b >= a by at least this

	// Build task list and return a map by task.id
	const result = {};
	todolist.forEach(category => {
		category.tasks.forEach(task => {
			const mRaw = (task.length || 0) / DAY;
			const mDays = mRaw > 0 ? mRaw : defaultMDays;
			let aDays = Math.max(0, (task.optimisticDays ?? (mDays * aFactor)));
			let bDays = Math.max(aDays, (task.pessimisticDays ?? (mDays * bFactor)));
			if (bDays - aDays < minSpanDays) bDays = aDays + minSpanDays;
			const teDays = (aDays + 4 * mDays + bDays) / 6;
			const sdDays = Math.abs(bDays - aDays) / 6;
			result[task.id] = {
				a: aDays,
				m: mDays,
				b: bDays,
				te: teDays,
				sd: sdDays
			};
		});
	});
	return result;
};

// Compute schedule windows (in days from now and dates) using PERT a/b and dependencies.
// For each task: minDays = max over predecessors(minDays[pred]) + a(task)
//                maxDays = max over predecessors(maxDays[pred]) + b(task)
// Returns map taskId -> { minDays, maxDays, minDate, maxDate }
export const calculatePERTSchedule = (todolist, opts = {}) => {
	const DAY = 24 * 60 * 60 * 1000;
	const now = (opts && typeof opts.now === 'number') ? opts.now : Date.now();
	const pert = calculatePERT(todolist, opts);

	// Build mapping and graph (using task names in requirements)
	const idByName = {};
	const tasks = [];
	todolist.forEach(cat => cat.tasks.forEach(t => { idByName[t.name] = t.id; tasks.push(t); }));
	const preds = {};
	const indegree = {};
	tasks.forEach(t => { preds[t.id] = []; indegree[t.id] = 0; });
	tasks.forEach(t => {
		if (Array.isArray(t.requirements)) {
			t.requirements.forEach(rn => {
				const rid = idByName[(rn || '').trim()];
				if (!rid) return;
				preds[t.id].push(rid);
				indegree[t.id]++;
			});
		}
	});

	// Topological order
	const q = [];
	tasks.forEach(t => { if (indegree[t.id] === 0) q.push(t.id); });
	const topo = [];
	while (q.length) {
		const u = q.shift();
		topo.push(u);
		// Decrease indegree of dependents (we don't store, so recompute simple)
		tasks.forEach(t => {
			if (preds[t.id].includes(u)) {
				indegree[t.id]--;
				if (indegree[t.id] === 0) q.push(t.id);
			}
		});
	}
	// Fallback in case of cycles
	if (topo.length < tasks.length) tasks.forEach(t => { if (!topo.includes(t.id)) topo.push(t.id); });

	// Forward pass computing both earliest start/finish (optimistic) and
	// pessimistic start/finish using a/b durations. Naming:
	//   minStartDays/minFinishDays use 'a' durations
	//   maxStartDays/maxFinishDays use 'b' durations
	const minStartDays = {}; const minFinishDays = {};
	const maxStartDays = {}; const maxFinishDays = {};

	topo.forEach(id => {
		const p = pert[id] || { a: 0, b: 0 };
		// Earliest start is the max of predecessors' earliest finishes (a-based)
		const es = preds[id].length ? Math.max(...preds[id].map(pid => minFinishDays[pid] || 0)) : 0;
		const ef = es + (p.a || 0);
		minStartDays[id] = es;
		minFinishDays[id] = ef;
		// Pessimistic window propagated similarly with b durations
		const ls = preds[id].length ? Math.max(...preds[id].map(pid => maxFinishDays[pid] || 0)) : 0;
		const lf = ls + (p.b || 0);
		maxStartDays[id] = ls;
		maxFinishDays[id] = lf;
	});

	const out = {};
	tasks.forEach(t => {
		const minStartD = minStartDays[t.id] ?? 0;
		const minFinishD = minFinishDays[t.id] ?? minStartD;
		const maxStartD = maxStartDays[t.id] ?? minStartD;
		const maxFinishD = maxFinishDays[t.id] ?? minFinishD;
		out[t.id] = {
			// Back-compat (previously these represented earliest finish/latest finish)
			minDays: minFinishD,
			maxDays: maxFinishD,
			minDate: new Date(now + minFinishD * DAY).toISOString(),
			maxDate: new Date(now + maxFinishD * DAY).toISOString(),
			// New explicit fields
			minStartDays: minStartD,
			minFinishDays: minFinishD,
			maxStartDays: maxStartD,
			maxFinishDays: maxFinishD,
			minStartDate: new Date(now + minStartD * DAY).toISOString(),
			minFinishDate: new Date(now + minFinishD * DAY).toISOString(),
			maxStartDate: new Date(now + maxStartD * DAY).toISOString(),
			maxFinishDate: new Date(now + maxFinishD * DAY).toISOString()
		};
	});
	return out;
};
