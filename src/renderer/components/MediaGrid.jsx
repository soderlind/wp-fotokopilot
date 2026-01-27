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
      {items.map((item) => (
        <div
          key={item.id}
          className="media-card"
          style={{
            borderColor: selectedItems.includes(item.id)
              ? 'var(--accent)'
              : 'var(--border)',
            borderWidth: selectedItems.includes(item.id) ? '2px' : '1px',
          }}
        >
          {selectable && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                className="checkbox"
                checked={selectedItems.includes(item.id)}
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
      ))}
    </div>
  )
}
