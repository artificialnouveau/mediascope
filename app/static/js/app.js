const API = "";
let currentNotebookId = null;
let currentChapterId = null;
let quillEditors = {};
let chapterNotesQuill = null;

// --- Notebook management ---

async function loadNotebooks() {
    const res = await fetch(`${API}/api/notebooks`);
    const notebooks = await res.json();
    const dropdown = document.getElementById("notebook-dropdown");
    dropdown.innerHTML = "";
    notebooks.forEach(nb => {
        const opt = document.createElement("option");
        opt.value = nb.id;
        opt.textContent = nb.name;
        if (nb.id === currentNotebookId) opt.selected = true;
        dropdown.appendChild(opt);
    });
    if (!currentNotebookId && notebooks.length > 0) {
        currentNotebookId = notebooks[0].id;
        dropdown.value = currentNotebookId;
    }
    if (currentNotebookId) loadChapters();
}

function onNotebookChange(e) {
    currentNotebookId = parseInt(e.target.value);
    currentChapterId = null;
    showWelcome();
    loadChapters();
}

async function addNotebook() {
    const name = prompt("New notebook name:");
    if (!name) return;
    const res = await fetch(`${API}/api/notebooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    const nb = await res.json();
    currentNotebookId = nb.id;
    currentChapterId = null;
    showWelcome();
    await loadNotebooks();
}

async function renameNotebook() {
    if (!currentNotebookId) return;
    const dropdown = document.getElementById("notebook-dropdown");
    const currentName = dropdown.options[dropdown.selectedIndex]?.textContent || "";
    const name = prompt("Rename notebook:", currentName);
    if (!name) return;
    await fetch(`${API}/api/notebooks/${currentNotebookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    await loadNotebooks();
}

async function deleteNotebook() {
    if (!currentNotebookId) return;
    if (!confirm("Delete this notebook and all its chapters/entries?")) return;
    const res = await fetch(`${API}/api/notebooks/${currentNotebookId}`, { method: "DELETE" });
    if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Cannot delete");
        return;
    }
    currentNotebookId = null;
    currentChapterId = null;
    showWelcome();
    await loadNotebooks();
}

// --- Chapter management ---

async function loadChapters() {
    if (!currentNotebookId) return;
    const res = await fetch(`${API}/api/notebooks/${currentNotebookId}/chapters`);
    const chapters = await res.json();
    const list = document.getElementById("chapter-list");
    list.innerHTML = "";
    chapters.forEach((ch, idx) => {
        const li = document.createElement("li");
        li.dataset.id = ch.id;
        li.draggable = true;
        if (ch.id === currentChapterId) li.classList.add("active");
        li.innerHTML = `
            <span class="chapter-order-btns">
                <button onclick="moveChapter(${idx}, -1, event)" title="Move up" ${idx === 0 ? 'disabled' : ''}>▲</button>
                <button onclick="moveChapter(${idx}, 1, event)" title="Move down" ${idx === chapters.length - 1 ? 'disabled' : ''}>▼</button>
            </span>
            <span class="chapter-name">${escapeHtml(ch.name)}</span>
            <span class="chapter-actions">
                <button onclick="renameChapter(${ch.id}, event)" title="Rename">✏</button>
                <button onclick="deleteChapter(${ch.id}, event)" title="Delete">✕</button>
            </span>
        `;
        // Drag and drop
        li.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", idx.toString());
            li.classList.add("dragging");
        });
        li.addEventListener("dragend", () => li.classList.remove("dragging"));
        li.addEventListener("dragover", (e) => { e.preventDefault(); li.classList.add("drag-over"); });
        li.addEventListener("dragleave", () => li.classList.remove("drag-over"));
        li.addEventListener("drop", async (e) => {
            e.preventDefault();
            li.classList.remove("drag-over");
            const fromIdx = parseInt(e.dataTransfer.getData("text/plain"));
            const toIdx = idx;
            if (fromIdx !== toIdx) {
                const ids = chapters.map(c => c.id);
                const [moved] = ids.splice(fromIdx, 1);
                ids.splice(toIdx, 0, moved);
                await saveChapterOrder(ids);
            }
        });
        li.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON") return;
            selectChapter(ch.id, ch.name);
        });
        list.appendChild(li);
    });
}

async function moveChapter(fromIdx, direction, event) {
    event.stopPropagation();
    const list = document.getElementById("chapter-list");
    const items = Array.from(list.children);
    const ids = items.map(li => parseInt(li.dataset.id));
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= ids.length) return;
    const [moved] = ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, moved);
    await saveChapterOrder(ids);
}

async function saveChapterOrder(chapterIds) {
    await fetch(`${API}/api/chapters/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter_ids: chapterIds }),
    });
    await loadChapters();
}

async function addChapter() {
    if (!currentNotebookId) return;
    const input = document.getElementById("new-chapter-name");
    const name = input.value.trim();
    if (!name) return;
    await fetch(`${API}/api/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebook_id: currentNotebookId, name }),
    });
    input.value = "";
    await loadChapters();
}

async function renameChapter(id, event) {
    event.stopPropagation();
    const name = prompt("Rename chapter:");
    if (!name) return;
    await fetch(`${API}/api/chapters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    await loadChapters();
    if (id === currentChapterId) {
        document.getElementById("chapter-title").textContent = name;
    }
}

async function deleteChapter(id, event) {
    event.stopPropagation();
    if (!confirm("Delete this chapter and all its entries?")) return;
    await fetch(`${API}/api/chapters/${id}`, { method: "DELETE" });
    if (id === currentChapterId) {
        currentChapterId = null;
        showWelcome();
    }
    await loadChapters();
}

async function selectChapter(id, name) {
    currentChapterId = id;
    document.querySelectorAll("#chapter-list li").forEach(li => {
        li.classList.toggle("active", parseInt(li.dataset.id) === id);
    });
    document.getElementById("chapter-title").textContent = name;
    document.getElementById("welcome").style.display = "none";
    document.getElementById("chapter-view").style.display = "flex";
    document.getElementById("search-results").style.display = "none";
    document.getElementById("bulk-view").style.display = "none";
    await loadChapterNotes(id);
    await loadEntries(id);
}

function showWelcome() {
    document.getElementById("welcome").style.display = "block";
    document.getElementById("chapter-view").style.display = "none";
    document.getElementById("search-results").style.display = "none";
    document.getElementById("bulk-view").style.display = "none";
}

// --- Chapter notes ---

async function loadChapterNotes(chapterId) {
    const res = await fetch(`${API}/api/chapters/${chapterId}`);
    const chapter = await res.json();

    if (!chapterNotesQuill) {
        chapterNotesQuill = new Quill("#chapter-notes-editor", {
            theme: "snow",
            modules: {
                toolbar: [
                    ["bold", "italic", "underline"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    [{ header: [1, 2, 3, false] }],
                    ["clean"],
                ],
            },
            placeholder: "Write chapter notes here...",
        });
    }
    chapterNotesQuill.root.innerHTML = chapter.notes || "";
    document.getElementById("chapter-notes-status").textContent = "";
}

async function saveChapterNotes() {
    if (!chapterNotesQuill || !currentChapterId) return;
    const notes = chapterNotesQuill.root.innerHTML;
    await fetch(`${API}/api/chapters/${currentChapterId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
    });
    document.getElementById("chapter-notes-status").textContent = "Saved!";
    setTimeout(() => {
        document.getElementById("chapter-notes-status").textContent = "";
    }, 2000);
}

// --- Entry management ---

async function loadEntries(chapterId) {
    const res = await fetch(`${API}/api/chapters/${chapterId}/entries`);
    const entries = await res.json();
    const container = document.getElementById("entries-list");
    container.innerHTML = "";
    quillEditors = {};

    entries.forEach(entry => {
        container.appendChild(createEntryCard(entry));
    });

    if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No entries yet</h3><p>Add a video URL above to get started.</p></div>';
    }
}

function createEntryCard(entry) {
    const card = document.createElement("div");
    card.className = "entry-card";
    card.dataset.id = entry.id;

    const videoSrc = entry.video_path ? `/media/${entry.video_path}` : "";
    const editorId = `editor-${entry.id}`;

    card.innerHTML = `
        <div class="entry-inner">
            <div class="entry-video">
                ${videoSrc ? `<video controls preload="metadata"><source src="${videoSrc}" type="video/mp4"></video>` : '<p style="color:#666">No video</p>'}
            </div>
            <div class="entry-notes">
                <div class="entry-header">
                    <h4>${escapeHtml(entry.video_title || "Untitled")}</h4>
                </div>
                ${entry.source_url ? `<div class="entry-source">${escapeHtml(entry.source_url)}</div>` : ""}
                ${entry.video_path ? `<div class="trim-row" style="margin-bottom:8px;">
                    <label style="font-size:12px;color:#666;">Start:</label>
                    <input type="text" id="entry-trim-start-${entry.id}" placeholder="00:00:00" style="width:100px;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;font-family:monospace;">
                    <label style="font-size:12px;color:#666;">End:</label>
                    <input type="text" id="entry-trim-end-${entry.id}" placeholder="00:01:30" style="width:100px;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;font-family:monospace;">
                    <button class="btn btn-secondary" onclick="trimEntryVideo(${entry.id}, '${entry.video_path}')">Trim</button>
                </div>` : ""}
                <div id="${editorId}">${entry.notes || ""}</div>
                <div class="entry-actions">
                    <button class="btn btn-primary" onclick="saveNotes(${entry.id})">Save Notes</button>
                    <button class="btn btn-secondary" id="transcribe-btn-${entry.id}" onclick="transcribeEntry(${entry.id})">Transcribe</button>
                    <button class="btn btn-danger" onclick="deleteEntry(${entry.id})">Delete</button>
                </div>
            </div>
        </div>
    `;

    requestAnimationFrame(() => {
        const editorEl = document.getElementById(editorId);
        if (editorEl) {
            const quill = new Quill(`#${editorId}`, {
                theme: "snow",
                modules: {
                    toolbar: [
                        ["bold", "italic", "underline"],
                        [{ list: "ordered" }, { list: "bullet" }],
                        ["clean"],
                    ],
                },
            });
            quillEditors[entry.id] = quill;
        }
    });

    return card;
}

async function transcribeEntry(entryId) {
    const btn = document.getElementById(`transcribe-btn-${entryId}`);
    btn.disabled = true;
    btn.innerHTML = 'Transcribing...<span class="loading"></span>';

    try {
        const res = await fetch(`${API}/api/entries/${entryId}/transcribe`, { method: "POST" });
        if (!res.ok) {
            const err = await res.json();
            alert("Transcription error: " + (err.detail || "Failed"));
            return;
        }
        const entry = await res.json();
        // Update the Quill editor with the new notes
        const quill = quillEditors[entryId];
        if (quill) {
            quill.root.innerHTML = entry.notes || "";
        }
    } catch (e) {
        alert("Transcription error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Transcribe";
    }
}

async function transcribeAll() {
    const btn = document.getElementById("transcribe-all-btn");
    btn.disabled = true;
    btn.innerHTML = 'Transcribing all...<span class="loading"></span>';

    try {
        const res = await fetch(`${API}/api/chapters/${currentChapterId}/entries`);
        const entries = await res.json();

        for (const entry of entries) {
            // Skip if already has transcription
            if (entry.notes && entry.notes.includes("--- Transcription ---")) continue;
            if (!entry.video_path) continue;

            const tbtn = document.getElementById(`transcribe-btn-${entry.id}`);
            if (tbtn) {
                tbtn.disabled = true;
                tbtn.innerHTML = 'Transcribing...<span class="loading"></span>';
            }

            const r = await fetch(`${API}/api/entries/${entry.id}/transcribe`, { method: "POST" });
            if (r.ok) {
                const updated = await r.json();
                const quill = quillEditors[entry.id];
                if (quill) quill.root.innerHTML = updated.notes || "";
            }

            if (tbtn) {
                tbtn.disabled = false;
                tbtn.textContent = "Transcribe";
            }
        }
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Transcribe All";
    }
}

async function trimEntryVideo(entryId, videoPath) {
    const start = document.getElementById(`entry-trim-start-${entryId}`).value.trim();
    const end = document.getElementById(`entry-trim-end-${entryId}`).value.trim();
    if (!start && !end) {
        alert("Enter at least a start or end timestamp.");
        return;
    }
    try {
        const res = await fetch(`${API}/api/trim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_path: videoPath, start, end }),
        });
        if (!res.ok) {
            const err = await res.json();
            alert("Trim failed: " + (err.detail || "Error"));
            return;
        }
        // Reload entries to refresh the video player
        await loadEntries(currentChapterId);
    } catch (e) {
        alert("Trim error: " + e.message);
    }
}

async function addEntry() {
    const urlInput = document.getElementById("entry-url");
    const notesInput = document.getElementById("entry-notes");
    const btn = document.getElementById("add-entry-btn");
    const url = urlInput.value.trim();

    if (!url || !currentChapterId) return;

    btn.disabled = true;
    btn.innerHTML = 'Downloading...<span class="loading"></span>';

    try {
        const res = await fetch(`${API}/api/entries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chapter_id: currentChapterId,
                url: url,
                notes: notesInput.value,
            }),
        });

        if (!res.ok) {
            const err = await res.json();
            alert("Error: " + (err.detail || "Download failed"));
            return;
        }

        urlInput.value = "";
        notesInput.value = "";
        await loadEntries(currentChapterId);
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Download & Save";
    }
}

async function saveNotes(entryId) {
    const quill = quillEditors[entryId];
    if (!quill) return;
    const notes = quill.root.innerHTML;
    await fetch(`${API}/api/entries/${entryId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
    });
}

async function deleteEntry(entryId) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`${API}/api/entries/${entryId}`, { method: "DELETE" });
    await loadEntries(currentChapterId);
}

// --- Export ---

function exportChapter() {
    if (!currentChapterId) return;
    window.open(`${API}/api/chapters/${currentChapterId}/export`, "_blank");
}

// --- Search ---

let searchTimeout = null;

function onSearch(e) {
    const q = e.target.value.trim();
    clearTimeout(searchTimeout);
    if (!q) {
        if (currentChapterId) {
            document.getElementById("chapter-view").style.display = "flex";
        } else {
            document.getElementById("welcome").style.display = "block";
        }
        document.getElementById("search-results").style.display = "none";
        return;
    }
    searchTimeout = setTimeout(() => doSearch(q), 300);
}

async function doSearch(q) {
    const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
    const results = await res.json();
    const container = document.getElementById("search-results");
    document.getElementById("welcome").style.display = "none";
    document.getElementById("chapter-view").style.display = "none";
    document.getElementById("bulk-view").style.display = "none";
    container.style.display = "block";

    if (results.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No results</h3></div>';
        return;
    }

    container.innerHTML = `<h3>Search results (${results.length})</h3>`;
    results.forEach(entry => {
        const card = document.createElement("div");
        card.className = "entry-card";
        const videoSrc = entry.video_path ? `/media/${entry.video_path}` : "";
        card.innerHTML = `
            <div class="entry-inner">
                <div class="entry-video">
                    ${videoSrc ? `<video controls preload="metadata"><source src="${videoSrc}" type="video/mp4"></video>` : ""}
                </div>
                <div class="entry-notes" style="padding:20px">
                    <div class="entry-header"><h4>${escapeHtml(entry.video_title || "Untitled")}</h4></div>
                    <div class="entry-source">Chapter: ${escapeHtml(entry.chapter_name)}</div>
                    <div>${entry.notes || "<em>No notes</em>"}</div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- Bulk Download ---

let currentBulkFolder = null;

function showBulkDownload() {
    document.getElementById("welcome").style.display = "none";
    document.getElementById("chapter-view").style.display = "none";
    document.getElementById("search-results").style.display = "none";
    document.getElementById("bulk-view").style.display = "flex";
    document.getElementById("bulk-view").style.flexDirection = "column";
    document.getElementById("bulk-view").style.flex = "1";
    document.getElementById("bulk-view").style.overflow = "hidden";
    currentChapterId = null;
    document.querySelectorAll("#chapter-list li").forEach(li => li.classList.remove("active"));
    loadBulkFolders();
}

function hideBulkView() {
    document.getElementById("bulk-view").style.display = "none";
}

async function loadBulkFolders() {
    const res = await fetch(`${API}/api/bulk/folders`);
    const folders = await res.json();
    const container = document.getElementById("bulk-folders-list");
    container.innerHTML = "";

    if (folders.length === 0) {
        container.innerHTML = '<p style="color:#888; font-size:13px;">No downloads yet.</p>';
        return;
    }

    folders.forEach(f => {
        const card = document.createElement("div");
        card.className = "bulk-folder-card";
        card.innerHTML = `
            <span class="folder-name">${escapeHtml(f.name.replace(/_/g, " "))}</span>
            <span class="folder-count">${f.video_count} video${f.video_count !== 1 ? "s" : ""}</span>
        `;
        card.addEventListener("click", () => openBulkFolder(f.name));
        container.appendChild(card);
    });
}

async function openBulkFolder(folderName) {
    currentBulkFolder = folderName;
    const res = await fetch(`${API}/api/bulk/folders/${encodeURIComponent(folderName)}`);
    const videos = await res.json();

    document.getElementById("bulk-folder-title").textContent = folderName.replace(/_/g, " ");
    document.getElementById("bulk-folder-contents").style.display = "block";

    const container = document.getElementById("bulk-videos-list");
    container.innerHTML = "";

    videos.forEach((v, idx) => {
        const card = document.createElement("div");
        card.className = "bulk-video-card";
        card.id = `bulk-video-${idx}`;
        card.innerHTML = `
            <div class="bulk-video-inner">
                <div class="bulk-video-player">
                    <video controls preload="metadata">
                        <source src="/media/${v.video_path}" type="video/mp4">
                    </video>
                </div>
                <div class="bulk-video-info">
                    <h4>${escapeHtml(v.title)}</h4>
                    <div class="trim-row">
                        <label>Start:</label>
                        <input type="text" id="trim-start-${idx}" placeholder="00:00:00" data-path="${v.video_path}">
                        <label>End:</label>
                        <input type="text" id="trim-end-${idx}" placeholder="00:01:30">
                        <button class="btn btn-secondary" onclick="trimBulkVideo(${idx}, '${v.video_path}')">Trim</button>
                    </div>
                    ${v.has_transcript
                        ? `<div class="transcript-box">${escapeHtml(v.transcript)}</div>`
                        : `<div class="transcript-box" id="transcript-${idx}" style="display:none;"></div>`
                    }
                    <div class="bulk-video-actions">
                        ${!v.has_transcript ? `<button class="btn btn-secondary" id="bulk-transcribe-${idx}" onclick="transcribeBulkVideo(${idx}, '${v.video_path}')">Transcribe</button>` : '<span style="font-size:12px;color:#888;">Transcribed</span>'}
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

async function startBulkDownload() {
    const folder = document.getElementById("bulk-folder").value.trim();
    const urlsText = document.getElementById("bulk-urls").value.trim();
    const transcribe = document.getElementById("bulk-transcribe").checked;
    const btn = document.getElementById("bulk-download-btn");
    const progress = document.getElementById("bulk-progress");

    if (!folder || !urlsText) {
        alert("Please enter a folder name and at least one URL.");
        return;
    }

    const urls = urlsText.split("\n").map(u => u.trim()).filter(u => u);
    btn.disabled = true;
    btn.innerHTML = 'Downloading...<span class="loading"></span>';

    let completed = 0;
    let errors = [];
    let doneList = [];

    for (const url of urls) {
        const shortUrl = url.length > 60 ? url.substring(0, 60) + "..." : url;
        progress.innerHTML = buildBulkProgress(completed + 1, urls.length, doneList, errors, `Downloading: ${escapeHtml(shortUrl)}`);

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout

            const res = await fetch(`${API}/api/bulk/download?folder=${encodeURIComponent(folder)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!res.ok) {
                const err = await res.json();
                errors.push(`${shortUrl}: ${err.detail || "Failed"}`);
            } else {
                const result = await res.json();
                doneList.push(result.title || shortUrl);
                if (transcribe) {
                    progress.innerHTML = buildBulkProgress(completed + 1, urls.length, doneList, errors, `Transcribing: ${escapeHtml(result.title || shortUrl)}`);
                    try {
                        await fetch(`${API}/api/bulk/transcribe?video_path=${encodeURIComponent(result.video_path)}`, {
                            method: "POST",
                        });
                    } catch (te) {
                        errors.push(`Transcribe ${shortUrl}: ${te.message}`);
                    }
                }
            }
        } catch (e) {
            if (e.name === "AbortError") {
                errors.push(`${shortUrl}: Timed out (5 min)`);
            } else {
                errors.push(`${shortUrl}: ${e.message}`);
            }
        }
        completed++;
    }

    btn.disabled = false;
    btn.textContent = "Download All";
    const succeeded = completed - errors.length;

    if (errors.length > 0) {
        progress.innerHTML = `<strong>Done! ${succeeded}/${urls.length} succeeded.</strong><br><br>` +
            `<span style="color:#ef4444;font-size:12px;">${errors.map(e => escapeHtml(e)).join("<br>")}</span>`;
    } else {
        progress.innerHTML = `<strong>Done!</strong> All ${urls.length} videos downloaded.`;
        document.getElementById("bulk-urls").value = "";
    }

    await loadBulkFolders();
    if (currentBulkFolder === folder.replace(/ /g, "_")) {
        await openBulkFolder(currentBulkFolder);
    }
}

async function trimBulkVideo(idx, videoPath) {
    const start = document.getElementById(`trim-start-${idx}`).value.trim();
    const end = document.getElementById(`trim-end-${idx}`).value.trim();

    if (!start && !end) {
        alert("Enter at least a start or end timestamp.");
        return;
    }

    try {
        const res = await fetch(`${API}/api/trim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_path: videoPath, start, end }),
        });
        if (!res.ok) {
            const err = await res.json();
            alert("Trim failed: " + (err.detail || "Error"));
            return;
        }
        // Refresh the video player
        const card = document.getElementById(`bulk-video-${idx}`);
        const video = card.querySelector("video");
        video.src = `/media/${videoPath}?t=${Date.now()}`;
        video.load();
    } catch (e) {
        alert("Trim error: " + e.message);
    }
}

async function transcribeBulkVideo(idx, videoPath) {
    const btn = document.getElementById(`bulk-transcribe-${idx}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Transcribing...<span class="loading"></span>';
    }

    try {
        const res = await fetch(`${API}/api/bulk/transcribe?video_path=${encodeURIComponent(videoPath)}`, {
            method: "POST",
        });
        if (!res.ok) {
            const err = await res.json();
            alert("Transcription failed: " + (err.detail || "Error"));
            return;
        }
        const data = await res.json();
        const box = document.getElementById(`transcript-${idx}`);
        if (box) {
            box.textContent = data.transcript;
            box.style.display = "block";
        }
        if (btn) {
            btn.textContent = "Transcribed";
            btn.disabled = true;
        }
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        if (btn && !btn.disabled) {
            btn.disabled = false;
            btn.textContent = "Transcribe";
        }
    }
}

async function transcribeAllBulk() {
    if (!currentBulkFolder) return;
    const res = await fetch(`${API}/api/bulk/folders/${encodeURIComponent(currentBulkFolder)}`);
    const videos = await res.json();

    for (let i = 0; i < videos.length; i++) {
        if (videos[i].has_transcript) continue;
        await transcribeBulkVideo(i, videos[i].video_path);
    }
}

// --- Helpers ---

function buildBulkProgress(current, total, doneList, errors, statusText) {
    let html = `<strong>${statusText}</strong> (${current} of ${total})<br>`;
    if (doneList.length > 0) {
        html += `<div style="margin-top:8px;font-size:12px;color:#16a34a;">`;
        doneList.forEach(t => { html += `&#10003; ${escapeHtml(t)} is done<br>`; });
        html += `</div>`;
    }
    if (errors.length > 0) {
        html += `<div style="margin-top:4px;font-size:12px;color:#ef4444;">${errors.length} failed</div>`;
    }
    return html;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// --- Init ---

document.addEventListener("DOMContentLoaded", () => {
    loadNotebooks();

    document.getElementById("notebook-dropdown").addEventListener("change", onNotebookChange);

    document.getElementById("new-chapter-name").addEventListener("keydown", (e) => {
        if (e.key === "Enter") addChapter();
    });

    document.getElementById("search-input").addEventListener("input", onSearch);
});
