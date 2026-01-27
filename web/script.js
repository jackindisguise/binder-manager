const STORAGE_KEY = 'tcgBinder';
let currentEditIndex = null;
let pullMode = false;
const recentlyAddedIndices = new Set();

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
        cards: []
    };
}

function saveBinder(binder) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(binder));
    render();
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
                const onClick = pullMode ? '' : `onclick="openAddCardModal(${cardIndexNumber})"`;
                cardsHtml.push(`<div class="card empty" ${onClick}>
                    <div class="card-index">#${cardIndexNumber}</div>
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
                        <div class="card-index">#${cardIndexNumber}</div>
                        <div class="card-info">
                            <div class="card-name">${escapedName}</div>
                            <div class="card-number">${escapedNumber}</div>
                            <div class="card-condition">${escapedCondition}</div>
                            <div class="card-value">$${formattedValue}</div>
                        </div>
                        <div class="pull-progress-bar" id="pullProgress-${cardIndexNumber}" style="width: 0%;"></div>
                    </div>`);
                } else {
                    cardsHtml.push(`<div class="card${recentClass}" onclick="openEditCardModal(${cardIndexNumber})">
                        <div class="card-index">#${cardIndexNumber}</div>
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
            const onClick = pullMode ? '' : `onclick="openAddCardModal(${cardIndexNumber})"`;
            cardsHtml.push(`<div class="card empty" ${onClick}>
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
    document.getElementById('modalTitle').textContent = index !== null ? `Edit Card #${index}` : 'Add Card';
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
    
    // Generate filename with current date/time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const filename = `binder-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.json`;
    
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
    updatePullModeUI();
    render();
}

function updatePullModeUI() {
    const btn = document.getElementById('pullModeBtn');
    const indicator = document.getElementById('pullModeIndicator');
    if (pullMode) {
        btn.textContent = 'Pull Mode: On';
        btn.classList.add('active');
        indicator.classList.remove('hidden');
    } else {
        btn.textContent = 'Pull Mode: Off';
        btn.classList.remove('active');
        indicator.classList.add('hidden');
    }
}

let pullTimers = {};
const PULL_DURATION = 1000; // 1 second

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

function calculateMinimumSwaps(binder, sortBy) {
    // Collect all cards with their current indices
    const cardsWithIndices = [];
    if (!binder.cards || !Array.isArray(binder.cards)) {
        return { totalSwaps: 0, moves: [], cycles: [], sortedCards: [], cardsWithIndices: [] };
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
    
    // Sort cards by criteria
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
    
    // Calculate target positions (sequential, filling empty slots)
    // Each sorted card should go to the next available position
    let targetPosition = 0;
    const positionMap = new Map(); // currentIndex -> targetIndex
    
    sortedCards.forEach((item) => {
        positionMap.set(item.currentIndex, targetPosition);
        targetPosition++;
    });
    
    // Find cycles in the permutation
    // For each card at currentIndex, it should move to targetIndex
    // To find cycles: if card at A goes to B, find card at B and see where it goes
    const visited = new Set();
    const cycles = [];
    
    // Create a map: targetIndex -> currentIndex (which card is currently at the target position)
    // Actually, we need: for target position T, which card's currentIndex is T?
    // That's just: find card where currentIndex === target
    const targetToCurrent = new Map();
    cardsWithIndices.forEach((item) => {
        const target = positionMap.get(item.currentIndex);
        if (target !== undefined) {
            // The card at item.currentIndex should go to target
            // So if we're looking for what's at target, we need to find the card whose currentIndex equals target
            const cardAtTarget = cardsWithIndices.find(c => c.currentIndex === target);
            if (cardAtTarget) {
                targetToCurrent.set(target, cardAtTarget.currentIndex);
            }
        }
    });
    
    cardsWithIndices.forEach((item) => {
        if (visited.has(item.currentIndex)) return;
        
        const cycle = [];
        let current = item.currentIndex;
        
        while (!visited.has(current)) {
            visited.add(current);
            cycle.push(current);
            const target = positionMap.get(current);
            if (target === undefined || target === current) break;
            // Find which card is currently at the target position
            // That's the card whose currentIndex equals target
            const cardAtTarget = cardsWithIndices.find(c => c.currentIndex === target);
            if (!cardAtTarget) break;
            current = cardAtTarget.currentIndex;
        }
        
        if (cycle.length > 1) {
            cycles.push(cycle);
        }
    });
    
    // Calculate swaps needed (each cycle of length k needs k-1 swaps)
    const totalSwaps = cycles.reduce((sum, cycle) => sum + (cycle.length - 1), 0);
    
    // Build a map of what's currently at each position
    const positionToCard = new Map();
    cardsWithIndices.forEach((item) => {
        positionToCard.set(item.currentIndex, item);
    });
    
    // Separate moves into: moves to empty slots vs swaps between cards
    const movesToEmpty = [];
    const swaps = [];
    
    sortedCards.forEach((sortedItem) => {
        const targetIdx = positionMap.get(sortedItem.currentIndex);
        if (targetIdx !== undefined && sortedItem.currentIndex !== targetIdx) {
            const targetCard = positionToCard.get(targetIdx);
            if (targetCard) {
                // This is a swap (target position has a card)
                swaps.push({
                    from: sortedItem.currentIndex,
                    to: targetIdx,
                    card: sortedItem.card,
                    targetCard: targetCard.card
                });
            } else {
                // This is a move to empty slot
                movesToEmpty.push({
                    from: sortedItem.currentIndex,
                    to: targetIdx,
                    card: sortedItem.card
                });
            }
        }
    });
    
    // Order swaps into chains
    // When we swap A->B, we're holding the card that was at B
    // So the next swap should move that card from B to its target position
    const orderedSwaps = [];
    const usedSwaps = new Set();
    
    // Create a map: card -> target position (where each card should go)
    const cardToTarget = new Map();
    cardsWithIndices.forEach((item) => {
        const target = positionMap.get(item.currentIndex);
        if (target !== undefined) {
            cardToTarget.set(item.card, target);
        }
    });
    
    // Create a map: position -> swaps that move FROM that position
    const swapsFromPosition = new Map();
    swaps.forEach(swap => {
        if (!swapsFromPosition.has(swap.from)) {
            swapsFromPosition.set(swap.from, []);
        }
        swapsFromPosition.get(swap.from).push(swap);
    });
    
    // Build chains
    for (const swap of swaps) {
        if (usedSwaps.has(`${swap.from}-${swap.to}`)) continue;
        
        const chain = [];
        let currentSwap = swap;
        
        // Follow the chain
        while (currentSwap && !usedSwaps.has(`${currentSwap.from}-${currentSwap.to}`)) {
            usedSwaps.add(`${currentSwap.from}-${currentSwap.to}`);
            chain.push(currentSwap);
            
            // After swapping from->to, we're holding the card that was at 'to' (targetCard)
            // Find where that card should go
            const targetCardTarget = cardToTarget.get(currentSwap.targetCard);
            if (targetCardTarget !== undefined && targetCardTarget !== currentSwap.to) {
                // Find the swap that moves targetCard from 'to' position to its target
                // The targetCard's current position is 'to', so find swap from 'to'
                const nextSwaps = swapsFromPosition.get(currentSwap.to) || [];
                currentSwap = nextSwaps.find(s => 
                    s.card === currentSwap.targetCard && 
                    !usedSwaps.has(`${s.from}-${s.to}`)
                );
            } else {
                // Card is already in place or going to empty, chain ends
                currentSwap = null;
            }
        }
        
        orderedSwaps.push(...chain);
    }
    
    // Combine: moves to empty can be done anytime, ordered swaps follow chains
    const allMoves = [...movesToEmpty, ...orderedSwaps];
    
    return {
        totalSwaps,
        moves: allMoves,
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
    
    if (result.totalSwaps === 0) {
        infoDiv.innerHTML = `
            <div style="color: #28a745; font-weight: 600;">✓ Binder is already sorted by ${sortBy}!</div>
        `;
        swapsDiv.innerHTML = '';
    } else {
        infoDiv.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong>Total cards:</strong> ${result.cardsWithIndices.length}
            </div>
            <div style="margin-bottom: 10px;">
                <strong>Swaps needed:</strong> ${result.totalSwaps}
            </div>
            <div style="color: #666; font-size: 14px;">
                The following swaps will be made to sort the binder:
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
                            #${move.from} → #${move.to}
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
    
    if (result.totalSwaps === 0) {
        closeSortModal();
        return;
    }
    
    const cardsPerPage = getCardsPerPage();
    // Create new sorted binder with flat cards array
    const newBinder = {
        cardsPerPage: cardsPerPage,
        cards: []
    };
    
    // Determine how many slots we need (keep at least as many as original)
    const originalLength = binder.cards ? binder.cards.length : 0;
    const neededSlots = Math.max(originalLength, result.sortedCards.length);
    
    // Initialize with nulls
    newBinder.cards = Array(neededSlots).fill(null);
    
    // Place sorted cards in order
    result.sortedCards.forEach((item, idx) => {
        newBinder.cards[idx] = item.card;
    });
    
    saveBinder(newBinder);
    closeSortModal();
}

// Close sort modal on outside click
document.getElementById('sortModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeSortModal();
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

// Initialize
updatePullModeUI();
updatePageSizeDropdown();
render();