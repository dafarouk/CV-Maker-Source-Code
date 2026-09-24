(() => {
    "use strict";

    const copy = {
        en: {
            eyebrow: "CV CREATION WORKSPACE",
            pages: {
                home: "Home",
                content: "CV Content",
                design: "Design",
                ats: "ATS Check",
                export: "Export",
                recent: "Recent Projects",
                logs: "Logs",
                exports: "Exports",
            },
            support: "♥ Support CVM",
            open: "Open .cvm",
            save: "Save .cvm",
            recent: "Recent Projects",
            logs: "Logs",
            contact: "Contact",
            about: "About CVM",
        },
        fr: {
            eyebrow: "ESPACE DE CRÉATION CV",
            pages: {
                home: "Accueil",
                content: "Contenu du CV",
                design: "Design",
                ats: "Check ATS",
                export: "Export",
                recent: "Projets récents",
                logs: "Journaux",
                exports: "Exports",
            },
            support: "♥ Soutenir CVM",
            open: "Ouvrir .cvm",
            save: "Enregistrer .cvm",
            recent: "Projets récents",
            logs: "Journaux",
            contact: "Contact",
            about: "À propos de CVM",
        },
    };

    function currentLanguage() {
        return document.documentElement.lang === "fr" ? "fr" : "en";
    }

    function setText(selector, value) {
        const element = document.querySelector(selector);

        if (element) {
            element.textContent = value;
        }
    }

    function activePageKey() {
        if (document.querySelector("#page-logs-manager.active")) {
            return "logs";
        }

        if (document.querySelector("#page-exports-manager.active")) {
            return "exports";
        }

        if (document.querySelector("#page-recent-manager.active")) {
            return "recent";
        }

        const activeNav = document.querySelector(
            ".sidebar .nav-item.active[data-page]"
        );

        if (activeNav?.dataset?.page) {
            return activeNav.dataset.page;
        }

        const activePage = document.querySelector(
            ".main-content > .page.active"
        );

        const id = activePage?.id || "";

        if (id === "page-content") {
            return "content";
        }

        if (id === "page-design") {
            return "design";
        }

        if (id === "page-ats") {
            return "ats";
        }

        if (id === "page-export") {
            return "export";
        }

        return "home";
    }

    function refreshShellText() {
        const lang = currentLanguage();
        const text = copy[lang];
        const pageKey = activePageKey();

        setText(
            "#cvmShellEyebrow",
            text.eyebrow
        );

        setText(
            "#cvmShellPageTitle",
            text.pages[pageKey] || text.pages.home
        );

        setText(
            "#cvmShellSupportBtn",
            text.support
        );

        setText(
            "#cvmShellOpenProjectBtn",
            text.open
        );

        setText(
            "#saveProjectBtn",
            text.save
        );

        setText(
            "#openRecentBtn",
            text.recent
        );

        setText(
            "#openLogsBtn",
            text.logs
        );

        setText(
            "#cvmShellContactBtn",
            text.contact
        );

        setText(
            "#cvmShellAboutBtn",
            text.about
        );
    }

    function bindShellActions() {
        document
            .querySelector("#cvmShellSupportBtn")
            ?.addEventListener(
                "click",
                () => {
                    if (
                        typeof window.cvmShowModal
                        === "function"
                    ) {
                        window.cvmShowModal(
                            "cvmSupportModal"
                        );
                    }
                }
            );

        document
            .querySelector("#cvmShellOpenProjectBtn")
            ?.addEventListener(
                "click",
                () => {
                    document
                        .querySelector("#openProjectBtn")
                        ?.click();
                }
            );

        document
            .querySelector("#cvmShellContactBtn")
            ?.addEventListener(
                "click",
                () => {
                    if (
                        typeof window.cvmShowModal
                        === "function"
                    ) {
                        window.cvmShowModal(
                            "cvmContactModal"
                        );
                    }
                }
            );

        document
            .querySelector("#cvmShellAboutBtn")
            ?.addEventListener(
                "click",
                () => {
                    if (
                        typeof window.cvmV05ShowAbout
                        === "function"
                    ) {
                        window.cvmV05ShowAbout();
                    }
                }
            );

        document.addEventListener(
            "click",
            (event) => {
                if (
                    event.target.closest(
                        ".sidebar, .topbar"
                    )
                ) {
                    window.setTimeout(
                        refreshShellText,
                        0
                    );

                    window.setTimeout(
                        refreshShellText,
                        80
                    );
                }
            }
        );

        document
            .querySelectorAll(
                "[data-cvm-language]"
            )
            .forEach(
                (button) => {
                    button.addEventListener(
                        "click",
                        () => {
                            window.setTimeout(
                                refreshShellText,
                                40
                            );

                            window.setTimeout(
                                refreshShellText,
                                140
                            );
                        }
                    );
                }
            );
    }

    function init() {
        bindShellActions();
        refreshShellText();

        window.setTimeout(
            refreshShellText,
            100
        );

        window.setTimeout(
            refreshShellText,
            350
        );
    }

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
})();