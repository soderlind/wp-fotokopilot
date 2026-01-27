import { useAppStore } from '../stores/appStore'

export default function MediaGrid({ items, selectable = false, showProposed = false }) {
  const selectedItems = useAppStore((state) => state.selectedItems)
  const toggleSelectItem = useAppStore((state) => state.toggleSelectItem)
  const updateMediaItem = useAppStore((state) => state.updateMediaItem)

  const handleAltChange = (id, value) => {
    updateMediaItem(id, { proposedAlt: value })
  }

  return (
    <div className="media-grid">
      {items.map((item) => {
        const isSelected = selectedItems.includes(item.id)
        
        const handleCardClick = (e) => {
          // Don't toggle if clicking on textarea or checkbox
          if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
            return
          }
          if (selectable) {
            toggleSelectItem(item.id)
          }
        }

        return (
          <div
            key={item.id}
            className="media-card"
            onClick={handleCardClick}
            style={{
              borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
              borderWidth: isSelected ? '2px' : '1px',
              cursor: selectable ? 'pointer' : 'default',
            }}
          >
            {selectable && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelectItem(item.id)}
                />
              </div>
            )}
            <img
              className="media-thumbnail"
              src={item.thumbnailUrl || item.sourceUrl}
              alt={item.currentAlt || ''}
              loading="lazy"
            />
            <div className="media-info">
              <div className="media-filename" title={item.filename}>
                {item.filename || item.title}
              </div>
              <div className="media-alt">
                {item.currentAlt ? (
                  <span title={item.currentAlt}>
                    Alt: {item.currentAlt.slice(0, 50)}
                    {item.currentAlt.length > 50 && '...'}
                  </span>
                ) : (
                  <span style={{ color: 'var(--warning)' }}>No alt text</span>
                )}
              </div>
              {showProposed && (
                <div style={{ marginTop: '8px' }}>
                  <textarea
                    className="form-input"
                    style={{ fontSize: '12px', minHeight: '60px' }}
                    placeholder="Proposed alt text..."
                    value={item.proposedAlt || ''}
                    onChange={(e) => handleAltChange(item.id, e.target.value)}
                  />
                  {item.status && (
                    <span className={`status-badge status-${item.status}`}>
                      {item.status}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
