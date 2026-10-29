// Load projects on page load
document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();

  if (document.body.dataset.page === 'project-detail') {
    loadProjectDetail();
    return;
  }

  loadProjects();
  loadSkills();
  setupFormHandling();
  setupMobileMenu();
});

// Load projects from API
async function loadProjects() {
  try {
    const response = await fetch('/api/projects');
    if (!response.ok) {
      throw new Error(`Project request failed with status ${response.status}`);
    }
    const projects = await response.json();
    
    const container = document.getElementById('projectsContainer');
    const groups = ['Data Analytics', 'Data Engineering', 'Machine Learning']
      .map(theme => ({
        theme,
        id: `projects-${theme.toLowerCase().replace(/\s+/g, '-')}`,
        projects: projects.filter(project => project.theme === theme)
      }))
      .filter(group => group.projects.length);

    container.innerHTML = `
      <div class="project-tabs" role="tablist" aria-label="Project topics">
        ${groups.map((group, i) => `
          <button type="button" class="project-tab" role="tab" id="${group.id}-tab" aria-controls="${group.id}"
            aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
            ${group.theme} <span>${group.projects.length}</span>
          </button>
        `).join('')}
      </div>
      ${groups.map((group, i) => `
        <div class="projects-grid" role="tabpanel" id="${group.id}" aria-labelledby="${group.id}-tab" ${i === 0 ? '' : 'hidden'}>
          ${group.projects.map(renderProjectCard).join('')}
        </div>
      `).join('')}
    `;
    setupProjectTabs(container);
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

function setupProjectTabs(container) {
  const tabs = [...container.querySelectorAll('.project-tab')];

  const select = tab => {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', selected);
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  });

  // Links like /#projects-machine-learning open that tab directly
  const linked = tabs.find(tab => `#${tab.getAttribute('aria-controls')}` === window.location.hash);
  if (linked) {
    select(linked);
    document.getElementById('projects').scrollIntoView();
  }
}

function renderProjectCard(project) {
  // Projects without a detail page yet (in progress) link straight to their repository
  const link = project.details
    ? `href="/projects/${encodeURIComponent(project.slug)}"`
    : `href="${project.github}" target="_blank" rel="noopener noreferrer"`;
  // Lead with the numbers: every card shows its first three facts
  const facts = (project.facts || []).slice(0, 3);
  const tags = project.tags.slice(0, 5);
  const moreTags = project.tags.length - tags.length;
  const cover = project.image ? `<div class="project-cover"><img src="${project.image}" alt="${project.title}" loading="lazy"></div>` : '';
  const factList = facts.length ? `
          <dl class="project-facts">
            ${facts.map(fact => `<div><dt>${fact.label}</dt><dd>${fact.value}</dd></div>`).join('')}
          </dl>` : '';
  return `
      <a class="project-card" ${link}>
        ${cover}
        <div class="project-body">
          <div class="project-badges">
            ${project.award ? `<span class="project-award">${project.award}</span>` : ''}
            ${project.status ? `<span class="project-status">${project.status}</span>` : ''}
          </div>
          <p class="project-category">${project.category}</p>
          <h3>${project.title}</h3>
          <p class="project-summary">${project.summary || project.description}</p>
          ${factList}
          <div class="project-tags">
            ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            ${moreTags > 0 ? `<span class="tag tag-more">+${moreTags}</span>` : ''}
          </div>
          <span class="project-details-link">${project.details ? 'Read the case study →' : 'View on GitHub →'}</span>
        </div>
      </a>
    `;
}

async function loadProjectDetail() {
  const root = document.getElementById('projectDetail');
  const slug = window.location.pathname.split('/').filter(Boolean).pop();

  try {
    const response = await fetch('/api/projects');
    if (!response.ok) {
      throw new Error(`Project request failed with status ${response.status}`);
    }

    const projects = await response.json();
    const project = projects.find(item => item.slug === slug);
    if (!project || !project.details) {
      window.location.replace('/#projects');
      return;
    }

    document.title = `${project.title} | Anh Thu`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', project.description);
    root.innerHTML = renderProjectDetail(project);
    initSlideViewer(root);
  } catch (error) {
    console.error('Error loading project details:', error);
    root.innerHTML = '<p class="project-load-error">Project details could not be loaded. Please try again later.</p>';
  }
}

function renderProjectDetail(project) {
  const { challenge, solution, architecture, eda, models, kpis, implementation, results } = project.details;
  const { presentation } = project;
  const bottomLink = '<a class="detail-back detail-back-bottom" href="/#projects">Explore all projects</a>';
  let phase = 0;
  // Called inside the template so the phase number follows where the section is placed
  const renderEda = () => `
    <section class="detail-phase container">
      ${renderPhaseHeading(++phase, eda.label || 'Data Exploration')}
      <div class="phase-content">
        <h2>${eda.title || 'Exploratory Data Analysis'}</h2>
        <p class="phase-summary">${eda.summary}</p>
        ${eda.facts ? `
          <div class="implementation-grid">
            ${eda.facts.map(fact => `
              <article class="detail-panel"><span>${fact.label}</span><p>${fact.value}</p></article>
            `).join('')}
          </div>
        ` : ''}
        ${eda.visuals ? renderVisuals(eda.visuals) : ''}
      </div>
    </section>
  `;
  // Each model gets its own phase so readers can follow how scores and groups are built, one stage at a time
  const renderModel = model => `
    <section class="detail-phase container">
      ${renderPhaseHeading(++phase, model.label)}
      <div class="phase-content">
        <h2>${model.title}</h2>
        ${model.question ? `<p class="model-question">${model.question}</p>` : ''}
        <p class="phase-summary">${model.summary}</p>
        ${model.steps ? `
          <ol class="detail-step-list">
            ${model.steps.map((step, index) => `
              <li><span>${model.stepLabel || 'Step'} ${index + 1}/${model.steps.length}</span><p>${step}</p></li>
            `).join('')}
          </ol>
        ` : ''}
        ${model.tables ? model.tables.map(renderTable).join('') : ''}
        ${model.visuals ? renderVisuals(model.visuals) : ''}
        ${model.facts ? `
          <div class="implementation-grid">
            ${model.facts.map(fact => `
              <article class="detail-panel"><span>${fact.label}</span><p>${fact.value}</p></article>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </section>
  `;
  const externalLink = project.github && project.github !== '#'
    ? `<a class="detail-action" href="${project.github}" target="_blank" rel="noopener noreferrer">GitHub repository</a>`
    : '';
  const powerBiLink = project.powerBiProject
    ? `<a class="detail-action" href="${project.powerBiProject}" target="_blank" rel="noopener noreferrer">Open Power BI PBIP</a>`
    : '';
  const liveDashboardLink = project.liveDashboard
    ? `<a class="detail-action" href="${project.liveDashboard}" target="_blank" rel="noopener noreferrer">Open interactive dashboard</a>`
    : '';
  const powerBiDownloadLink = project.powerBiDownload
    ? `<a class="detail-action" href="${project.powerBiDownload}" download>Download PBIP (.zip)</a>`
    : '';
  const slidesLink = presentation
    ? '<a class="detail-action" href="#presentation">Presentation slides</a>'
    : '';

  return `
    <section class="detail-hero container">
      <div class="detail-navigation">
        <a href="/#projects" class="detail-back">View all projects</a>
        <div class="detail-actions">
          ${slidesLink}
          ${liveDashboardLink}
          ${powerBiLink}
          ${powerBiDownloadLink}
          ${externalLink}
        </div>
      </div>
      <p class="detail-category">${project.category}</p>
      <h1>${project.title}</h1>
      <p class="detail-summary">${project.description}</p>
      <div class="detail-facts" aria-label="Project highlights">
        ${project.facts.map(fact => `
          <article class="detail-fact">
            <strong>${fact.value}</strong>
            <span>${fact.label}</span>
          </article>
        `).join('')}
      </div>
      <div class="detail-tags">${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
    </section>

    <div class="detail-phases">
      ${eda && eda.first ? renderEda() : ''}

      <section class="detail-phase container">
        ${renderPhaseHeading(++phase, challenge.label || 'Project Challenge')}
        <div class="phase-content">
          <h2>${challenge.title || 'The Challenge'}</h2>
          <p class="phase-summary">${challenge.summary}</p>
          <ul class="detail-card-list">
            ${challenge.points.map(point => `<li>${point}</li>`).join('')}
          </ul>
        </div>
      </section>

      <section class="detail-phase container">
        ${renderPhaseHeading(++phase, solution.label || 'Approach')}
        <div class="phase-content">
          <h2>${solution.title || 'The Solution'}</h2>
          <p class="phase-summary">${solution.summary}</p>
          ${solution.visuals ? renderVisuals(solution.visuals) : ''}
          ${solution.steps ? `
            <ol class="detail-step-list">
              ${solution.steps.map((step, index) => `
                <li><span>${solution.stepLabel || 'Step'} ${index + 1}/${solution.steps.length}</span><p>${step}</p></li>
              `).join('')}
            </ol>
          ` : ''}
        </div>
      </section>

      <section class="detail-phase container">
        ${renderPhaseHeading(++phase, architecture.label || 'Architecture')}
        <div class="phase-content">
          <h2>${architecture.title || 'Solution Architecture'}</h2>
          <ol class="architecture-flow">
            ${architecture.flow.map((item, index) => `
              <li>${item}${index < architecture.flow.length - 1 ? '<span class="flow-sep" aria-hidden="true"></span>' : ''}</li>
            `).join('')}
          </ol>
          <div class="before-after">
            <article class="detail-panel">
              <h3>${architecture.beforeTitle || 'Before'}</h3>
              <ul>${architecture.before.map(item => `<li>${item}</li>`).join('')}</ul>
            </article>
            <article class="detail-panel">
              <h3>${architecture.afterTitle || 'After'}</h3>
              <ul>${architecture.after.map(item => `<li>${item}</li>`).join('')}</ul>
            </article>
          </div>
        </div>
      </section>

      ${kpis ? `
        <section class="detail-phase container">
          ${renderPhaseHeading(++phase, kpis.label || 'KPIs')}
          <div class="phase-content">
            <h2>${kpis.title || 'Key Metrics'}</h2>
            ${kpis.summary ? `<p class="phase-summary">${kpis.summary}</p>` : ''}
            <div class="kpi-map">
              ${kpis.root ? `<div class="kpi-map-root"><strong>${kpis.root.title}</strong><span>${kpis.root.subtitle}</span></div>` : ''}
              <ol class="kpi-map-pages">
                ${kpis.groups.map((group, index) => `
                  <li class="kpi-map-page">
                    <div class="kpi-map-node">
                      <span>Page ${index + 1}</span>
                      <strong>${group.title}</strong>
                      ${group.question ? `<em>${group.question}</em>` : ''}
                    </div>
                    <ul class="kpi-map-leaves">
                      ${group.items.map(item => `
                        <li class="kpi-tile">
                          <h4>${item.name}${item.full ? `<span>${item.full}</span>` : ''}</h4>
                          ${renderKpiFormula(item.formula)}
                        </li>
                      `).join('')}
                    </ul>
                  </li>
                `).join('')}
              </ol>
            </div>
            ${kpis.steps || kpis.modelTitle ? `
              <h3 class="kpi-subtitle">${kpis.modelTitle || 'Data Model'}</h3>
              ${kpis.modelSummary ? `<p class="phase-summary">${kpis.modelSummary}</p>` : ''}
              ${kpis.steps ? `
                <ol class="detail-step-list">
                  ${kpis.steps.map((step, index) => `
                    <li><span>${kpis.stepLabel || 'Step'} ${index + 1}/${kpis.steps.length}</span><p>${step}</p></li>
                  `).join('')}
                </ol>
              ` : ''}
            ` : ''}
            ${kpis.visuals ? renderVisuals(kpis.visuals) : ''}
            ${kpis.dashboard ? `
              <h3 class="kpi-subtitle">${kpis.dashboard.title}</h3>
              ${kpis.dashboard.summary ? `<p class="phase-summary">${kpis.dashboard.summary}</p>` : ''}
              ${renderVisuals(kpis.dashboard.visuals)}
              ${kpis.dashboard.actions ? `
                <h3 class="kpi-subtitle">${kpis.dashboard.actionsTitle || 'Recommendations'}</h3>
                <ol class="detail-step-list">
                  ${kpis.dashboard.actions.map(item => `
                    <li><span>${item.page}</span><p>${item.action}</p><p class="plan-meta"><strong>Track:</strong> ${item.track}</p></li>
                  `).join('')}
                </ol>
              ` : ''}
            ` : ''}
          </div>
        </section>
      ` : ''}

      ${eda && !eda.first ? renderEda() : ''}

      ${models ? models.map(renderModel).join('') : ''}

      <section class="detail-phase container">
        ${renderPhaseHeading(++phase, implementation.label || 'Implementation')}
        <div class="phase-content">
          <h2>${implementation.title || 'Technical Implementation'}</h2>
          ${implementation.summary ? `<p class="phase-summary">${implementation.summary}</p>` : ''}
          ${implementation.image ? `<img class="detail-image" src="${implementation.image}" alt="${project.title} dashboard" loading="lazy">` : ''}
          ${implementation.visuals ? renderVisuals(implementation.visuals) : ''}
          ${implementation.facts ? `
            <div class="implementation-grid">
              ${implementation.facts.map(fact => `
                <article class="detail-panel"><span>${fact.label}</span><p>${fact.value}</p></article>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </section>

      <section class="detail-phase container">
        ${renderPhaseHeading(++phase, 'Outcomes')}
        <div class="phase-content">
          <h2>Results &amp; Impact</h2>
          <div class="${results.validation ? 'before-after' : 'detail-visuals'}">
            <article class="detail-panel">
              <h3>${results.outcomesTitle || 'Key Outcomes'}</h3>
              <ul>${results.outcomes.map(item => `<li>${item}</li>`).join('')}</ul>
            </article>
            ${results.validation ? `
              <article class="detail-panel">
                <h3>${results.validationTitle || 'Project Evidence'}</h3>
                <ul>${results.validation.map(item => `<li>${item}</li>`).join('')}</ul>
              </article>
            ` : ''}
          </div>
          ${results.plan ? `
            <h3 class="kpi-subtitle">${results.plan.title}</h3>
            ${results.plan.summary ? `<p class="phase-summary">${results.plan.summary}</p>` : ''}
            <ol class="action-plan">
              ${results.plan.items.map((item, index) => `
                <li class="action-plan-item">
                  <div class="action-plan-head">
                    <strong>${String(index + 1).padStart(2, '0')}</strong>
                    <span>${item.when}</span>
                  </div>
                  <div class="action-plan-body">
                    <h4>${item.action}</h4>
                    <p>${item.detail}</p>
                    <p class="plan-meta"><strong>Based on:</strong> ${item.basis}</p>
                    <p class="plan-meta"><strong>Track:</strong> ${item.track}</p>
                  </div>
                </li>
              `).join('')}
            </ol>
          ` : ''}
          ${project.related ? `
            <article class="detail-panel detail-related">
              <span>${project.related.label}</span>
              <h3>${project.related.title}</h3>
              <p>${project.related.text}</p>
              <a class="detail-action" href="${project.related.href}">${project.related.cta}</a>
            </article>
          ` : ''}
          ${presentation ? '' : bottomLink}
        </div>
      </section>

      ${presentation ? `
        <section class="detail-phase container" id="presentation">
          ${renderPhaseHeading(++phase, 'Presentation')}
          <div class="phase-content">
            <h2>Presentation Slides</h2>
            ${renderSlideViewer(project.title, presentation)}
            ${bottomLink}
          </div>
        </section>
      ` : ''}
    </div>
  `;
}

// A ratio "A ÷ B" is drawn as a fraction so the numerator and denominator read at a glance
function renderKpiFormula(formula) {
  const parts = formula.split(' ÷ ');
  if (parts.length !== 2) return `<div class="kpi-formula">${formula}</div>`;
  return `
    <div class="kpi-formula kpi-fraction" aria-label="${formula}">
      <span>${parts[0]}</span>
      <span>${parts[1]}</span>
    </div>
  `;
}

function renderTable(table) {
  return `
    <div class="model-table-wrap">
      <table class="model-table">
        ${table.caption ? `<caption>${table.caption}</caption>` : ''}
        <thead><tr>${table.columns.map(column => `<th scope="col">${column}</th>`).join('')}</tr></thead>
        <tbody>
          ${table.rows.map(row => `
            <tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderVisuals(visuals) {
  return `
    <div class="detail-visuals">
      ${visuals.map(visual => `
        <figure class="detail-figure">
          <a href="${visual.image}" target="_blank" rel="noopener noreferrer" aria-label="Open full-size image: ${visual.alt}">
            <img src="${visual.image}" alt="${visual.alt}" width="${visual.width}" height="${visual.height}"${visual.narrow ? ` class="figure-narrow" style="max-width: ${visual.width}px"` : ''} loading="lazy">
          </a>
          <figcaption>${visual.caption}</figcaption>
        </figure>
      `).join('')}
    </div>
  `;
}

function renderSlideViewer(title, presentation) {
  const { slides, pdf } = presentation;
  return `
    <div class="slide-viewer" data-slides='${JSON.stringify(slides)}'>
      <a class="slide-stage" href="${slides[0]}" target="_blank" rel="noopener noreferrer" aria-label="Open full-size slide">
        <img src="${slides[0]}" alt="${title} presentation, slide 1 of ${slides.length}" width="1920" height="1080" loading="lazy">
      </a>
      <div class="slide-controls">
        <button type="button" class="slide-nav" data-step="-1" aria-label="Previous slide">Prev</button>
        <span class="slide-counter" aria-live="polite">1 / ${slides.length}</span>
        <button type="button" class="slide-nav" data-step="1" aria-label="Next slide">Next</button>
        ${pdf ? `<a class="detail-action slide-download" href="${pdf}" target="_blank" rel="noopener noreferrer">Download PDF</a>` : ''}
      </div>
    </div>
  `;
}

function initSlideViewer(root) {
  const viewer = root.querySelector('.slide-viewer');
  if (!viewer) return;

  const slides = JSON.parse(viewer.dataset.slides);
  const stage = viewer.querySelector('.slide-stage');
  const image = stage.querySelector('img');
  const counter = viewer.querySelector('.slide-counter');
  const altPrefix = image.alt.replace(/slide \d+ of \d+$/, '');
  let current = 0;

  const show = index => {
    current = (index + slides.length) % slides.length;
    image.src = slides[current];
    image.alt = `${altPrefix}slide ${current + 1} of ${slides.length}`;
    stage.href = slides[current];
    counter.textContent = `${current + 1} / ${slides.length}`;
    new Image().src = slides[(current + 1) % slides.length];
  };

  viewer.querySelectorAll('.slide-nav').forEach(button => {
    button.addEventListener('click', () => show(current + Number(button.dataset.step)));
  });
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
}

function renderPhaseHeading(number, label) {
  return `
    <div class="phase-marker">
      <strong>${number}</strong>
      <span>Phase ${number}<br>${label}</span>
    </div>
  `;
}

// Load skills from API
async function loadSkills() {
  try {
    const response = await fetch('/api/skills');
    if (!response.ok) {
      throw new Error(`Skills request failed with status ${response.status}`);
    }
    const { core, categories } = await response.json();

    document.getElementById('skillsContainer').innerHTML = `
      <p class="skills-divider"><span>Core Expertise</span></p>
      <div class="core-grid">
        ${core.map(item => `
          <article class="core-card">
            <div class="core-head">
              <span class="core-icon">${renderSkillIcon(item.icon)}</span>
              <div>
                <p class="core-area">${item.area}</p>
                <h3>${item.title}</h3>
              </div>
            </div>
            <p>${item.description}</p>
            <div class="core-tags">${item.tags.map(tag => `<span>${tag}</span>`).join('')}</div>
          </article>
        `).join('')}
      </div>
      <p class="skills-divider"><span>Supporting Technologies</span></p>
      <div class="tech-grid">
        ${categories.map(category => `
          <article class="tech-card">
            <h3><span class="tech-card-icon">${SKILL_GLYPHS[category.icon]}</span>${category.title}</h3>
            <ul>
              ${category.items.map(item => `
                <li><span class="tech-logo">${renderSkillIcon(item.icon)}</span>${item.name}</li>
              `).join('')}
            </ul>
          </article>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error loading skills:', error);
  }
}

// Brand logos are stored in /images/skills; everything else uses a line glyph
const SKILL_LOGOS = new Set([
  'microsoftsqlserver', 'postgresql', 'mysql', 'mongodb', 'clickhouse', 'duckdb', 'python', 'pandas', 'apachespark', 'jupyter',
  'powerbi', 'microsoftexcel', 'looker', 'metabase', 'scikitlearn', 'azure', 'git'
]);

const glyph = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const SKILL_GLYPHS = {
  database: glyph('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'),
  layers: glyph('<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>'),
  braces: glyph('<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>'),
  chart: glyph('<path d="M3 3v18h18"/><path d="M8 17v-5"/><path d="M13 17V8"/><path d="M18 17v-9"/>'),
  spark: glyph('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  cloud: glyph('<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.3 12 4 4 0 0 0 6 19z"/>'),
  warehouse: glyph('<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-8h10v8"/><path d="M7 17h10"/>'),
  etl: glyph('<rect x="2" y="4" width="6" height="6" rx="1"/><rect x="16" y="14" width="6" height="6" rx="1"/><path d="M8 7h5a2 2 0 0 1 2 2v8h1"/><path d="m14 15 2 2-2 2"/>'),
  cube: glyph('<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5"/><path d="M12 12v10"/>'),
  code: glyph('<path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/>'),
  formula: glyph('<path d="M18 4H6l6 8-6 8h12"/>'),
  tree: glyph('<circle cx="12" cy="4" r="2"/><circle cx="6" cy="13" r="2"/><circle cx="18" cy="13" r="2"/><circle cx="3" cy="21" r="1.5"/><circle cx="9" cy="21" r="1.5"/><path d="m11 6-4 5.5M13 6l4 5.5M5 15l-1.5 4.5M7 15l1.5 4.5"/>'),
  scatter: glyph('<circle cx="6" cy="7" r="1.6"/><circle cx="9" cy="10" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="16" cy="15" r="1.6"/><circle cx="19" cy="18" r="1.6"/><circle cx="15" cy="19" r="1.6"/>'),
  check: glyph('<path d="M3 3v18h18"/><path d="m7 13 3 3 7-8"/>')
};

function renderSkillIcon(name) {
  return SKILL_LOGOS.has(name)
    ? `<img src="/images/skills/${name}.svg" alt="" width="28" height="28" loading="lazy">`
    : SKILL_GLYPHS[name];
}

// Contact form handling: the site has no mail backend, so the form opens the visitor's
// email app with the message filled in
const CONTACT_EMAIL = 'huynhtrananhthu.tk1@gmail.com';

function setupFormHandling() {
  const form = document.getElementById('contactForm');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const message = document.getElementById('message').value;

      const subject = `Portfolio contact from ${name}`;
      const body = `${message}\n\n${name}\n${email}`;
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }
}

// Mobile menu toggle
function setupMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');

  if (!hamburger || !navLinks) {
    return;
  }

  const closeMenu = () => {
    navLinks.classList.remove('is-open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Open navigation');
  };

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', String(!isOpen));
    hamburger.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
    navLinks.classList.toggle('is-open', !isOpen);
  });

  const links = navLinks.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      hamburger.focus();
    }
  });
}

// Light / dark theme toggle
function setupThemeToggle() {
  const toggle = document.querySelector('.theme-toggle');
  const themeColor = document.querySelector('meta[name="theme-color"]');

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    themeColor?.setAttribute('content', theme === 'light' ? '#f4faf7' : '#08110e');
    toggle?.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  };

  applyTheme(document.documentElement.dataset.theme || 'dark');

  toggle?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch (error) {
      // Storage unavailable; the theme still applies for this page view.
    }
  });
}
