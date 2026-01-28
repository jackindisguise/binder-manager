# binder-manager

A web application for managing a trading card game binder collection. It displays cards in a grid layout organized by pages, similar to a physical binder.

**Live demo:** https://jackindisguise.github.io/binder-manager/

## What it does

The application lets you track cards in a virtual binder. Each card has a name, number, condition, and optional value. Cards are displayed in pages with configurable sizes: 2x2 (4 cards), 3x3 (9 cards), or 4x3 (12 cards).

## Features

**Card management:**
- Add cards individually or import multiple cards from a CSV file
- Edit card details (name, number, condition, value)
- Remove cards from the binder

**Organization:**
- Sort cards by name, number, or value. The application generates a list of moves needed to reorganize the binder.
- Convert the binder between different page sizes (2x2, 3x3, 4x3) with optional sorting
- Move cards by dragging and dropping in move mode
- Remove cards by clicking and holding in pull mode

**Data management:**
- Export the binder to a JSON file
- Import a binder from a JSON file
- Rename the binder
- Clear all cards
- Undo the last card removal

**Display options:**
- Toggle between 0-based and 1-based indexing for card positions
- Adjust page size to match your physical binder layout

## 0-Based Indexing

When I started tracking my personal binders, I found it was annoying to have pages with 9 slots, but the indexes for the first card on each page would be #1, #10, #19, #28, etc. I labeled all my binders with the first card being card #0. Then the next page started on card #9, then #18, then #27. This is just my personal preference.

I've recently decided I don't care that much, since *understanding* the page indexes quickly isn't that useful of a feature. I label the first slot of each page, and that's good enough.

Though I do still prefer 0-based indexing.

## Usage

The application is a single-page web application using vanilla JavaScript, HTML, and CSS. It runs entirely in the browser with no server required. Data is stored in browser local storage.