import { safeStorage } from 'electron'
import Store from 'electron-store'

const store = new Store({ name: 'wp-fotokopilot-credentials' })

export async function saveCredentials(siteId, { url, username, password, ...metadata }) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage not available on this system')
  }

  const encrypted = safeStorage.encryptString(
    JSON.stringify({ url, username, password })
  )

  const sites = store.get('sites', {})
  sites[siteId] = {
    id: siteId,
    credentials: encrypted.toString('base64'),
    ...metadata,
  }
  store.set('sites', sites)

  return { id: siteId, url, ...metadata }
}

export async function getCredentials(siteId) {
  const sites = store.get('sites', {})
  const site = sites[siteId]
  if (!site) return undefined

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage not available')
  }

  const decrypted = safeStorage.decryptString(
    Buffer.from(site.credentials, 'base64')
  )
  const { url, username, password } = JSON.parse(decrypted)

  return {
    id: siteId,
    url,
    username,
    password,
    name: site.name,
    capabilities: site.capabilities,
  }
}

export async function deleteCredentials(siteId) {
  const sites = store.get('sites', {})
  delete sites[siteId]
  store.set('sites', sites)
}

export async function listSites() {
  const sites = store.get('sites', {})
  return Object.values(sites).map(({ id, name, url, capabilities }) => ({
    id,
    name,
    url,
    capabilities,
  }))
}
