// STANDARDS button on the Internal Non Conformance report: shows which official standards govern each INC parameter
// Source: QA-REF-002 Regulatory Compliance & Standards Mapping (2026-11-06)
(() => {
  const STANDARDS = [
    {
      group: 'Food Safety & Processing',
      items: [
        {
          name: 'SLS 1161 (Sri Lanka Standard for Poultry Meat)',
          issuer: 'Sri Lanka Standards Institution (SLSI)',
          summary: 'National standard for poultry meat. Requires strict core temperature control to prevent microbial spoilage, mandatory use of potable water, and hygiene limits during slaughter.',
          governs: ['Gizzard Temp (<4 C)', 'Liver Temp (<4 C)', 'Water Supply Slaughter']
        },
        {
          name: 'Codex Alimentarius (CAC/RCP 58-2005, Code of Hygienic Practice for Meat)',
          issuer: 'FAO / WHO',
          summary: 'Global food standard. Requires zero fecal contamination during evisceration and complete removal of the digestive tract and viscera to prevent cross-contamination.',
          governs: ['Continuous Vent Cutting', 'Ensure Cavity Removal', 'Washing Points EV']
        },
        {
          name: 'ISO 22000 & HACCP',
          issuer: 'International Organization for Standardization / Codex HACCP',
          summary: 'Food safety management system. Chilling is a Critical Control Point to stop Salmonella and Campylobacter. Scalding temperature and chemical sanitizers (chlorine) are validated Prerequisite Programs.',
          governs: ['Chilling Temperatures', 'Scalder Tank Temp (56-59 C)', 'Chlorine 7AM / 1PM (30 ppm)']
        }
      ]
    },
    {
      group: 'Environmental & Wastewater (ETP)',
      items: [
        {
          name: 'National Environmental Act (Environmental Protection Licence)',
          issuer: 'Central Environmental Authority (CEA), Sri Lanka',
          summary: 'Legal limits for treated industrial wastewater discharged to the environment. pH must be 6.5 to 8.5, residual chlorine below 0.1 ppm, and the water must be visually acceptable with no objectionable odour.',
          governs: ['pH Level (6.8-8.5)', 'Chlorine (<0.1)', 'Colour', 'Smell']
        },
        {
          name: 'ISO 14001 (Environmental Management System)',
          issuer: 'International Organization for Standardization',
          summary: 'Environmental management. Planned maintenance and waste control: prevent leaks, manage solid waste, and backwash filtration systems on schedule.',
          governs: ['Leakage M1 / M2', 'Solid Waste Bucket (<=8)', 'Parabolic Screen Cleanness', 'Backwash Sand Bed / Clarifier']
        }
      ]
    },
    {
      group: 'Good Manufacturing Practice (GMP) & Operations',
      items: [
        {
          name: 'BRCGS & GMP',
          issuer: 'Brand Reputation Compliance Global Standards',
          summary: 'Operational standards requiring continuous monitoring of production lines. Missing authorised people at critical control points is a failure of Prerequisite Programs.',
          governs: ['Labour Position Gap Slaughter', 'Labour Position Gap EV']
        }
      ]
    }
  ];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function closeStandards() {
    const overlay = document.getElementById('incStandardsOverlay');
    if (overlay) overlay.remove();
  }

  function listHtml() {
    return STANDARDS.map(section => `
      <div style="margin:0 0 14px">
        <div style="font-weight:800;color:#1e3a8a;text-transform:uppercase;letter-spacing:.4px;font-size:.78rem;margin:6px 0 8px">${esc(section.group)}</div>
        ${section.items.map(item => `
          <div style="border:1px solid #dbeafe;border-radius:10px;padding:10px 12px;margin:0 0 10px;background:#f8fbff">
            <div style="font-weight:800;color:#0f172a">${esc(item.name)}</div>
            <div style="color:#64748b;font-size:.82rem;margin:2px 0 6px">${esc(item.issuer)}</div>
            <div style="color:#334155;line-height:1.45">${esc(item.summary)}</div>
            <div style="margin-top:8px;font-size:.82rem"><b style="color:#334155">Governs:</b> <span style="color:#0f172a">${item.governs.map(esc).join(', ')}</span></div>
          </div>`).join('')}
      </div>`).join('');
  }

  function openStandards() {
    closeStandards();
    const overlay = document.createElement('div');
    overlay.id = 'incStandardsOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:10000;padding:16px';
    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-label="Standards" style="width:min(640px,100%);max-height:86vh;display:flex;flex-direction:column;background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(15,23,42,.35);overflow:hidden;font:500 .9rem Calibri,Carlito,sans-serif">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#dbeafe;color:#1e3a8a;padding:14px 18px;font-weight:800">
          <span>Standards &amp; Regulatory Compliance</span>
          <button type="button" id="incStandardsClose" aria-label="Close" title="Close" style="width:26px;height:26px;border:0;border-radius:50%;background:#ef4444;color:#fff;font:700 1.1rem Calibri,Carlito,sans-serif;line-height:1;cursor:pointer;flex:0 0 auto;box-shadow:0 2px 6px rgba(239,68,68,.35)">&times;</button>
        </div>
        <div style="padding:14px 18px 18px;overflow:auto">
          <div style="color:#475569;font-size:.82rem;margin:0 0 12px">Official frameworks that govern the INC control limits used in this report (QA-REF-002).</div>
          ${listHtml()}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('incStandardsClose').addEventListener('click', closeStandards);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeStandards(); });
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#incStandardBtn')) openStandards();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeStandards(); });
})();
