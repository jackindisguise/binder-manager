#!/usr/bin/env node

/**
 * TCG Binder Collection - REPL Client
 * Interactive command-line interface for managing binder collections
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    // Text colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    // Background colors
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',
};

// Helper functions for colored output
function colorize(text, color) {
    return `${color}${text}${colors.reset}`;
}

function success(text) {
    return colorize(`✓ ${text}`, colors.green);
}

function error(text) {
    return colorize(`✗ ${text}`, colors.red);
}

function info(text) {
    return colorize(text, colors.cyan);
}

function warning(text) {
    return colorize(text, colors.yellow);
}

function highlight(text) {
    return colorize(text, colors.bright + colors.cyan);
}

// Binder data structure
let binder = {
    cardsPerPage: 9,
    cards: [],
    name: 'TCG Binder Collection'
};

let indexOffset = 0; // 0-based by default
let pullHistory = [];

// Helper functions
function formatIndex(index) {
    return index + indexOffset;
}

function getFirstEmptyIndex() {
    for (let i = 0; i < binder.cards.length; i++) {
        if (binder.cards[i] === null || binder.cards[i] === undefined) {
            return i;
        }
    }
    return binder.cards.length;
}

function insertCard(card) {
    const index = getFirstEmptyIndex();
    if (index >= binder.cards.length) {
        binder.cards.push(card);
    } else {
        binder.cards[index] = card;
    }
    return index;
}

function saveBinder(filepath = 'binder.json') {
    try {
        fs.writeFileSync(filepath, JSON.stringify(binder, null, 2));
        console.log(success(`Binder saved to ${filepath}`));
    } catch (error) {
        console.error(error(`Error saving binder: ${error.message}`));
    }
}

function loadBinder(filepath = 'binder.json') {
    try {
        if (fs.existsSync(filepath)) {
            const data = fs.readFileSync(filepath, 'utf8');
            binder = JSON.parse(data);
            // Ensure defaults
            if (!binder.cardsPerPage) binder.cardsPerPage = 9;
            if (!binder.name) binder.name = 'TCG Binder Collection';
            if (!binder.cards) binder.cards = [];
            console.log(success(`Binder loaded from ${filepath}`));
            return true;
        } else {
            console.log(error(`File not found: ${filepath}`));
            return false;
        }
    } catch (error) {
        console.error(error(`Error loading binder: ${error.message}`));
        return false;
    }
}

function calculateStats() {
    const totalCards = binder.cards.filter(c => c !== null && c !== undefined).length;
    const totalValue = binder.cards.reduce((sum, card) => {
        return sum + (card && card.value !== undefined && card.value !== null ? card.value : 0);
    }, 0);
    const totalPages = Math.ceil(binder.cards.length / binder.cardsPerPage);
    return { totalCards, totalValue, totalPages };
}

// Sort functions (hole-chasing algorithm)
function calculateMinimumSwaps(sortBy) {
    const cardsWithIndices = [];
    for (let i = 0; i < binder.cards.length; i++) {
        const card = binder.cards[i];
        if (card) {
            cardsWithIndices.push({ card, currentIndex: i });
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
    
    // Build target array
    const targetBinder = [];
    const cardToTargetIndex = new Map();
    const targetToCard = new Map();
    
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
    
    // Build card to current position map
    const cardToCurrentPos = new Map();
    for (let i = 0; i < currentBinder.length; i++) {
        const card = currentBinder[i];
        if (card) {
            const cardKey = `${card.name}|${card.number}`;
            cardToCurrentPos.set(cardKey, i);
        }
    }
    
    // Hole-chasing algorithm
    const moves = [];
    const processedCards = new Set();
    
    function chaseHole(holeIndex) {
        const chainMoves = [];
        let currentHole = holeIndex;
        const visitedHoles = new Set();
        
        while (currentHole !== undefined) {
            if (targetBinder[currentHole] === undefined || targetBinder[currentHole] === null) {
                break;
            }
            
            if (visitedHoles.has(currentHole)) {
                break;
            }
            
            visitedHoles.add(currentHole);
            
            const targetCard = targetBinder[currentHole];
            if (!targetCard) break;
            
            const cardKey = `${targetCard.name}|${targetCard.number}`;
            const cardCurrentPos = cardToCurrentPos.get(cardKey);
            
            if (cardCurrentPos === undefined) break;
            if (cardCurrentPos === currentHole) {
                processedCards.add(cardKey);
                break;
            }
            if (processedCards.has(cardKey)) break;
            
            const card = currentBinder[cardCurrentPos];
            chainMoves.push({
                from: cardCurrentPos,
                to: currentHole,
                card: card
            });
            
            processedCards.add(cardKey);
            currentHole = cardCurrentPos;
        }
        
        chainMoves.reverse();
        moves.push(...chainMoves);
    }
    
    // Find all holes
    const holes = [];
    for (let i = 0; i < currentBinder.length; i++) {
        if (currentBinder[i] === null) {
            holes.push(i);
        }
    }
    
    for (const hole of holes) {
        chaseHole(hole);
    }
    
    // Handle remaining cards (cycles)
    for (let i = 0; i < currentBinder.length; i++) {
        const card = currentBinder[i];
        if (!card) continue;
        
        const cardKey = `${card.name}|${card.number}`;
        if (processedCards.has(cardKey)) continue;
        
        const targetIdx = cardToTargetIndex.get(i);
        if (targetIdx === undefined || targetIdx === i) {
            processedCards.add(cardKey);
            continue;
        }
        
        moves.push({
            from: i,
            to: targetIdx,
            card: card
        });
        processedCards.add(cardKey);
    }
    
    return { moves, sortedCards, cardsWithIndices };
}

// Convert functions
function calculateConversionMoves(targetCardsPerPage, sortBy) {
    const cardsWithIndices = [];
    for (let i = 0; i < binder.cards.length; i++) {
        const card = binder.cards[i];
        if (card) {
            cardsWithIndices.push({ card, currentIndex: i });
        }
    }
    
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
    
    const moves = [];
    sortedCards.forEach((item, idx) => {
        moves.push({
            from: item.currentIndex,
            to: idx,
            card: item.card
        });
    });
    
    return { moves, sortedCards, cardsWithIndices };
}

// REPL Interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colorize('binder> ', colors.cyan + colors.bright)
});

function printHelp() {
    console.log(`
${highlight('Available commands:')}
  ${colorize('help', colors.cyan)}                    - Show this help message
  ${colorize('stats', colors.cyan)}                   - Show binder statistics
  ${colorize('list [page]', colors.cyan)}             - List cards (optionally by page number)
  ${colorize('show <index>', colors.cyan)}             - Show card at index
  ${colorize('add [name] [number]', colors.cyan)}     - Add a new card (interactive if no args)
  ${colorize('edit <index>', colors.cyan)}            - Edit card at index
  ${colorize('remove <index>', colors.cyan)}          - Remove card at index
  ${colorize('move <from> <to>', colors.cyan)}        - Move card from index to index
  ${colorize('sort <criteria>', colors.cyan)}         - Sort binder (name|number|value)
  ${colorize('convert <size> [sort]', colors.cyan)}   - Convert binder (4|9|12, optional: name|number|value|none)
  ${colorize('bulk <file>', colors.cyan)}             - Bulk insert cards from CSV file
  ${colorize('export [file]', colors.cyan)}           - Export binder to JSON file
  ${colorize('import <file>', colors.cyan)}           - Import binder from JSON file
  ${colorize('rename <name>', colors.cyan)}           - Rename binder
  ${colorize('pagesize <size>', colors.cyan)}         - Set page size (4|9|12)
  ${colorize('indexoffset <0|1>', colors.cyan)}       - Set index offset (0-based or 1-based)
  ${colorize('clear', colors.cyan)}                   - Clear all cards
  ${colorize('undo', colors.cyan)}                    - Undo last card removal
  ${colorize('quit, exit', colors.cyan)}              - Exit the REPL
`);
}

function printStats() {
    const stats = calculateStats();
    console.log(`
${highlight('Binder:')} ${binder.name}
${highlight('Total Pages:')} ${stats.totalPages}
${highlight('Total Cards:')} ${stats.totalCards}
${highlight('Total Value:')} ${colorize('$' + stats.totalValue.toFixed(2), colors.green)}
${highlight('Page Size:')} ${binder.cardsPerPage} cards/page
${highlight('Index Offset:')} ${indexOffset === 0 ? '0-based' : '1-based'}
`);
}

function listCards(pageNum = null) {
    const cardsPerPage = binder.cardsPerPage;
    const totalPages = Math.ceil(binder.cards.length / cardsPerPage);
    
    if (pageNum !== null) {
        if (pageNum < 1 || pageNum > totalPages) {
            console.log(error(`Invalid page number. Valid range: 1-${totalPages}`));
            return;
        }
        const start = (pageNum - 1) * cardsPerPage;
        const end = Math.min(start + cardsPerPage, binder.cards.length);
        console.log(`\n${highlight(`Page ${pageNum}:`)}`);
        for (let i = start; i < end; i++) {
            const card = binder.cards[i];
            if (card) {
                const indexColor = colorize(`#${formatIndex(i)}`, colors.cyan);
                const valueColor = colorize('$' + (card.value || 0).toFixed(2), colors.green);
                console.log(`  ${indexColor}: ${card.name} ${colorize('(' + card.number + ')', colors.dim)} - ${valueColor}`);
            } else {
                console.log(`  ${colorize(`#${formatIndex(i)}`, colors.dim)}: ${colorize('[empty]', colors.dim)}`);
            }
        }
    } else {
        // List all cards
        let currentPage = 1;
        for (let i = 0; i < binder.cards.length; i += cardsPerPage) {
            const pageStart = i;
            const pageEnd = Math.min(i + cardsPerPage, binder.cards.length);
            console.log(`\n${highlight(`Page ${currentPage}:`)}`);
            for (let j = pageStart; j < pageEnd; j++) {
                const card = binder.cards[j];
                if (card) {
                    const indexColor = colorize(`#${formatIndex(j)}`, colors.cyan);
                    const valueColor = colorize('$' + (card.value || 0).toFixed(2), colors.green);
                    console.log(`  ${indexColor}: ${card.name} ${colorize('(' + card.number + ')', colors.dim)} - ${valueColor}`);
                } else {
                    console.log(`  ${colorize(`#${formatIndex(j)}`, colors.dim)}: ${colorize('[empty]', colors.dim)}`);
                }
            }
            currentPage++;
        }
    }
}

function showCard(index) {
    const actualIndex = index - indexOffset;
    if (actualIndex < 0 || actualIndex >= binder.cards.length) {
        console.log(error(`Invalid index: ${index}`));
        return;
    }
    const card = binder.cards[actualIndex];
    if (!card) {
        console.log(error(`No card at index ${index}`));
        return;
    }
    console.log(`
${highlight(`Card #${index}:`)}
  ${colorize('Name:', colors.cyan)} ${card.name}
  ${colorize('Number:', colors.cyan)} ${card.number}
  ${colorize('Condition:', colors.cyan)} ${card.condition || 'N/A'}
  ${colorize('Value:', colors.cyan)} ${colorize('$' + (card.value || 0).toFixed(2), colors.green)}
`);
}

function addCard(name, number, condition, value) {
    if (!name || !number) {
        console.log(error('Name and number are required'));
        return;
    }
    const card = {
        name: name.trim(),
        number: number.trim(),
        condition: condition ? condition.trim() : '',
        value: value ? parseFloat(value) : 0
    };
    const index = insertCard(card);
    console.log(success(`Card added at index ${formatIndex(index)}`));
}

function editCard(index, name, number, condition, value) {
    const actualIndex = index - indexOffset;
    if (actualIndex < 0 || actualIndex >= binder.cards.length) {
        console.log(error(`Invalid index: ${index}`));
        return;
    }
    const card = binder.cards[actualIndex];
    if (!card) {
        console.log(error(`No card at index ${index}`));
        return;
    }
    
    if (name) card.name = name.trim();
    if (number) card.number = number.trim();
    if (condition !== undefined) card.condition = condition.trim();
    if (value !== undefined) card.value = parseFloat(value);
    
    console.log(success(`Card at index ${index} updated`));
}

function removeCard(index) {
    const actualIndex = index - indexOffset;
    if (actualIndex < 0 || actualIndex >= binder.cards.length) {
        console.log(error(`Invalid index: ${index}`));
        return;
    }
    const card = binder.cards[actualIndex];
    if (!card) {
        console.log(error(`No card at index ${index}`));
        return;
    }
    
    // Save to history
    pullHistory.push({
        index: actualIndex,
        card: JSON.parse(JSON.stringify(card))
    });
    if (pullHistory.length > 50) {
        pullHistory.shift();
    }
    
    binder.cards[actualIndex] = null;
    console.log(success(`Card removed from index ${index}`));
}

function moveCard(from, to) {
    const fromIndex = from - indexOffset;
    const toIndex = to - indexOffset;
    
    if (fromIndex < 0 || fromIndex >= binder.cards.length) {
        console.log(error(`Invalid source index: ${from}`));
        return;
    }
    if (toIndex < 0 || toIndex >= binder.cards.length) {
        // Extend array if needed
        while (binder.cards.length <= toIndex) {
            binder.cards.push(null);
        }
    }
    
    const sourceCard = binder.cards[fromIndex];
    if (!sourceCard) {
        console.log(error(`No card at source index ${from}`));
        return;
    }
    
    const targetCard = binder.cards[toIndex];
    binder.cards[toIndex] = sourceCard;
    binder.cards[fromIndex] = targetCard;
    
    console.log(success(`Card moved from index ${from} to ${to}`));
}

function sortBinder(criteria) {
    if (!['name', 'number', 'value'].includes(criteria)) {
        console.log(error('Invalid sort criteria. Use: name, number, or value'));
        return;
    }
    
    const result = calculateMinimumSwaps(criteria);
    console.log(`\n${info(`Sorting by ${criteria}...`)}`);
    console.log(`${highlight('Total moves needed:')} ${result.moves.length}`);
    
    if (result.moves.length === 0) {
        console.log(success('Binder is already sorted!'));
        return;
    }
    
    // Apply moves - need to find cards by identity since positions change as we apply moves
    const workingBinder = [];
    const maxIndex = Math.max(
        binder.cards.length - 1,
        ...result.moves.map(m => Math.max(m.from, m.to))
    );
    
    // Copy current state
    for (let i = 0; i <= maxIndex; i++) {
        workingBinder[i] = (binder.cards[i] || null);
    }
    
    // Apply each move in sequence
    result.moves.forEach(move => {
        // Find the card that matches move.card in the current state (by identity)
        let sourceIndex = -1;
        for (let i = 0; i < workingBinder.length; i++) {
            const card = workingBinder[i];
            if (card && 
                card.name === move.card.name && 
                card.number === move.card.number) {
                sourceIndex = i;
                break;
            }
        }
        
        if (sourceIndex === -1) {
            console.log(warning(`Card not found for move: ${move.card.name} (${move.card.number})`));
            return;
        }
        
        const sourceCard = workingBinder[sourceIndex];
        const targetCard = workingBinder[move.to];
        
        if (targetCard) {
            // This is a swap - move source card to target, and target card to source
            workingBinder[move.to] = sourceCard;
            workingBinder[sourceIndex] = targetCard;
        } else {
            // This is a move to empty slot - just move the card
            workingBinder[move.to] = sourceCard;
            workingBinder[sourceIndex] = null;
        }
    });
    
    // Build final sorted state from the sortedCards
    const finalBinder = [];
    result.sortedCards.forEach((item, idx) => {
        finalBinder[idx] = item.card;
    });
    
    binder.cards = finalBinder;
    
    // Trim trailing nulls
    let lastCardIndex = -1;
    for (let i = binder.cards.length - 1; i >= 0; i--) {
        if (binder.cards[i] !== null) {
            lastCardIndex = i;
            break;
        }
    }
    if (lastCardIndex >= 0) {
        binder.cards = binder.cards.slice(0, lastCardIndex + 1);
    } else {
        binder.cards = [];
    }
    
    console.log(success('Binder sorted successfully'));
}

function convertBinder(size, sortBy = 'none') {
    const validSizes = [4, 9, 12];
    const sizeNum = parseInt(size);
    if (!validSizes.includes(sizeNum)) {
        console.log(error('Invalid size. Use: 4, 9, or 12'));
        return;
    }
    
    if (sortBy !== 'none' && !['name', 'number', 'value'].includes(sortBy)) {
        console.log(error('Invalid sort criteria. Use: name, number, value, or none'));
        return;
    }
    
    const result = calculateConversionMoves(sizeNum, sortBy);
    console.log(`\n${info(`Converting to ${sizeNum} cards/page (${sortBy !== 'none' ? `sorted by ${sortBy}` : 'no sorting'})...`)}`);
    console.log(`${highlight('Total moves needed:')} ${result.moves.length}`);
    
    // Apply conversion
    const newBinder = {
        cardsPerPage: sizeNum,
        cards: [],
        name: binder.name
    };
    
    const totalCards = result.sortedCards.length;
    const neededSlots = Math.ceil(totalCards / sizeNum) * sizeNum;
    newBinder.cards = Array(neededSlots).fill(null);
    
    result.sortedCards.forEach((item, idx) => {
        newBinder.cards[idx] = item.card;
    });
    
    binder = newBinder;
    console.log(success('Binder converted successfully'));
}

function bulkInsert(filepath) {
    try {
        if (!fs.existsSync(filepath)) {
            console.log(error(`File not found: ${filepath}`));
            return;
        }
        
        const content = fs.readFileSync(filepath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        
        let successCount = 0;
        let errorCount = 0;
        
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;
            
            // Simple CSV parsing (handles quoted values)
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
            parts.push(current.trim());
            
            const cleanParts = parts.map(part => part.replace(/^"|"$/g, ''));
            
            if (cleanParts.length < 4) {
                errorCount++;
                console.log(error(`Line ${index + 1}: Insufficient columns`));
                return;
            }
            
            const [name, number, condition, valueStr] = cleanParts;
            const value = parseFloat(valueStr);
            
            if (!name || !number) {
                errorCount++;
                console.log(error(`Line ${index + 1}: Name and Number are required`));
                return;
            }
            
            if (isNaN(value)) {
                errorCount++;
                console.log(error(`Line ${index + 1}: Invalid value "${valueStr}"`));
                return;
            }
            
            const card = {
                name: name.trim(),
                number: number.trim(),
                condition: condition || '',
                value: value || 0
            };
            
            insertCard(card);
            successCount++;
        });
        
        if (errorCount === 0) {
            console.log(success(`Bulk insert complete: ${successCount} cards added`));
        } else {
            console.log(warning(`Bulk insert complete: ${successCount} successful, ${errorCount} errors`));
        }
    } catch (error) {
        console.error(error(`Error during bulk insert: ${error.message}`));
    }
}

function undoPull() {
    if (pullHistory.length === 0) {
        console.log(error('No cards to undo'));
        return;
    }
    
    const lastPull = pullHistory.pop();
    while (binder.cards.length <= lastPull.index) {
        binder.cards.push(null);
    }
    binder.cards[lastPull.index] = lastPull.card;
    console.log(success(`Restored card at index ${formatIndex(lastPull.index)}`));
}

// Command processing
function processCommand(line) {
    const parts = line.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    switch (command) {
        case 'help':
        case 'h':
            printHelp();
            break;
            
        case 'stats':
        case 's':
            printStats();
            break;
            
        case 'list':
        case 'l':
            if (args.length > 0) {
                const page = parseInt(args[0]);
                listCards(page);
            } else {
                listCards();
            }
            break;
            
        case 'show':
            if (args.length < 1) {
                console.log(error('Usage: show <index>'));
                break;
            }
            showCard(parseInt(args[0]));
            break;
            
        case 'add':
        case 'a':
            if (args.length >= 2) {
                addCard(args[0], args[1], args[2], args[3]);
            } else {
                // Interactive mode
                rl.question(colorize('Card name: ', colors.cyan), (name) => {
                    rl.question(colorize('Card number: ', colors.cyan), (number) => {
                        rl.question(colorize('Condition (optional): ', colors.cyan), (condition) => {
                            rl.question(colorize('Value (optional): ', colors.cyan), (value) => {
                                addCard(name, number, condition, value);
                                rl.prompt();
                            });
                        });
                    });
                });
            }
            break;
            
        case 'edit':
        case 'e':
            if (args.length < 1) {
                console.log(error('Usage: edit <index> [name] [number] [condition] [value]'));
                break;
            }
            const editIndex = parseInt(args[0]);
            editCard(editIndex, args[1], args[2], args[3], args[4]);
            break;
            
        case 'remove':
        case 'rm':
        case 'delete':
        case 'del':
            if (args.length < 1) {
                console.log(error('Usage: remove <index>'));
                break;
            }
            removeCard(parseInt(args[0]));
            break;
            
        case 'move':
        case 'mv':
            if (args.length < 2) {
                console.log(error('Usage: move <from> <to>'));
                break;
            }
            moveCard(parseInt(args[0]), parseInt(args[1]));
            break;
            
        case 'sort':
            if (args.length < 1) {
                console.log(error('Usage: sort <name|number|value>'));
                break;
            }
            sortBinder(args[0]);
            break;
            
        case 'convert':
        case 'conv':
            if (args.length < 1) {
                console.log(error('Usage: convert <4|9|12> [name|number|value|none]'));
                break;
            }
            convertBinder(args[0], args[1] || 'none');
            break;
            
        case 'bulk':
            if (args.length < 1) {
                console.log(error('Usage: bulk <file>'));
                break;
            }
            bulkInsert(args[0]);
            break;
            
        case 'export':
            saveBinder(args[0] || 'binder.json');
            break;
            
        case 'import':
        case 'load':
            if (args.length < 1) {
                console.log(error('Usage: import <file>'));
                break;
            }
            loadBinder(args[0]);
            break;
            
        case 'rename':
            if (args.length < 1) {
                console.log(error('Usage: rename <name>'));
                break;
            }
            binder.name = args.join(' ');
            console.log(success(`Binder renamed to: ${binder.name}`));
            break;
            
        case 'pagesize':
        case 'ps':
            if (args.length < 1) {
                console.log(error('Usage: pagesize <4|9|12>'));
                break;
            }
            const newSize = parseInt(args[0]);
            if ([4, 9, 12].includes(newSize)) {
                binder.cardsPerPage = newSize;
                console.log(success(`Page size set to ${newSize}`));
            } else {
                console.log(error('Invalid page size. Use: 4, 9, or 12'));
            }
            break;
            
        case 'indexoffset':
        case 'io':
            if (args.length < 1) {
                console.log(error('Usage: indexoffset <0|1>'));
                break;
            }
            const offset = parseInt(args[0]);
            if (offset === 0 || offset === 1) {
                indexOffset = offset;
                console.log(success(`Index offset set to ${offset === 0 ? '0-based' : '1-based'}`));
            } else {
                console.log(error('Invalid offset. Use: 0 or 1'));
            }
            break;
            
        case 'clear':
            binder.cards = [];
            pullHistory = [];
            console.log(success('Binder cleared'));
            break;
            
        case 'undo':
            undoPull();
            break;
            
        case 'quit':
        case 'exit':
        case 'q':
            console.log(colorize('Goodbye!', colors.cyan));
            rl.close();
            process.exit(0);
            break;
            
        case '':
            // Empty line, do nothing
            break;
            
        default:
            console.log(error(`Unknown command: ${command}. Type 'help' for available commands.`));
    }
}

// Main REPL loop
console.log(colorize('TCG Binder Collection - REPL Client', colors.bright + colors.cyan));
console.log(colorize('Type "help" for available commands', colors.dim));
console.log('');

// Try to load default binder
if (fs.existsSync('binder.json')) {
    loadBinder('binder.json');
}

rl.prompt();

rl.on('line', (line) => {
    processCommand(line);
    rl.prompt();
}).on('close', () => {
    console.log(colorize('\nGoodbye!', colors.cyan));
    process.exit(0);
});
