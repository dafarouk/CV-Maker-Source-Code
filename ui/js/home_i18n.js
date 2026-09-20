"use strict";

// ===========================================================
// CVM HOMEPAGE LANGUAGE PATCH — EN / FR
//
// Handles the v1.0.1+ homepage tiles that were added after
// the original localization system.
//
// No MutationObserver.
// No changes to the existing localization engine.
// ===========================================================

(() => {
    const HOME_TEXT = {
        en: {
            boardAria:
                "CV Maker creation options",

            createEyebrow:
                "EASY STEPS",

            createTitle:
                "Create CV",

            createSub:
                "Guided steps",

            latexEyebrow:
                "ADVANCED",

            latexTitle:
                "Customize with LaTeX",

            openEyebrow:
                "CONTINUE",

            openTitle:
                "Open Project",

            demoEyebrow:
                "EXPLORE",

            demoTitle:
                "Try Demo CV",
        },

        fr: {
            boardAria:
                "Options de création CV Maker",

            createEyebrow:
                "ÉTAPES SIMPLES",

            createTitle:
                "Créer un CV",

            createSub:
                "Étapes guidées",

            latexEyebrow:
                "AVANCÉ",

            latexTitle:
                "Personnaliser avec LaTeX",

            openEyebrow:
                "CONTINUER",

            openTitle:
                "Ouvrir un projet",

            demoEyebrow:
                "EXPLORER",

            demoTitle:
                "Essayer le CV démo",
        },
    };


    function normalizeLanguage(value) {
        return String(
            value || "en"
        )
            .toLowerCase()
            .startsWith("fr")
                ? "fr"
                : "en";
    }


    function currentLanguage() {
        return normalizeLanguage(
            document.documentElement.lang
            || "en"
        );
    }


    function setText(
        selector,
        value
    ) {
        const element =
            document.querySelector(
                selector
            );

        if (element) {
            element.textContent =
                value;
        }
    }


    function applyHomeLanguage(
        forcedLanguage = null
    ) {
        const language =
            forcedLanguage
                ? normalizeLanguage(
                    forcedLanguage
                )
                : currentLanguage();

        const text =
            HOME_TEXT[
                language
            ]
            || HOME_TEXT.en;


        const board =
            document.querySelector(
                ".cvm-v101-home-board"
            );

        if (board) {
            board.setAttribute(
                "aria-label",
                text.boardAria
            );
        }


        // CREATE CV
        setText(
            "#newCvBtn .cvm-v101-home-label small",
            text.createEyebrow
        );

        setText(
            "#newCvBtn .cvm-v101-home-label strong",
            text.createTitle
        );

        setText(
            "#newCvBtn .cvm-v101-home-label > span",
            text.createSub
        );


        // CUSTOMIZE WITH LATEX
        setText(
            "#cvmLatexHomeBtn .cvm-v101-home-label small",
            text.latexEyebrow
        );

        setText(
            "#cvmLatexHomeBtn .cvm-v101-home-label strong",
            text.latexTitle
        );


        // OPEN PROJECT
        setText(
            "#openProjectBtn .cvm-v101-home-label small",
            text.openEyebrow
        );

        setText(
            "#openProjectBtn .cvm-v101-home-label strong",
            text.openTitle
        );


        // DEMO
        setText(
            "#demoBtn .cvm-v101-home-label small",
            text.demoEyebrow
        );

        setText(
            "#demoBtn .cvm-v101-home-label strong",
            text.demoTitle
        );
    }


    // Existing CVM language buttons use data-cvm-language.
    document.addEventListener(
        "click",

        (event) => {
            const button =
                event.target.closest?.(
                    "[data-cvm-language]"
                );

            if (!button) {
                return;
            }

            const requestedLanguage =
                button.dataset
                    .cvmLanguage;


            // Immediate visual response.
            applyHomeLanguage(
                requestedLanguage
            );


            // Existing localization updates <html lang>.
            // Refresh once more afterwards to stay synchronized.
            window.setTimeout(
                () =>
                    applyHomeLanguage(),

                40
            );
        }
    );


    document.addEventListener(
        "DOMContentLoaded",

        () =>
            applyHomeLanguage()
    );


    window.addEventListener(
        "pywebviewready",

        () =>
            window.setTimeout(
                () =>
                    applyHomeLanguage(),

                0
            )
    );


    window.cvmRefreshHomeLanguage =
        applyHomeLanguage;
})();