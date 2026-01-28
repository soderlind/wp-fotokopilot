/**
 * @fileoverview Secure credential storage using Electron's safeStorage API.
 * Stores WordPress site credentials encrypted in the OS keychain.
 * @module main/services/credential-store
 */

import { safeStorage } from 'electron'
import Store from 'electron-store'

const store = new Store({ name: 'wp-fotokopilot-credentials' })

/**
 * @typedef {Object} SiteCredentials
 * @property {string} id - Unique site identifier
 * @property {string} url - WordPress site URL
 * @property {string} username - WordPress username
 * @property {string} password - Application password
 * @property {string} [name] - Site display name
 * @property {Object} [capabilities] - Site capabilities (REST API, VMF support)
 */

/**
 * Saves site credentials securely using OS keychain encryption.
 * @param {string} siteId - Unique site identifier
 * @param {Object} credentials - Site credentials and metadata
 * @param {string} credentials.url - WordPress site URL
 * @param {string} credentials.username - WordPress username
 * @param {string} credentials.password - Application password
 * @returns {Promise<{id: string, url: string}>} Saved site info (without password)
 * @throws {Error} If secure storage is not available
 */
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

/**
 * Retrieves decrypted credentials for a site.
 * @param {string} siteId - Unique site identifier
 * @returns {Promise<SiteCredentials|undefined>} Decrypted credentials or undefined if not found
 * @throws {Error} If secure storage is not available
 */
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

/**
 * Deletes stored credentials for a site.
 * @param {string} siteId - Unique site identifier
 * @returns {Promise<void>}
 */
export async function deleteCredentials(siteId) {
  const sites = store.get('sites', {})
  delete sites[siteId]
  store.set('sites', sites)
}

/**
 * Lists all stored sites (without credentials).
 * @returns {Promise<Array<{id: string, name: string, url: string, capabilities: Object}>>}
 */
export async function listSites() {
  const sites = store.get('sites', {})
  return Object.values(sites).map(({ id, name, url, capabilities }) => ({
    id,
    name,
    url,
    capabilities,
  }))
}
