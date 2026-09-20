"use strict";

// ===========================================================
// CVM LATEX IDE
//
// Visual / editing enhancement around the existing
// #cvmLatexEditor textarea.
//
// IMPORTANT:
// The original textarea remains the source of truth.
// Existing compile / save / PDF export behavior stays intact.
// ===========================================================

(() => {
    const S = {
        ready: false,

        editor: null,
        lines: null,
        highlight: null,
        currentLine: null,

        dirtyDot: null,
        cursor: null,
        selection: null,

        findBar: null,
        findInput: null,
        replaceInput: null,
        findCount: null,

        matches: [],
        matchIndex: -1,

        observer: null,
    };

    const TAB = "    ";
    const LINE_HEIGHT = 20;
    const TOP_PADDING = 16;


    // =======================================================
    // HELPERS
    // =======================================================

    function esc(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
    }


    function isEscaped(text, index) {
        let count = 0;

        for (
            let i = index - 1;
            i >= 0 && text[i] === "\\";
            i -= 1
        ) {
            count += 1;
        }

        return count % 2 === 1;
    }


    function stopObserver() {
        if (!S.observer) {
            return;
        }

        S.observer.disconnect();
        S.observer = null;
    }


    function resetDisconnectedEditor() {
        if (
            S.ready
            && S.editor
            && !S.editor.isConnected
        ) {
            S.ready = false;

            S.editor = null;
            S.lines = null;
            S.highlight = null;
            S.currentLine = null;

            S.dirtyDot = null;
            S.cursor = null;
            S.selection = null;

            S.findBar = null;
            S.findInput = null;
            S.replaceInput = null;
            S.findCount = null;

            S.matches = [];
            S.matchIndex = -1;
        }
    }


    // =======================================================
    // BRACKET MATCHING
    // =======================================================

    function matchingBrackets(source, caret) {
        const pairs = {
            "{": "}",
            "[": "]",
            "(": ")",

            "}": "{",
            "]": "[",
            ")": "(",
        };

        const opening = new Set([
            "{",
            "[",
            "(",
        ]);

        let position = -1;
        let bracket = "";

        for (const index of [
            caret - 1,
            caret,
        ]) {
            if (
                index >= 0
                && index < source.length
                && pairs[source[index]]
            ) {
                position = index;
                bracket = source[index];
                break;
            }
        }

        if (position < 0) {
            return new Set();
        }

        const target = pairs[bracket];
        let depth = 0;

        if (opening.has(bracket)) {
            for (
                let i = position;
                i < source.length;
                i += 1
            ) {
                if (
                    source[i] === bracket
                    && !isEscaped(source, i)
                ) {
                    depth += 1;
                }
                else if (
                    source[i] === target
                    && !isEscaped(source, i)
                ) {
                    depth -= 1;

                    if (depth === 0) {
                        return new Set([
                            position,
                            i,
                        ]);
                    }
                }
            }
        }
        else {
            for (
                let i = position;
                i >= 0;
                i -= 1
            ) {
                if (
                    source[i] === bracket
                    && !isEscaped(source, i)
                ) {
                    depth += 1;
                }
                else if (
                    source[i] === target
                    && !isEscaped(source, i)
                ) {
                    depth -= 1;

                    if (depth === 0) {
                        return new Set([
                            position,
                            i,
                        ]);
                    }
                }
            }
        }

        return new Set([
            position,
        ]);
    }


    // =======================================================
    // SYNTAX HIGHLIGHTING
    // =======================================================

    function token(
        className,
        text,
        start,
        bracketMatches
    ) {
        let body = "";

        for (
            let i = 0;
            i < text.length;
            i += 1
        ) {
            const character =
                esc(text[i]);

            if (
                bracketMatches.has(
                    start + i
                )
            ) {
                body += `
                    <span class="cvm-ide-bracket-match">
                        ${character}
                    </span>
                `;
            }
            else {
                body += character;
            }
        }

        if (!className) {
            return body;
        }

        return (
            `<span class="${className}">`
            + body
            + `</span>`
        );
    }


    function highlightLatex(
        source,
        bracketMatches = new Set()
    ) {
        const structuralCommands = new Set([
            "documentclass",
            "usepackage",
            "begin",
            "end",
            "section",
            "subsection",
            "subsubsection",
            "paragraph",
            "title",
            "author",
            "date",
            "newcommand",
            "renewcommand",
            "definecolor",
            "geometry",
            "href",
            "url",
            "textbf",
            "textit",
            "item",
            "includegraphics",
        ]);

        let html = "";
        let index = 0;
        let environmentNext = false;

        while (index < source.length) {
            const character =
                source[index];


            // New line
            if (character === "\n") {
                html += "\n";
                index += 1;
                environmentNext = false;
                continue;
            }


            // Comment
            if (
                character === "%"
                && !isEscaped(
                    source,
                    index
                )
            ) {
                const newline =
                    source.indexOf(
                        "\n",
                        index
                    );

                const end =
                    newline === -1
                        ? source.length
                        : newline;

                html += token(
                    "cvm-ide-comment",
                    source.slice(
                        index,
                        end
                    ),
                    index,
                    bracketMatches
                );

                index = end;
                continue;
            }


            // Command
            if (character === "\\") {
                let end =
                    index + 1;

                if (
                    /[A-Za-z@]/.test(
                        source[end] || ""
                    )
                ) {
                    while (
                        end < source.length
                        && /[A-Za-z@]/.test(
                            source[end]
                        )
                    ) {
                        end += 1;
                    }

                    if (
                        source[end] === "*"
                    ) {
                        end += 1;
                    }
                }
                else if (
                    end < source.length
                ) {
                    end += 1;
                }

                const value =
                    source.slice(
                        index,
                        end
                    );

                const command =
                    value
                        .replace(
                            /^\\/,
                            ""
                        )
                        .replace(
                            /\*$/,
                            ""
                        );

                const className =
                    structuralCommands.has(
                        command
                    )
                        ? (
                            "cvm-ide-command "
                            + "cvm-ide-command-structural"
                        )
                        : "cvm-ide-command";

                html += token(
                    className,
                    value,
                    index,
                    bracketMatches
                );

                environmentNext =
                    command === "begin"
                    || command === "end";

                index = end;
                continue;
            }


            // Environment name after \begin or \end
            if (
                environmentNext
                && character === "{"
            ) {
                const close =
                    source.indexOf(
                        "}",
                        index + 1
                    );

                if (close !== -1) {
                    html += token(
                        "cvm-ide-brace",
                        "{",
                        index,
                        bracketMatches
                    );

                    html += token(
                        "cvm-ide-environment",
                        source.slice(
                            index + 1,
                            close
                        ),
                        index + 1,
                        bracketMatches
                    );

                    html += token(
                        "cvm-ide-brace",
                        "}",
                        close,
                        bracketMatches
                    );

                    index =
                        close + 1;

                    environmentNext =
                        false;

                    continue;
                }
            }


            // Braces
            if (
                "{}[]()".includes(
                    character
                )
            ) {
                html += token(
                    "cvm-ide-brace",
                    character,
                    index,
                    bracketMatches
                );

                index += 1;
                environmentNext = false;
                continue;
            }


            // LaTeX operators
            if (
                "$&#~^".includes(
                    character
                )
            ) {
                html += token(
                    "cvm-ide-operator",
                    character,
                    index,
                    bracketMatches
                );

                index += 1;
                environmentNext = false;
                continue;
            }


            // Numbers
            if (/\d/.test(character)) {
                let end =
                    index + 1;

                while (
                    end < source.length
                    && /[\d.]/.test(
                        source[end]
                    )
                ) {
                    end += 1;
                }

                html += token(
                    "cvm-ide-number",
                    source.slice(
                        index,
                        end
                    ),
                    index,
                    bracketMatches
                );

                index = end;
                environmentNext = false;
                continue;
            }


            // Plain text
            let end =
                index + 1;

            while (
                end < source.length
                && !"\\\n%{}[]()$&#~^"
                    .includes(
                        source[end]
                    )
                && !/\d/.test(
                    source[end]
                )
            ) {
                end += 1;
            }

            html += token(
                "",
                source.slice(
                    index,
                    end
                ),
                index,
                bracketMatches
            );

            index = end;
            environmentNext = false;
        }

        return html || " ";
    }


    // =======================================================
    // CURSOR / LINE STATUS
    // =======================================================

    function cursorInfo() {
        if (!S.editor) {
            return {
                line: 1,
                column: 1,
            };
        }

        const before =
            S.editor.value.slice(
                0,
                S.editor.selectionStart
            );

        const parts =
            before.split("\n");

        return {
            line:
                parts.length,

            column:
                (
                    parts.at(-1)
                    || ""
                ).length + 1,
        };
    }


    function renderLines() {
        if (
            !S.editor
            || !S.lines
        ) {
            return;
        }

        const count =
            Math.max(
                1,
                S.editor.value
                    .split("\n")
                    .length
            );

        const activeLine =
            cursorInfo().line;

        S.lines.innerHTML =
            Array.from(
                {
                    length: count,
                },

                (_, index) => {
                    const lineNumber =
                        index + 1;

                    const activeClass =
                        lineNumber === activeLine
                            ? "active"
                            : "";

                    return (
                        `<span class="${activeClass}">`
                        + `${lineNumber}`
                        + `</span>`
                    );
                }
            )
                .join("");

        S.lines.scrollTop =
            S.editor.scrollTop;
    }


    function updateStatus() {
        if (!S.editor) {
            return;
        }

        const {
            line,
            column,
        } = cursorInfo();

        const selected =
            Math.max(
                0,

                S.editor.selectionEnd
                - S.editor.selectionStart
            );

        if (S.cursor) {
            S.cursor.textContent =
                `Ln ${line}, Col ${column}`;
        }

        if (S.selection) {
            S.selection.textContent =
                selected
                    ? `${selected} selected`
                    : "UTF-8";
        }

        if (S.dirtyDot) {
            S.dirtyDot.classList.toggle(
                "visible",

                Boolean(
                    window.cvmV07
                    ?.latexStale
                )
            );
        }
    }


    // =======================================================
    // SCROLLING / CURRENT LINE
    // =======================================================

    function syncScroll() {
        if (
            !S.editor
            || !S.highlight
        ) {
            return;
        }

        S.highlight.style.transform =
            (
                `translate(`
                + `${-S.editor.scrollLeft}px, `
                + `${-S.editor.scrollTop}px`
                + `)`
            );

        if (S.lines) {
            S.lines.scrollTop =
                S.editor.scrollTop;
        }

        updateCurrentLine();
    }


    function updateCurrentLine() {
        if (
            !S.editor
            || !S.currentLine
        ) {
            return;
        }

        const lineIndex =
            cursorInfo().line - 1;

        const top =
            TOP_PADDING
            + (
                lineIndex
                * LINE_HEIGHT
            )
            - S.editor.scrollTop;

        S.currentLine.style.transform =
            `translateY(${top}px)`;

        S.currentLine.classList.toggle(
            "hidden",

            top < -LINE_HEIGHT
            || top > S.editor.clientHeight
        );
    }


    // =======================================================
    // MAIN REFRESH
    // =======================================================

    function refresh() {
        if (
            !S.editor
            || !S.highlight
            || !S.editor.isConnected
        ) {
            return;
        }

        const brackets =
            matchingBrackets(
                S.editor.value,
                S.editor.selectionStart
            );

        S.highlight.innerHTML =
            highlightLatex(
                S.editor.value,
                brackets
            );

        renderLines();
        updateStatus();
        syncScroll();
    }


    function emitInput() {
        if (!S.editor) {
            return;
        }

        S.editor.dispatchEvent(
            new Event(
                "input",
                {
                    bubbles: true,
                }
            )
        );
    }


    // =======================================================
    // TAB / INDENTATION
    // =======================================================

    function indent(outdent) {
        const editor =
            S.editor;

        if (!editor) {
            return;
        }

        const source =
            editor.value;

        const start =
            editor.selectionStart;

        const end =
            editor.selectionEnd;

        const blockStart =
            source.lastIndexOf(
                "\n",
                start - 1
            ) + 1;

        const nextNewline =
            source.indexOf(
                "\n",
                end
            );

        const blockEnd =
            nextNewline === -1
                ? source.length
                : nextNewline;

        const block =
            source.slice(
                blockStart,
                blockEnd
            );


        // Normal single-cursor Tab
        if (
            !outdent
            && start === end
            && !block.includes("\n")
        ) {
            editor.setRangeText(
                TAB,
                start,
                end,
                "end"
            );

            emitInput();
            return;
        }


        const rows =
            block.split("\n");

        let delta = 0;
        let firstRemoved = 0;

        const changed =
            rows
                .map(
                    (
                        row,
                        index
                    ) => {
                        if (!outdent) {
                            delta +=
                                TAB.length;

                            return (
                                TAB
                                + row
                            );
                        }

                        const spaces =
                            row.match(
                                /^ +/
                            )?.[0]
                                .length
                            || 0;

                        const remove =
                            Math.min(
                                TAB.length,
                                spaces
                            );

                        if (index === 0) {
                            firstRemoved =
                                Math.min(
                                    remove,

                                    Math.max(
                                        0,
                                        start
                                        - blockStart
                                    )
                                );
                        }

                        delta -= remove;

                        return row.slice(
                            remove
                        );
                    }
                )
                .join("\n");

        editor.setRangeText(
            changed,
            blockStart,
            blockEnd,
            "select"
        );

        if (outdent) {
            const newStart =
                Math.max(
                    blockStart,
                    start - firstRemoved
                );

            editor.setSelectionRange(
                newStart,

                Math.max(
                    newStart,
                    end + delta
                )
            );
        }
        else {
            const rowsBeforeStart =
                source
                    .slice(
                        blockStart,
                        start
                    )
                    .split("\n")
                    .length;

            editor.setSelectionRange(
                start
                + rowsBeforeStart
                * TAB.length,

                end + delta
            );
        }

        emitInput();
    }


    // =======================================================
    // FIND / REPLACE
    // =======================================================

    function searchMatches() {
        if (
            !S.editor
            || !S.findInput?.value
        ) {
            return [];
        }

        const source =
            S.editor.value
                .toLocaleLowerCase();

        const query =
            S.findInput.value
                .toLocaleLowerCase();

        const results = [];
        let from = 0;

        while (
            from
            <= source.length
            - query.length
        ) {
            const found =
                source.indexOf(
                    query,
                    from
                );

            if (found < 0) {
                break;
            }

            results.push({
                start: found,

                end:
                    found
                    + query.length,
            });

            from =
                found
                + Math.max(
                    1,
                    query.length
                );
        }

        return results;
    }


    function updateFindCount() {
        if (!S.findCount) {
            return;
        }

        if (!S.findInput?.value) {
            S.findCount.textContent =
                "";

            return;
        }

        if (!S.matches.length) {
            S.findCount.textContent =
                "0 / 0";

            return;
        }

        S.findCount.textContent =
            (
                `${S.matchIndex + 1}`
                + ` / `
                + `${S.matches.length}`
            );
    }


    function selectMatch(index) {
        if (!S.matches.length) {
            S.matchIndex = -1;
            updateFindCount();
            return;
        }

        const normalized =
            (
                (
                    index
                    % S.matches.length
                )
                + S.matches.length
            )
            % S.matches.length;

        const match =
            S.matches[
                normalized
            ];

        S.matchIndex =
            normalized;

        S.editor.focus({
            preventScroll: true,
        });

        S.editor.setSelectionRange(
            match.start,
            match.end
        );

        const line =
            S.editor.value
                .slice(
                    0,
                    match.start
                )
                .split("\n")
                .length - 1;

        S.editor.scrollTop =
            Math.max(
                0,

                line
                * LINE_HEIGHT
                - S.editor.clientHeight
                * .35
            );

        updateFindCount();
        refresh();
    }


    function runSearch(
        direction = 1
    ) {
        S.matches =
            searchMatches();

        if (!S.matches.length) {
            selectMatch(-1);
            return;
        }

        let next =
            S.matchIndex;

        if (next < 0) {
            const caret =
                S.editor.selectionStart;

            next =
                S.matches.findIndex(
                    (match) =>
                        match.start
                        >= caret
                );

            if (next < 0) {
                next = 0;
            }
        }
        else {
            next += direction;
        }

        selectMatch(next);
    }


    function openFind(
        showReplace = false
    ) {
        if (
            !S.findBar
            || !S.findInput
            || !S.editor
        ) {
            return;
        }

        S.findBar.classList.add(
            "visible"
        );

        S.findBar.classList.toggle(
            "replace-open",
            showReplace
        );

        const selected =
            S.editor.value.slice(
                S.editor.selectionStart,
                S.editor.selectionEnd
            );

        if (
            selected
            && !selected.includes("\n")
        ) {
            S.findInput.value =
                selected;
        }

        S.matches =
            searchMatches();

        S.matchIndex = -1;

        updateFindCount();

        window.setTimeout(
            () => {
                S.findInput.focus();
                S.findInput.select();
            },
            0
        );
    }


    function closeFind() {
        S.findBar?.classList.remove(
            "visible",
            "replace-open"
        );

        S.matches = [];
        S.matchIndex = -1;

        updateFindCount();

        S.editor?.focus();
    }


    function replaceCurrent() {
        if (
            !S.editor
            || S.matchIndex < 0
            || !S.matches[
                S.matchIndex
            ]
        ) {
            return;
        }

        const match =
            S.matches[
                S.matchIndex
            ];

        S.editor.setRangeText(
            S.replaceInput?.value
            || "",

            match.start,
            match.end,
            "end"
        );

        emitInput();

        S.matches =
            searchMatches();

        S.matchIndex =
            Math.min(
                S.matchIndex,
                S.matches.length - 1
            );

        updateFindCount();
    }


    function replaceAll() {
        if (
            !S.editor
            || !S.findInput?.value
        ) {
            return;
        }

        const query =
            S.findInput.value;

        const replacement =
            S.replaceInput?.value
            || "";

        const lowerSource =
            S.editor.value
                .toLocaleLowerCase();

        const lowerQuery =
            query.toLocaleLowerCase();

        let cursor = 0;
        let output = "";
        let count = 0;

        while (
            cursor
            < S.editor.value.length
        ) {
            const found =
                lowerSource.indexOf(
                    lowerQuery,
                    cursor
                );

            if (found < 0) {
                output +=
                    S.editor.value.slice(
                        cursor
                    );

                break;
            }

            output +=
                S.editor.value.slice(
                    cursor,
                    found
                )
                + replacement;

            cursor =
                found
                + query.length;

            count += 1;
        }

        if (!count) {
            return;
        }

        S.editor.value =
            output;

        S.editor.setSelectionRange(
            0,
            0
        );

        emitInput();

        S.matches =
            searchMatches();

        S.matchIndex = -1;

        updateFindCount();
    }


    // =======================================================
    // FIND BAR UI
    // =======================================================

    function buildFindBar(pane) {
        const bar =
            document.createElement(
                "div"
            );

        bar.id =
            "cvmLatexIdeFindBar";

        bar.className =
            "cvm-ide-findbar";

        bar.innerHTML = `
            <div class="cvm-ide-find-row">

                <span class="cvm-ide-find-icon">
                    ⌕
                </span>

                <input
                    id="cvmLatexIdeFindInput"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder="Find in resume.tex"
                >

                <span
                    id="cvmLatexIdeFindCount"
                    class="cvm-ide-find-count"
                ></span>

                <button
                    id="cvmLatexIdeFindPrev"
                    type="button"
                    title="Previous"
                >
                    ↑
                </button>

                <button
                    id="cvmLatexIdeFindNext"
                    type="button"
                    title="Next"
                >
                    ↓
                </button>

                <button
                    id="cvmLatexIdeFindClose"
                    type="button"
                    title="Close"
                >
                    ×
                </button>

            </div>

            <div class="cvm-ide-replace-row">

                <span class="cvm-ide-find-icon">
                    ↳
                </span>

                <input
                    id="cvmLatexIdeReplaceInput"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder="Replace with"
                >

                <button
                    id="cvmLatexIdeReplaceOne"
                    type="button"
                >
                    Replace
                </button>

                <button
                    id="cvmLatexIdeReplaceAll"
                    type="button"
                >
                    All
                </button>

            </div>
        `;

        pane.appendChild(bar);

        S.findBar = bar;

        S.findInput =
            bar.querySelector(
                "#cvmLatexIdeFindInput"
            );

        S.replaceInput =
            bar.querySelector(
                "#cvmLatexIdeReplaceInput"
            );

        S.findCount =
            bar.querySelector(
                "#cvmLatexIdeFindCount"
            );


        S.findInput.addEventListener(
            "input",

            () => {
                S.matches =
                    searchMatches();

                S.matchIndex = -1;

                updateFindCount();
            }
        );


        S.findInput.addEventListener(
            "keydown",

            (event) => {
                if (
                    event.key
                    === "Enter"
                ) {
                    event.preventDefault();

                    runSearch(
                        event.shiftKey
                            ? -1
                            : 1
                    );
                }
                else if (
                    event.key
                    === "Escape"
                ) {
                    event.preventDefault();
                    closeFind();
                }
            }
        );


        S.replaceInput.addEventListener(
            "keydown",

            (event) => {
                if (
                    event.key
                    === "Enter"
                ) {
                    event.preventDefault();

                    replaceCurrent();
                }
                else if (
                    event.key
                    === "Escape"
                ) {
                    event.preventDefault();

                    closeFind();
                }
            }
        );


        bar
            .querySelector(
                "#cvmLatexIdeFindPrev"
            )
            .addEventListener(
                "click",

                () =>
                    runSearch(-1)
            );


        bar
            .querySelector(
                "#cvmLatexIdeFindNext"
            )
            .addEventListener(
                "click",

                () =>
                    runSearch(1)
            );


        bar
            .querySelector(
                "#cvmLatexIdeFindClose"
            )
            .addEventListener(
                "click",
                closeFind
            );


        bar
            .querySelector(
                "#cvmLatexIdeReplaceOne"
            )
            .addEventListener(
                "click",
                replaceCurrent
            );


        bar
            .querySelector(
                "#cvmLatexIdeReplaceAll"
            )
            .addEventListener(
                "click",
                replaceAll
            );
    }


    // =======================================================
    // KEYBOARD
    // =======================================================

    function editorKeydown(event) {
        const modifier =
            event.ctrlKey
            || event.metaKey;


        // Tab / Shift+Tab
        if (event.key === "Tab") {
            event.preventDefault();
            event.stopImmediatePropagation();

            indent(
                event.shiftKey
            );

            return;
        }


        // Ctrl+F
        if (
            modifier
            && event.key
                .toLowerCase()
                === "f"
        ) {
            event.preventDefault();
            event.stopImmediatePropagation();

            openFind(false);
            return;
        }


        // Ctrl+H
        if (
            modifier
            && event.key
                .toLowerCase()
                === "h"
        ) {
            event.preventDefault();
            event.stopImmediatePropagation();

            openFind(true);
        }
    }


    // =======================================================
    // BUILD IDE CHROME
    // =======================================================

    function buildChrome(editor) {
        const wrap =
            editor.closest(
                ".cvm-latex-editor-wrap"
            );

        const pane =
            editor.closest(
                ".cvm-latex-editor-pane"
            );

        const header =
            pane?.querySelector(
                ".cvm-latex-pane-header"
            );

        const footer =
            pane?.querySelector(
                ".cvm-latex-editor-footer"
            );

        const lines =
            pane?.querySelector(
                "#cvmLatexLineNumbers"
            );

        if (
            !wrap
            || !pane
            || !header
            || !footer
            || !lines
        ) {
            return false;
        }


        // Guard against duplicate enhancement.
        if (
            pane.classList.contains(
                "cvm-latex-ide-pane"
            )
        ) {
            S.editor = editor;
            S.lines = lines;

            S.highlight =
                pane.querySelector(
                    "#cvmLatexIdeHighlight"
                );

            S.currentLine =
                pane.querySelector(
                    ".cvm-ide-current-line"
                );

            S.dirtyDot =
                pane.querySelector(
                    "#cvmLatexIdeDirtyDot"
                );

            S.cursor =
                pane.querySelector(
                    "#cvmLatexIdeCursorStatus"
                );

            S.selection =
                pane.querySelector(
                    "#cvmLatexIdeSelectionStatus"
                );

            S.findBar =
                pane.querySelector(
                    "#cvmLatexIdeFindBar"
                );

            S.findInput =
                pane.querySelector(
                    "#cvmLatexIdeFindInput"
                );

            S.replaceInput =
                pane.querySelector(
                    "#cvmLatexIdeReplaceInput"
                );

            S.findCount =
                pane.querySelector(
                    "#cvmLatexIdeFindCount"
                );

            return Boolean(
                S.highlight
                && S.currentLine
            );
        }


        pane.classList.add(
            "cvm-latex-ide-pane"
        );

        header.classList.add(
            "cvm-latex-ide-pane-header"
        );

        wrap.classList.add(
            "cvm-latex-ide-wrap"
        );

        lines.classList.add(
            "cvm-latex-ide-line-numbers"
        );


        // ---------------------------------------------------
        // File tab
        // ---------------------------------------------------

        const tabbar =
            document.createElement(
                "div"
            );

        tabbar.className =
            "cvm-ide-tabbar";

        tabbar.innerHTML = `
            <div class="cvm-ide-tab active">

                <span class="cvm-ide-tex-glyph">
                    TeX
                </span>

                <span class="cvm-ide-tab-name">
                    resume.tex
                </span>

                <span
                    id="cvmLatexIdeDirtyDot"
                    class="cvm-ide-dirty-dot"
                    aria-hidden="true"
                ></span>

            </div>

            <div class="cvm-ide-breadcrumb">

                <span>
                    CV Maker
                </span>

                <b>
                    ›
                </b>

                <span>
                    LaTeX Studio
                </span>

                <b>
                    ›
                </b>

                <strong>
                    resume.tex
                </strong>

            </div>

            <div class="cvm-ide-tab-actions">

                <button
                    id="cvmLatexIdeFindBtn"
                    type="button"
                    title="Find (Ctrl+F)"
                >
                    ⌕
                </button>

            </div>
        `;

        pane.insertBefore(
            tabbar,
            wrap
        );


        // ---------------------------------------------------
        // Syntax layer
        // ---------------------------------------------------

        const shell =
            document.createElement(
                "div"
            );

        shell.className =
            "cvm-ide-code-shell";


        const currentLine =
            document.createElement(
                "div"
            );

        currentLine.className =
            "cvm-ide-current-line";

        currentLine.setAttribute(
            "aria-hidden",
            "true"
        );


        const highlight =
            document.createElement(
                "pre"
            );

        highlight.id =
            "cvmLatexIdeHighlight";

        highlight.className =
            "cvm-ide-highlight";

        highlight.setAttribute(
            "aria-hidden",
            "true"
        );


        wrap.insertBefore(
            shell,
            editor
        );

        shell.append(
            currentLine,
            highlight,
            editor
        );


        // ---------------------------------------------------
        // Status bar
        // ---------------------------------------------------

        const engineStatus =
            footer.querySelector(
                "#cvmLatexEngineStatus"
            );

        Array.from(
            footer.children
        ).forEach(
            (node) => {
                if (
                    node
                    !== engineStatus
                ) {
                    node.remove();
                }
            }
        );


        const status =
            document.createElement(
                "div"
            );

        status.className =
            "cvm-ide-status-right";

        status.innerHTML = `
            <span>
                LaTeX
            </span>

            <span
                id="cvmLatexIdeSelectionStatus"
            >
                UTF-8
            </span>

            <span>
                Spaces: 4
            </span>

            <span
                id="cvmLatexIdeCursorStatus"
            >
                Ln 1, Col 1
            </span>

            <span class="cvm-ide-shortcut-hint">
                Ctrl+Enter Compile · Ctrl+S Save
            </span>
        `;

        footer.appendChild(
            status
        );


        // ---------------------------------------------------
        // References
        // ---------------------------------------------------

        S.editor = editor;
        S.lines = lines;
        S.highlight = highlight;
        S.currentLine = currentLine;

        S.dirtyDot =
            tabbar.querySelector(
                "#cvmLatexIdeDirtyDot"
            );

        S.cursor =
            status.querySelector(
                "#cvmLatexIdeCursorStatus"
            );

        S.selection =
            status.querySelector(
                "#cvmLatexIdeSelectionStatus"
            );


        // ---------------------------------------------------
        // Search
        // ---------------------------------------------------

        buildFindBar(pane);

        tabbar
            .querySelector(
                "#cvmLatexIdeFindBtn"
            )
            .addEventListener(
                "click",

                () =>
                    openFind(false)
            );


        // ---------------------------------------------------
        // Editor events
        // ---------------------------------------------------

        editor.addEventListener(
            "keydown",
            editorKeydown,
            true
        );

        editor.addEventListener(
            "input",
            refresh
        );

        editor.addEventListener(
            "scroll",
            syncScroll
        );

        [
            "click",
            "keyup",
            "select",
            "focus",
        ].forEach(
            (eventName) => {
                editor.addEventListener(
                    eventName,
                    refresh
                );
            }
        );


        return true;
    }


    // =======================================================
    // ENHANCE EXISTING LATEX EDITOR
    // =======================================================

    function enhance() {
        resetDisconnectedEditor();


        // CRITICAL:
        // Once enhanced, do NOT call refresh() from here.
        //
        // The previous version did that while a MutationObserver
        // watched the whole document. refresh() rewrites the line
        // number DOM, which triggered the observer again and caused
        // an infinite UI loop.
        if (
            S.ready
            && S.editor?.isConnected
        ) {
            return true;
        }


        const editor =
            document.querySelector(
                "#cvmLatexEditor"
            );

        if (!editor) {
            return false;
        }


        if (!buildChrome(editor)) {
            return false;
        }


        S.ready = true;

        // We only needed the observer to WAIT until the editor
        // existed. It must never remain active after enhancement.
        stopObserver();

        refresh();

        return true;
    }


    // =======================================================
    // EXISTING CVM FUNCTION HOOKS
    // =======================================================

    function wrapFunction(
        name,
        after
    ) {
        const original =
            window[name];

        if (
            typeof original
            !== "function"
            || original
                .__cvmLatexIdeWrapped
        ) {
            return;
        }

        const wrapped =
            async function (...args) {
                const result =
                    await original.apply(
                        this,
                        args
                    );

                await after?.(
                    ...args
                );

                return result;
            };


        wrapped.__cvmLatexIdeWrapped =
            true;

        window[name] =
            wrapped;
    }


    function installHooks() {
        wrapFunction(
            "cvmV07OpenLatexStudio",

            async () => {
                enhance();

                window.setTimeout(
                    refresh,
                    0
                );
            }
        );


        wrapFunction(
            "cvmV07LoadStarterTemplate",

            async () => {
                window.setTimeout(
                    refresh,
                    0
                );
            }
        );


        wrapFunction(
            "cvmV07CompileLatex",

            async () => {
                window.setTimeout(
                    refresh,
                    0
                );
            }
        );


        wrapFunction(
            "cvmV07RefreshLatexLabels",

            async () => {
                window.setTimeout(
                    updateStatus,
                    0
                );
            }
        );
    }


    // =======================================================
    // OBSERVER
    //
    // IMPORTANT:
    // This observer exists ONLY if the editor is not present
    // when the script initializes.
    //
    // As soon as the editor is found and enhanced, it is
    // disconnected permanently.
    // =======================================================

    function startObserverIfNeeded() {
        if (
            S.ready
            || S.observer
        ) {
            return;
        }

        S.observer =
            new MutationObserver(
                () => {
                    if (S.ready) {
                        stopObserver();
                        return;
                    }

                    if (
                        document.querySelector(
                            "#cvmLatexEditor"
                        )
                    ) {
                        enhance();

                        if (S.ready) {
                            stopObserver();
                        }
                    }
                }
            );

        S.observer.observe(
            document.body,

            {
                childList: true,
                subtree: true,
            }
        );
    }


    // =======================================================
    // INIT
    // =======================================================

    function init() {
        installHooks();

        // In the current CVM architecture the LaTeX editor exists
        // in the static DOM, even while its overlay is closed.
        //
        // This normally succeeds immediately, meaning no observer
        // is needed at all.
        if (enhance()) {
            stopObserver();
            return;
        }

        // Fallback only for a future dynamically-created editor.
        startObserverIfNeeded();
    }


    // =======================================================
    // PUBLIC HELPERS
    // =======================================================

    window.cvmLatexIdeRefresh =
        refresh;

    window.cvmLatexIdeOpenFind =
        openFind;


    // =======================================================
    // START
    // =======================================================

    if (
        document.readyState
        === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,

            {
                once: true,
            }
        );
    }
    else {
        init();
    }


    window.addEventListener(
        "pywebviewready",

        () => {
            window.setTimeout(
                init,
                0
            );
        }
    );
})();