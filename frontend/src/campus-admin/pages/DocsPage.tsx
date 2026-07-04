import { useState, type CSSProperties, useEffect } from 'react'
import { BookOpen, ChevronRight } from 'lucide-react'
import { T } from '../theme'
import { useDocsStore } from '../docsStore'
import { DOCS_MENU } from '../docs/docsMenu'
import { DOCS_CONTENT } from '../docs/docsContent'

export default function DocsPage() {
  const { activeTab } = useDocsStore()
  
  // Get first item of the active tab to set as default
  const defaultDocId = DOCS_MENU[activeTab][0]?.items[0]?.id || ''
  const [activeDoc, setActiveDoc] = useState(defaultDocId)

  // When tab changes, reset active doc to the first item of the new tab
  useEffect(() => {
    setActiveDoc(DOCS_MENU[activeTab][0]?.items[0]?.id || '')
  }, [activeTab])

  // Flatten the menu for easy lookup
  const currentMenuGroups = DOCS_MENU[activeTab]
  const flatMenu = currentMenuGroups.flatMap(group => group.items)
  
  const isValidDoc = flatMenu.some(item => item.id === activeDoc)
  const currentDocId = isValidDoc ? activeDoc : flatMenu[0]?.id
  const currentDocItem = flatMenu.find(item => item.id === currentDocId)

  return (
    <div style={s.page}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.sideHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={18} color={T.accent} />
            <span style={{ fontWeight: 700, fontSize: 14, color: T.textWhite, textTransform: 'capitalize' }}>
              {activeTab} Docs
            </span>
          </div>
        </div>

        <div style={s.catSection}>
          {currentMenuGroups.map((group, groupIdx) => (
            <div key={groupIdx} style={{ marginBottom: 24 }}>
              <div style={s.catTitle}>{group.groupLabel}</div>
              {group.items.map(item => {
                const Icon = item.icon
                const active = currentDocId === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveDoc(item.id)}
                    style={{ ...s.catBtn, ...(active ? s.catBtnActive : {}) }}
                  >
                    <Icon size={14} color={active ? T.accent : T.textMuted} />
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: active ? T.accent : T.textSecondary, fontWeight: active ? 600 : 400 }}>
                      {item.label}
                    </span>
                    {active && <ChevronRight size={14} color={T.accent} />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main style={s.main}>
        <div style={s.contentHeader}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.textWhite, margin: 0 }}>
            {currentDocItem?.label}
          </h1>
          <p style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} / {currentDocItem?.label}
          </p>
        </div>

        <div style={s.contentBody}>
          {/* Render content from DOCS_CONTENT if it exists, otherwise show placeholder */}
          {(DOCS_CONTENT[activeTab] as any)?.[currentDocId] ? (
            <div style={s.articleWrapper}>
              {(DOCS_CONTENT[activeTab] as any)[currentDocId]}
            </div>
          ) : (
            <div style={s.placeholderCard}>
              <BookOpen size={48} color={T.border} style={{ marginBottom: 16 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textSecondary, marginBottom: 8 }}>
                Content Pending
              </h3>
              <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>
                This section is reserved for the {currentDocItem?.label} documentation. The technical architecture and workflows will be documented here.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const s: Record<string, CSSProperties> = {
  page: { display: 'flex', height: 'calc(100vh - 44px)', background: T.bg, overflow: 'hidden' },

  sidebar: {
    width: 260, background: T.bgPanel, borderRight: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
  },
  sideHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 16px 16px', borderBottom: `1px solid ${T.border}`,
  },
  catSection: { padding: '16px 10px', flex: 1 },
  catTitle: {
    fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 12, paddingLeft: 6
  },
  catBtn: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '10px 12px', border: 'none', borderRadius: 8, cursor: 'pointer',
    background: 'transparent', transition: 'all 0.15s', marginBottom: 4,
  },
  catBtnActive: { background: T.accentBg },

  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' },
  contentHeader: {
    padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
    background: T.bgPanel, flexShrink: 0,
  },
  contentBody: {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflowY: 'auto', padding: '24px 32px'
  },
  articleWrapper: {
    maxWidth: 800,
    color: T.textSecondary,
    fontSize: 15,
    lineHeight: 1.6,
  },
  placeholderCard: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: T.bgCard, border: `1px dashed ${T.borderLight}`, borderRadius: 12,
  }
}
