/*jshint esversion: 6 */

let _ysfHideSet = new Set();
let _ysfMarkSet = new Set();
let _ysfProducts = null;
let _ysfTags = null;
let _ysfLastModifiedTags = [];
let _ysfInputStayFocused = false;
let _itemLimit = 6;
let _ysfIndex = -1;
let _lastSelected;
let _ysf;
const DEBUG = false;
const LOCALE_TR = "tr-tr";
const MAX_TAG_LEN = 24;
const SELECTED_CLASS = "ysf-selected";
const EXPANDED_CLASS = "expanded";
const MARKED_CLASS = "ysf-marked";
const HIDDEN_CLASS = "ysf-hidden";
const RE_DISALLOWED_CHARS = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g;

function ready(fn) {
    if (document.attachEvent ? document.readyState === "complete" : document.readyState !== "loading") {
        fn();
    }
    else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}

function logDebug(message) {
    if (DEBUG)
        console.log(message);
}

function timeExecute(label, fn) {
    if (!DEBUG)
    {
        fn();
        return;
    }

    console.time(label);
    fn();
    console.timeEnd(label);
}

let ysfFunctionsLayout1 = {
    getProductLi: product => product.parentElement,
    collectProducts: () => document.querySelectorAll(`li:not(.${HIDDEN_CLASS})>.product`)
};

let ysfFunctionsLayout2 = {
    getProductLi: product => product.parentElement.parentElement,
    collectProducts: () => document.querySelectorAll(`li:not(.${HIDDEN_CLASS})>.table-row>.product-detail-info`)
}

function validateLastModifiedTags() {
    let validated = [];
    for (let tag of _ysfLastModifiedTags) {
        if (isTagMarked(tag) || isTagHidden(tag)) {
            validated.push(tag);
        }
    }
    _ysfLastModifiedTags = validated;
}

function addToLastModifiedTags(tag) {
    let indexOfTag = _ysfLastModifiedTags.indexOf(tag);
    if (indexOfTag === -1) {
        _ysfLastModifiedTags.push(tag);
        return;
    }
    // bubble element to the end
    for (let i = indexOfTag; i < _ysfLastModifiedTags.length - 1; i++) {
        const temp = _ysfLastModifiedTags[i];
        _ysfLastModifiedTags[i] = _ysfLastModifiedTags[i + 1];
        _ysfLastModifiedTags[i + 1] = temp;
    }
}

function markProduct(product, state) {
    setProductState(product, state, MARKED_CLASS);
}

function hideProduct(product, state) {
    setProductState(product, state, HIDDEN_CLASS);
}

function setProductState(product, state, cls) {
    state = state == undefined ? true : state;
    let li = _ysf.getProductLi(product);
    let setState = state ? li.classList.add : li.classList.remove;
    setState.call(li.classList, cls);
}

function productLiHasClass(product, cls) {
    return _ysf.getProductLi(product).classList.contains(cls);
}

function isProductHidden(product) {
    return productLiHasClass(product, HIDDEN_CLASS);
}

function isProductMarked(product) {
    return productLiHasClass(product, MARKED_CLASS);
}

function resetProduct(product) {
    let li = _ysf.getProductLi(product);
    li.classList.remove(MARKED_CLASS);
    li.classList.remove(HIDDEN_CLASS);
}

function showElement(element) {
    element.classList.remove(HIDDEN_CLASS);
}

function hideElement(element) {
    element.classList.add(HIDDEN_CLASS);
}

function getChildTextContentLowerTrim(product, childIndex) {
    let children = product.children;
    return (children.length === 1
            ? children[0].children[childIndex]
            : children[childIndex])
        .textContent.toLocaleLowerCase(LOCALE_TR).trim();
}

function getProductName(product) {
    return getChildTextContentLowerTrim(product, 0);
}

function getProductDesc(product) {
    return getChildTextContentLowerTrim(product, 1);
}

function filterProducts(products) {
    if (_ysfHideSet.size === 0 && _ysfMarkSet.size === 0)
        return;

    for (let product of products) {
        const productName = getProductName(product);
        const productDesc = getProductDesc(product);

        for (let hiddenTag of _ysfHideSet)
            if (productName.includes(hiddenTag) || productDesc.includes(hiddenTag))
                hideProduct(product);

        for (let markedTag of _ysfMarkSet)
            if (productName.includes(markedTag) || productDesc.includes(markedTag))
                markProduct(product);
    }
}

function scrollIfRequired(products) {
    if (_ysfMarkSet.size === 0)
        return;

    let elementToScroll = null;

    for (let product of products) {
        if (isProductHidden(product))
            continue;
        if (!isProductMarked(product))
            continue;

        let productLi = _ysf.getProductLi(product);

        if (isElementInViewPort(productLi))
            return;
        
        if (elementToScroll === null)
            elementToScroll = productLi;
    }

    if (elementToScroll !== null)
        scrollToElement(elementToScroll);
}

function unmarkProducts(products) {
    for (let product of products)
        markProduct(product, false);
}

function unhideProducts(products) {
    for (let product of products)
        hideProduct(product, false);
}

function resetProducts(products) {
    for (let product of products) {
        resetProduct(product);
    }
}

function isTagValid(tag) {
    return tag.length > 0 && tag.length <= MAX_TAG_LEN;
}

function isUnique(e, i, arr) {
    return arr.indexOf(e) === i;
}

function collectTags(products) {
    let tags = [...products]
        .map(getProductDesc)
        .flatMap(c => c.split(','))
        .map(t => t.trim())
        .filter(isTagValid)
        .filter(isUnique)
        .sort();

    return tags;
}

function searchMatchAnywhere(query, wordList, limit, results) {
    results = results || new Set();
    let substrRegex = new RegExp(query, 'i');
    for (let word of wordList) {
        if (results.length === limit || results.size === limit) {
            return results;
        }
        if (substrRegex.test(word)) {
            results.add(word);
        }
    }
    return results;
}

function searchMatchBeginning(query, wordList, limit, results) {
    return searchMatchAnywhere('^' + query, wordList, limit, results);
}

function setTag(tag, blacklist) {
    blacklist.add(tag);
    addToLastModifiedTags(tag);
    validateLastModifiedTags();
    return blacklist;
}

function unsetTag(tag, blacklist) {
    blacklist.delete(tag);
    addToLastModifiedTags(tag);
    validateLastModifiedTags();
    return blacklist;
}

function checkTag(tag, blacklist) {
    return blacklist.has(tag);
}

function toggleTag(tag, blacklist, state) {
    return state ? setTag(tag, blacklist) : unsetTag(tag, blacklist);
}

function isTagMarked(tag) {
    return checkTag(tag, _ysfMarkSet);
}

function isTagHidden(tag) {
    return checkTag(tag, _ysfHideSet);
}

function highlightWord(word, highlight, insert_start, insert_end) {
    if (highlight.length === 0) return word;

    highlight = highlight.toLocaleLowerCase(LOCALE_TR).trim();
    let re = new RegExp(highlight, "g");
    let length = highlight.length;
    let prevIndex = 0;
    let result = "";
    let match;
    while (true)
    {
        match = re.exec(word);
        if (match == null)
            break;

        result += word.substring(prevIndex, match.index);
        result += insert_start;
        result += word.substr(match.index, length);
        result += insert_end;
        prevIndex = match.index + length;
    }
    result += word.substring(prevIndex);
    return result;
}

function appendRawHTML(parent, html) {
    let newDiv = document.createElement("div");
    newDiv.innerHTML = html;

    parent.appendChild(newDiv);
    parent.appendChild(newDiv.firstElementChild);
    parent.removeChild(newDiv);
}

function appendExtensionUI() {
    let ysf_div = '<div id="ysf" class="ys-basket"><div class="header"><span>FİLTRE</span> <button id="ysf-clear" class="ysf-btn dark txt ysf-white ml6 float-right ysf-hidden"><i class="fas fa-trash"></i></button></div><div id="ysf-input"><input class="ysf-control no-border-radius w10 rbl4 rbr4" type="text" placeholder="Malzeme arayın."></div><div id="ysf-result"></div></div>';

    let parent = document.getElementById("basket-container");
    appendRawHTML(parent, ysf_div);
}

function getMarkIcon(isMarked) {
    return '<i class="fas ' + (isMarked ? "fa-tint" : "fa-tint-slash") + '"></i>';
}

function getHideIcon(isHidden) {
    return '<i class="fas ' + (isHidden ? "fa-eye-slash" : "fa-eye") + '"></i>';
}

function getResultHTML(tag, query) {
    let highlighted = highlightWord(tag, query, "<strong>", "</strong>");

    return '' +
    '<div class="result ysf-control" data-tag="' + tag + '">' +
        '<span>' + highlighted + '</span>' +
        '<button class="float-right w1 light ysf-btn txt ysf-icon-r no-focus">' +
            getMarkIcon(isTagMarked(tag)) +
        '</button>' +
        '<button class="float-right w1 light ysf-btn txt ysf-icon-l no-focus">' +
            getHideIcon(isTagHidden(tag)) +
        '</button>' +
    '</div>';
}

function focusInput() {
    document.getElementById("ysf-input").firstElementChild.focus();
}

function prepareRow(row) {
    let btnMark = row.children[1];
    let btnHide = row.children[2];

    btnMark.addEventListener("mousedown", () => {
        btnMark.blur();

        timeExecute("un/mark product", () => {
            let tag = btnMark.parentElement.dataset.tag;
            let isMarked = isTagMarked(tag);

            btnMark.innerHTML = getMarkIcon(!isMarked);
            toggleTag(tag, _ysfMarkSet, !isMarked);

            unmarkProducts(_ysfProducts);
            filterProducts(_ysfProducts);
            scrollIfRequired(_ysfProducts);
            _ysfInputStayFocused = true;
            focusInput();
            updateHeaderText();
        });
    });

    btnHide.addEventListener("mousedown", () => {
        btnHide.blur();

        timeExecute("un/hide product", () => {
            let tag = btnHide.parentElement.dataset.tag;
            let isHidden = isTagHidden(tag);
    
            btnHide.innerHTML = getHideIcon(!isHidden);
            toggleTag(tag, _ysfHideSet, !isHidden);
    
            unhideProducts(_ysfProducts);
            filterProducts(_ysfProducts);
            _ysfInputStayFocused = true;
            focusInput();
            updateHeaderText();

            // only the visible products' tags should be available
            prepareTags(_ysf.collectProducts());
        });
    });
}

function prepareLastModifiedTags() {
    let results = [..._ysfLastModifiedTags];
    results.reverse();
    results.splice(_itemLimit);
    return results;
}

function processInput(ysf_input) {
    let query = ysf_input.value;
    let results = [];
    if (query.length === 0) {
        results = prepareLastModifiedTags();
    }
    else {
        results = searchMatchBeginning(query, _ysfTags, _itemLimit);
        results = [...results].sort();
        if (results.length < _itemLimit) {
            let results2 = searchMatchAnywhere(query, _ysfTags, _itemLimit - results.length);
            results2 = [...results2].sort();
            results = results.concat(results2.filter(r => {
                return !results.includes(r);
            }));
        }
    }
    return results;
}

function displayResults(ysf_input, results, ysf_result) {
    results.forEach(tag => {
        ysf_result.innerHTML += getResultHTML(tag, ysf_input.value);
    });

    for (let row of ysf_result.children)
        prepareRow(row);

    if (results.length > 0) {
        let input_row = ysf_input.parentElement.children;
        for (let element of input_row)
            element.classList.add(EXPANDED_CLASS);
    }
}

function clearInput(ysf_input) {
    ysf_input.value = "";
}

function clearResults(ysf_input, ysf_result) {
    ysf_result.innerHTML = "";
    let input_row = ysf_input.parentElement.children;
    for (let element of input_row)
        element.classList.remove(EXPANDED_CLASS);
}

function isElementFocused(element) {
    return element === document.activeElement;
}

function incrementItemIndex() {
    return _ysfIndex === _itemLimit - 1 ? _ysfIndex : ++_ysfIndex;
}

function decrementItemIndex() {
    return _ysfIndex === -1 ? _ysfIndex : --_ysfIndex;
}

function fixItemIndex(ysf_result) {
    if (_ysfIndex >= ysf_result.childElementCount) {
        _ysfIndex = ysf_result.childElementCount - 1;
    }
}

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function selectResult(ysf_result) {
    for (let i = 0; i < ysf_result.childElementCount; i++) {
        ysf_result.children[i].classList.remove(SELECTED_CLASS);
    }

    if (_ysfIndex > -1 && ysf_result.childElementCount > 0) {
        _ysfIndex = clamp(_ysfIndex, 0, ysf_result.childElementCount - 1);
        const result = ysf_result.children[_ysfIndex];
        result.classList.add(SELECTED_CLASS);
        _lastSelected = result.firstElementChild.innerText;
    }
    else if (_ysfIndex === -1) {
        _lastSelected = null;
    }
}

function trySelectLastSelected() {
    let ysf_result = document.getElementById("ysf-result");
    for (let i = 0; i < ysf_result.children.length; i++) {
        const result = ysf_result.children[i];
        if (result.firstElementChild.innerText === _lastSelected) {
            _ysfIndex = i;
            break;
        }
    }
    selectResult(ysf_result);
}

function getSelectedResult() {
    let elements = document.getElementsByClassName(SELECTED_CLASS);
    let element = elements.length === 0 ? null : elements[0];
    return element;
}

function triggerEvent(element, eventType) {
    let event =  document.createEvent("HTMLEvents");
    event.initEvent(eventType, true, true);
    element.dispatchEvent(event);
}

function preventDefaultIllegalRegexCharKeyEvent(e) {
    if (RE_DISALLOWED_CHARS.test(e.key))
        e.preventDefault();
}

function hookEvents() {
    let ysf_input = document.getElementById("ysf-input").firstElementChild;
    let ysf_result = document.getElementById("ysf-result");

    ysf_input.addEventListener("keydown", e => {
        if (e.keyCode === 27) {
            // ESC
            ysf_input.blur();
        }

        if (e.keyCode === 38) {
            // up
            decrementItemIndex();
            e.preventDefault();
        }
        else if (e.keyCode === 40) {
            // down
            incrementItemIndex();
            e.preventDefault();
        }

        let result = getSelectedResult();
        if (result != null) {
            if (e.key === '2') {
                // toggle mark
                triggerEvent(result.children[1], "mousedown");
                e.preventDefault();
            }
            else if (e.key === '1') {
                // toggle hide
                let result = getSelectedResult();
                triggerEvent(result.children[2], "mousedown");
                e.preventDefault();
            }
        }

        fixItemIndex(ysf_result);
        selectResult(ysf_result);

        preventDefaultIllegalRegexCharKeyEvent(e);        
    });

    ysf_input.addEventListener("keyup", e => {
        if (e.keyCode === 38 || e.keyCode === 40) {
            // up || down
            return;
        }

        clearResults(ysf_input, ysf_result);

        if (e.keyCode === 27) {
            // ESC
            return;
        }

        let results = processInput(ysf_input);
        displayResults(ysf_input, results, ysf_result);

        trySelectLastSelected();
        fixItemIndex(ysf_result);
        selectResult(ysf_result);

        preventDefaultIllegalRegexCharKeyEvent(e);
    });

    ysf_input.addEventListener("keypress", e => {
        preventDefaultIllegalRegexCharKeyEvent(e);
    });

    ysf_input.addEventListener("input", e => {
        ysf_input.value = e.target.value.replace(RE_DISALLOWED_CHARS, "");
    });

    let resetButton = document.getElementById("ysf-clear");
    resetButton.addEventListener("click", () => {
        timeExecute("reset", () => {
            resetButton.blur();
    
            _ysfMarkSet.clear();
            _ysfHideSet.clear();
            _ysfLastModifiedTags = [];
            _lastSelected = null;
            _ysfIndex = -1;
    
            resetProducts(_ysfProducts);
            clearInput(ysf_input);
            clearResults(ysf_input, ysf_result);
            updateHeaderText();
            prepareTags(_ysfProducts);
    
            hideElement(resetButton);
        });
    });

    ysf_input.addEventListener("focus", () => {
        let results = processInput(ysf_input);
        displayResults(ysf_input, results, ysf_result);
        fixItemIndex(ysf_result);
        selectResult(ysf_result);
    });

    ysf_input.addEventListener("blur", () => {
        clearResults(ysf_input, ysf_result);

        if (_ysfInputStayFocused) {
            ysf_input.focus();
            _ysfInputStayFocused = false;
        }
    });
}

function getInfoTextHTML() {
    let hiddenProductCount = document.querySelectorAll(`li.${HIDDEN_CLASS}`).length;
    let markedProductCount = document.querySelectorAll(`.${MARKED_CLASS}:not(.${HIDDEN_CLASS})`).length;
    if (hiddenProductCount === 0 && markedProductCount === 0)
        return "";

    return '(' + hiddenProductCount + ' <i class="fas fa-eye-slash"></i>, ' +
        markedProductCount + ' <i class="fas fa-tint"></i>)';
}

function getTopBarHeight() {
    return document.getElementsByClassName("inner")[0].clientHeight;
}

function isElementInViewPort(element) {
    let top = pageYOffset + element.getBoundingClientRect().top;
    let vp = [pageYOffset, pageYOffset + innerHeight];
    let el = [top + getTopBarHeight(), top + element.clientHeight];

    return el[1] <= vp[1] && el[0] >= vp[0];
}

function scrollToElement(element) {
    let target = pageYOffset + element.getBoundingClientRect().top - getTopBarHeight() - element.clientHeight;
    logDebug(`scroll target: ${target}`)
    scrollTo({top: target, behavior: "smooth"});
}

function updateHeaderText() {
    let span = document.querySelector("#ysf .header span");
    let clearButton = document.getElementById("ysf-clear");
    let infoTextHTML = getInfoTextHTML();
    if (infoTextHTML === "") {
        span.innerHTML = "FİLTRE";
        hideElement(clearButton);
    }
    else {
        span.innerHTML = `FİLTRE ${infoTextHTML}`;
        showElement(clearButton);
    }
}

function prepareTags(products) {
    _ysfTags = collectTags(products);
}

function prepareData() {
    _ysfProducts = ysfFunctionsLayout1.collectProducts();
    if (_ysfProducts.length === 0) {
        _ysf = ysfFunctionsLayout2;
        _ysfProducts = _ysf.collectProducts();
        logDebug("ysf/2");
    }
    else {
        _ysf = ysfFunctionsLayout1;
        logDebug("ysf/1");
    }

    prepareTags(_ysfProducts);
}

ready(() => {
    logDebug("ysf?");
    if (document.getElementById("basket-container") == null || document.getElementById("restaurantDetail") == null) {
        chrome.runtime.sendMessage("disableIcon");
        logDebug("ysf-");
        return;
    }
    logDebug("ysf!");

    chrome.runtime.sendMessage("enableIcon");

    appendExtensionUI();

    prepareData();

    hookEvents();
    logDebug("ysf.");
});
