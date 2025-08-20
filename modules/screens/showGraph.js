import { getToDoTasks, setToDoTasks } from '../storage/storage.js';
import { calculatePERT, calculatePERTSchedule } from '../logic/pert.js';
import {DAY} from "./showToDo.js";

export const showGraph = () => {
    // Hide main content, show graph
    document.querySelector('.content').innerHTML = '<div class="page-title"><h1>Graph View</h1><div class="change-date-format"><span>Change to Relative/Absolute Date</span>\n' +
        '<div class="checkbox-wrapper-22">\n' +
        '<label class="switch" for="changeDateFormat">\n' +
        '<input type="checkbox" id="changeDateFormat" />\n' +
        '<div class="slider round"></div>\n' +
        '</label>\n' +
        '</div></div></div><div id="drawflow" style="width:100%;display:none;"></div>';
    const graphContainer = document.getElementById('drawflow');
    graphContainer.style.display = 'block';
    // Ensure container has height so Drawflow's SVG can render
    graphContainer.innerHTML = '';

    // Initialize DrawFlow
    const editor = new window.Drawflow(graphContainer);
    editor.reroute = true;
    editor.start();

    // Mouse wheel zoom support
    const onWheelZoom = (e) => {
        e.preventDefault();
        try {
            if (e.deltaY < 0) editor.zoom_in();
            else editor.zoom_out();
        } catch (_) {}
    };
    graphContainer.addEventListener('wheel', onWheelZoom, { passive: false });

    // Date formatting: toggle absolute/relative via checkbox
    const dateToggle = document.getElementById('changeDateFormat');
    const formatAbsolute = (date) => {
        if (!date) return '-';
        return date.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };
    const formatRelative = (date) => {
        if (!date) return '-';
        const now = Date.now();
        let delta = Math.floor((date.getTime() - now) / 1000); // seconds
        const past = delta < 0;
        delta = Math.abs(delta);
        const days = Math.floor(delta / 86400); delta %= 86400;
        const hours = Math.floor(delta / 3600); delta %= 3600;
        const minutes = Math.floor(delta / 60); const seconds = delta % 60;
        const parts = [];
        if (days) parts.push(`${days}d`);
        if (hours || parts.length) parts.push(`${hours}h`);
        if (minutes || parts.length) parts.push(`${minutes}m`);
        if (parts.length < 2) parts.push(`${seconds}s`);
        const text = parts.slice(0, 3).join(' ');
        return past ? `${text} ago` : `in ${text}`;
    };
    const formatDateByMode = (date) => (dateToggle?.checked ? formatAbsolute(date) : formatRelative(date));
    const refreshDueText = () => {
        const nodes = graphContainer.querySelectorAll('.pert');
        nodes.forEach(container => {
            const minEl = container.querySelector('.due-min');
            const maxEl = container.querySelector('.due-max');
            const usrEl = container.querySelector('.due-user');
            if (minEl && minEl.dataset.iso) {
                const d = new Date(minEl.dataset.iso);
                if (!isNaN(d)) minEl.textContent = formatDateByMode(d);
            }
            if (maxEl && maxEl.dataset.iso) {
                const d = new Date(maxEl.dataset.iso);
                if (!isNaN(d)) maxEl.textContent = formatDateByMode(d);
            }
            if (usrEl && usrEl.dataset.iso) {
                const d = new Date(usrEl.dataset.iso);
                if (!isNaN(d)) usrEl.textContent = formatDateByMode(d);
            }
        });
    };
    if (dateToggle) dateToggle.addEventListener('change', refreshDueText);

    // Gather all tasks
    const todolist = getToDoTasks();
    const allTasks = [];
    todolist.forEach(category => {
        category.tasks.forEach(task => {
            allTasks.push(task);
        });
    });

    // Build a DAG layout (layers by dependency depth) to avoid overlapping edges
    const taskById = {};
    const idByName = {};
    const taskIdToColor = {};
    const taskIdToCategory = {};
    const taskIdToLength = {};
    const taskIdToDue = {};
    allTasks.forEach(t => { taskById[t.id] = t; idByName[t.name] = t.id; });
    // Map task id -> category color
    todolist.forEach(cat => {
        cat.tasks.forEach(t => {
            taskIdToColor[t.id] = cat.color || 'grey';
            taskIdToCategory[t.id] = cat.name;
            taskIdToLength[t.id] = t.length;
            taskIdToDue[t.id] = t.dueDate; // may be ms or ISO string
        });
    });

    // Compute PERT metrics per task
    const pertById = calculatePERT(todolist);
    const scheduleById = calculatePERTSchedule(todolist);

    // Build edges: req -> task (i.e., dependency -> dependent)
    const edges = {};
    const indegree = {};
    allTasks.forEach(t => { edges[t.id] = []; indegree[t.id] = 0; });
    allTasks.forEach(task => {
        if (Array.isArray(task.requirements)) {
            task.requirements.forEach(reqNameRaw => {
                const reqName = (reqNameRaw || '').trim();
                if (!reqName) return;
                const reqId = idByName[reqName];
                if (!reqId) return; // unknown requirement, skip
                edges[reqId].push(task.id);
                indegree[task.id]++;
            });
        }
    });

    // Kahn's algorithm to get topological order and levels (longest-path layering)
    const level = {};
    allTasks.forEach(t => { level[t.id] = 0; });
    const queue = [];
    allTasks.forEach(t => { if (indegree[t.id] === 0) queue.push(t.id); });
    const topo = [];
    while (queue.length) {
        const u = queue.shift();
        topo.push(u);
        edges[u].forEach(v => {
            // assign level as longest distance from roots
            level[v] = Math.max(level[v] || 0, (level[u] || 0) + 1);
            indegree[v]--;
            if (indegree[v] === 0) queue.push(v);
        });
    }
    // Handle potential cycles by appending remaining nodes
    if (topo.length < allTasks.length) {
        allTasks.forEach(t => { if (!topo.includes(t.id)) topo.push(t.id); });
    }

    // Group nodes by layer
    const layers = {};
    topo.forEach(id => {
        const l = level[id] || 0;
        if (!layers[l]) layers[l] = [];
        layers[l].push(id);
    });

    // Compute positions
    const H_SPACING = 280;
    const V_SPACING = 180;
    const MARGIN_X = 100;
    const MARGIN_Y = 80;
    const positions = {};
    Object.keys(layers).sort((a,b) => Number(a) - Number(b)).forEach(lStr => {
        const l = Number(lStr);
        const ids = layers[l];
        ids.forEach((id, idx) => {
            positions[id] = {
                x: MARGIN_X + l * H_SPACING,
                y: MARGIN_Y + idx * V_SPACING
            };
        });
    });
    // Post-process positions to avoid nodes lying on connection lines and enforce per-column spacing
    const NODE_CLEARANCE = 48; // min distance from any edge
    const MIN_ROW_SPACING = 120; // vertical spacing between nodes in same column
    const MAX_LAYOUT_ITERS = 6;

    const idsAll = topo.slice();

    function closestPointOnSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx*dx + dy*dy;
        if (len2 === 0) return { x: x1, y: y1, t: 0 };
        let t = ((px - x1) * dx + (py - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        return { x: x1 + t * dx, y: y1 + t * dy, t };
    }

    for (let iter = 0; iter < MAX_LAYOUT_ITERS; iter++) {
        let moved = false;
        // Push nodes away from edges
        idsAll.forEach(wId => {
            const pw = positions[wId];
            if (!pw) return;
            let shiftY = 0;
            Object.keys(edges).forEach(uId => {
                edges[uId].forEach(vId => {
                    if (wId === uId || wId === vId) return;
                    const pu = positions[uId];
                    const pv = positions[vId];
                    if (!pu || !pv) return;
                    const cp = closestPointOnSegment(pw.x, pw.y, pu.x, pu.y, pv.x, pv.y);
                    const dx = pw.x - cp.x; const dy = pw.y - cp.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < NODE_CLEARANCE) {
                        const away = Math.sign(pw.y - cp.y) || 1; // push up or down
                        shiftY += away * (NODE_CLEARANCE - dist);
                    }
                });
            });
            if (shiftY !== 0) {
                pw.y += shiftY;
                moved = true;
            }
        });

        // Enforce vertical separation per column (same x)
        const columns = {};
        idsAll.forEach(id => {
            const p = positions[id];
            if (!p) return;
            const key = String(p.x);
            if (!columns[key]) columns[key] = [];
            columns[key].push(id);
        });
        Object.values(columns).forEach(colIds => {
            colIds.sort((a,b) => positions[a].y - positions[b].y);
            for (let i = 1; i < colIds.length; i++) {
                const prev = positions[colIds[i-1]];
                const cur = positions[colIds[i]];
                const needed = prev.y + MIN_ROW_SPACING;
                if (cur.y < needed) {
                    cur.y = needed;
                    moved = true;
                }
            }
        });

        if (!moved) break;
    }

    // Resize container height to fit final positions vertically

    // Add nodes for each task
    let isBootstrapping = true; // prevent event handlers from firing during initial wiring
    const nodeIdMap = {}; // task.id -> nodeId
    const nodeIdToTaskId = {}; // nodeId -> task.id
    allTasks.forEach((task, idx) => {
        // Ensure enough input sockets for the number of requirements this task has
        const reqCount = Array.isArray(task.requirements)
            ? task.requirements.filter(r => typeof r === 'string' && r.trim()).length
            : 0;
        const inputCount = Math.max(1, reqCount);
        const pos = positions[task.id] || {
            x: 100 + (idx % 5) * 250,
            y: 80 + Math.floor(idx / 5) * 180
        };
                const color = taskIdToColor[task.id] || 'grey';
                const p = pertById[task.id];
                const s = scheduleById[task.id];
                const fmt = (n) => (n ?? 0).toFixed(1);
                const parseDate = (val) => {
                    if (!val && val !== 0) return null;
                    if (typeof val === 'number') return new Date(val);
                    if (typeof val === 'string') {
                        const d = new Date(val);
                        return isNaN(d) ? null : d;
                    }
                    return null;
                };
                const minDueDate = s?.minDate ? new Date(s.minDate) : null;
                const maxDueDate = s?.maxDate ? new Date(s.maxDate) : null;
                const userDueDate = parseDate(taskIdToDue[task.id]);
                const userDueLate = userDueDate && minDueDate && (minDueDate.getTime() > userDueDate.getTime());
                const isDone = taskIdToCategory[task.id] === 'Done';
                const detailsHtml = isDone
                    ? `<div class="done-summary" style="margin-top:6px;font-size:10px;opacity:0.85;display:flex;align-items:center;gap:6px;">
                           
                           <span>Completed</span>
                       </div>`
                    : `<div style=\"margin-top:6px;font-size:10px;opacity:0.85;display:flex;flex-direction:column;gap:2px;\" class=\"pert\">\n                                                <span title=\"Assigned\">User Assigned Length: <b>${fmt(taskIdToLength[task.id]/DAY)}d</b></span>\n                                                <span title=\"Optimistic\">Min required: <b>${fmt(p?.a)}d</b></span>\n                                                <span title=\"Pessimistic\">Max time alowed: <b>${fmt(p?.b)}d</b></span>\n                                                <span title=\"User assigned due\">User Due: <b class=\"due-user\" data-iso=\"${userDueDate ? userDueDate.toISOString() : ''}\" style=\"color:${userDueLate ? '#f00' : 'inherit'}\">${formatDateByMode(userDueDate)}</b></span>\n                                                <span title=\"Earliest completion from now\">Min Due: <b class=\"due-min\" data-iso=\"${minDueDate ? minDueDate.toISOString() : ''}\">${formatDateByMode(minDueDate)}</b></span>\n                                                <span title=\"Latest completion from now\">Max Due: <b class=\"due-max\" data-iso=\"${maxDueDate ? maxDueDate.toISOString() : ''}\">${formatDateByMode(maxDueDate)}</b></span>\n                                            </div>`;
                const nodeId = editor.addNode(
            'task',
            inputCount, // inputs
            1, // outputs
            pos.x, // x
            pos.y, // y
            'task',
            { taskId: task.id, taskName: task.name },
                                `<div style="display:flex;align-items:flex-start;white-space:nowrap;flex-direction: column">
                                        <div class="task-content">
                                            <div class="task-title"><span>${task.name}</span><span style="display:inline-block;background:var(--${color});box-shadow:0 0 0 2px rgba(0,0,0,0.2);" class="small-pill">${taskIdToCategory[task.id]}</span></div>
                                            <small>${task.description || ''}</small>
                                            ${detailsHtml}
                                        </div>
                                        
                                </div>`
        );
        nodeIdMap[task.id] = nodeId;
                nodeIdToTaskId[nodeId] = task.id;
    });

    // Add connections for requirements
    const nextInputIndex = {}; // task.id -> next input socket index to use (1-based)
    allTasks.forEach(task => {
        if (Array.isArray(task.requirements)) {
            task.requirements.forEach(reqNameRaw => {
                const reqName = reqNameRaw.trim();
                if (!reqName) return;
                const requiredTask = allTasks.find(t => t.name === reqName);
                if (!requiredTask) {
                    console.warn(`Requirement '${reqName}' for task '${task.name}' not found in allTasks.`);
                    return;
                }
                if (!nodeIdMap[requiredTask.id] || !nodeIdMap[task.id]) {
                    console.warn(`Node ID missing for connection: ${requiredTask.name} -> ${task.name}`);
                    return;
                }
                // Connect requiredTask (output) to this task (input)
                const inputIdx = (nextInputIndex[task.id] || 1);
                try {
                    editor.addConnection(
                        nodeIdMap[requiredTask.id],
                        nodeIdMap[task.id],
                        'output_1',
                        `input_${inputIdx}`
                    );
                } catch (e) {
                    console.warn(`Failed to connect ${requiredTask.name} -> ${task.name} on input_${inputIdx}`, e);
                }
                nextInputIndex[task.id] = inputIdx + 1;
            });
        }
    });
    // Refresh connection positions just in case
    try { editor.updateConnectionNodes && editor.updateConnectionNodes('all'); } catch(_) {}
    isBootstrapping = false;
    // Apply initial date formatting according to toggle
    refreshDueText();

    // Helper to update storage: add or remove a requirement by task id/name
    const addRequirement = (targetTaskId, requiredTaskName) => {
        if (!requiredTaskName) return;
        const lists = todolist; // captured list; mutate and persist
        for (const cat of lists) {
            for (const t of cat.tasks) {
                if (t.id === targetTaskId) {
                    if (!Array.isArray(t.requirements)) t.requirements = [];
                    if (!t.requirements.includes(requiredTaskName)) {
                        t.requirements.push(requiredTaskName);
                        setToDoTasks(lists);
                    }
                    return;
                }
            }
        }
    };
    const removeRequirement = (targetTaskId, requiredTaskName) => {
        if (!requiredTaskName) return;
        const lists = todolist;
        for (const cat of lists) {
            for (const t of cat.tasks) {
                if (t.id === targetTaskId && Array.isArray(t.requirements)) {
                    const idx = t.requirements.indexOf(requiredTaskName);
                    if (idx !== -1) {
                        t.requirements.splice(idx, 1);
                        setToDoTasks(lists);
                    }
                    return;
                }
            }
        }
    };

    // Listen for user-created connections to sync requirements
    editor.on('connectionCreated', (info) => {
        if (isBootstrapping) return;
        try {
            const fromId = Number(info.output_id ?? info.from ?? info.node_out ?? info.node);
            const toId = Number(info.input_id ?? info.to ?? info.node_in);
            if (!fromId || !toId) return;
            const fromNode = editor.getNodeFromId(fromId);
            const toNode = editor.getNodeFromId(toId);
            const requiredName = fromNode?.data?.taskName;
            const targetTaskId = toNode?.data?.taskId;
            if (requiredName && targetTaskId != null) {
                addRequirement(targetTaskId, requiredName);
            }
        } catch (e) {
            console.warn('connectionCreated handler error', e);
        }
    });

    // Listen for connection removal to sync requirements
    editor.on('connectionRemoved', (info) => {
        try {
            const fromId = Number(info.output_id ?? info.from ?? info.node_out ?? info.node);
            const toId = Number(info.input_id ?? info.to ?? info.node_in);
            if (!fromId || !toId) return;
            const fromNode = editor.getNodeFromId(fromId);
            const toNode = editor.getNodeFromId(toId);
            const requiredName = fromNode?.data?.taskName;
            const targetTaskId = toNode?.data?.taskId;
            if (requiredName && targetTaskId != null) {
                removeRequirement(targetTaskId, requiredName);
            }
        } catch (e) {
            console.warn('connectionRemoved handler error', e);
        }
    });

    // Delete underlying task when a node is removed
    editor.on('nodeRemoved', (removedNodeId) => {
        try {
            const taskId = nodeIdToTaskId[removedNodeId];
            if (!taskId) return;
            // Find the task and its name and category
            let removedTaskName = null;
            let foundCatIndex = -1;
            let foundTaskIndex = -1;
            for (let ci = 0; ci < todolist.length; ci++) {
                const cat = todolist[ci];
                const idx = cat.tasks.findIndex(t => t.id === taskId);
                if (idx !== -1) {
                    removedTaskName = cat.tasks[idx].name;
                    foundCatIndex = ci;
                    foundTaskIndex = idx;
                    break;
                }
            }
            if (foundCatIndex === -1) return;
            // Remove the task
            todolist[foundCatIndex].tasks.splice(foundTaskIndex, 1);
            // Clean up references (requirements/blocking) across all tasks
            todolist.forEach(cat => {
                cat.tasks.forEach(t => {
                    if (Array.isArray(t.requirements)) {
                        t.requirements = t.requirements.filter(r => r !== removedTaskName);
                    }
                    if (Array.isArray(t.blocking)) {
                        t.blocking = t.blocking.filter(b => b !== removedTaskName);
                    }
                });
            });
            setToDoTasks(todolist);
        } catch (e) {
            console.warn('nodeRemoved handler error', e);
        }
    });
};