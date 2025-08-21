// Firestore connection and two-way sync for To-Do data
// - Uses localStorage.db_id for Firebase config (JSON string). If missing, asks user via modal.
// - Stores data under collection 'todo' (does not touch existing 'progress', 'progress_flashcards', 'studysets').
// - Keeps localStorage 'toDoTasks' in sync with Firestore document.

import { showModal } from '../misc/modal.js';
import { getToDoTasks } from './storage.js';
import { randomID } from '../misc/utils.js';

let firebaseExports = null; // { initializeApp, getFirestore, doc, setDoc, getDoc, onSnapshot, serverTimestamp, collection }
let db = null;
let unsub = null;
const CLIENT_ID = `todo-${randomID()}`;
let isRemoteApplying = false; // guard to avoid feedback loops
let isInitialized = false;
let isSyncingLocal = false; // guard for internal localStorage writes

const TASKS_KEY = 'toDoTasks';
const PROJECTS_KEY = 'toDoProjectsV1';

function getLocalProjectsState() {
	const raw = window.localStorage.getItem(PROJECTS_KEY);
	if (!raw) return null;
	try { return JSON.parse(raw); } catch (_) { return null; }
}

function setLocalProjectsState(state) {
	isSyncingLocal = true;
	try { window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(state)); } finally { isSyncingLocal = false; }
}

function deriveActiveCategoriesFromProjects(state) {
	if (!state || !Array.isArray(state.projects)) return null;
	const active = state.projects.find(p => p.id === state.activeId) || state.projects[0];
	return active ? (active.categories || []) : null;
}

// Patch localStorage.setItem to observe changes to 'toDoTasks'
const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
function patchLocalStorage() {
	if ((window.localStorage.setItem.__patchedForTodoSync || false) === true) return;
	window.localStorage.setItem = function(key, value) {
		// Perform the actual write
		originalSetItem(key, value);
		// Skip reactions during internal or remote-applied writes
		if (isSyncingLocal || isRemoteApplying) return;

		if (key === TASKS_KEY) {
			// If we're applying a remote update, don't echo back
			try {
				const tasks = JSON.parse(value);
				// Also update active project's categories in local projects state for consistency
				const state = getLocalProjectsState();
				if (state && Array.isArray(tasks)) {
					const activeIdx = state.projects.findIndex(p => p.id === state.activeId);
					if (activeIdx !== -1) {
						const newState = { ...state, projects: state.projects.map((p, i) => i === activeIdx ? { ...p, categories: tasks } : p) };
						setLocalProjectsState(newState);
						pushRemote({ projectsState: newState, tasks }).catch(err => console.error('[todo sync] push error', err));
						return;
					}
				}
				// Fallback: push just tasks
				pushRemote({ tasks }).catch(err => console.error('[todo sync] push error', err));
			} catch (_) { /* ignore */ }
		} else if (key === PROJECTS_KEY) {
			try {
				const state = JSON.parse(value);
				// Push entire projects state
				pushRemote({ projectsState: state }).catch(err => console.error('[todo sync] push error', err));
			} catch (_) { /* ignore */ }
		}
	};
	// Mark as patched
	try { window.localStorage.setItem.__patchedForTodoSync = true; } catch (_) {}
}

async function dynamicImportFirebase() {
	if (firebaseExports) return firebaseExports;
	// Use Firebase v10+ modular SDK via ESM CDN
	const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
	const fsMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
	firebaseExports = {
		initializeApp: appMod.initializeApp,
		getFirestore: fsMod.getFirestore,
		doc: fsMod.doc,
		setDoc: fsMod.setDoc,
		getDoc: fsMod.getDoc,
		onSnapshot: fsMod.onSnapshot,
		serverTimestamp: fsMod.serverTimestamp,
		collection: fsMod.collection,
	};
	return firebaseExports;
}

function parseConfig(raw) {
	if (!raw) return null;
	try {
		const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
		// Minimal required keys
		if (!cfg || !cfg.apiKey || !cfg.projectId) return null;
		return cfg;
	} catch (_) { return null; }
}

async function ensureConfig() {
	// Try existing
	const stored = window.localStorage.getItem('db_id');
	let cfg = parseConfig(stored);
	if (cfg) return cfg;
	// Prompt user
	try {
		const input = await showModal(
			'Connect to Firestore',
			'Enter Firebase config JSON for your decks-db project. This will only create/read the "todo" collection and won\'t touch existing data.\nIf you already have a database that you created for the Morisinc platform, you can use it here.\n\nTo create a new one please visit https://decks.morisinc.net/help',
			'Save',
			['Firebase Config (JSON)']
		);
		const raw = input && input['Firebase Config (JSON)'];
		cfg = parseConfig(raw);
		if (!cfg) throw new Error('Invalid config');
		window.localStorage.setItem('db_id', JSON.stringify(cfg));
		return cfg;
	} catch (e) {
		console.warn('[todo sync] Firebase config not provided or invalid:', e);
		return null;
	}
}

function getDocRef() {
	if (!db || !firebaseExports) return null;
	// Single shared document in collection 'todo'
	const { doc, collection } = firebaseExports;
	const col = collection(db, 'todo');
	// Use a stable document id. Optionally allow per-board in future via localStorage.todo_board_id
	return doc(col, 'board');
}

async function pushRemote(payload) {
	if (!db || !firebaseExports) return;
	const ref = getDocRef();
	if (!ref) return;
	const { setDoc, serverTimestamp } = firebaseExports;
	const body = {
		updatedAt: serverTimestamp(),
		clientId: CLIENT_ID,
		version: 2,
	};
	if (payload) {
		if (Array.isArray(payload.tasks)) body.toDoTasks = payload.tasks;
		if (payload.projectsState) body.toDoProjectsV1 = payload.projectsState;
	}
	await setDoc(ref, body, { merge: true });
}

async function hydrateFromRemote() {
	const ref = getDocRef();
	if (!ref) return;
	const { getDoc } = firebaseExports;
	const snap = await getDoc(ref);
	if (snap.exists()) {
		const data = snap.data();
		const hasProjects = data && data.toDoProjectsV1 && Array.isArray(data.toDoProjectsV1.projects);
		const hasTasksOnly = data && Array.isArray(data.toDoTasks);
		if (hasProjects || hasTasksOnly) {
			isRemoteApplying = true;
			try {
				if (hasProjects) {
					setLocalProjectsState(data.toDoProjectsV1);
					const cats = deriveActiveCategoriesFromProjects(data.toDoProjectsV1);
					if (cats) window.localStorage.setItem(TASKS_KEY, JSON.stringify(cats));
				} else if (hasTasksOnly) {
					window.localStorage.setItem(TASKS_KEY, JSON.stringify(data.toDoTasks));
				}
			} finally {
				setTimeout(() => { isRemoteApplying = false; }, 0);
			}
			return true;
		}
	} else {
		// No remote doc: seed from local projects if available; else derive default from current tasks
		const localProjects = getLocalProjectsState();
		if (localProjects) {
			await pushRemote({ projectsState: localProjects, tasks: deriveActiveCategoriesFromProjects(localProjects) || [] });
		} else {
			const localTasks = getToDoTasks();
			// Create a default project container
			const def = { id: randomID(), name: 'Default', categories: localTasks };
			const state = { activeId: def.id, projects: [def] };
			setLocalProjectsState(state);
			await pushRemote({ projectsState: state, tasks: localTasks });
		}
	}
	return false;
}

function subscribeRemote() {
	const ref = getDocRef();
	if (!ref) return;
	const { onSnapshot } = firebaseExports;
	// Clean previous
	try { unsub && unsub(); } catch (_) {}
	unsub = onSnapshot(ref, (snap) => {
		const data = snap.data();
		if (!data) return;
		// Ignore our own writes
		if (data.clientId === CLIENT_ID) return;
		const hasProjects = data && data.toDoProjectsV1 && Array.isArray(data.toDoProjectsV1.projects);
		const hasTasksOnly = data && Array.isArray(data.toDoTasks);
		if (!hasProjects && !hasTasksOnly) return;
		// Apply
		isRemoteApplying = true;
		try {
			if (hasProjects) {
				setLocalProjectsState(data.toDoProjectsV1);
				const cats = deriveActiveCategoriesFromProjects(data.toDoProjectsV1);
				if (cats) window.localStorage.setItem(TASKS_KEY, JSON.stringify(cats));
			} else if (hasTasksOnly) {
				window.localStorage.setItem(TASKS_KEY, JSON.stringify(data.toDoTasks));
			}
		} finally {
			setTimeout(() => { isRemoteApplying = false; }, 0);
		}
	}, (err) => console.error('[todo sync] snapshot error', err));
}

export async function startFirestoreSync() {
	if (isInitialized) return;
	patchLocalStorage();
	const cfg = await ensureConfig();
	if (!cfg) { console.warn('[todo sync] Skipping Firestore sync (no config).'); return; }
	const { initializeApp, getFirestore } = await dynamicImportFirebase();
	try {
		const app = initializeApp(cfg);
		db = getFirestore(app);
	} catch (e) {
		console.error('[todo sync] Firebase init failed', e);
		return;
	}
	await hydrateFromRemote();
	subscribeRemote();
	isInitialized = true;
}

export function stopFirestoreSync() {
	try { unsub && unsub(); } catch (_) {}
	unsub = null;
	isInitialized = false;
}

