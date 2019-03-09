/*jshint esversion: 6 */

var _ysfHideSet = new Set();
var _ysfMarkSet = new Set();
var _ysfProducts = null;
var _ysfTags = null;
var _ysfLastModifiedTags = [];
var _stayFocused = false;
var _itemLimit = 5;
var _ysfIndex = -1;
var _lastSelected;
const DEBUG = false;
const LOCALE_TR = "tr-tr";
const SELECTED_CLASS = "ysf-selected";
const EXPANDED_CLASS = "expanded";
const MARKED_CLASS = "ysf-marked";
const HIDDEN_CLASS = "hidden";
const RE = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g;

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

function validateLastModifiedTags() {
    var validated = [];
    for (let tag of _ysfLastModifiedTags) {
        if (isTagMarked(tag) || isTagHidden(tag)) {
            validated.push(tag);
        }
    }
    _ysfLastModifiedTags = validated;
}

function addToLastModifiedTags(tag) {
    var indexOfTag = _ysfLastModifiedTags.indexOf(tag);
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
    state = state == undefined ? true : state;
    var li = product.parentElement;
    if (state)
        li.classList.add(MARKED_CLASS);
    else
        li.classList.remove(MARKED_CLASS);
}

function hideProduct(product, state) {
    state = state == undefined ? true : state;
    var li = product.parentElement;
    if (state)
        li.classList.add(HIDDEN_CLASS);
    else
        li.classList.remove(HIDDEN_CLASS);
}

function isProductHidden(product) {
    var li = product.parentElement;
    return li.classList.contains(HIDDEN_CLASS);
}

function resetProduct(product) {
    var li = product.parentElement;
    li.classList.remove(MARKED_CLASS);
    li.classList.remove(HIDDEN_CLASS);
}

function showElement(element) {
    element.classList.remove(HIDDEN_CLASS);
}

function hideElement(element) {
    element.classList.add(HIDDEN_CLASS);
}

function collectProducts() {
    return document.querySelectorAll("li:not(.hidden)>.product");
}

function filterProducts() {
    var scrollingRequired = true;
    var elementToScroll = null;
    if (_ysfHideSet.size === 0 && _ysfMarkSet.size === 0) return;
    for (let product of _ysfProducts) {
        const productInfo = product.textContent.toLocaleLowerCase(LOCALE_TR);
        const productName = product.children[1].textContent.toLocaleLowerCase(LOCALE_TR);
        for (let hiddenTag of _ysfHideSet) {
            if (productInfo.includes(hiddenTag) || productName.includes(hiddenTag)) {
                hideProduct(product);
            }
        }
        for (let markedTag of _ysfMarkSet) {
            if (!productInfo.includes(markedTag) && !productName.includes(markedTag))
                continue;

            markProduct(product);
            if (isProductHidden(product))
                continue;
            // product isn't hidden
            if (elementIsInViewPort(product.parentElement))
                scrollingRequired = false;
            if (elementToScroll == null)
                elementToScroll = product.parentElement;
        }
    }
    if (scrollingRequired && elementToScroll != null)
        scrollToElement(elementToScroll);
}

function unmarkProducts() {
    for (let product of _ysfProducts)
        markProduct(product, false);
}

function unhideProducts() {
    for (let product of _ysfProducts)
        hideProduct(product, false);
}

function resetProducts(products) {
    for (let product of products) {
        resetProduct(product);
    }
}

function collectTags(products) {
    var tagSet = new Set();
    for (let product of products) {
        const productDesc = product.lastElementChild.textContent.toLocaleLowerCase(LOCALE_TR).trim();
        const contents = productDesc.split(', ');
        contents.forEach(c => {
            if (c.length > 0 && c.length < 25)
                tagSet.add(c);
        });
    }
    _ysfLastModifiedTags.forEach(t => tagSet.add(t));
    return [...tagSet].sort();
}

function findDuplicates(tags) {
    // tags must be sorted
    var duplicates = [];
    for (let i = 0; i < tags.length - 1; i++) {
        const tag = tags[i];
        for (let j = i + 1; j < tags.length; j++) {
            if (tags[j].includes(tag)) {
                duplicates.push(tags[j]);
            }
        }
    }
    return duplicates;
}

function removeDuplicates(tags) {
    var duplicates = findDuplicates(tags);
    return tags.filter(item => !duplicates.includes(item));
}

function search(query, wordList, limit, results) {
    results = results || new Set();
    var substrRegex = new RegExp(query, 'i');
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
    return search('^' + query, wordList, limit, results);
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
    var re = new RegExp(highlight, "g");
    var length = highlight.length;
    var prevIndex = 0;
    var result = "";
    var match;
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
    var newDiv = document.createElement("div");
    newDiv.innerHTML = html;

    parent.appendChild(newDiv);
    parent.appendChild(newDiv.firstElementChild);
    parent.removeChild(newDiv);
}

function appendExtensionUI() {
    var ysf_div = '<div id="ysf" class="ys-basket"><div class="header"><span>FİLTRE</span> <button id="ysf-clear" class="ysf-btn dark txt ysf-white ml6 float-right hidden"><i class="fas fa-trash"></i></button></div><div id="ysf-input"><input class="ysf-control no-border-radius w10 rbl4 rbr4" type="text" placeholder="Malzeme arayın."></div><div id="ysf-result"></div></div>';

    var parent = document.getElementById("basket-container");
    appendRawHTML(parent, ysf_div);
}

function getMarkIcon(isMarked) {
    return '<i class="fas ' + (isMarked ? "fa-tint" : "fa-tint-slash") + '"></i>';
}

function getHideIcon(isHidden) {
    return '<i class="fas ' + (isHidden ? "fa-eye-slash" : "fa-eye") + '"></i>';
}

function getResultHTML(tag, query) {
    var highlighted = highlightWord(tag, query, "<strong>", "</strong>");

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
    var btnMark = row.children[1];
    var btnHide = row.children[2];

    btnMark.addEventListener("mousedown", () => {
        btnMark.blur();

        var tag = btnMark.parentElement.dataset.tag;
        var isMarked = isTagMarked(tag);

        btnMark.innerHTML = getMarkIcon(!isMarked);
        toggleTag(tag, _ysfMarkSet, !isMarked);

        unmarkProducts();
        filterProducts();
        _stayFocused = true;
        focusInput();
        updateHeaderText();
        prepareTags(collectProducts());
    });

    btnHide.addEventListener("mousedown", () => {
        btnHide.blur();

        var tag = btnHide.parentElement.dataset.tag;
        var isHidden = isTagHidden(tag);

        btnHide.innerHTML = getHideIcon(!isHidden);
        toggleTag(tag, _ysfHideSet, !isHidden);

        unhideProducts();
        filterProducts();
        _stayFocused = true;
        focusInput();
        updateHeaderText();
        prepareTags(collectProducts());
    });
}

function prepareLastModifiedTags() {
    var results = Array.from([..._ysfLastModifiedTags]);
    results.reverse();
    results.splice(_itemLimit);
    return results;
}

function processInput(ysf_input) {
    var query = ysf_input.value;
    var results = [];
    if (query.length === 0) {
        results = prepareLastModifiedTags();
    }
    else {
        // match the beginning of the word
        results = searchMatchBeginning(query, _ysfTags, _itemLimit);
        results = [...results].sort();
        if (results.length < _itemLimit) {
            // match anywhere
            var results2 = search(query, _ysfTags, _itemLimit - results.length);
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
        var input_row = ysf_input.parentElement.children;
        for (let element of input_row)
            element.classList.add(EXPANDED_CLASS);
    }
}

function clearInput(ysf_input) {
    ysf_input.value = "";
}

function clearResults(ysf_input, ysf_result) {
    ysf_result.innerHTML = "";
    var input_row = ysf_input.parentElement.children;
    for (let element of input_row)
        element.classList.remove(EXPANDED_CLASS);
}

function isElementFocused(element) {
    return element === document.activeElement;
}

function incrementItemIndex() {
    if (_ysfIndex === _itemLimit - 1)
        return _ysfIndex;
    return ++_ysfIndex;
}

function decrementItemIndex() {
    if (_ysfIndex === -1)
        return _ysfIndex;
    return --_ysfIndex;
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
    var ysf_result = document.getElementById("ysf-result");
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
    var elements = document.getElementsByClassName(SELECTED_CLASS);
    var element = elements.length === 0 ? null : elements[0];
    return element;
}

function triggerEvent(element, eventType) {
    var event =  document.createEvent("HTMLEvents");
    event.initEvent(eventType, true, true);
    element.dispatchEvent(event);
}

function hookEvents() {
    var ysf_input = document.getElementById("ysf-input").firstElementChild;
    var ysf_result = document.getElementById("ysf-result");

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
                // toggle show/hide
                let result = getSelectedResult();
                triggerEvent(result.children[2], "mousedown");
                e.preventDefault();
            }
        }

        fixItemIndex(ysf_result);
        selectResult(ysf_result);

        if (RE.test(e.key)) {
            e.preventDefault();
        }
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

        var results = processInput(ysf_input);
        displayResults(ysf_input, results, ysf_result);

        trySelectLastSelected();
        fixItemIndex(ysf_result);
        selectResult(ysf_result);
    });

    var clearButton = document.getElementById("ysf-clear");
    clearButton.addEventListener("click", () => {
        clearButton.blur();

        _ysfMarkSet.clear();
        _ysfHideSet.clear();
        _ysfLastModifiedTags = [];
        _lastSelected = null;
        _ysfIndex = -1;

        resetProducts(_ysfProducts);
        clearInput(ysf_input);
        clearResults(ysf_input, ysf_result);
        updateHeaderText();
        prepareTags(collectProducts());

        hideElement(clearButton);
    });

    ysf_input.addEventListener("focus", () => {
        var results = processInput(ysf_input);
        displayResults(ysf_input, results, ysf_result);
        fixItemIndex(ysf_result);
        selectResult(ysf_result);
    });

    ysf_input.addEventListener("blur", () => {
        clearResults(ysf_input, ysf_result);

        if (_stayFocused) {
            ysf_input.focus();
            _stayFocused = false;
        }
    });
}

function getInfoTextHTML() {
    var hiddenProductCount = document.querySelectorAll("li.hidden").length;
    var markedProductCount = document.querySelectorAll(".ysf-marked:not(.hidden)").length;
    if (hiddenProductCount === 0 && markedProductCount === 0)
        return "";
    return '(' + hiddenProductCount + ' <i class="fas fa-eye-slash"></i>, ' +
        markedProductCount + ' <i class="fas fa-tint"></i>)';
}

function elementIsInViewPort(element) {
    var topBarHeight =  - document.getElementsByClassName("inner")[0].clientHeight;
    var top = pageYOffset + element.getBoundingClientRect().top;
    var vp = [pageYOffset, pageYOffset + innerHeight];
    var el = [top + topBarHeight, top + element.clientHeight];

    return el[1] <= vp[1] && el[0] >= vp[0];
}

function scrollToElement(element) {
    var target = pageYOffset + element.getBoundingClientRect().top - document.getElementsByClassName("inner")[0].clientHeight - element.clientHeight;
    scrollTo({top: target, behavior: "smooth"});
}

function updateHeaderText() {
    var span = document.querySelector("#ysf .header span");
    var clearButton = document.getElementById("ysf-clear");
    var infoTextHTML = getInfoTextHTML();
    if (infoTextHTML === "") {
        span.innerHTML = "FİLTRE";
        hideElement(clearButton);
    }
    else {
        span.innerHTML = "FİLTRE " + infoTextHTML;
        showElement(clearButton);
    }
}

function prepareTags(products) {
    var tags = collectTags(products);
    _ysfTags = removeDuplicates(tags);
}

function prepareData() {
    _ysfProducts = collectProducts();
    prepareTags(_ysfProducts);
}

ready(() => {
    logDebug("ysf?");
    if (document.getElementById("basket-container") == null || document.getElementById("restaurantDetail") == null) {
        chrome.runtime.sendMessage("disableIcon");
        return;
    }
    logDebug("ysf!");

    chrome.runtime.sendMessage("enableIcon");

    appendExtensionUI();

    prepareData();

    hookEvents();
    logDebug("ysf.");
});
