import {join, dirname, relative} from "path";
import {fileURLToPath} from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const BINDER_PATH = join(__dirname, "binder.json");

export let Binder = {
    cardsPerPage: 9,
    pages: []
};

let EDIT_MODE = false;

export function getPageByIndex(index){
    const pageIndex = Math.floor(index / Binder.cardsPerPage);
    return Binder.pages[pageIndex];
}

export function createPage(){
    const page = Array(Binder.cardsPerPage).fill(null);
    Binder.pages.push(page);
    return page;
}

export function insertCardByIndex(card, index){
    const page = getPageByIndex(index);
    const subIndex = index%Binder.cardsPerPage;
    page[subIndex] = card;
    //sortBinder();
}

export function getCardByIndex(index){
    const page = getPageByIndex(index);
    const subIndex = index%Binder.cardsPerPage;
    return page[subIndex];
}

export function pullCardByIndex(index){
    const page = getPageByIndex(index);
    const subIndex = index%Binder.cardsPerPage;
    const card = page[subIndex];
    page[subIndex] = null;
    //sortBinder();
    return card;
}

export function getFirstEmptyIndex(){
    for(let i=0;i<Binder.pages.length;i++){
        for(let j=0;j<Binder.pages[i].length;j++){
            if(Binder.pages[i][j] === null){
                return i*Binder.cardsPerPage+j;
            }
        }
    }
    return null;
}

export function insertCard(card){
    let firstEmptyIndex = getFirstEmptyIndex();
    if(firstEmptyIndex === null){
        createPage();
        firstEmptyIndex = getFirstEmptyIndex();
    }
    insertCardByIndex(card, firstEmptyIndex);
    return firstEmptyIndex;
}

export function sortBinder(sort){
    if(EDIT_MODE) return;
    if(Binder.pages.length === 0) return;
    Binder.pages.forEach((page)=>page.sort(sort));
}

export async function edit(modifier){
    EDIT_MODE = true;
    await modifier();
    EDIT_MODE = false;
    sortBinder();
}

export function getPages(){
    return Binder.pages;
}

export async function saveBinder(){
    await fs.writeFile(BINDER_PATH, JSON.stringify(Binder, null, 2));
}

export async function loadBinder(){
    Binder = JSON.parse(await fs.readFile(BINDER_PATH, "utf8"));
}