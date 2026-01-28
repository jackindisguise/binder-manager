const STORAGE_KEY = 'tcgBinder';
const INDEX_OFFSET_KEY = 'firstIndexZero';
let currentEditIndex = null;
let pullMode = false;
let moveMode = false;
const recentlyAddedIndices = new Set();
const pullHistory = []; // Store pulled cards for undo
let draggedCardIndex = null; // Track which card is being dragged

// Get index offset preference (0 for 0-based, 1 for 1-based)
function getIndexOffset() {
    const stored = localStorage.getItem(INDEX_OFFSET_KEY);
    return stored === null || stored === 'true' ? 0 : 1;
}

// Format an index for display based on user preference
function formatIndex(index) {
    return index + getIndexOffset();
}

// Toggle first index preference
function toggleFirstIndex() {
    const currentOffset = getIndexOffset();
    const newOffset = currentOffset === 0 ? 1 : 0;
    localStorage.setItem(INDEX_OFFSET_KEY, (newOffset === 0).toString());
    
    // Update button appearance
    updateFirstIndexButton();
    
    render(); // Re-render to update all displayed indices
}

// Update first index button appearance
function updateFirstIndexButton() {
    const btn = document.getElementById('firstIndexZeroBtn');
    if (btn) {
        const isZero = getIndexOffset() === 0;
        if (isZero) {
            btn.classList.add('active');
            btn.classList.remove('secondary');
        } else {
            btn.classList.remove('active');
            btn.classList.add('secondary');
        }
    }
}

function getCardsPerPage() {
    const binder = getBinder();
    return binder.cardsPerPage || 9;
}

// Initialize binder from localStorage or create empty binder
function getBinder() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const binder = JSON.parse(stored);
            // Ensure cardsPerPage is set
            if (!binder.cardsPerPage) {
                binder.cardsPerPage = 9;
            }
            
            // Ensure name is set (for old binders without a name)
            if (!binder.name) {
                binder.name = 'TCG Binder Collection';
            }
            
            // Migrate from old pages format to new cards format
            if (binder.pages && Array.isArray(binder.pages) && !binder.cards) {
                const cardsPerPage = binder.cardsPerPage || 9;
                binder.cards = [];
                for (let i = 0; i < binder.pages.length; i++) {
                    if (binder.pages[i] && Array.isArray(binder.pages[i])) {
                        for (let j = 0; j < binder.pages[i].length; j++) {
                            binder.cards.push(binder.pages[i][j] || null);
                        }
                    }
                }
                // Remove old pages property
                delete binder.pages;
                // Save migrated binder
                localStorage.setItem(STORAGE_KEY, JSON.stringify(binder));
            }
            
            // Ensure cards array exists
            if (!binder.cards || !Array.isArray(binder.cards)) {
                binder.cards = [];
            }
            return binder;
        } catch (error) {
            console.error('Error parsing binder from localStorage:', error);
            // Fall through to create new binder
        }
    }
    // Create empty binder
    return {
        cardsPerPage: 9,
        cards: [],
        name: 'TCG Binder Collection'
    };
}

function saveBinder(binder) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(binder));
    updateBinderTitle();
    render();
}

function updateBinderTitle() {
    const binder = getBinder();
    const titleElement = document.getElementById('binderTitle');
    if (titleElement) {
        const binderName = binder.name || 'TCG Binder Collection';
        titleElement.textContent = binderName;
        
        // Fade in the title
        titleElement.style.transition = 'opacity 0.3s ease-in';
        // Use requestAnimationFrame to ensure the text is set before fading in
        requestAnimationFrame(() => {
            titleElement.style.opacity = '1';
        });
    }
}

function changePageSize() {
    const newSize = parseInt(document.getElementById('pageSize').value);
    const binder = getBinder();
    const oldSize = binder.cardsPerPage || 9;
    
    if (newSize === oldSize) return;
    
    const oldGrid = getGridSize(oldSize);
    const newGrid = getGridSize(newSize);
    const sizeChange = newSize - oldSize;
    
    if (!binder.cards) {
        binder.cards = [];
    }
    
    if (sizeChange > 0) {
        // Increasing size - add empty slots to each page
        if (confirm(`Resize binder pages from ${oldGrid.cols}x${oldGrid.rows} to ${newGrid.cols}x${newGrid.rows}? This will add ${sizeChange} empty slot(s) per page.`)) {
            binder.cardsPerPage = newSize;
            
            // Add empty slots to each existing page
            const newCards = [];
            for (let i = 0; i < binder.cards.length; i += oldSize) {
                const page = binder.cards.slice(i, i + oldSize);
                // Add empty slots to fill new page size
                while (page.length < newSize) {
                    page.push(null);
                }
                newCards.push(...page);
            }
            binder.cards = newCards;
            
            saveBinder(binder);
            updatePageSizeDropdown();
        } else {
            updatePageSizeDropdown();
        }
    } else {
        // Decreasing size - remove last slots (only if empty)
        let canResize = true;
        const slotsToRemove = Math.abs(sizeChange);
        
        // Check if any slots to be removed contain cards
        for (let i = 0; i < binder.cards.length; i += oldSize) {
            const pageStart = i;
            const pageEnd = Math.min(i + oldSize, binder.cards.length);
            for (let j = newSize; j < (pageEnd - pageStart); j++) {
                const idx = pageStart + j;
                if (idx < binder.cards.length && binder.cards[idx] !== null) {
                    canResize = false;
                    break;
                }
            }
            if (!canResize) break;
        }
        
        if (!canResize) {
            alert(`Cannot resize: Some pages have cards in the last ${slotsToRemove} slot(s) that would be removed. Please move or remove those cards first.`);
            updatePageSizeDropdown();
            return;
        }
        
        if (confirm(`Resize binder pages from ${oldGrid.cols}x${oldGrid.rows} to ${newGrid.cols}x${newGrid.rows}? This will remove the last ${slotsToRemove} empty slot(s) per page.`)) {
            binder.cardsPerPage = newSize;
            
            // Remove last slots from each page
            const newCards = [];
            for (let i = 0; i < binder.cards.length; i += oldSize) {
                const page = binder.cards.slice(i, i + oldSize);
                // Keep only first newSize slots
                newCards.push(...page.slice(0, newSize));
            }
            binder.cards = newCards;
            
            saveBinder(binder);
            updatePageSizeDropdown();
        } else {
            updatePageSizeDropdown();
        }
    }
}

function getGridSize(cardsPerPage) {
    if (cardsPerPage === 4) {
        return { cols: 2, rows: 2 };
    } else if (cardsPerPage === 9) {
        return { cols: 3, rows: 3 };
    } else if (cardsPerPage === 12) {
        return { cols: 4, rows: 3 };
    }
    return { cols: 3, rows: 3 }; // default
}

function updatePageSizeDropdown() {
    const binder = getBinder();
    const cardsPerPage = binder.cardsPerPage || 9;
    document.getElementById('pageSize').value = cardsPerPage.toString();
}

function getFirstEmptyIndex(binder) {
    if (!binder.cards || !Array.isArray(binder.cards)) {
        return null;
    }
    for (let i = 0; i < binder.cards.length; i++) {
        if (binder.cards[i] === null || binder.cards[i] === undefined) {
            return i;
        }
    }
    return null;
}

function insertCard(binder, card) {
    if (!binder.cards) {
        binder.cards = [];
    }
    let firstEmptyIndex = getFirstEmptyIndex(binder);
    if (firstEmptyIndex === null) {
        // No empty slots, append to end
        firstEmptyIndex = binder.cards.length;
        binder.cards.push(card);
    } else {
        binder.cards[firstEmptyIndex] = card;
    }
    return firstEmptyIndex;
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function generatePagesHtml(binder) {
    const cardsPerPage = getCardsPerPage();
    // Calculate grid columns based on page size
    let gridCols;
    if (cardsPerPage === 4) {
        gridCols = 2; // 2x2
    } else if (cardsPerPage === 9) {
        gridCols = 3; // 3x3
    } else if (cardsPerPage === 12) {
        gridCols = 4; // 4x3
    } else {
        gridCols = 3; // default
    }
    
    if (!binder.cards || !Array.isArray(binder.cards)) {
        return '';
    }
    
    // Calculate number of pages needed
    const totalSlots = binder.cards.length;
    const numPages = Math.ceil(totalSlots / cardsPerPage);
    
    const pagesHtml = [];
    for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
        const pageStart = pageIndex * cardsPerPage;
        const pageEnd = Math.min(pageStart + cardsPerPage, totalSlots);
        const cardsHtml = [];
        
        for (let i = pageStart; i < pageEnd; i++) {
            const card = binder.cards[i];
            const cardIndexNumber = i;
            if (!card) {
                const onClick = (pullMode || moveMode) ? '' : `onclick="openAddCardModal(${cardIndexNumber})"`;
                const dropHandlers = moveMode ? `ondragover="handleDragOver(event)" ondrop="handleDrop(${cardIndexNumber}, event)"` : '';
                cardsHtml.push(`<div class="card empty${moveMode ? ' drop-target' : ''}" ${onClick} ${dropHandlers}>
                    <div class="card-index">#${formatIndex(cardIndexNumber)}</div>
                    <div class="card-empty-label">Empty</div>
                </div>`);
            } else {
                const escapedName = escapeHtml(card.name || '');
                const escapedNumber = escapeHtml(card.number || '');
                const escapedCondition = escapeHtml(card.condition || '');
                const cardValue = card.value !== undefined && card.value !== null ? card.value : 0;
                const formattedValue = cardValue.toFixed(2);
                const recentClass = recentlyAddedIndices.has(cardIndexNumber) ? ' recently-added' : '';
                if (pullMode) {
                    cardsHtml.push(`<div class="card${recentClass}" data-index="${cardIndexNumber}" onmousedown="startPull(${cardIndexNumber}, event)" onmouseup="cancelPull(${cardIndexNumber})" onmouseleave="cancelPull(${cardIndexNumber})" ontouchstart="startPull(${cardIndexNumber}, event)" ontouchend="cancelPull(${cardIndexNumber})" ontouchcancel="cancelPull(${cardIndexNumber})">
                        <div class="card-index">#${formatIndex(cardIndexNumber)}</div>
                        <div class="card-info">
                            <div class="card-name">${escapedName}</div>
                            <div class="card-number">${escapedNumber}</div>
                            <div class="card-condition">${escapedCondition}</div>
                            <div class="card-value">$${formattedValue}</div>
                        </div>
                        <div class="pull-progress-bar" id="pullProgress-${cardIndexNumber}" style="width: 0%;"></div>
                    </div>`);
                } else if (moveMode) {
                    cardsHtml.push(`<div class="card${recentClass} draggable-card" data-index="${cardIndexNumber}" draggable="true" ondragstart="handleDragStart(${cardIndexNumber}, event)" ondragend="handleDragEnd(event)" ondragover="handleDragOver(event)" ondrop="handleDrop(${cardIndexNumber}, event)">
                        <div class="card-index">#${formatIndex(cardIndexNumber)}</div>
                        <div class="card-info">
                            <div class="card-name">${escapedName}</div>
                            <div class="card-number">${escapedNumber}</div>
                            <div class="card-condition">${escapedCondition}</div>
                            <div class="card-value">$${formattedValue}</div>
                        </div>
                    </div>`);
                } else {
                    cardsHtml.push(`<div class="card${recentClass}" onclick="openEditCardModal(${cardIndexNumber})">
                        <div class="card-index">#${formatIndex(cardIndexNumber)}</div>
                        <div class="card-info">
                            <div class="card-name">${escapedName}</div>
                            <div class="card-number">${escapedNumber}</div>
                            <div class="card-condition">${escapedCondition}</div>
                            <div class="card-value">$${formattedValue}</div>
                        </div>
                    </div>`);
                }
            }
        }
        
        // Fill remaining slots if page is incomplete
        for (let i = pageEnd; i < pageStart + cardsPerPage; i++) {
            const cardIndexNumber = i;
            const onClick = (pullMode || moveMode) ? '' : `onclick="openAddCardModal(${cardIndexNumber})"`;
            const dropHandlers = moveMode ? `ondragover="handleDragOver(event)" ondrop="handleDrop(${cardIndexNumber}, event)"` : '';
            cardsHtml.push(`<div class="card empty${moveMode ? ' drop-target' : ''}" ${onClick} ${dropHandlers}>
                <div class="card-index">#${cardIndexNumber}</div>
                <div class="card-empty-label">Empty</div>
            </div>`);
        }
        
        pagesHtml.push(`<div class="page">
            <div class="page-header">Page ${pageIndex + 1}</div>
            <div class="cards-grid" style="grid-template-columns: repeat(${gridCols}, 1fr);">
${cardsHtml.join('\n')}
            </div>
        </div>`);
    }
    
    return pagesHtml.join('\n');
}

function calculateStats(binder) {
    if (!binder.cards || !Array.isArray(binder.cards)) {
        return { totalCards: 0, totalValue: 0, totalPages: 0 };
    }
    const cardsPerPage = getCardsPerPage();
    const totalCards = binder.cards.filter(c => c !== null && c !== undefined).length;
    const totalValue = binder.cards.reduce((sum, card) => {
        return sum + (card && card.value !== undefined && card.value !== null ? card.value : 0);
    }, 0);
    const totalPages = Math.ceil(binder.cards.length / cardsPerPage);
    return { totalCards, totalValue, totalPages };
}

function render() {
    try {
        const binder = getBinder();
        if (!binder) {
            console.error('Failed to get binder');
            return;
        }
        const stats = calculateStats(binder);
        
        // Update stats
        const statsEl = document.getElementById('stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${stats.totalPages}</div>
                        <div class="stat-label">Total Pages</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.totalCards}</div>
                        <div class="stat-label">Total Cards</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">$${stats.totalValue.toFixed(2)}</div>
                        <div class="stat-label">Total Value</div>
                    </div>
                </div>
            `;
        }
        
        // Update pages
        const pagesEl = document.getElementById('pagesGrid');
        if (pagesEl) {
            pagesEl.innerHTML = generatePagesHtml(binder);
        }
    } catch (error) {
        console.error('Error rendering:', error);
    }
}

function openAddCardModal(index = null) {
    currentEditIndex = index;
    document.getElementById('modalTitle').textContent = index !== null ? `Edit Card #${formatIndex(index)}` : 'Add Card';
    document.getElementById('cardName').value = '';
    document.getElementById('cardNumber').value = '';
    document.getElementById('cardCondition').value = '';
    document.getElementById('cardValue').value = '';
    
    const pullBtn = document.getElementById('pullCardBtn');
    
    if (index !== null) {
        const binder = getBinder();
        if (!binder.cards) {
            binder.cards = [];
        }
        // Ensure array is large enough
        while (binder.cards.length <= index) {
            binder.cards.push(null);
        }
        const card = binder.cards[index];
        if (card) {
            document.getElementById('cardName').value = card.name || '';
            document.getElementById('cardNumber').value = card.number || '';
            document.getElementById('cardCondition').value = card.condition || '';
            document.getElementById('cardValue').value = card.value || '';
            pullBtn.classList.remove('hidden');
        } else {
            pullBtn.classList.add('hidden');
        }
    } else {
        pullBtn.classList.add('hidden');
    }
    
    document.getElementById('cardModal').classList.add('active');
}

function openEditCardModal(index) {
    openAddCardModal(index);
}

function closeCardModal() {
    document.getElementById('cardModal').classList.remove('active');
    currentEditIndex = null;
}

function saveCard() {
    const name = document.getElementById('cardName').value.trim();
    const number = document.getElementById('cardNumber').value.trim();
    const condition = document.getElementById('cardCondition').value.trim();
    const value = parseFloat(document.getElementById('cardValue').value) || 0;
    
    if (!name || !number) {
        alert('Name and number are required');
        return;
    }
    
    const binder = getBinder();
    const card = { name, number, condition, value };
    
    if (currentEditIndex !== null) {
        // Edit existing card
        if (!binder.cards) {
            binder.cards = [];
        }
        // Ensure array is large enough
        while (binder.cards.length <= currentEditIndex) {
            binder.cards.push(null);
        }
        binder.cards[currentEditIndex] = card;
    } else {
        // Add new card
        const idx = insertCard(binder, card);
        recentlyAddedIndices.add(idx);
    }
    
    saveBinder(binder);
    closeCardModal();
}

function exportBinder() {
    const binder = getBinder();
    const dataStr = JSON.stringify(binder, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename based on binder name with timestamp
    let binderName = binder.name || 'TCG Binder Collection';
    
    // Sanitize the filename: remove invalid characters, replace spaces with hyphens
    // Remove or replace characters that are invalid in filenames
    const sanitizedName = binderName
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .toLowerCase(); // Convert to lowercase for consistency
    
    // Generate timestamp (compact format: YYYYMMDD-HHMMSS)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}-${hours}${minutes}${seconds}`;
    
    // If sanitized name is empty, use default
    const filename = (sanitizedName || 'binder') + '-' + timestamp + '.json';
    
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function importBinder(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const binder = JSON.parse(e.target.result);
            // Migrate from old pages format if needed
            if (binder.pages && Array.isArray(binder.pages) && !binder.cards) {
                const cardsPerPage = binder.cardsPerPage || 9;
                binder.cards = [];
                for (let i = 0; i < binder.pages.length; i++) {
                    if (binder.pages[i] && Array.isArray(binder.pages[i])) {
                        for (let j = 0; j < binder.pages[i].length; j++) {
                            binder.cards.push(binder.pages[i][j] || null);
                        }
                    }
                }
                delete binder.pages;
            }
            if (binder.cards && Array.isArray(binder.cards)) {
                // Ensure name is set for imported binders
                if (!binder.name) {
                    binder.name = 'TCG Binder Collection';
                }
                recentlyAddedIndices.clear();
                saveBinder(binder);
                alert('Binder imported successfully');
            } else {
                alert('Invalid binder file format');
            }
        } catch (error) {
            alert('Error importing binder: ' + error.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearBinder() {
    if (confirm('Are you sure you want to clear all cards? This cannot be undone.')) {
        const cardsPerPage = getCardsPerPage();
        const binder = { cardsPerPage: cardsPerPage, cards: [] };
        saveBinder(binder);
    }
}

function togglePullMode() {
    pullMode = !pullMode;
    if (pullMode) {
        moveMode = false; // Disable move mode when enabling pull mode
    }
    updatePullModeUI();
    updateMoveModeUI();
    render();
}

function toggleMoveMode() {
    moveMode = !moveMode;
    if (moveMode) {
        pullMode = false; // Disable pull mode when enabling move mode
    }
    updatePullModeUI();
    updateMoveModeUI();
    render();
}

function updatePullModeUI() {
    const btn = document.getElementById('pullModeBtn');
    const body = document.body;
    if (pullMode) {
        btn.textContent = 'Pull Mode: On';
        btn.classList.add('active');
        body.classList.add('pull-mode-active');
    } else {
        btn.textContent = 'Pull Mode: Off';
        btn.classList.remove('active');
        body.classList.remove('pull-mode-active');
    }
}

function updateMoveModeUI() {
    const btn = document.getElementById('moveModeBtn');
    const body = document.body;
    if (moveMode) {
        btn.textContent = 'Move Mode: On';
        btn.classList.add('active');
        body.classList.add('move-mode-active');
    } else {
        btn.textContent = 'Move Mode: Off';
        btn.classList.remove('active');
        body.classList.remove('move-mode-active');
    }
}

let pullTimers = {};
const PULL_DURATION = 750; // 0.75 seconds

function startPull(index, event) {
    if (!pullMode) return;
    event.preventDefault();
    
    const cardElement = document.querySelector(`[data-index="${index}"]`);
    if (!cardElement) return;
    
    const binder = getBinder();
    if (!binder.cards || index >= binder.cards.length) {
        return;
    }
    const card = binder.cards[index];
    
    if (!card) return;
    
    // Add pull-progress class
    cardElement.classList.add('pull-progress');
    const progressBar = document.getElementById(`pullProgress-${index}`);
    
    // Start progress animation
    let startTime = Date.now();
    const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / PULL_DURATION) * 100, 100);
        
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
        
        if (progress >= 100) {
            // Complete pull
            completePull(index);
        } else if (pullTimers[index]) {
            requestAnimationFrame(updateProgress);
        }
    };
    
    // Store timer
    pullTimers[index] = {
        startTime: startTime,
        update: updateProgress
    };
    
    requestAnimationFrame(updateProgress);
}

function cancelPull(index) {
    if (pullTimers[index]) {
        const timer = pullTimers[index];
        delete pullTimers[index];
        
        const cardElement = document.querySelector(`[data-index="${index}"]`);
        const progressBar = document.getElementById(`pullProgress-${index}`);
        
        if (cardElement && progressBar) {
            // Get current progress
            const currentWidth = parseFloat(progressBar.style.width) || 0;
            
            if (currentWidth > 0) {
                // Animate back to 0
                const startWidth = currentWidth;
                const startTime = Date.now();
                const reverseDuration = 300; // 300ms to reverse
                
                const reverseAnimation = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / reverseDuration, 1);
                    const newWidth = startWidth * (1 - progress);
                    
                    progressBar.style.width = newWidth + '%';
                    
                    if (progress < 1) {
                        requestAnimationFrame(reverseAnimation);
                    } else {
                        // Animation complete, clean up
                        progressBar.style.width = '0%';
                        cardElement.classList.remove('pull-progress');
                    }
                };
                
                requestAnimationFrame(reverseAnimation);
            } else {
                // No progress to reverse, just clean up
                progressBar.style.width = '0%';
                cardElement.classList.remove('pull-progress');
            }
        }
    }
}

function completePull(index) {
    const binder = getBinder();
    if (!binder.cards) {
        binder.cards = [];
    }
    
    const cardElement = document.querySelector(`[data-index="${index}"]`);
    if (cardElement) {
        // Save card to history before removing
        if (index < binder.cards.length && binder.cards[index]) {
            pullHistory.push({
                index: index,
                card: JSON.parse(JSON.stringify(binder.cards[index])) // Deep copy
            });
            // Keep only last 50 pulls in history
            if (pullHistory.length > 50) {
                pullHistory.shift();
            }
        }
        
        // Add pulling class for animation
        cardElement.classList.add('pulling');
        cardElement.classList.remove('pull-progress');
        
        // Remove card after animation
        setTimeout(() => {
            if (index < binder.cards.length) {
                binder.cards[index] = null;
            }
            saveBinder(binder);
        }, 500); // Match animation duration
    }
    
    delete pullTimers[index];
}

function pullCardFromModal() {
    if (currentEditIndex === null) return;
    
    const binder = getBinder();
    if (!binder.cards || currentEditIndex >= binder.cards.length) {
        return;
    }
    const card = binder.cards[currentEditIndex];
    
    if (card) {
        if (confirm(`Remove card: ${card.name} (${card.number})?`)) {
            // Save card to history before removing
            pullHistory.push({
                index: currentEditIndex,
                card: JSON.parse(JSON.stringify(card)) // Deep copy
            });
            // Keep only last 50 pulls in history
            if (pullHistory.length > 50) {
                pullHistory.shift();
            }
            
            binder.cards[currentEditIndex] = null;
            saveBinder(binder);
            closeCardModal();
        }
    }
}

// Close modal on outside click
document.getElementById('cardModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeCardModal();
    }
});

// Sort preview functions
function openSortPreview() {
    try {
        const modal = document.getElementById('sortModal');
        if (!modal) {
            console.error('Sort modal not found');
            return;
        }
        modal.classList.add('active');
        updateSortPreview();
    } catch (error) {
        console.error('Error opening sort preview:', error);
        alert('Error opening sort preview: ' + error.message);
    }
}

function closeSortModal() {
    document.getElementById('sortModal').classList.remove('active');
}

function copyConvertMoves() {
    const copyBtn = document.getElementById('copyConvertMovesBtn');
    if (!copyBtn || !copyBtn.dataset.moves) {
        return;
    }
    
    try {
        const moves = JSON.parse(copyBtn.dataset.moves);
        const movesText = moves.map((move, index) => {
            const number = String(index + 1).padStart(3, '0');
            return `${number}. ${formatIndex(move.from)}->${formatIndex(move.to)}`;
        }).join('\n');
        
        // Copy to clipboard
        navigator.clipboard.writeText(movesText).then(() => {
            // Show feedback
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.style.background = '#28a745';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        });
    } catch (error) {
        console.error('Error copying moves:', error);
        alert('Error copying moves');
    }
}

function copySortMoves() {
    const copyBtn = document.getElementById('copySortMovesBtn');
    if (!copyBtn || !copyBtn.dataset.moves) {
        return;
    }
    
    try {
        const moves = JSON.parse(copyBtn.dataset.moves);
        const movesText = moves.map((move, index) => {
            const number = String(index + 1).padStart(3, '0');
            return `${number}. ${formatIndex(move.from)}->${formatIndex(move.to)}`;
        }).join('\n');
        
        // Copy to clipboard
        navigator.clipboard.writeText(movesText).then(() => {
            // Show feedback
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.style.background = '#28a745';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        });
    } catch (error) {
        console.error('Error copying moves:', error);
        alert('Error copying moves');
    }
}

function calculateMinimumSwaps(binder, sortBy) {
    // Step 1: Create a sorted copy of the binder's cards
    const cardsWithIndices = [];
    if (!binder.cards || !Array.isArray(binder.cards)) {
        return { totalSwaps: 0, moves: [], cycles: [], sortedCards: [], cardsWithIndices: [] };
    }
    
    // Collect all cards with their current indices
    for (let i = 0; i < binder.cards.length; i++) {
        const card = binder.cards[i];
        if (card) {
            cardsWithIndices.push({
                card: card,
                currentIndex: i
            });
        }
    }
    
    // Sort cards by criteria to create sorted copy
    const sortedCards = [...cardsWithIndices].sort((a, b) => {
        if (sortBy === 'name') {
            return a.card.name.localeCompare(b.card.name);
        } else if (sortBy === 'number') {
            return a.card.number.localeCompare(b.card.number);
        } else if (sortBy === 'value') {
            return (b.card.value || 0) - (a.card.value || 0);
        }
        return 0;
    });
    
    // Step 2: Build target array - what should be at each position in sorted binder
    // Cards are placed sequentially starting from index 0
    const targetBinder = [];
    const cardToTargetIndex = new Map(); // Map: source index -> target index
    const targetToCard = new Map(); // Map: target index -> card object
    
    sortedCards.forEach((item, sortedIdx) => {
        cardToTargetIndex.set(item.currentIndex, sortedIdx);
        targetToCard.set(sortedIdx, item.card);
        targetBinder[sortedIdx] = item.card;
    });
    
    // Build current state
    const currentBinder = [];
    for (let i = 0; i < binder.cards.length; i++) {
        currentBinder[i] = binder.cards[i] || null;
    }
    
    // Build map: card -> current position (for finding cards)
    const cardToCurrentPos = new Map();
    for (let i = 0; i < currentBinder.length; i++) {
        const card = currentBinder[i];
        if (card) {
            // Use a unique key for the card (name + number)
            const cardKey = `${card.name}|${card.number}`;
            cardToCurrentPos.set(cardKey, i);
        }
    }
    
    // Step 3: Hole-chasing algorithm
    // The hole is the cursor - wherever the hole is, place the card that belongs there
    const moves = [];
    const processedCards = new Set(); // Track cards we've moved (by their current position key)
    
    // Helper function to chase a hole (follow the chain from an empty slot)
    function chaseHole(holeIndex) {
        const chainMoves = [];
        let currentHole = holeIndex;
        const visitedHoles = new Set();
        
        while (currentHole !== undefined) {
            // Check if this hole should be empty in the target (end of chain)
            if (targetBinder[currentHole] === undefined || targetBinder[currentHole] === null) {
                // This hole should remain empty - we're done with this chain
                break;
            }
            
            // Check for cycle - if we've visited this hole before in this chain
            if (visitedHoles.has(currentHole)) {
                // We've cycled back - break the cycle
                break;
            }
            
            visitedHoles.add(currentHole);
            
            // Find what card should be in this hole position
            const targetCard = targetBinder[currentHole];
            if (!targetCard) {
                break;
            }
            
            // Find where this card currently is
            const cardKey = `${targetCard.name}|${targetCard.number}`;
            const cardCurrentPos = cardToCurrentPos.get(cardKey);
            
            if (cardCurrentPos === undefined) {
                // Card not found (shouldn't happen, but handle gracefully)
                break;
            }
            
            // Check if card is already in correct position
            if (cardCurrentPos === currentHole) {
                // Already correct - no move needed
                processedCards.add(cardKey);
                break;
            }
            
            // Check if we've already processed this card
            if (processedCards.has(cardKey)) {
                // Already moved this card - end of chain
                break;
            }
            
            // Move the card from its current position to the hole
            const card = currentBinder[cardCurrentPos];
            chainMoves.push({
                from: cardCurrentPos,
                to: currentHole,
                card: card
            });
            
            // Mark card as processed
            processedCards.add(cardKey);
            
            // The card's old position becomes the new hole
            // (After the move, position cardCurrentPos will be empty)
            currentHole = cardCurrentPos;
        }
        
        // Hole-chasing naturally builds moves in reverse order (from end to start)
        // Reverse them to get forward execution order: start → end
        // Example: collected [31->40, 94->31, 73->94] → reversed [73->94, 94->31, 31->40]
        chainMoves.reverse();
        
        // Add moves in forward order
        for (const move of chainMoves) {
            moves.push(move);
        }
    }
    
    // Find all empty slots (holes) in the current binder
    const holes = [];
    for (let i = 0; i < currentBinder.length; i++) {
        if (currentBinder[i] === null) {
            holes.push(i);
        }
    }
    
    // Process each hole to create move chains
    // This creates natural chains: A → B → C → D where each move creates the next hole
    for (const hole of holes) {
        chaseHole(hole);
    }
    
    // After hole-chasing, handle remaining cards that need to move (cycles without holes)
    // These are cards that need to swap but there are no empty slots to use
    for (let i = 0; i < currentBinder.length; i++) {
        const card = currentBinder[i];
        if (!card) continue;
        
        const cardKey = `${card.name}|${card.number}`;
        if (processedCards.has(cardKey)) continue;
        
        const targetIdx = cardToTargetIndex.get(i);
        if (targetIdx === undefined || targetIdx === i) {
            // Card is already in correct position or doesn't need to move
            processedCards.add(cardKey);
            continue;
        }
        
        // This card needs to move but wasn't handled by hole-chasing
        // This typically happens in cycles. We'll add the move directly.
        // The applySort function will handle the swap correctly.
        moves.push({
            from: i,
            to: targetIdx,
            card: card
        });
        processedCards.add(cardKey);
    }
    
    // Calculate cycles for display purposes (optional)
    const visited = new Set();
    const cycles = [];
    
    cardsWithIndices.forEach((item) => {
        if (visited.has(item.currentIndex)) return;
        
        const cycle = [];
        let current = item.currentIndex;
        
        while (!visited.has(current)) {
            visited.add(current);
            const target = cardToTargetIndex.get(current);
            if (target === undefined || target === current) break;
            cycle.push(current);
            // Find which card is currently at the target position
            const cardAtTarget = cardsWithIndices.find(c => c.currentIndex === target);
            if (!cardAtTarget) break;
            current = cardAtTarget.currentIndex;
        }
        
        if (cycle.length > 1) {
            cycles.push(cycle);
        }
    });
    
    const totalSwaps = cycles.reduce((sum, cycle) => sum + (cycle.length - 1), 0);
    
    return {
        totalSwaps,
        moves: moves,
        cycles,
        sortedCards,
        cardsWithIndices
    };
}

function updateSortPreview() {
    try {
        const sortBy = document.getElementById('sortCriteria').value;
        const binder = getBinder();
        const result = calculateMinimumSwaps(binder, sortBy);
    
    const infoDiv = document.getElementById('sortPreviewInfo');
    const swapsDiv = document.getElementById('sortPreviewSwaps');
    
    // Show/hide copy button based on whether there are moves
    const copyBtn = document.getElementById('copySortMovesBtn');
    if (copyBtn) {
        if (result.moves.length === 0) {
            copyBtn.style.display = 'none';
        } else {
            copyBtn.style.display = 'block';
            // Store moves for copying
            copyBtn.dataset.moves = JSON.stringify(result.moves);
        }
    }
    
    // Check if binder is already sorted and compacted (no moves needed)
    if (result.moves.length === 0) {
        infoDiv.innerHTML = `
            <div style="color: #28a745; font-weight: 600;">✓ Binder is already sorted by ${sortBy} and compacted!</div>
        `;
        swapsDiv.innerHTML = '';
    } else {
        infoDiv.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong>Total cards:</strong> ${result.cardsWithIndices.length}
            </div>
            <div style="margin-bottom: 10px;">
                <strong>Moves needed:</strong> ${result.moves.length}
            </div>
            <div style="color: #666; font-size: 14px;">
                The following moves will be made to sort and compact the binder:
            </div>
        `;
        
        let swapsHtml = '<div style="max-height: 300px; overflow-y: auto;">';
        result.moves.forEach((move, idx) => {
            swapsHtml += `
                <div style="padding: 10px; margin-bottom: 8px; background: white; border: 1px solid #ddd; border-radius: 6px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                        <div style="flex: 1;">
                            <strong>Move ${idx + 1}:</strong>
                        </div>
                        <div style="flex: 2; font-size: 13px; color: #666;">
                            #${formatIndex(move.from)} → #${formatIndex(move.to)}
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #333; padding-left: 10px;">
                        ${move.card.name} (${move.card.number})
                    </div>
                </div>
            `;
        });
        swapsHtml += '</div>';
        swapsDiv.innerHTML = swapsHtml;
    }
    } catch (error) {
        console.error('Error updating sort preview:', error);
        const infoDiv = document.getElementById('sortPreviewInfo');
        if (infoDiv) {
            infoDiv.innerHTML = `<div style="color: #dc3545;">Error: ${error.message}</div>`;
        }
    }
}

function applySort() {
    const sortBy = document.getElementById('sortCriteria').value;
    const binder = getBinder();
    const result = calculateMinimumSwaps(binder, sortBy);
    
    if (result.moves.length === 0) {
        closeSortModal();
        return;
    }
    
    const cardsPerPage = getCardsPerPage();
    
    // Build the final sorted state by applying moves
    // Start with a copy of the current state
    const newBinder = {
        cardsPerPage: cardsPerPage,
        cards: []
    };
    
    // Copy current state - ensure array is large enough for all moves
    const maxIndex = Math.max(
        binder.cards ? binder.cards.length - 1 : 0,
        ...result.moves.map(m => Math.max(m.from, m.to))
    );
    
    for (let i = 0; i <= maxIndex; i++) {
        newBinder.cards[i] = (binder.cards && binder.cards[i]) || null;
    }
    
    // Apply each move in sequence to transform the current state
    // Since we follow cycles, moves are already in the correct order
    // We need to find cards by their identity (name+number) since positions change as we apply moves
    result.moves.forEach(move => {
        // Find the card that matches move.card in the current state
        let sourceIndex = -1;
        for (let i = 0; i < newBinder.cards.length; i++) {
            const card = newBinder.cards[i];
            if (card && 
                card.name === move.card.name && 
                card.number === move.card.number) {
                sourceIndex = i;
                break;
            }
        }
        
        if (sourceIndex === -1) {
            // Card not found - skip this move
            console.warn(`Card not found for move: ${move.card.name} (${move.card.number})`);
            return;
        }
        
        const sourceCard = newBinder.cards[sourceIndex];
        const targetCard = newBinder.cards[move.to];
        
        if (targetCard) {
            // This is a swap - move source card to target, and target card to source
            newBinder.cards[move.to] = sourceCard;
            newBinder.cards[sourceIndex] = targetCard;
        } else {
            // This is a move to empty slot - just move the card
            newBinder.cards[move.to] = sourceCard;
            newBinder.cards[sourceIndex] = null;
        }
    });
    
    // After applying all moves, build the final sorted state
    // The moves should have transformed the state, but we need to ensure
    // the final state matches the sorted order exactly
    const expectedFinalState = [];
    result.sortedCards.forEach((item, idx) => {
        expectedFinalState[idx] = item.card;
    });
    
    // Verify final state: check each position that should have a card
    for (let i = 0; i < expectedFinalState.length; i++) {
        const expectedCard = expectedFinalState[i];
        if (expectedCard) {
            // Position i should have expectedCard
            if (newBinder.cards[i] !== expectedCard) {
                // Wrong card (or empty) at position i - find expectedCard and move it here
                let foundAt = -1;
                for (let j = 0; j < newBinder.cards.length; j++) {
                    // Use object comparison - cards are objects, so we need to compare by reference
                    // or find the card that matches the expected card's properties
                    if (newBinder.cards[j] && 
                        newBinder.cards[j].name === expectedCard.name &&
                        newBinder.cards[j].number === expectedCard.number &&
                        j !== i) {
                        foundAt = j;
                        break;
                    }
                }
                
                if (foundAt !== -1) {
                    // Move the card to its correct position
                    newBinder.cards[i] = newBinder.cards[foundAt];
                    newBinder.cards[foundAt] = null;
                }
            }
        }
    }
    
    // Trim trailing null entries from the end of the array
    // Find the last non-null card
    let lastCardIndex = -1;
    for (let i = newBinder.cards.length - 1; i >= 0; i--) {
        if (newBinder.cards[i] !== null) {
            lastCardIndex = i;
            break;
        }
    }
    
    // Trim array to remove all trailing nulls
    if (lastCardIndex >= 0) {
        newBinder.cards = newBinder.cards.slice(0, lastCardIndex + 1);
    } else {
        // All nulls - keep empty array
        newBinder.cards = [];
    }
    
    saveBinder(newBinder);
    closeSortModal();
}

// Close sort modal on outside click
document.getElementById('sortModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeSortModal();
    }
});

// Convert Binder functions
function openConvertPreview() {
    try {
        const modal = document.getElementById('convertModal');
        if (!modal) {
            console.error('Convert modal not found');
            return;
        }
        const binder = getBinder();
        const currentSize = binder.cardsPerPage || 9;
        document.getElementById('convertTargetSize').value = currentSize.toString();
        document.getElementById('convertSortCriteria').value = 'none';
        modal.classList.add('active');
        updateConvertPreview();
    } catch (error) {
        console.error('Error opening convert preview:', error);
        alert('Error opening convert preview: ' + error.message);
    }
}

function closeConvertModal() {
    document.getElementById('convertModal').classList.remove('active');
}

function calculateConversionMoves(binder, targetCardsPerPage, sortBy) {
    // Collect all cards with their current indices
    const cardsWithIndices = [];
    if (!binder.cards || !Array.isArray(binder.cards)) {
        return { totalMoves: 0, moves: [], cardsWithIndices: [], sortedCards: [] };
    }
    for (let i = 0; i < binder.cards.length; i++) {
        const card = binder.cards[i];
        if (card) {
            cardsWithIndices.push({
                card: card,
                currentIndex: i
            });
        }
    }
    
    // Sort cards by criteria if needed
    let sortedCards = [...cardsWithIndices];
    if (sortBy !== 'none') {
        sortedCards.sort((a, b) => {
            if (sortBy === 'name') {
                return a.card.name.localeCompare(b.card.name);
            } else if (sortBy === 'number') {
                return a.card.number.localeCompare(b.card.number);
            } else if (sortBy === 'value') {
                return (b.card.value || 0) - (a.card.value || 0);
            }
            return 0;
        });
    }
    
    // Calculate target positions in new form factor
    // Cards will be placed sequentially in the new binder
    // Note: ALL cards need to be listed as moves, even if position stays the same,
    // because we're moving from one binder to another binder
    const moves = [];
    sortedCards.forEach((item, idx) => {
        const targetIndex = idx;
        moves.push({
            from: item.currentIndex,
            to: targetIndex,
            card: item.card
        });
    });
    
    return {
        totalMoves: moves.length,
        moves: moves,
        cardsWithIndices: cardsWithIndices,
        sortedCards: sortedCards
    };
}

function updateConvertPreview() {
    try {
        const targetSize = parseInt(document.getElementById('convertTargetSize').value);
        const sortBy = document.getElementById('convertSortCriteria').value;
        const binder = getBinder();
        const currentSize = binder.cardsPerPage || 9;
        
        const result = calculateConversionMoves(binder, targetSize, sortBy);
        
        const infoDiv = document.getElementById('convertPreviewInfo');
        const movesDiv = document.getElementById('convertPreviewMoves');
        
        // Show/hide copy button based on whether there are moves
        const copyBtn = document.getElementById('copyConvertMovesBtn');
        if (copyBtn) {
            if (result.moves.length === 0) {
                copyBtn.style.display = 'none';
            } else {
                copyBtn.style.display = 'block';
                // Store moves for copying
                copyBtn.dataset.moves = JSON.stringify(result.moves);
            }
        }
        
        const currentGrid = getGridSize(currentSize);
        const targetGrid = getGridSize(targetSize);
        
        // Always show moves since we're moving from one binder to another
        {
            const totalCards = result.cardsWithIndices.length;
            const currentPages = Math.ceil((binder.cards ? binder.cards.length : 0) / currentSize);
            const targetPages = Math.ceil(totalCards / targetSize);
            
            infoDiv.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <strong>Current form factor:</strong> ${currentGrid.cols}x${currentGrid.rows} (${currentSize} cards/page, ${currentPages} page(s))
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Target form factor:</strong> ${targetGrid.cols}x${targetGrid.rows} (${targetSize} cards/page, ${targetPages} page(s))
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Total cards:</strong> ${totalCards}
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Sort method:</strong> ${sortBy === 'none' ? 'No sorting (keep current order)' : sortBy === 'name' ? 'Name' : sortBy === 'number' ? 'Number' : 'Value (High to Low)'}
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Moves needed:</strong> ${result.totalMoves}
                </div>
                <div style="color: #666; font-size: 14px;">
                    The following moves will be made to convert the binder:
                </div>
            `;
            
            // Use moves in their original order (same as copied list)
            let movesHtml = '<div style="max-height: 300px; overflow-y: auto;">';
            result.moves.forEach((move, idx) => {
                const currentPage = Math.floor(move.from / currentSize) + 1;
                const currentSlot = (move.from % currentSize) + 1;
                const targetPage = Math.floor(move.to / targetSize) + 1;
                const targetSlot = (move.to % targetSize) + 1;
                const isSamePosition = move.from === move.to;
                const isSamePage = currentPage === targetPage;
                
                movesHtml += `
                    <div style="padding: 10px; margin-bottom: 8px; background: white; border: 1px solid #ddd; border-radius: 6px; ${isSamePosition ? 'border-left: 4px solid #28a745;' : ''}">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                            <div style="flex: 1;">
                                <strong>Move ${idx + 1}:</strong>
                            </div>
                            <div style="flex: 2; font-size: 13px; color: #666;">
                                #${formatIndex(move.from)} (Page ${currentPage}, Slot ${currentSlot}) → #${formatIndex(move.to)} (Page ${targetPage}, Slot ${targetSlot})
                                ${isSamePosition ? '<span style="color: #28a745; font-weight: 600;"> (same position)</span>' : ''}
                            </div>
                        </div>
                        <div style="font-size: 13px; color: #333; padding-left: 10px;">
                            ${escapeHtml(move.card.name)} (${escapeHtml(move.card.number)})
                        </div>
                    </div>
                `;
            });
            movesHtml += '</div>';
            movesDiv.innerHTML = movesHtml;
        }
    } catch (error) {
        console.error('Error updating convert preview:', error);
        const infoDiv = document.getElementById('convertPreviewInfo');
        if (infoDiv) {
            infoDiv.innerHTML = `<div style="color: #dc3545;">Error: ${error.message}</div>`;
        }
    }
}

function applyConvert() {
    const targetSize = parseInt(document.getElementById('convertTargetSize').value);
    const sortBy = document.getElementById('convertSortCriteria').value;
    const binder = getBinder();
    const result = calculateConversionMoves(binder, targetSize, sortBy);
    
    // Create new binder with target form factor
    const newBinder = {
        cardsPerPage: targetSize,
        cards: []
    };
    
    // Determine how many slots we need
    const totalCards = result.sortedCards.length;
    const neededSlots = Math.ceil(totalCards / targetSize) * targetSize;
    
    // Initialize with nulls
    newBinder.cards = Array(neededSlots).fill(null);
    
    // Place sorted cards in order
    result.sortedCards.forEach((item, idx) => {
        newBinder.cards[idx] = item.card;
    });
    
    saveBinder(newBinder);
    updatePageSizeDropdown();
    closeConvertModal();
}

// Close convert modal on outside click
document.getElementById('convertModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeConvertModal();
    }
});

// Bulk Insert functions
function openBulkInsertModal() {
    document.getElementById('bulkInsertModal').classList.add('active');
    document.getElementById('bulkInsertText').value = '';
    document.getElementById('bulkInsertStatus').classList.add('hidden');
    document.getElementById('bulkInsertText').focus();
}

function closeBulkInsertModal() {
    document.getElementById('bulkInsertModal').classList.remove('active');
    document.getElementById('bulkInsertText').value = '';
    document.getElementById('bulkInsertStatus').classList.add('hidden');
}

function processBulkInsert() {
    const text = document.getElementById('bulkInsertText').value.trim();
    if (!text) {
        alert('Please enter CSV data');
        return;
    }
    
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
        alert('No data to process');
        return;
    }
    
    const binder = getBinder();
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    const inserted = []; // { position, name, number }
    
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;
        
        // Parse CSV line (handle quoted values)
        const parts = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < trimmedLine.length; i++) {
            const char = trimmedLine[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current.trim()); // Add last part
        
        // Remove quotes from parts
        const cleanParts = parts.map(part => part.replace(/^"|"$/g, ''));
        
        if (cleanParts.length < 4) {
            errorCount++;
            errors.push(`Line ${index + 1}: Insufficient columns (expected 4: Name, Number, Condition, Value)`);
            return;
        }
        
        const [name, number, condition, valueStr] = cleanParts;
        const value = parseFloat(valueStr);
        
        if (!name || !number) {
            errorCount++;
            errors.push(`Line ${index + 1}: Name and Number are required`);
            return;
        }
        
        if (isNaN(value)) {
            errorCount++;
            errors.push(`Line ${index + 1}: Invalid value "${valueStr}"`);
            return;
        }
        
        const card = { name, number, condition: condition || '', value: value || 0 };
        const position = insertCard(binder, card);
        recentlyAddedIndices.add(position);
        inserted.push({ position, name, number });
        successCount++;
    });
    
    saveBinder(binder);
    
    // Show status
    const statusDiv = document.getElementById('bulkInsertStatus');
    statusDiv.classList.remove('hidden');
    
    const insertedList = inserted.length > 0
        ? `<ul style="margin-top: 8px; padding-left: 20px;">
            ${inserted.map(({ position, name, number }) => `<li>#${position}: ${escapeHtml(name)} (${escapeHtml(number)})</li>`).join('')}
            </ul>`
        : '';
    
    if (errorCount === 0) {
        statusDiv.style.background = '#d4edda';
        statusDiv.style.color = '#155724';
        statusDiv.style.border = '1px solid #c3e6cb';
        statusDiv.innerHTML = `<strong>Success!</strong> Inserted ${successCount} card(s):${insertedList}`;
    } else {
        statusDiv.style.background = '#f8d7da';
        statusDiv.style.color = '#721c24';
        statusDiv.style.border = '1px solid #f5c6cb';
        statusDiv.innerHTML = `
            <strong>Completed with errors:</strong><br>
            Successfully inserted: ${successCount} card(s):${insertedList}
            Errors: ${errorCount} line(s)<br>
            <details style="margin-top: 10px;">
                <summary style="cursor: pointer;">View errors</summary>
                <ul style="margin-top: 5px; padding-left: 20px;">
                    ${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
                </ul>
            </details>
        `;
    }
    
    // Clear textarea if all successful
    if (errorCount === 0) {
        document.getElementById('bulkInsertText').value = '';
    }
}

// Close bulk insert modal on outside click
document.getElementById('bulkInsertModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeBulkInsertModal();
    }
});

function undoPull() {
    if (pullHistory.length === 0) {
        return;
    }
    
    const lastPull = pullHistory.pop();
    const binder = getBinder();
    
    if (!binder.cards) {
        binder.cards = [];
    }
    
    // Ensure array is large enough
    while (binder.cards.length <= lastPull.index) {
        binder.cards.push(null);
    }
    
    // Restore the card
    binder.cards[lastPull.index] = lastPull.card;
    saveBinder(binder);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Only handle shortcuts if not typing in an input field
    const activeElement = document.activeElement;
    const isInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
    );
    
    if (isInput) {
        // Allow undo in input fields
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !e.altKey) {
            return; // Let browser handle undo in input fields
        }
        return; // Don't handle other shortcuts in input fields
    }
    
    // P key: Toggle Pull Mode
    if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePullMode();
        return;
    }
    
    // M key: Toggle Move Mode
    if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMoveMode();
        return;
    }
    
    // Ctrl+Z / Cmd+Z: Undo last pull
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        undoPull();
    }
});

// Test function for sort optimization
function testSortOptimization() {
    console.log('Testing sort optimization...');
    
    // Test case from sort.md: [A, A, null, A, A, null, A, A, null, A, A, null]
    // Expected: Should move cards from end (10, 11) directly to empty slots (2, 5, 8)
    // Not: 3->2, 4->3, 6->4, 7->5, etc.
    
    const testCard = { name: 'A', number: '1', condition: '', value: 0 };
    const testBinder = {
        cardsPerPage: 9,
        cards: [
            testCard, testCard, null,
            testCard, testCard, null,
            testCard, testCard, null,
            testCard, testCard, null
        ]
    };
    
    const result = calculateMinimumSwaps(testBinder, 'name');
    
    console.log('Test binder:', testBinder.cards.map((c, i) => c ? `A@${i}` : `null@${i}`).join(', '));
    console.log('Total moves:', result.moves.length);
    console.log('Moves:');
    result.moves.forEach((move, idx) => {
        console.log(`  ${idx + 1}. Move #${move.from} -> #${move.to} (${move.card.name})`);
    });
    
    // Verify optimization: moves from end (10, 11) should come before moves from middle (3, 4, 6, 7)
    const movesFromEnd = result.moves.filter(m => m.from >= 9);
    const movesFromMiddle = result.moves.filter(m => m.from >= 3 && m.from <= 7);
    
    console.log('\nOptimization check:');
    console.log(`Moves from end (9+): ${movesFromEnd.length}`);
    console.log(`Moves from middle (3-7): ${movesFromMiddle.length}`);
    
    if (movesFromEnd.length > 0 && movesFromMiddle.length > 0) {
        const firstEndMove = result.moves.findIndex(m => m.from >= 9);
        const firstMiddleMove = result.moves.findIndex(m => m.from >= 3 && m.from <= 7);
        
        if (firstEndMove < firstMiddleMove) {
            console.log('✓ PASS: Moves from end come before moves from middle');
        } else {
            console.log('✗ FAIL: Moves from middle come before moves from end');
        }
    }
    
    // Verify: moves to empty slots should prioritize from end
    const movesToEmpty = result.moves.filter(m => !m.targetCard);
    console.log(`\nMoves to empty slots: ${movesToEmpty.length}`);
    if (movesToEmpty.length > 0) {
        const avgSourceIndex = movesToEmpty.reduce((sum, m) => sum + m.from, 0) / movesToEmpty.length;
        console.log(`Average source index: ${avgSourceIndex.toFixed(1)} (higher is better, max is ${testBinder.cards.length - 1})`);
        
        // Check if first few moves are from end
        const firstMovesFromEnd = movesToEmpty.slice(0, Math.min(3, movesToEmpty.length))
            .filter(m => m.from >= 9).length;
        if (firstMovesFromEnd > 0) {
            console.log('✓ PASS: First moves to empty slots are from end of binder');
        } else {
            console.log('✗ FAIL: First moves to empty slots are not from end of binder');
        }
    }
    
    // Test for inefficiency pattern: moving to a position that was just emptied
    console.log('\nInefficiency check:');
    let inefficiencyCount = 0;
    const positionsEmptied = new Set();
    
    for (let i = 0; i < result.moves.length; i++) {
        const move = result.moves[i];
        
        // Check if this move empties a position
        if (move.from !== move.to) {
            positionsEmptied.add(move.from);
        }
        
        // Check if this move fills a position that was just emptied
        if (positionsEmptied.has(move.to) && move.from > move.to) {
            // Find the move that emptied this position
            const moveThatEmptied = result.moves.slice(0, i).find(m => m.from === move.to);
            if (moveThatEmptied) {
                console.log(`  ✗ INEFFICIENT: Move #${move.from}->#${move.to} fills slot emptied by #${moveThatEmptied.from}->#${moveThatEmptied.to}`);
                console.log(`    Should be: Move #${move.from}->#${moveThatEmptied.to} directly`);
                inefficiencyCount++;
            }
        }
    }
    
    if (inefficiencyCount === 0) {
        console.log('✓ PASS: No inefficient moves detected');
    } else {
        console.log(`✗ FAIL: Found ${inefficiencyCount} inefficient move(s)`);
    }
    
    return result;
}

// Drag and drop handlers for move mode
function handleDragStart(index, event) {
    if (!moveMode) return;
    draggedCardIndex = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
    event.currentTarget.classList.add('dragging');
}

function handleDragEnd(event) {
    if (!moveMode) return;
    event.currentTarget.classList.remove('dragging');
    draggedCardIndex = null;
}

function handleDragOver(event) {
    if (!moveMode) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
}

function handleDrop(targetIndex, event) {
    if (!moveMode) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
    
    if (draggedCardIndex === null || draggedCardIndex === targetIndex) {
        return;
    }
    
    const binder = getBinder();
    if (!binder.cards) {
        binder.cards = [];
    }
    
    // Ensure arrays are large enough
    const maxIndex = Math.max(draggedCardIndex, targetIndex);
    while (binder.cards.length <= maxIndex) {
        binder.cards.push(null);
    }
    
    // Swap the cards
    const sourceCard = binder.cards[draggedCardIndex];
    const targetCard = binder.cards[targetIndex];
    
    binder.cards[targetIndex] = sourceCard;
    binder.cards[draggedCardIndex] = targetCard;
    
    saveBinder(binder);
    draggedCardIndex = null;
}

// Remove drag-over class when leaving drop target
document.addEventListener('dragleave', function(e) {
    if (e.target.classList.contains('card')) {
        e.target.classList.remove('drag-over');
    }
});

// Rename Binder modal functions
function openRenameBinderModal() {
    const binder = getBinder();
    const binderNameInput = document.getElementById('binderName');
    if (binderNameInput) {
        binderNameInput.value = binder.name || 'TCG Binder Collection';
    }
    document.getElementById('renameBinderModal').classList.add('active');
    // Focus and select the input text
    setTimeout(() => {
        binderNameInput.focus();
        binderNameInput.select();
    }, 100);
}

function closeRenameBinderModal() {
    document.getElementById('renameBinderModal').classList.remove('active');
}

function saveBinderName() {
    const binderNameInput = document.getElementById('binderName');
    const newName = binderNameInput.value.trim();
    
    if (!newName) {
        alert('Binder name cannot be empty');
        return;
    }
    
    const binder = getBinder();
    binder.name = newName;
    saveBinder(binder);
    closeRenameBinderModal();
}

// Close rename binder modal on outside click
document.getElementById('renameBinderModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeRenameBinderModal();
    }
});

// Help modal functions
function openHelpModal() {
    document.getElementById('helpModal').classList.add('active');
}

function closeHelpModal() {
    document.getElementById('helpModal').classList.remove('active');
}

// Close help modal on outside click
document.getElementById('helpModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeHelpModal();
    }
});

// Initialize
updateFirstIndexButton();
updateBinderTitle();
updatePullModeUI();
updateMoveModeUI();
updatePageSizeDropdown();
render();

// Test function for large binder with random cards
function testLargeBinderSort() {
    console.log('Testing large binder sort optimization...');
    
    // Generate random card names
    const adjectives = ['Ancient', 'Mystic', 'Fierce', 'Golden', 'Shadow', 'Crystal', 'Dragon', 'Fire', 'Ice', 'Lightning', 'Dark', 'Bright', 'Swift', 'Mighty', 'Legendary'];
    const nouns = ['Warrior', 'Mage', 'Beast', 'Spirit', 'Guardian', 'Knight', 'Sorcerer', 'Dragon', 'Phoenix', 'Tiger', 'Eagle', 'Wolf', 'Lion', 'Bear', 'Shark'];
    const numbers = ['001', '002', '003', '004', '005', '010', '015', '020', '025', '030', '050', '075', '100', '150', '200'];
    
    function generateRandomCard() {
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = numbers[Math.floor(Math.random() * numbers.length)];
        return {
            name: `${adj} ${noun}`,
            number: num,
            condition: 'Near Mint',
            value: Math.random() * 100
        };
    }
    
    // Create a large binder with many cards and some empty slots
    const totalSlots = 100; // 100 slots
    const cardCount = 75; // 75 cards, 25 empty slots
    const testBinder = {
        cardsPerPage: 9,
        cards: []
    };
    
    // Generate unique cards
    const cards = [];
    for (let i = 0; i < cardCount; i++) {
        cards.push(generateRandomCard());
    }
    
    // Sort cards by name for reference
    const sortedCards = [...cards].sort((a, b) => a.name.localeCompare(b.name));
    console.log(`Generated ${cardCount} cards, ${totalSlots - cardCount} empty slots`);
    console.log('First 5 cards (sorted):', sortedCards.slice(0, 5).map(c => c.name));
    console.log('Last 5 cards (sorted):', sortedCards.slice(-5).map(c => c.name));
    
    // Scatter cards throughout the binder with empty slots
    // Create array of indices and shuffle them
    const indices = [];
    for (let i = 0; i < totalSlots; i++) {
        indices.push(i);
    }
    
    // Shuffle indices
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // Initialize all slots as empty
    for (let i = 0; i < totalSlots; i++) {
        testBinder.cards.push(null);
    }
    
    // Place cards at random positions
    for (let i = 0; i < cardCount && i < cards.length; i++) {
        const randomIndex = indices[i];
        testBinder.cards[randomIndex] = cards[i];
    }
    
    // Count actual cards and empty slots
    const actualCardCount = testBinder.cards.filter(c => c !== null).length;
    const actualEmptyCount = testBinder.cards.filter(c => c === null).length;
    console.log(`\nBinder state: ${actualCardCount} cards, ${actualEmptyCount} empty slots`);
    
    // Find some example cards and their positions
    const exampleCards = [];
    for (let i = 0; i < testBinder.cards.length; i++) {
        if (testBinder.cards[i]) {
            exampleCards.push({ index: i, name: testBinder.cards[i].name });
            if (exampleCards.length >= 5) break;
        }
    }
    console.log('Sample card positions:', exampleCards.map(c => `#${c.index}: ${c.name}`).join(', '));
    
    // Test sorting
    console.log('\n--- Running sort optimization test ---');
    const result = calculateMinimumSwaps(testBinder, 'name');
    
    console.log(`\nTotal moves: ${result.moves.length}`);
    console.log(`Total cards: ${result.cardsWithIndices.length}`);
    
    // Show first 10 moves
    console.log('\nFirst 10 moves:');
    result.moves.slice(0, 10).forEach((move, idx) => {
        const cardName = move.card.name.substring(0, 20);
        console.log(`  ${idx + 1}. Move #${move.from} -> #${move.to} (${cardName}${move.card.name.length > 20 ? '...' : ''})`);
    });
    
    // Analyze move efficiency
    const movesToEmpty = result.moves.filter(m => !m.targetCard);
    const swaps = result.moves.filter(m => m.targetCard);
    
    console.log(`\nMove breakdown:`);
    console.log(`  Moves to empty slots: ${movesToEmpty.length}`);
    console.log(`  Swaps: ${swaps.length}`);
    
    // Check if moves from end come first
    const movesFromEnd = result.moves.filter(m => m.from >= totalSlots * 0.7); // Last 30% of binder
    const movesFromFront = result.moves.filter(m => m.from < totalSlots * 0.3); // First 30% of binder
    
    console.log(`\nSource position analysis:`);
    console.log(`  Moves from end (70%+): ${movesFromEnd.length}`);
    console.log(`  Moves from front (0-30%): ${movesFromFront.length}`);
    
    if (movesToEmpty.length > 0) {
        const avgSourceIndex = movesToEmpty.reduce((sum, m) => sum + m.from, 0) / movesToEmpty.length;
        console.log(`  Average source index for empty-slot moves: ${avgSourceIndex.toFixed(1)} (max: ${totalSlots - 1})`);
        
        // Check first few moves to empty slots
        const firstMovesToEmpty = movesToEmpty.slice(0, 5);
        const avgFirstSource = firstMovesToEmpty.reduce((sum, m) => sum + m.from, 0) / firstMovesToEmpty.length;
        console.log(`  Average source index for first 5 empty-slot moves: ${avgFirstSource.toFixed(1)}`);
        
        if (avgFirstSource > totalSlots * 0.6) {
            console.log('  ✓ PASS: First moves to empty slots prioritize cards from end');
        } else {
            console.log('  ✗ FAIL: First moves to empty slots are not from end');
        }
    }
    
    // Test for inefficiency pattern
    console.log('\nInefficiency check:');
    let inefficiencyCount = 0;
    const positionsEmptied = new Set();
    
    for (let i = 0; i < result.moves.length; i++) {
        const move = result.moves[i];
        
        if (move.from !== move.to) {
            positionsEmptied.add(move.from);
        }
        
        if (positionsEmptied.has(move.to) && move.from > move.to) {
            const moveThatEmptied = result.moves.slice(0, i).find(m => m.from === move.to);
            if (moveThatEmptied) {
                inefficiencyCount++;
                if (inefficiencyCount <= 3) {
                    console.log(`  ✗ INEFFICIENT: Move #${move.from}->#${move.to} fills slot emptied by #${moveThatEmptied.from}->#${moveThatEmptied.to}`);
                }
            }
        }
    }
    
    if (inefficiencyCount === 0) {
        console.log('  ✓ PASS: No inefficient moves detected');
    } else {
        console.log(`  ✗ FAIL: Found ${inefficiencyCount} inefficient move(s)`);
    }
    
    return { binder: testBinder, result };
}

// Expose test functions to console
window.testSortOptimization = testSortOptimization;
window.testLargeBinderSort = testLargeBinderSort;