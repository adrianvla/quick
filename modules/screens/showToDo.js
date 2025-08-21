import $ from '../../lib/jquery.min.js';
import {showScreen} from "./showScreen.js";
import {showModal} from "../misc/modal.js";
import {getToDoTasks, setToDoTasks} from "../storage/storage.js";
import {randomID} from "../misc/utils.js";
export const DAY = 60 * 60 * 24 * 1000;
// --- Projects support (local to this module) ---
// Stored under localStorage key 'toDoProjectsV1' as { activeId, projects: [{ id, name, categories }] }
function loadProjectsState() {
    const raw = localStorage.getItem('toDoProjectsV1');
    if (raw) {
        try { return JSON.parse(raw); } catch(_) { /* fallthrough */ }
    }
    // Initialize from current categories into a Default project
    const current = getToDoTasks();
    const def = { id: randomID(), name: 'Default', categories: current };
    const state = { activeId: def.id, projects: [def] };
    localStorage.setItem('toDoProjectsV1', JSON.stringify(state));
    // Ensure global categories reflect active project
    setToDoTasks(def.categories);
    return state;
}

function saveProjectsState(state) {
    localStorage.setItem('toDoProjectsV1', JSON.stringify(state));
}

function getActiveProject(state) {
    return state.projects.find(p => p.id === state.activeId) || state.projects[0];
}

function syncActiveProjectCategories(categories) {
    const state = loadProjectsState();
    const idx = state.projects.findIndex(p => p.id === state.activeId);
    if (idx !== -1) {
        state.projects[idx].categories = categories;
        saveProjectsState(state);
    }
}

function switchActiveProject(projectId) {
    const state = loadProjectsState();
    const proj = state.projects.find(p => p.id === projectId);
    if (!proj) return;
    state.activeId = projectId;
    saveProjectsState(state);
    // Update global categories so other views use this project's data
    setToDoTasks(proj.categories || []);
}
export const calculateBlocking = (todolist) => {
    todolist.forEach(category => {
        category.tasks.forEach(task => {
            task.blocking = [];
        });
    });
    todolist.forEach(category => {
        category.tasks.forEach(task => {
            task.requirements.forEach(req => {
                let reqTask = todolist.find(c => c.tasks.find(t => t.name === req));
                if(reqTask){
                    reqTask.tasks.find(t => t.name === req).blocking.push(task.name);
                }else{
                    console.error(`Task ${req} is not in the to-do list!`);
                }
            });
        });
    });
};

export const showCategories = () => {
    let todolist = getToDoTasks();
    const doesTaskAlreadyExist = (taskName) => {
        return todolist.find(c => c.tasks.find(t => t.name === taskName));
    }
    $(".categories").html("");
    todolist.forEach((category, idx) => {
        let addBtn = $(`<div class="entry add-new-task">+ Add New Task</div>`);
        const btnstring = `<div class="btns"><div class="btn edit-cat"><svg width="800px" height="800px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g id="Complete"><g id="edit"><g><path d="M20,16v4a2,2,0,0,1-2,2H4a2,2,0,0,1-2-2V6A2,2,0,0,1,4,4H8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><polygon fill="none" points="12.5 15.8 22 6.2 17.8 2 8.3 11.5 8 16 12.5 15.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></g></g></svg></div><div class="btn delete-cat"><svg width="800px" height="800px" viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.96967 16.4697C6.67678 16.7626 6.67678 17.2374 6.96967 17.5303C7.26256 17.8232 7.73744 17.8232 8.03033 17.5303L6.96967 16.4697ZM13.0303 12.5303C13.3232 12.2374 13.3232 11.7626 13.0303 11.4697C12.7374 11.1768 12.2626 11.1768 11.9697 11.4697L13.0303 12.5303ZM11.9697 11.4697C11.6768 11.7626 11.6768 12.2374 11.9697 12.5303C12.2626 12.8232 12.7374 12.8232 13.0303 12.5303L11.9697 11.4697ZM18.0303 7.53033C18.3232 7.23744 18.3232 6.76256 18.0303 6.46967C17.7374 6.17678 17.2626 6.17678 16.9697 6.46967L18.0303 7.53033ZM13.0303 11.4697C12.7374 11.1768 12.2626 11.1768 11.9697 11.4697C11.6768 11.7626 11.6768 12.2374 11.9697 12.5303L13.0303 11.4697ZM16.9697 17.5303C17.2626 17.8232 17.7374 17.8232 18.0303 17.5303C18.3232 17.2374 18.3232 16.7626 18.0303 16.4697L16.9697 17.5303ZM11.9697 12.5303C12.2626 12.8232 12.7374 12.8232 13.0303 12.5303C13.3232 12.2374 13.3232 11.7626 13.0303 11.4697L11.9697 12.5303ZM8.03033 6.46967C7.73744 6.17678 7.26256 6.17678 6.96967 6.46967C6.67678 6.76256 6.67678 7.23744 6.96967 7.53033L8.03033 6.46967ZM8.03033 17.5303L13.0303 12.5303L11.9697 11.4697L6.96967 16.4697L8.03033 17.5303ZM13.0303 12.5303L18.0303 7.53033L16.9697 6.46967L11.9697 11.4697L13.0303 12.5303ZM11.9697 12.5303L16.9697 17.5303L18.0303 16.4697L13.0303 11.4697L11.9697 12.5303ZM13.0303 11.4697L8.03033 6.46967L6.96967 7.53033L11.9697 12.5303L13.0303 11.4697Z" fill="currentColor"/></svg></div></div>`;
        let o = $(`<div class="category" data-cat-index="${idx}" id="category-${idx}" style="--color:var(--${category.color});--color-dark:var(--${category.color}2)">
<div class="cat-title-c" data-cat-index="${idx}">
            <span class="cat-title">${category.name}</span>
            ${category.name !== "Done" ? btnstring : "" }
</div>
        </div>`);
        $(".categories").append(o);

        // Make category header draggable to reorder categories
        const headerEl = o[0].querySelector('.cat-title-c');
        if (headerEl) {
            headerEl.setAttribute('draggable', 'true');
            headerEl.addEventListener('dragstart', (ev) => {
                try {
                    ev.dataTransfer.effectAllowed = 'move';
                    // Use a distinct payload to avoid colliding with task DnD
                    ev.dataTransfer.setData('text/plain', `cat-${idx}`);
                } catch(_) {}
            });
            headerEl.addEventListener('dragover', (ev) => {
                // Allow dropping on headers to reorder
                ev.preventDefault();
                try { ev.dataTransfer.dropEffect = 'move'; } catch(_) {}
            });
            headerEl.addEventListener('drop', (ev) => {
                ev.preventDefault();
                // Stop task-drop handler on the container
                ev.stopPropagation();
                const payload = (ev.dataTransfer && (ev.dataTransfer.getData('text/plain') || ev.dataTransfer.getData('text'))) || '';
                if (!payload || !payload.startsWith('cat-')) return; // ignore non-category drags
                const fromIdx = parseInt(payload.split('-')[1], 10);
                if (!Number.isFinite(fromIdx)) return;
                // Determine insert position relative to this header (before/after)
                const rect = headerEl.getBoundingClientRect();
                const before = ev.clientY < (rect.top + rect.height / 2);
                let toIdx = idx + (before ? 0 : 1);
                // Adjust target index if removing from before shifts indices
                let list = todolist.slice();
                const [moved] = list.splice(fromIdx, 1);
                if (!moved) return;
                if (fromIdx < toIdx) toIdx -= 1;
                toIdx = Math.max(0, Math.min(list.length, toIdx));
                list.splice(toIdx, 0, moved);
                setToDoTasks(list);
                // Re-render with new order
                showCategories();
            });
        }

        o[0].querySelector(".btn.delete-cat")?.addEventListener("click", async () => {
            let index = todolist.findIndex(c => c.name === category.name);
            if(index === -1) return;
            //if category is not empty, show error
            if(category.tasks.length > 0){
                await showModal("Delete Category","To make sure you really want to delete this category, remove all tasks from this category.","Ok");
                return;
            }
            todolist.splice(index, 1);
            setToDoTasks(todolist);
            showCategories();
        });
        o[0].querySelector(".btn.edit-cat")?.addEventListener("click", async () => {
            let res = await showModal("Edit Category","","Done",[{name:"Category Name", value:category.name},{name:"Color", options:["green","blue","red","yellow","grey"]}]);
            category.name = res["Category Name"].trim();
            category.color = res["Color"].trim();
            setToDoTasks(todolist);
            showCategories();
        });

        addBtn.on("click", async () => {
            let blockingOptions = [];
            todolist.forEach(c => {
                c.tasks.forEach(task => {
                    blockingOptions.push({
                        name: task.name,
                        value: task.id
                    });
                });
            });

            let res = await showModal("Create new Task","A task is a single item that needs to be completed.","Create",["Task Name","Description",{name:"Due Date", type:"date"},"Length in Days",{name:"Requirements", autocomplete:blockingOptions}]);
            let taskName = res["Task Name"].trim();
            let requirements = res["Requirements"].split(",").filter(s => s.trim() !== "");
            requirements.forEach(req => {
                let reqTask = todolist.find(c => c.tasks.find(t => t.name === req));
                if(reqTask){
                    reqTask.tasks.find(t => t.name === req).blocking.push(taskName);
                }else{
                    console.error(`Task ${req} is not in the to-do list!`);
                }
            });
            //check if taskName already exists
            if(doesTaskAlreadyExist(taskName))
                do{
                    taskName += `'`;
                }while(doesTaskAlreadyExist(taskName))

            category.tasks.push({
                name: taskName,
                description: res["Description"].trim(),
                id: randomID(),
                dueDate: res["Due Date"] || "",
                requirements,
                blocking : [],
                length: parseFloat(res["Length in Days"])*DAY || 0,
            });
            setToDoTasks(todolist);
            showCategories();
        });
        category.tasks.forEach(task => {
            let el = $(`<div class="entry" data-task="${task.name}" draggable="true" id="task-${task.id}">
<div class="btn delete-task"><svg width="800px" height="800px" viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.96967 16.4697C6.67678 16.7626 6.67678 17.2374 6.96967 17.5303C7.26256 17.8232 7.73744 17.8232 8.03033 17.5303L6.96967 16.4697ZM13.0303 12.5303C13.3232 12.2374 13.3232 11.7626 13.0303 11.4697C12.7374 11.1768 12.2626 11.1768 11.9697 11.4697L13.0303 12.5303ZM11.9697 11.4697C11.6768 11.7626 11.6768 12.2374 11.9697 12.5303C12.2626 12.8232 12.7374 12.8232 13.0303 12.5303L11.9697 11.4697ZM18.0303 7.53033C18.3232 7.23744 18.3232 6.76256 18.0303 6.46967C17.7374 6.17678 17.2626 6.17678 16.9697 6.46967L18.0303 7.53033ZM13.0303 11.4697C12.7374 11.1768 12.2626 11.1768 11.9697 11.4697C11.6768 11.7626 11.6768 12.2374 11.9697 12.5303L13.0303 11.4697ZM16.9697 17.5303C17.2626 17.8232 17.7374 17.8232 18.0303 17.5303C18.3232 17.2374 18.3232 16.7626 18.0303 16.4697L16.9697 17.5303ZM11.9697 12.5303C12.2626 12.8232 12.7374 12.8232 13.0303 12.5303C13.3232 12.2374 13.3232 11.7626 13.0303 11.4697L11.9697 12.5303ZM8.03033 6.46967C7.73744 6.17678 7.26256 6.17678 6.96967 6.46967C6.67678 6.76256 6.67678 7.23744 6.96967 7.53033L8.03033 6.46967ZM8.03033 17.5303L13.0303 12.5303L11.9697 11.4697L6.96967 16.4697L8.03033 17.5303ZM13.0303 12.5303L18.0303 7.53033L16.9697 6.46967L11.9697 11.4697L13.0303 12.5303ZM11.9697 12.5303L16.9697 17.5303L18.0303 16.4697L13.0303 11.4697L11.9697 12.5303ZM13.0303 11.4697L8.03033 6.46967L6.96967 7.53033L11.9697 12.5303L13.0303 11.4697Z" fill="currentColor"/></svg></div>
<div class="btn edit-task"><svg width="800px" height="800px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g id="Complete"><g id="edit"><g><path d="M20,16v4a2,2,0,0,1-2,2H4a2,2,0,0,1-2-2V6A2,2,0,0,1,4,4H8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><polygon fill="none" points="12.5 15.8 22 6.2 17.8 2 8.3 11.5 8 16 12.5 15.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></g></g></svg></div>
<h1>${task.name}</h1>
<p>${task.description}</p>
<p>Requires: ${task.requirements}</p>
</div>`);
            el.on("dragstart", function (e){
                e.originalEvent.dataTransfer.setData("text", e.target.id);
            });
            o.append(el);
            el[0].querySelector(".btn.delete-task").addEventListener("click", () => {
                let index = category.tasks.findIndex(t => t.id === task.id);
                if(index !== -1) category.tasks.splice(index, 1);
                setToDoTasks(todolist);
                syncActiveProjectCategories(todolist);
                showCategories();
            });
            el[0].querySelector(".btn.edit-task").addEventListener("click", async () => {
                // Gather all tasks for requirements autocomplete
                let blockingOptions = [];
                todolist.forEach(c => {
                    c.tasks.forEach(t => {
                        blockingOptions.push({
                            name: t.name,
                            value: t.id
                        });
                    });
                });
                // Show modal with pre-filled values
                let res = await showModal(
                    "Edit Task",
                    "Edit the details of your task.",
                    "Save",
                    [
                        { name: "Task Name", value: task.name },
                        { name: "Description", value: task.description || '' },
                        { name: "Due Date", value: task.dueDate || '', type: "date" },
                        { name: "Length in Days", value: (task.length / DAY).toString(), type: "timelength" },
                        { name: "Requirements", autocomplete: blockingOptions, value: task.requirements.join(",") }
                    ]
                );
                console.log(res);
                let newName = res["Task Name"].trim();
                let newDescription = res["Description"].trim();
                let newLength = parseFloat(res["Length in Days"]) * DAY || 0;
                let newRequirements = res["Requirements"].split(",").map(s => s.trim()).filter(Boolean);
                // Check for name uniqueness (except for this task)
                if (newName !== task.name && todolist.some(c => c.tasks.some(t => t.name === newName))) {
                    let base = newName;
                    do {
                        newName += "'";
                    } while (todolist.some(c => c.tasks.some(t => t.name === newName)));
                }
                // If name changed, update requirements/blocking in all tasks
                if (newName !== task.name) {
                    todolist.forEach(c => {
                        c.tasks.forEach(t => {
                            // Update requirements
                            t.requirements = t.requirements.map(r => r === task.name ? newName : r);
                            // Update blocking
                            t.blocking = t.blocking.map(b => b === task.name ? newName : b);
                        });
                    });
                }
                // Update the task
                task.name = newName;
                task.description = newDescription;
                task.length = newLength;
                task.requirements = newRequirements;
                task.dueDate = res["Due Date"] ? res["Due Date"] : task.dueDate;
                // Recalculate blocking
                todolist.forEach(c => c.tasks.forEach(t => t.blocking = []));
                todolist.forEach(c => {
                    c.tasks.forEach(t => {
                        t.requirements.forEach(req => {
                            let reqTask = todolist.find(cat => cat.tasks.find(tt => tt.name === req));
                            if (reqTask) {
                                reqTask.tasks.find(tt => tt.name === req).blocking.push(t.name);
                            }
                        });
                    });
                });
                setToDoTasks(todolist);
                syncActiveProjectCategories(todolist);
                showCategories();
            });
        });
        o.on("dragover", (e) => {
            e.preventDefault();
        });
        o.on("drop", (e) => {
            e.preventDefault();
            const data = e.originalEvent.dataTransfer.getData("text");
            // If this is a category drag, ignore here (handled on header drop)
            if (typeof data === 'string' && data.startsWith('cat-')) {
                e.stopImmediatePropagation();
                return;
            }
            const taskId = data.split("-")[1];
            // Find the source category and the task
            let sourceCategory = todolist.find(c => c.tasks.some(t => t.id === taskId));
            if (!sourceCategory) return;
            let taskIndex = sourceCategory.tasks.findIndex(t => t.id === taskId);
            if (taskIndex === -1) return;
            let [task] = sourceCategory.tasks.splice(taskIndex, 1);
            // Add the task to the destination category
            category.tasks.push(task);
            setToDoTasks(todolist);
            syncActiveProjectCategories(todolist);
            showCategories();

        });
        o.append(addBtn);
    });
};

export const showToDo = () => {
    showScreen("todo");
    $(".content").html(`
<div class="title"><h1>To-Do List</h1>
    <div class="svg-btn add-new-category"><svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 8C11 7.44772 11.4477 7 12 7C12.5523 7 13 7.44772 13 8V11H16C16.5523 11 17 11.4477 17 12C17 12.5523 16.5523 13 16 13H13V16C13 16.5523 12.5523 17 12 17C11.4477 17 11 16.5523 11 16V13H8C7.44771 13 7 12.5523 7 12C7 11.4477 7.44772 11 8 11H11V8Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12ZM3.00683 12C3.00683 16.9668 7.03321 20.9932 12 20.9932C16.9668 20.9932 20.9932 16.9668 20.9932 12C20.9932 7.03321 16.9668 3.00683 12 3.00683C7.03321 3.00683 3.00683 7.03321 3.00683 12Z" fill="currentColor"/>
    </svg></div></div>
<div class="select-project"><select name="project" class="project-select"></select><button class="pill blue add-project">Add New Project</button><button class="pill rename-project orange" style="margin-left:6px;">Rename</button><button class="pill delete-project red" style="margin-left:6px;">Delete</button></div>
<div class="categories">
</div>
    `);
    // Initialize/load projects and ensure active project's categories are reflected
    const state = loadProjectsState();
    const active = getActiveProject(state);
    if (active && Array.isArray(active.categories)) setToDoTasks(active.categories);
    // Populate selector
    const sel = document.querySelector('.project-select');
    if (sel) {
        sel.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        sel.value = state.activeId;
        sel.addEventListener('change', (e) => {
            const pid = e.target.value;
            // Before switching, persist current categories back to current active project
            try { syncActiveProjectCategories(getToDoTasks()); } catch(_) {}
            switchActiveProject(pid);
            showCategories();
        });
    }
    showCategories();

    $(".add-new-category").on("click", async () => {
        let res = await showModal("Create new Category","A category is a status that your to-do items are going to be assigned to. For example, it may be: Done, In Progress, To-Do,...","Create",["Category Name",{name:"Color", options:["green","blue","red","yellow","grey"]}]);
        let catName = res["Category Name"].trim() || "New Category";
        let todolist = getToDoTasks();
        todolist.push({
            name: catName,
            color: res["Color"],
            tasks: []
        });
        setToDoTasks(todolist);
        syncActiveProjectCategories(todolist);
        showCategories();
    });

    // Add new project
    document.querySelector('.add-project')?.addEventListener('click', async () => {
        const input = await showModal('Create new Project', 'Projects let you keep separate boards.', 'Create', ['Project Name']);
        let name = (input && input['Project Name'] ? String(input['Project Name']).trim() : '') || 'New Project';
        // Minimal default categories
        const defaults = [
            { name: 'Not Started', tasks: [], color: 'grey' },
            { name: 'In Progress', tasks: [], color: 'blue' },
            { name: 'Done', tasks: [], color: 'green' },
        ];
        const state2 = loadProjectsState();
        const proj = { id: randomID(), name, categories: defaults };
        state2.projects.push(proj);
        state2.activeId = proj.id;
        saveProjectsState(state2);
        setToDoTasks(proj.categories);
        // Refresh selector and categories
        const sel2 = document.querySelector('.project-select');
        if (sel2) {
            sel2.innerHTML = state2.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            sel2.value = state2.activeId;
        }
        showCategories();
    });

    // Rename project (current selection)
    document.querySelector('.rename-project')?.addEventListener('click', async () => {
        const sel3 = document.querySelector('.project-select');
        if (!sel3) return;
        const pid = sel3.value;
        const state3 = loadProjectsState();
        const proj = state3.projects.find(p => p.id === pid);
        if (!proj) return;
        const input = await showModal('Rename Project', '', 'Save', [{ name: 'Project Name', value: proj.name }]);
        const newName = (input && input['Project Name'] ? String(input['Project Name']).trim() : '').trim();
        if (!newName) return; // ignore empty
        proj.name = newName;
        saveProjectsState(state3);
        // Refresh selector
        const sel4 = document.querySelector('.project-select');
        if (sel4) {
            sel4.innerHTML = state3.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            sel4.value = state3.activeId;
        }
    });

    // Delete project (current selection) with confirm; prevent deleting last project
    document.querySelector('.delete-project')?.addEventListener('click', async () => {
        const sel5 = document.querySelector('.project-select');
        if (!sel5) return;
        const pid = sel5.value;
        const state4 = loadProjectsState();
        if (!state4.projects || state4.projects.length <= 1) {
            await showModal('Delete Project', 'You must have at least one project. Create another project before deleting this one.', 'Ok');
            return;
        }
        const proj = state4.projects.find(p => p.id === pid);
        if (!proj) return;
        await showModal('Delete Project', `Are you sure you want to delete the project "${proj.name}"? This cannot be undone.`, 'Delete');
        // Persist current categories back to active project before removal
        try { syncActiveProjectCategories(getToDoTasks()); } catch(_) {}
        // Remove
        const idx = state4.projects.findIndex(p => p.id === pid);
        if (idx === -1) return;
        state4.projects.splice(idx, 1);
        // If we deleted the active project, switch to the first remaining
        if (state4.activeId === pid) {
            const newActive = state4.projects[0];
            state4.activeId = newActive.id;
            setToDoTasks(newActive.categories || []);
        }
        saveProjectsState(state4);
        // Refresh selector and categories
        const sel6 = document.querySelector('.project-select');
        if (sel6) {
            sel6.innerHTML = state4.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            sel6.value = state4.activeId;
        }
        showCategories();
    });
};