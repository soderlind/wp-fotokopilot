import { useState } from 'react'
import { useAppStore } from './stores/appStore'
import ConnectTab from './components/ConnectTab'
import ScanTab from './components/ScanTab'
import ReviewTab from './components/ReviewTab'
import FoldersTab from './components/FoldersTab'
import SettingsTab from './components/SettingsTab'

const TABS = [
  { id: 'connect', label: 'Connect', icon: '🔗' },
  { id: 'scan', label: 'Scan', icon: '🔍' },
  { id: 'review', label: 'Review & Apply', icon: '✏️' },
  { id: 'folders', label: 'Folders', icon: '📁' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('connect')
  const isConnected = useAppStore((state) => !!state.activeSiteId)

  const renderTab = () => {
    switch (activeTab) {
      case 'connect':
        return <ConnectTab />
      case 'scan':
        return <ScanTab />
      case 'review':
        return <ReviewTab />
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
                  tab.id !== 'connect' && tab.id !== 'settings' && !isConnected
                    ? 'disabled'
                    : ''
                }`}
                onClick={() => setActiveTab(tab.id)}
                disabled={
                  tab.id !== 'connect' && tab.id !== 'settings' && !isConnected
                }
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
