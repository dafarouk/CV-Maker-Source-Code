"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
    bridgeReady: false,
    bridgeInitializing: false,
    appVersion: "0.2.0",
    theme: "light",
    journalVisible: true,
    currentPage: "home",
    pdfAvailable: false,
    autosaveTimer: null,
    project: null,
};

function uid() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID().replaceAll("-", "");
    }

    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2)
    );
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function csvToArray(value) {
    return String(value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function linesToArray(value) {
    return String(value ?? "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function safeOn(selector, eventName, handler) {
    const element = $(selector);

    if (element) {
        element.addEventListener(
            eventName,
            handler
        );
    }
}

function getValue(
    selector,
    fallback = ""
) {
    const element = $(selector);

    return element
        ? element.value
        : fallback;
}

function setValue(
    selector,
    value = ""
) {
    const element = $(selector);

    if (element) {
        element.value = value ?? "";
    }
}


// ===========================================================
// BLANK ITEMS
// ===========================================================

function blankExperience() {
    return {
        id: uid(),

        job_title: "",
        company: "",
        location: "",

        start_date: "",
        end_date: "",

        current: false,

        description_mode: "bullets",

        paragraph: "",

        bullets: [],

        tools: [],
    };
}

function blankEducation() {
    return {
        id: uid(),

        degree: "",
        school: "",
        location: "",

        start_date: "",
        end_date: "",

        details: "",
    };
}

function blankProjectItem() {
    return {
        id: uid(),

        name: "",
        subtitle: "",
        date: "",

        bullets: [],

        tools: [],

        link: "",
    };
}

function blankVolunteering() {
    return {
        id: uid(),

        role: "",
        organization: "",
        location: "",

        start_date: "",
        end_date: "",

        bullets: [],
    };
}

function blankSkillGroup() {
    return {
        id: uid(),
        name: "",
        items: [],
    };
}

function blankLanguage() {
    return {
        id: uid(),
        name: "",
        level: "",
    };
}

function blankCertification() {
    return {
        id: uid(),
        name: "",
        issuer: "",
        year: "",
        link: "",
    };
}


// ===========================================================
// THEME
// ===========================================================

function getSavedTheme() {
    const saved =
        localStorage.getItem(
            "cvm-theme"
        );

    return saved === "dark"
        ? "dark"
        : "light";
}

function applyTheme(theme) {
    state.theme = theme;

    document.documentElement
        .setAttribute(
            "data-theme",
            theme
        );

    localStorage.setItem(
        "cvm-theme",
        theme
    );

    const icon =
        $("#themeIcon");

    if (icon) {
        icon.textContent =
            theme === "dark"
                ? "☀"
                : "◐";
    }
}

function toggleTheme() {
    applyTheme(
        state.theme === "dark"
            ? "light"
            : "dark"
    );
}


// ===========================================================
// JOURNAL
// ===========================================================

function savedJournalVisibility() {
    const saved =
        localStorage.getItem(
            "cvm-journal-visible"
        );

    return saved === null
        ? true
        : saved === "true";
}

function applyJournalVisibility(
    visible
) {
    state.journalVisible =
        Boolean(visible);

    const shell =
        $("#appShell");

    if (shell) {
        shell.classList.toggle(
            "journal-hidden",
            !state.journalVisible
        );
    }

    const toggle =
        $("#journalToggle");

    if (toggle) {
        toggle.classList.toggle(
            "active",
            state.journalVisible
        );

        toggle.title =
            state.journalVisible
                ? "Hide activity journal"
                : "Show activity journal";
    }

    const text =
        $("#journalToggleText");

    if (text) {
        text.textContent =
            state.journalVisible
                ? "Journal"
                : "Show Journal";
    }

    localStorage.setItem(
        "cvm-journal-visible",
        String(
            state.journalVisible
        )
    );
}

function toggleJournal() {
    applyJournalVisibility(
        !state.journalVisible
    );
}


// ===========================================================
// TOASTS / JOURNAL LOGS
// ===========================================================

function showToast(
    message,
    type = "info",
    duration = 3300
) {
    const container =
        $("#toastContainer");

    if (!container) {
        return;
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `toast ${type}`;

    toast.textContent =
        String(
            message ?? ""
        );

    container.appendChild(
        toast
    );

    window.setTimeout(
        () => toast.remove(),
        duration
    );
}

function logSymbol(level) {
    const normalized =
        String(
            level ?? "INFO"
        ).toUpperCase();

    if (
        normalized === "SUCCESS"
    ) {
        return "✓";
    }

    if (
        normalized === "WARNING"
    ) {
        return "!";
    }

    if (
        normalized === "ERROR"
    ) {
        return "×";
    }

    return "i";
}

function appendLog(event) {
    const list =
        $("#logList");

    if (!list) {
        return;
    }

    const level =
        String(
            event?.level ?? "INFO"
        ).toLowerCase();

    const row =
        document.createElement(
            "div"
        );

    row.className =
        `log-line ${level}`;

    row.innerHTML = `
        <time>
            ${escapeHtml(
                event?.timestamp ||
                "--:--:--"
            )}
        </time>

        <span class="log-symbol">
            ${logSymbol(
                event?.level
            )}
        </span>

        <p>
            ${escapeHtml(
                event?.message ||
                ""
            )}
        </p>
    `;

    list.appendChild(
        row
    );

    list.scrollTop =
        list.scrollHeight;
}

window.cvmReceiveLog =
    (event) =>
        appendLog(
            event
        );

function setBridgeStatus(
    connected,
    text = null
) {
    const badge =
        $("#connectionBadge");

    if (!badge) {
        return;
    }

    badge.classList.toggle(
        "connected",
        connected
    );

    badge.innerHTML = `
        <span class="connection-dot"></span>

        <span id="connectionText">
            ${escapeHtml(
                text ||
                (
                    connected
                        ? "Connected"
                        : "Connecting"
                )
            )}
        </span>
    `;
}


// ===========================================================
// NAVIGATION
// ===========================================================

const pageNames = [
    "home",
    "content",
    "design",
    "ats",
    "job",
    "export",
    "settings",
];

function showPage(pageName) {
    if (
        !pageNames.includes(
            pageName
        )
    ) {
        return;
    }

    state.currentPage =
        pageName;

    for (
        const name
        of pageNames
    ) {
        $(
            "#page-" + name
        )?.classList.toggle(
            "active",
            name === pageName
        );
    }

    $$(
        ".nav-item[data-page]"
    ).forEach(
        (button) => {
            button.classList.toggle(
                "active",
                button.dataset.page
                === pageName
            );
        }
    );

    if (
        pageName === "content"
    ) {
        renderPreview();
    }
}


// ===========================================================
// PROJECT UI
// ===========================================================

function loadProjectIntoUI(project) {
    if (!project) {
        return;
    }

    state.project =
        project;

    state.project.personal ||= {};
    state.project.design ||= {};

    state.project.experiences ||= [];
    state.project.education ||= [];
    state.project.projects ||= [];
    state.project.volunteering ||= [];
    state.project.skills ||= [];
    state.project.languages ||= [];
    state.project.certifications ||= [];

    setValue(
        "#projectTitle",
        project.title || ""
    );

    setValue(
        "#fullName",
        project.personal.full_name || ""
    );

    setValue(
        "#targetRole",
        project.personal.target_role || ""
    );

    setValue(
        "#secondaryTargetRole",
        project.personal.secondary_target_role || ""
    );

    setValue(
        "#location",
        project.personal.location || ""
    );

    setValue(
        "#email",
        project.personal.email || ""
    );

    setValue(
        "#phone",
        project.personal.phone || ""
    );

    setValue(
        "#linkedin",
        project.personal.linkedin || ""
    );

    setValue(
        "#github",
        project.personal.github || ""
    );

    setValue(
        "#website",
        project.personal.website || ""
    );

    setValue(
        "#profile",
        project.profile || ""
    );

    setValue(
        "#templateSelect",
        project.design.template_id ||
        "ats_classic"
    );

    setValue(
        "#accentColor",
        project.design.accent_color ||
        "#8B1540"
    );

    setValue(
        "#accentColorText",
        project.design.accent_color ||
        "#8B1540"
    );

    setValue(
        "#pageMode",
        project.design.page_mode ||
        "1"
    );

    setValue(
        "#regionSelect",
        project.design.region ||
        "international"
    );

    const photoEnabled =
        $("#photoEnabled");

    if (photoEnabled) {
        photoEnabled.checked =
            Boolean(
                project.design
                    .photo_enabled
            );
    }

    renderDynamicSections();
    renderPreview();
}

function collectStaticFields() {
    if (!state.project) {
        return;
    }

    state.project.personal ||= {};
    state.project.design ||= {};

    state.project.title =
        getValue(
            "#projectTitle",
            state.project.title ||
            "Untitled CV"
        );

    state.project.personal.full_name =
        getValue(
            "#fullName"
        );

    state.project.personal.target_role =
        getValue(
            "#targetRole"
        );

    state.project.personal
        .secondary_target_role =
        getValue(
            "#secondaryTargetRole"
        );

    state.project.personal.location =
        getValue(
            "#location"
        );

    state.project.personal.email =
        getValue(
            "#email"
        );

    state.project.personal.phone =
        getValue(
            "#phone"
        );

    state.project.personal.linkedin =
        getValue(
            "#linkedin"
        );

    state.project.personal.github =
        getValue(
            "#github"
        );

    state.project.personal.website =
        getValue(
            "#website"
        );

    state.project.profile =
        getValue(
            "#profile"
        );

    state.project.design.template_id =
        getValue(
            "#templateSelect",
            "ats_classic"
        );

    state.project.design.accent_color =
        getValue(
            "#accentColorText",
            "#8B1540"
        ) || "#8B1540";

    state.project.design.page_mode =
        getValue(
            "#pageMode",
            "1"
        );

    state.project.design.region =
        getValue(
            "#regionSelect",
            "international"
        );

    state.project.design.photo_enabled =
        Boolean(
            $("#photoEnabled")?.checked
        );
}


// ===========================================================
// FIELD GENERATION
// ===========================================================

function field(
    label,
    collection,
    index,
    key,
    value = "",
    options = {}
) {
    const full =
        options.full
            ? "full"
            : "";

    const type =
        options.type ||
        "text";

    if (
        type === "textarea" ||
        type === "lines"
    ) {
        const text =
            type === "lines" &&
            Array.isArray(value)
                ? value.join("\n")
                : value;

        return `
            <label class="field ${full}">

                <span>
                    ${escapeHtml(
                        label
                    )}
                </span>

                <textarea
                    rows="${
                        options.rows ||
                        4
                    }"
                    data-collection="${collection}"
                    data-index="${index}"
                    data-key="${key}"
                    data-value-type="${type}"
                >${escapeHtml(
                    text
                )}</textarea>

            </label>
        `;
    }

    const rendered =
        Array.isArray(value)
            ? value.join(", ")
            : value;

    return `
        <label class="field ${full}">

            <span>
                ${escapeHtml(
                    label
                )}
            </span>

            <input
                type="${type}"
                value="${escapeHtml(
                    rendered
                )}"
                data-collection="${collection}"
                data-index="${index}"
                data-key="${key}"
                data-value-type="${
                    options.valueType ||
                    "text"
                }"
            >

        </label>
    `;
}

function dynamicCard(
    title,
    collection,
    index,
    body
) {
    return `
        <article class="dynamic-card">

            <div class="dynamic-card-header">

                <strong>
                    ${escapeHtml(
                        title
                    )}
                </strong>

                <button
                    class="remove-button"
                    data-remove="${collection}"
                    data-index="${index}"
                >
                    Remove
                </button>

            </div>

            <div class="field-grid">
                ${body}
            </div>

        </article>
    `;
}


// ===========================================================
// EXPERIENCES
// ===========================================================

function renderExperiences() {
    const container =
        $("#experiencesContainer");

    if (
        !container ||
        !state.project
    ) {
        return;
    }

    container.innerHTML =
        state.project.experiences
            .map(
                (
                    item,
                    index
                ) => {
                    const body =
                        field(
                            "Job title",
                            "experiences",
                            index,
                            "job_title",
                            item.job_title
                        )
                        +
                        field(
                            "Company",
                            "experiences",
                            index,
                            "company",
                            item.company
                        )
                        +
                        field(
                            "Location",
                            "experiences",
                            index,
                            "location",
                            item.location
                        )
                        +
                        field(
                            "Start date",
                            "experiences",
                            index,
                            "start_date",
                            item.start_date
                        )
                        +
                        field(
                            "End date",
                            "experiences",
                            index,
                            "end_date",
                            item.end_date
                        )
                        +
                        `
                            <label class="toggle-row">

                                <div>

                                    <strong>
                                        Currently working here
                                    </strong>

                                    <span>
                                        Uses “Present” as the end date.
                                    </span>

                                </div>

                                <input
                                    type="checkbox"
                                    ${
                                        item.current
                                            ? "checked"
                                            : ""
                                    }
                                    data-collection="experiences"
                                    data-index="${index}"
                                    data-key="current"
                                    data-value-type="boolean"
                                >

                            </label>


                            <label class="field">

                                <span>
                                    Description format
                                </span>

                                <select
                                    data-collection="experiences"
                                    data-index="${index}"
                                    data-key="description_mode"
                                    data-value-type="text"
                                >

                                    <option
                                        value="bullets"
                                        ${
                                            item.description_mode
                                            === "bullets"
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        Bullet points
                                    </option>

                                    <option
                                        value="paragraph"
                                        ${
                                            item.description_mode
                                            === "paragraph"
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        Paragraph
                                    </option>

                                </select>

                            </label>
                        `
                        +
                        field(
                            "Bullets — one per line",
                            "experiences",
                            index,
                            "bullets",
                            item.bullets,
                            {
                                type: "lines",
                                full: true,
                                rows: 5,
                            }
                        )
                        +
                        field(
                            "Paragraph",
                            "experiences",
                            index,
                            "paragraph",
                            item.paragraph,
                            {
                                type: "textarea",
                                full: true,
                                rows: 4,
                            }
                        )
                        +
                        field(
                            "Tools — comma separated",
                            "experiences",
                            index,
                            "tools",
                            item.tools,
                            {
                                full: true,
                                valueType: "csv",
                            }
                        );

                    return dynamicCard(
                        item.job_title ||
                        `Experience ${index + 1}`,
                        "experiences",
                        index,
                        body
                    );
                }
            )
            .join("");
}


// ===========================================================
// EDUCATION
// ===========================================================

function renderEducation() {
    const container =
        $("#educationContainer");

    if (
        !container ||
        !state.project
    ) {
        return;
    }

    container.innerHTML =
        state.project.education
            .map(
                (
                    item,
                    index
                ) =>
                    dynamicCard(
                        item.degree ||
                        `Education ${index + 1}`,

                        "education",

                        index,

                        field(
                            "Degree",
                            "education",
                            index,
                            "degree",
                            item.degree
                        )
                        +
                        field(
                            "School / University",
                            "education",
                            index,
                            "school",
                            item.school
                        )
                        +
                        field(
                            "Location",
                            "education",
                            index,
                            "location",
                            item.location
                        )
                        +
                        field(
                            "Start",
                            "education",
                            index,
                            "start_date",
                            item.start_date
                        )
                        +
                        field(
                            "End",
                            "education",
                            index,
                            "end_date",
                            item.end_date
                        )
                        +
                        field(
                            "Details",
                            "education",
                            index,
                            "details",
                            item.details,
                            {
                                type: "textarea",
                                full: true,
                                rows: 3,
                            }
                        )
                    )
            )
            .join("");
}


// ===========================================================
// PROJECTS
// ===========================================================

function renderProjects() {
    const container =
        $("#projectsContainer");

    if (
        !container ||
        !state.project
    ) {
        return;
    }

    container.innerHTML =
        state.project.projects
            .map(
                (
                    item,
                    index
                ) =>
                    dynamicCard(
                        item.name ||
                        `Project ${index + 1}`,

                        "projects",

                        index,

                        field(
                            "Project name",
                            "projects",
                            index,
                            "name",
                            item.name
                        )
                        +
                        field(
                            "Subtitle",
                            "projects",
                            index,
                            "subtitle",
                            item.subtitle
                        )
                        +
                        field(
                            "Date",
                            "projects",
                            index,
                            "date",
                            item.date
                        )
                        +
                        field(
                            "Link",
                            "projects",
                            index,
                            "link",
                            item.link
                        )
                        +
                        field(
                            "Bullets — one per line",
                            "projects",
                            index,
                            "bullets",
                            item.bullets,
                            {
                                type: "lines",
                                full: true,
                            }
                        )
                        +
                        field(
                            "Tools — comma separated",
                            "projects",
                            index,
                            "tools",
                            item.tools,
                            {
                                full: true,
                                valueType: "csv",
                            }
                        )
                    )
            )
            .join("");
}


// ===========================================================
// VOLUNTEERING
// ===========================================================

function renderVolunteering() {
    const container =
        $("#volunteeringContainer");

    if (
        !container ||
        !state.project
    ) {
        return;
    }

    container.innerHTML =
        state.project.volunteering
            .map(
                (
                    item,
                    index
                ) =>
                    dynamicCard(
                        item.role ||
                        `Activity ${index + 1}`,

                        "volunteering",

                        index,

                        field(
                            "Role",
                            "volunteering",
                            index,
                            "role",
                            item.role
                        )
                        +
                        field(
                            "Organization",
                            "volunteering",
                            index,
                            "organization",
                            item.organization
                        )
                        +
                        field(
                            "Location",
                            "volunteering",
                            index,
                            "location",
                            item.location
                        )
                        +
                        field(
                            "Start",
                            "volunteering",
                            index,
                            "start_date",
                            item.start_date
                        )
                        +
                        field(
                            "End",
                            "volunteering",
                            index,
                            "end_date",
                            item.end_date
                        )
                        +
                        field(
                            "Bullets — one per line",
                            "volunteering",
                            index,
                            "bullets",
                            item.bullets,
                            {
                                type: "lines",
                                full: true,
                            }
                        )
                    )
            )
            .join("");
}


// ===========================================================
// SKILLS
// ===========================================================

function renderSkills() {
    const container =
        $("#skillsContainer");

    if (
        !container ||
        !state.project
    ) {
        return;
    }

    container.innerHTML =
        state.project.skills
            .map(
                (
                    item,
                    index
                ) =>
                    dynamicCard(
                        item.name ||
                        `Skill group ${index + 1}`,

                        "skills",

                        index,

                        field(
                            "Group name",
                            "skills",
                            index,
                            "name",
                            item.name
                        )
                        +
                        field(
                            "Skills — comma separated",
                            "skills",
                            index,
                            "items",
                            item.items,
                            {
                                valueType: "csv",
                            }
                        )
                    )
            )
            .join("");
}


// ===========================================================
// LANGUAGES
// ===========================================================

function renderLanguages() {
    const container =
        $("#languagesContainer");

    if (
        !container ||
        !state.project
    ) {
        return;
    }

    container.innerHTML =
        state.project.languages
            .map(
                (
                    item,
                    index
                ) =>
                    dynamicCard(
                        item.name ||
                        `Language ${index + 1}`,

                        "languages",

                        index,

                        field(
                            "Language",
                            "languages",
                            index,
                            "name",
                            item.name
                        )
                        +
                        field(
                            "Level",
                            "languages",
                            index,
                            "level",
                            item.level
                        )
                    )
            )
            .join("");
}


// ===========================================================
// CERTIFICATIONS
// ===========================================================

function renderCertifications() {
    const container =
        $("#certificationsContainer");

    if (
        !container ||
        !state.project
    ) {
        return;
    }

    container.innerHTML =
        state.project.certifications
            .map(
                (
                    item,
                    index
                ) =>
                    dynamicCard(
                        item.name ||
                        `Certification ${index + 1}`,

                        "certifications",

                        index,

                        field(
                            "Certification",
                            "certifications",
                            index,
                            "name",
                            item.name
                        )
                        +
                        field(
                            "Issuer",
                            "certifications",
                            index,
                            "issuer",
                            item.issuer
                        )
                        +
                        field(
                            "Year",
                            "certifications",
                            index,
                            "year",
                            item.year
                        )
                        +
                        field(
                            "Link",
                            "certifications",
                            index,
                            "link",
                            item.link
                        )
                    )
            )
            .join("");
}


function renderDynamicSections() {
    renderExperiences();
    renderEducation();
    renderProjects();
    renderVolunteering();
    renderSkills();
    renderLanguages();
    renderCertifications();
}


// ===========================================================
// DYNAMIC INPUT
// ===========================================================

function handleDynamicInput(target) {
    if (!state.project) {
        return;
    }

    const collection =
        target.dataset.collection;

    const index =
        Number(
            target.dataset.index
        );

    const key =
        target.dataset.key;

    if (
        !collection ||
        !key ||
        Number.isNaN(index) ||
        !state.project[
            collection
        ]?.[
            index
        ]
    ) {
        return;
    }

    const item =
        state.project[
            collection
        ][
            index
        ];

    const valueType =
        target.dataset.valueType ||
        "text";

    if (
        valueType === "lines"
    ) {
        item[
            key
        ] = linesToArray(
            target.value
        );
    }
    else if (
        valueType === "csv"
    ) {
        item[
            key
        ] = csvToArray(
            target.value
        );
    }
    else if (
        valueType === "boolean"
    ) {
        item[
            key
        ] = Boolean(
            target.checked
        );
    }
    else {
        item[
            key
        ] = target.value;
    }

    projectChanged();
}


// ===========================================================
// ADD / REMOVE
// ===========================================================

function addCollectionItem(
    collection
) {
    if (!state.project) {
        return;
    }

    const factories = {
        experiences:
            blankExperience,

        education:
            blankEducation,

        projects:
            blankProjectItem,

        volunteering:
            blankVolunteering,

        skills:
            blankSkillGroup,

        languages:
            blankLanguage,

        certifications:
            blankCertification,
    };

    const factory =
        factories[
            collection
        ];

    if (!factory) {
        return;
    }

    state.project[
        collection
    ].push(
        factory()
    );

    renderDynamicSections();

    projectChanged();
}

function removeCollectionItem(
    collection,
    index
) {
    if (
        !state.project?.[
            collection
        ] ||
        Number.isNaN(
            index
        )
    ) {
        return;
    }

    state.project[
        collection
    ].splice(
        index,
        1
    );

    renderDynamicSections();

    projectChanged();
}


// ===========================================================
// AUTOSAVE
// ===========================================================

function projectChanged() {
    collectStaticFields();

    renderPreview();

    window.clearTimeout(
        state.autosaveTimer
    );

    state.autosaveTimer =
        window.setTimeout(
            autosaveProject,
            650
        );
}

async function autosaveProject() {
    if (
        !state.bridgeReady ||
        !state.project ||
        !window.pywebview?.api
    ) {
        return;
    }

    try {
        const result =
            await window.pywebview.api
                .update_project(
                    state.project
                );

        if (
            result &&
            result.ok === false
        ) {
            showToast(
                result.message ||
                "Autosave failed.",
                "warning"
            );
        }
    }
    catch (error) {
        console.error(
            "Autosave error",
            error
        );
    }
}


// ===========================================================
// PREVIEW
// ===========================================================

function previewSectionTitle(
    text
) {
    return `
        <div class="preview-section-title">
            ${escapeHtml(
                text
            )}
        </div>
    `;
}

function renderPreview() {
    if (!state.project) {
        return;
    }

    collectStaticFields();

    const preview =
        $("#cvPreview");

    if (!preview) {
        return;
    }

    const project =
        state.project;

    const p =
        project.personal;

    const contacts = [
        p.location,
        p.email,
        p.phone,

        p.linkedin
            ? "LinkedIn"
            : "",

        p.github
            ? "GitHub"
            : "",

        p.website
            ? "Website"
            : "",
    ]
        .filter(Boolean)
        .join(" | ");

    let html = `
        <div class="preview-name">
            ${escapeHtml(
                p.full_name ||
                "YOUR NAME"
            )}
        </div>

        <div class="preview-role">
            ${escapeHtml(
                [
                    p.target_role,
                    p.secondary_target_role,
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        " | "
                    )
            )}
        </div>

        <div class="preview-contact">
            ${escapeHtml(
                contacts
            )}
        </div>

        <div class="preview-top-line"></div>
    `;


    // -------------------------------------------------------
    // PROFILE
    // -------------------------------------------------------

    if (
        project.profile
    ) {
        html +=
            previewSectionTitle(
                "PROFILE"
            );

        html += `
            <div class="preview-entry">
                ${escapeHtml(
                    project.profile
                )}
            </div>
        `;
    }


    // -------------------------------------------------------
    // EXPERIENCE
    // -------------------------------------------------------

    if (
        project.experiences.length
    ) {
        html +=
            previewSectionTitle(
                "PROFESSIONAL EXPERIENCE"
            );

        for (
            const item
            of project.experiences
        ) {
            const dates = [
                item.start_date,

                item.current
                    ? "Present"
                    : item.end_date,
            ]
                .filter(Boolean)
                .join(" - ");

            html += `
                <div class="preview-entry">

                    <div class="preview-entry-header">

                        <span>
                            ${escapeHtml(
                                item.job_title
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                dates
                            )}
                        </span>

                    </div>

                    <div class="preview-entry-sub">

                        <span>
                            ${escapeHtml(
                                item.company
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                item.location
                            )}
                        </span>

                    </div>
            `;

            if (
                item.description_mode
                === "paragraph" &&
                item.paragraph
            ) {
                html += `
                    <div class="preview-bullet">
                        ${escapeHtml(
                            item.paragraph
                        )}
                    </div>
                `;
            }
            else {
                for (
                    const bullet
                    of item.bullets
                ) {
                    html += `
                        <div class="preview-bullet">
                            ${escapeHtml(
                                bullet
                            )}
                        </div>
                    `;
                }
            }

            if (
                item.tools.length
            ) {
                html += `
                    <div class="preview-tools">

                        <strong>
                            Tools:
                        </strong>

                        ${escapeHtml(
                            item.tools.join(
                                ", "
                            )
                        )}

                    </div>
                `;
            }

            html += `
                </div>
            `;
        }
    }


    // -------------------------------------------------------
    // EDUCATION
    // -------------------------------------------------------

    if (
        project.education.length
    ) {
        html +=
            previewSectionTitle(
                "EDUCATION"
            );

        for (
            const item
            of project.education
        ) {
            const dates = [
                item.start_date,
                item.end_date,
            ]
                .filter(Boolean)
                .join(" - ");

            html += `
                <div class="preview-entry">

                    <div class="preview-entry-header">

                        <span>
                            ${escapeHtml(
                                item.degree
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                dates
                            )}
                        </span>

                    </div>

                    <div class="preview-entry-sub">

                        <span>
                            ${escapeHtml(
                                item.school
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                item.location
                            )}
                        </span>

                    </div>

                    ${
                        item.details
                            ? `
                                <div>
                                    ${escapeHtml(
                                        item.details
                                    )}
                                </div>
                            `
                            : ""
                    }

                </div>
            `;
        }
    }


    // -------------------------------------------------------
    // PROJECTS
    // -------------------------------------------------------

    if (
        project.projects.length
    ) {
        html +=
            previewSectionTitle(
                "PROJECTS"
            );

        for (
            const item
            of project.projects
        ) {
            html += `
                <div class="preview-entry">

                    <div class="preview-entry-header">

                        <span>
                            ${escapeHtml(
                                item.name
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                item.date
                            )}
                        </span>

                    </div>
            `;

            if (
                item.subtitle
            ) {
                html += `
                    <div class="preview-entry-sub">

                        <span>
                            ${escapeHtml(
                                item.subtitle
                            )}
                        </span>

                        <span></span>

                    </div>
                `;
            }

            for (
                const bullet
                of item.bullets
            ) {
                html += `
                    <div class="preview-bullet">
                        ${escapeHtml(
                            bullet
                        )}
                    </div>
                `;
            }

            if (
                item.tools.length
            ) {
                html += `
                    <div class="preview-tools">

                        <strong>
                            Tools:
                        </strong>

                        ${escapeHtml(
                            item.tools.join(
                                ", "
                            )
                        )}

                    </div>
                `;
            }

            html += `
                </div>
            `;
        }
    }


    // -------------------------------------------------------
    // VOLUNTEERING
    // -------------------------------------------------------

    if (
        project.volunteering.length
    ) {
        html +=
            previewSectionTitle(
                "VOLUNTEERING"
            );

        for (
            const item
            of project.volunteering
        ) {
            const dates = [
                item.start_date,
                item.end_date,
            ]
                .filter(Boolean)
                .join(" - ");

            html += `
                <div class="preview-entry">

                    <div class="preview-entry-header">

                        <span>
                            ${escapeHtml(
                                item.role
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                dates
                            )}
                        </span>

                    </div>

                    <div class="preview-entry-sub">

                        <span>
                            ${escapeHtml(
                                item.organization
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                item.location
                            )}
                        </span>

                    </div>
            `;

            for (
                const bullet
                of item.bullets
            ) {
                html += `
                    <div class="preview-bullet">
                        ${escapeHtml(
                            bullet
                        )}
                    </div>
                `;
            }

            html += `
                </div>
            `;
        }
    }


    // -------------------------------------------------------
    // SKILLS
    // -------------------------------------------------------

    if (
        project.skills.some(
            (group) =>
                group.name ||
                group.items.length
        )
    ) {
        html +=
            previewSectionTitle(
                "TECHNICAL SKILLS"
            );

        for (
            const group
            of project.skills
        ) {
            if (
                !group.name &&
                !group.items.length
            ) {
                continue;
            }

            html += `
                <div>

                    <strong>
                        ${escapeHtml(
                            group.name
                        )}:
                    </strong>

                    ${escapeHtml(
                        group.items.join(
                            ", "
                        )
                    )}

                </div>
            `;
        }
    }


    // -------------------------------------------------------
    // LANGUAGES
    // -------------------------------------------------------

    if (
        project.languages.length
    ) {
        html +=
            previewSectionTitle(
                "LANGUAGES"
            );

        html += `
            <div>

                ${project.languages
                    .map(
                        (item) =>
                            `
                                <strong>
                                    ${escapeHtml(
                                        item.name
                                    )}:
                                </strong>

                                ${escapeHtml(
                                    item.level
                                )}
                            `
                    )
                    .join(
                        " &nbsp; | &nbsp; "
                    )}

            </div>
        `;
    }


    // -------------------------------------------------------
    // CERTIFICATIONS
    // -------------------------------------------------------

    if (
        project.certifications.length
    ) {
        html +=
            previewSectionTitle(
                "CERTIFICATIONS"
            );

        html += `
            <div>

                ${project.certifications
                    .map(
                        (item) =>
                            escapeHtml(
                                `${item.name}${
                                    item.year
                                        ? ` (${item.year})`
                                        : ""
                                }`
                            )
                    )
                    .join(
                        " | "
                    )}

            </div>
        `;
    }


    preview.style.setProperty(
        "--preview-accent",
        project.design.accent_color ||
        "#8B1540"
    );

    preview.innerHTML =
        html;
}


// ===========================================================
// PROJECT COMMANDS
// ===========================================================

function bridgeApiAvailable() {
    if (
        !state.bridgeReady ||
        !window.pywebview?.api
    ) {
        showToast(
            "Python engine is not connected yet.",
            "warning"
        );

        return false;
    }

    return true;
}

async function newProject() {
    if (
        !bridgeApiAvailable()
    ) {
        return;
    }

    const response =
        await window.pywebview.api
            .create_new_project();

    if (
        response?.ok
    ) {
        loadProjectIntoUI(
            response.project
        );

        showPage(
            "content"
        );

        showToast(
            "New CV project created.",
            "success"
        );
    }
}

async function openProject() {
    if (
        !bridgeApiAvailable()
    ) {
        return;
    }

    const response =
        await window.pywebview.api
            .open_project();

    if (
        response?.cancelled
    ) {
        return;
    }

    if (
        response?.ok
    ) {
        loadProjectIntoUI(
            response.project
        );

        showPage(
            "content"
        );

        showToast(
            "Project opened.",
            "success"
        );
    }
    else {
        showToast(
            response?.message ||
            "Unable to open project.",
            "error"
        );
    }
}

async function demoProject() {
    if (
        !bridgeApiAvailable()
    ) {
        return;
    }

    const response =
        await window.pywebview.api
            .load_demo_project();

    if (
        response?.ok
    ) {
        loadProjectIntoUI(
            response.project
        );

        showPage(
            "content"
        );

        showToast(
            "Demo CV loaded.",
            "success"
        );
    }
}

async function saveProject() {
    if (
        !bridgeApiAvailable() ||
        !state.project
    ) {
        return;
    }

    collectStaticFields();

    const response =
        await window.pywebview.api
            .save_project(
                state.project
            );

    if (
        response?.ok
    ) {
        showToast(
            "Project saved.",
            "success"
        );
    }
    else {
        showToast(
            response?.message ||
            "Save failed.",
            "error"
        );
    }
}


// ===========================================================
// ATS / JOB MATCH
// ===========================================================

function analysisList(
    title,
    items
) {
    if (
        !items?.length
    ) {
        return "";
    }

    return `
        <section class="result-section">

            <h3>
                ${escapeHtml(
                    title
                )}
            </h3>

            <ul class="result-list">

                ${items
                    .map(
                        (item) =>
                            `
                                <li>
                                    ${escapeHtml(
                                        item
                                    )}
                                </li>
                            `
                    )
                    .join("")}

            </ul>

        </section>
    `;
}

async function runAtsCheck() {
    if (
        !bridgeApiAvailable() ||
        !state.project
    ) {
        return;
    }

    collectStaticFields();

    const container =
        $("#atsResults");

    if (!container) {
        return;
    }

    container.className =
        "analysis-empty";

    container.textContent =
        "Analysing CV...";

    try {
        const response =
            await window.pywebview.api
                .analyze_ats(
                    state.project
                );

        if (
            !response?.ok
        ) {
            container.textContent =
                response?.message ||
                "ATS analysis failed.";

            return;
        }

        const result =
            response.result;

        container.className =
            "analysis-panel";

        container.innerHTML = `
            <div class="score-card">

                <div class="score-circle">
                    ${result.score}
                </div>

                <div>

                    <div class="eyebrow">
                        CVM ATS READINESS
                    </div>

                    <h2>
                        ${escapeHtml(
                            result.label
                        )}
                    </h2>

                    <p>
                        ${escapeHtml(
                            result.note
                        )}
                    </p>

                </div>

            </div>

            ${analysisList(
                "Issues",
                result.issues
            )}

            ${analysisList(
                "Warnings",
                result.warnings
            )}

            ${analysisList(
                "Passed checks",
                result.passed
            )}
        `;
    }
    catch (error) {
        console.error(
            error
        );

        container.textContent =
            "ATS analysis failed.";
    }
}

function tagSection(
    title,
    items,
    type
) {
    if (
        !items?.length
    ) {
        return "";
    }

    return `
        <section class="result-section">

            <h3>
                ${escapeHtml(
                    title
                )}
            </h3>

            <div class="result-tags">

                ${items
                    .map(
                        (item) =>
                            `
                                <span class="result-tag ${type}">
                                    ${escapeHtml(
                                        item
                                    )}
                                </span>
                            `
                    )
                    .join("")}

            </div>

        </section>
    `;
}

async function runJobMatch() {
    if (
        !bridgeApiAvailable() ||
        !state.project
    ) {
        return;
    }

    collectStaticFields();

    const description =
        getValue(
            "#jobDescription"
        );

    const container =
        $("#jobResults");

    if (!container) {
        return;
    }

    container.className =
        "analysis-empty";

    container.textContent =
        "Analysing job description...";

    try {
        const response =
            await window.pywebview.api
                .analyze_job_match(
                    state.project,
                    description
                );

        if (
            !response?.ok
        ) {
            container.textContent =
                response?.message ||
                "Job Match failed.";

            return;
        }

        const result =
            response.result;

        container.className =
            "analysis-panel";

        container.innerHTML = `
            <div class="score-card">

                <div class="score-circle">
                    ${result.score}%
                </div>

                <div>

                    <div class="eyebrow">
                        SKILL COVERAGE
                    </div>

                    <h2>
                        Job Match
                    </h2>

                    <p>
                        ${escapeHtml(
                            result.note
                        )}
                    </p>

                </div>

            </div>

            ${tagSection(
                "Matched skills",
                result.matched_skills,
                "matched"
            )}

            ${tagSection(
                "Missing skills",
                result.missing_skills,
                "missing"
            )}

            ${tagSection(
                "Matched keywords",
                result.matched_keywords,
                "matched"
            )}

            ${tagSection(
                "Other keywords from the offer",
                result.missing_keywords,
                "missing"
            )}
        `;
    }
    catch (error) {
        console.error(
            error
        );

        container.textContent =
            "Job Match failed.";
    }
}


// ===========================================================
// EXPORT
// ===========================================================

async function exportPdf() {
    if (
        !bridgeApiAvailable() ||
        !state.project
    ) {
        return;
    }

    collectStaticFields();

    showToast(
        "Generating PDF...",
        "info"
    );

    const response =
        await window.pywebview.api
            .export_pdf(
                state.project
            );

    if (
        response?.cancelled
    ) {
        showToast(
            "PDF export cancelled.",
            "info",
            1800
        );

        return;
    }

    if (
        !response?.ok
    ) {
        showToast(
            response?.message ||
            "PDF export failed.",
            "error",
            5000
        );

        return;
    }

    const validation =
        response.validation ||
        {};

    const result =
        $("#exportResult");

    if (result) {
        result.innerHTML = `
            <div class="result-section">

                <h3>
                    PDF exported
                </h3>

                <p>
                    ${escapeHtml(
                        response.pdf_path
                    )}
                </p>

                <p>
                    Selectable text:

                    <strong>
                        ${
                            validation.selectable_text
                                ? "Yes"
                                : "No"
                        }
                    </strong>
                </p>

                <p>
                    Post-export validation:

                    <strong>
                        ${
                            validation.passed
                                ? "Passed"
                                : "Needs review"
                        }
                    </strong>
                </p>

            </div>
        `;
    }

    showToast(
        "PDF exported successfully.",
        "success"
    );
}

async function exportDocx() {
    if (
        !bridgeApiAvailable() ||
        !state.project
    ) {
        return;
    }

    collectStaticFields();

    showToast(
        "Generating DOCX...",
        "info"
    );

    const response =
        await window.pywebview.api
            .export_docx(
                state.project
            );

    if (
        response?.cancelled
    ) {
        showToast(
            "DOCX export cancelled.",
            "info",
            1800
        );

        return;
    }

    if (
        !response?.ok
    ) {
        showToast(
            response?.message ||
            "DOCX export failed.",
            "error"
        );

        return;
    }

    const result =
        $("#exportResult");

    if (result) {
        result.innerHTML = `
            <div class="result-section">

                <h3>
                    DOCX exported
                </h3>

                <p>
                    ${escapeHtml(
                        response.docx_path
                    )}
                </p>

            </div>
        `;
    }

    showToast(
        "DOCX exported successfully.",
        "success"
    );
}

async function openFolder(
    methodName
) {
    if (
        !bridgeApiAvailable()
    ) {
        return;
    }

    try {
        const result =
            await window.pywebview.api[
                methodName
            ]();

        if (
            result?.ok === false
        ) {
            showToast(
                result.message ||
                "Unable to open folder.",
                "error"
            );
        }
    }
    catch (error) {
        console.error(
            error
        );

        showToast(
            "Unable to open folder.",
            "error"
        );
    }
}


// ===========================================================
// DESIGN
// ===========================================================

function syncAccentColor(
    source
) {
    if (!state.project) {
        return;
    }

    let value =
        String(
            source.value ||
            ""
        ).trim();

    if (
        !value.startsWith(
            "#"
        )
    ) {
        value =
            `#${value}`;
    }

    if (
        /^#[0-9a-fA-F]{6}$/
            .test(
                value
            )
    ) {
        setValue(
            "#accentColor",
            value
        );

        setValue(
            "#accentColorText",
            value.toUpperCase()
        );

        state.project.design
            .accent_color =
            value.toUpperCase();

        projectChanged();
    }
    else {
        showToast(
            "Use a 6-digit hex color such as #4F46E5.",
            "warning"
        );
    }
}


// ===========================================================
// PYWEBVIEW BRIDGE
// ===========================================================

async function initializeBridge() {
    if (
        state.bridgeReady ||
        state.bridgeInitializing
    ) {
        return;
    }

    if (
        !window.pywebview?.api
    ) {
        return;
    }

    state.bridgeInitializing =
        true;

    try {
        const initial =
            await window.pywebview.api
                .get_initial_state();

        state.bridgeReady =
            true;

        state.appVersion =
            initial.app.version;

        state.pdfAvailable =
            Boolean(
                initial.pdf?.available
            );

        const versionBadge =
            $("#versionBadge");

        if (versionBadge) {
            versionBadge.textContent =
                `v${initial.app.version}`;
        }

        const footerVersion =
            $("#footerVersion");

        if (footerVersion) {
            footerVersion.textContent =
                `CVM ${initial.app.version}`;
        }

        const logList =
            $("#logList");

        if (logList) {
            logList.innerHTML =
                "";
        }

        (
            initial.logs ||
            []
        ).forEach(
            appendLog
        );

        loadProjectIntoUI(
            initial.project
        );

        setBridgeStatus(
            true
        );

        const pdfStatus =
            $("#pdfEngineStatus");

        if (pdfStatus) {
            if (
                initial.pdf?.available
            ) {
                pdfStatus.className =
                    "export-status success";

                pdfStatus.textContent =
                    `${
                        initial.pdf.engine ||
                        "LaTeX"
                    } detected — PDF export ready`;
            }
            else {
                pdfStatus.className =
                    "export-status error";

                pdfStatus.textContent =
                    "No supported LaTeX engine detected yet";
            }
        }

        await window.pywebview.api
            .ui_ready();
    }
    catch (error) {
        console.error(
            "Bridge initialization failed",
            error
        );

        state.bridgeReady =
            false;

        setBridgeStatus(
            false,
            "Connection error"
        );

        showToast(
            "CVM could not connect to the Python engine.",
            "error",
            5000
        );
    }
    finally {
        state.bridgeInitializing =
            false;
    }
}

function startBridgeRetry() {
    let attempts = 0;

    const maxAttempts =
        60;

    const timer =
        window.setInterval(
            async () => {
                attempts += 1;

                if (
                    state.bridgeReady
                ) {
                    window.clearInterval(
                        timer
                    );

                    return;
                }

                if (
                    window.pywebview?.api
                ) {
                    await initializeBridge();
                }

                if (
                    attempts >= maxAttempts &&
                    !state.bridgeReady
                ) {
                    window.clearInterval(
                        timer
                    );

                    setBridgeStatus(
                        false,
                        "Not connected"
                    );
                }
            },
            250
        );
}


// ===========================================================
// EVENT BINDINGS
// ===========================================================

function bindEvents() {
    safeOn(
        "#themeToggle",
        "click",
        toggleTheme
    );

    safeOn(
        "#settingsThemeBtn",
        "click",
        toggleTheme
    );

    safeOn(
        "#journalToggle",
        "click",
        toggleJournal
    );

    safeOn(
        "#settingsJournalBtn",
        "click",
        toggleJournal
    );

    safeOn(
        "#closeJournalBtn",
        "click",
        () =>
            applyJournalVisibility(
                false
            )
    );

    safeOn(
        "#saveProjectBtn",
        "click",
        saveProject
    );

    safeOn(
        "#newCvBtn",
        "click",
        newProject
    );

    safeOn(
        "#openProjectBtn",
        "click",
        openProject
    );

    safeOn(
        "#demoBtn",
        "click",
        demoProject
    );

    safeOn(
        "#runAtsBtn",
        "click",
        runAtsCheck
    );

    safeOn(
        "#runJobMatchBtn",
        "click",
        runJobMatch
    );

    safeOn(
        "#exportPdfBtn",
        "click",
        exportPdf
    );

    safeOn(
        "#exportDocxBtn",
        "click",
        exportDocx
    );

    safeOn(
        "#openExportsBtn",
        "click",
        () =>
            openFolder(
                "open_exports_folder"
            )
    );

    safeOn(
        "#openLogsBtn",
        "click",
        () =>
            openFolder(
                "open_logs_folder"
            )
    );


    $$(
        ".nav-item[data-page]"
    ).forEach(
        (button) => {
            button.addEventListener(
                "click",
                () =>
                    showPage(
                        button.dataset.page
                    )
            );
        }
    );


    const editorRoot =
        $("#editorRoot");

    if (editorRoot) {
        editorRoot.addEventListener(
            "input",
            (event) => {
                if (
                    event.target.dataset
                        .collection
                ) {
                    handleDynamicInput(
                        event.target
                    );
                }
                else {
                    projectChanged();
                }
            }
        );


        editorRoot.addEventListener(
            "change",
            (event) => {
                if (
                    event.target.dataset
                        .collection
                ) {
                    handleDynamicInput(
                        event.target
                    );
                }
                else {
                    projectChanged();
                }
            }
        );
    }


    document.addEventListener(
        "click",
        (event) => {
            const add =
                event.target.closest(
                    "[data-add]"
                );

            if (add) {
                addCollectionItem(
                    add.dataset.add
                );

                return;
            }

            const remove =
                event.target.closest(
                    "[data-remove]"
                );

            if (remove) {
                removeCollectionItem(
                    remove.dataset.remove,
                    Number(
                        remove.dataset.index
                    )
                );
            }
        }
    );


    [
        "templateSelect",
        "pageMode",
        "photoEnabled",
        "regionSelect",
    ].forEach(
        (id) => {
            safeOn(
                `#${id}`,
                "change",
                projectChanged
            );
        }
    );


    safeOn(
        "#accentColor",
        "input",
        (event) =>
            syncAccentColor(
                event.target
            )
    );


    safeOn(
        "#accentColorText",
        "change",
        (event) =>
            syncAccentColor(
                event.target
            )
    );
}


// ===========================================================
// BOOT
// ===========================================================

function bootstrap() {
    applyTheme(
        getSavedTheme()
    );

    applyJournalVisibility(
        savedJournalVisibility()
    );

    bindEvents();

    showPage(
        "home"
    );

    startBridgeRetry();
}


document.addEventListener(
    "DOMContentLoaded",
    bootstrap
);

window.addEventListener(
    "pywebviewready",
    initializeBridge
);