import { useState } from 'react'
import { useAppStore } from './stores/appStore'
import ConnectTab from './components/ConnectTab'
import MediaTab from './components/MediaTab'
import FoldersTab from './components/FoldersTab'
import SettingsTab from './components/SettingsTab'

const TABS = [
  { id: 'sites', label: 'Sites', icon: '🔗' },
  { id: 'media', label: 'Alt Text', icon: '📷' },
  { id: 'folders', label: 'Folders', icon: '📁' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('sites')
  const isConnected = useAppStore((state) => !!state.activeSiteId)

  const renderTab = () => {
    switch (activeTab) {
      case 'sites':
        return <ConnectTab />
      case 'media':
        return <MediaTab />
      case 'folders':
        return <FoldersTab />
      case 'settings':
        return <SettingsTab />
      default:
        return <ConnectTab />
    }
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          <span className="logo-icon">📷</span>
          <span className="logo-text">FotoKopilot</span>
        </div>
        <ul className="nav-list">
          {TABS.map((tab) => (
            <li key={tab.id}>
              <button
                className={`nav-item ${activeTab === tab.id ? 'active' : ''} ${
                  (tab.id === 'media' || tab.id === 'folders') && !isConnected ? 'disabled' : ''
                }`}
                onClick={() => setActiveTab(tab.id)}
                disabled={(tab.id === 'media' || tab.id === 'folders') && !isConnected}
              >
                <span className="nav-icon">{tab.icon}</span>
                <span className="nav-label">{tab.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="content">{renderTab()}</main>
    </div>
  )
}
