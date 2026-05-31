// helpers/financial.helpers.ts
// Convenience re-export barrel — each name sourced from the correct helper file.

export { injectFHCSS, compact, clamp }                          from './hub.helpers';
export { sMeta as hubSMeta, initials, fmtD as hubFmtD,
         fmtDT, exportCSV as hubExportCSV }                     from './hub.helpers';
export { sMeta as recSMeta, fmtD as recFmtD,
         initials as recInitials, exportCSV as recExportCSV,
         avatarColor, money }                                    from './records.helpers';
export { injectFSCSS, pct, fmtShort,
         fmtD as rptFmtD, ngn, num, abs }                       from './reports.helpers';
export { injectObservatoryCSS, fmt, fmtK }                      from './dashboard.helpers';