// Basic PERT calculator.
// For each task, we assume the current `length` (in ms) is the Most Likely time (m).
// We derive optimistic (a) and pessimistic (b) via simple heuristics unless provided.
// Expected time te = (a + 4m + b) / 6
// Standard deviation sd = (b - a) / 6
export const calculatePERT = (todolist, opts = {}) => {
	const DAY = 24 * 60 * 60 * 1000;
	const aFactor = typeof opts.aFactor === 'number' ? opts.aFactor : 0.75; // a = m * aFactor
	const bFactor = typeof opts.bFactor === 'number' ? opts.bFactor : 1.25; // b = m * bFactor

	// Build task list and return a map by task.id
	const result = {};
	todolist.forEach(category => {
		category.tasks.forEach(task => {
			const mDays = Math.max(0, (task.length || 0) / DAY);
			const aDays = Math.max(0, (task.optimisticDays ?? (mDays * aFactor)));
			const bDays = Math.max(aDays, (task.pessimisticDays ?? (mDays * bFactor)));
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
	const now = Date.now();
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

	const minDays = {}; const maxDays = {};
	topo.forEach(id => {
		const p = pert[id] || { a: 0, b: 0 };
		const bestPredMin = preds[id].length ? Math.max(...preds[id].map(pid => minDays[pid] || 0)) : 0;
		const bestPredMax = preds[id].length ? Math.max(...preds[id].map(pid => maxDays[pid] || 0)) : 0;
		minDays[id] = bestPredMin + (p.a || 0);
		maxDays[id] = bestPredMax + (p.b || 0);
	});

	const out = {};
	tasks.forEach(t => {
		const minD = minDays[t.id] || 0;
		const maxD = maxDays[t.id] || minD;
		out[t.id] = {
			minDays: minD,
			maxDays: maxD,
			minDate: new Date(now + minD * DAY).toISOString(),
			maxDate: new Date(now + maxD * DAY).toISOString()
		};
	});
	return out;
};
