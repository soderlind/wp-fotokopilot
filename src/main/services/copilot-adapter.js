import { CopilotClient } from '@github/copilot-sdk'
import { validateAltText } from '../utils/validation.js'

let client

// Configuration for connecting to CLI server
let cliServerUrl = null

// Session-suggested folders to track newly suggested folders during a session
// This prevents the AI from suggesting duplicate new folders
let sessionSuggestedFolders = new Set()

const ALT_TEXT_SYSTEM_PROMPT = `You are an accessibility expert generating alt text for web images.

RULES:
- Output ONLY valid JSON: {"alt_text":"..."}
- Maximum length will be specified in the user message
- Describe the visual content concisely for screen reader users
- Focus on: subject, action, context, important details
- Do NOT start with "Image of", "Picture of", "Photo of", "A photo", "An image"
- Do NOT guess or transcribe text unless it is clearly legible
- Do NOT include file names, SEO keywords, or hashtags
- Do NOT mention AI, Copilot, or that this was auto-generated
- If the image is purely decorative or cannot be described, return {"alt_text":""}

EXAMPLES:
- Person photo: {"alt_text":"Smiling woman in business attire presenting at a conference podium"}
- Product: {"alt_text":"Red leather handbag with gold clasp on white background"}
- Landscape: {"alt_text":"Sunset over Norwegian fjord with snow-capped mountains"}
- Abstract/decorative: {"alt_text":""}
- Chart: {"alt_text":"Bar chart showing quarterly sales growth from Q1 to Q4 2025"}`

/**
 * Generate the folder organization system prompt with language support
 * Based on vmfa-ai-organizer AbstractProvider.php patterns
 */
function getFolderSystemPrompt(languageName = 'English') {
  return `You are an image analysis and categorization expert with vision capabilities.
You will analyze images and their metadata to suggest the best organization folder.

LANGUAGE REQUIREMENT:
- Respond in ${languageName}. All text including folder names and explanations must be in ${languageName}.

ANALYSIS APPROACH:
1. Examine the image content carefully
2. Review any provided metadata (filename, title, existing description)
3. Consider the available folder structure
4. Make a categorization decision

FOLDER CONSISTENCY RULES:
1. AVOID SYNONYMS: Check if a semantically equivalent folder exists
   - Don't suggest "Photographs" if "Photos" exists
   - Don't suggest "Images" if "Pictures" exists
   - Don't suggest "Portraits" if "People" exists
2. CHECK FOR SUBSETS: Determine if image fits existing subcategory
   - Use "Nature/Mountains" rather than creating just "Mountains"
   - Use "People/Team" rather than creating separate "Team Photos"
3. PREVENT DUPLICATES: Never suggest a folder that already exists

STANDARD CATEGORY EXAMPLES (adapt to ${languageName}):
- Products, Services, Portfolio
- People, Team, Profiles  
- Events, News, Blog
- Locations, Office, Facilities
- Marketing, Branding, Logos
- Screenshots, Technical, Documentation
- Backgrounds, Decorative, Icons

OUTPUT FORMAT:
You must respond with ONLY a valid JSON object:
{
  "visual_description": "Brief description of what the image shows",
  "action": "existing|new|skip",
  "folder_id": 123,
  "folder_path": "Category/Subcategory",
  "new_folder_path": "Category/NewSubcategory",
  "confidence": 0.95,
  "reason": "Brief explanation of the decision"
}

FIELD DEFINITIONS:
- visual_description: What you see in the image (2-3 sentences max)
- action: "existing" to use existing folder, "new" to create new folder, "skip" if uncategorizable
- folder_id: ID of existing folder (only when action="existing")
- folder_path: Full path of existing folder (only when action="existing")
- new_folder_path: Full path for new folder (only when action="new")
- confidence: 0.0 to 1.0 confidence score
- reason: Brief explanation of why this folder was chosen`
}

/**
 * Build the user prompt with metadata and available folders
 * Based on vmfa-ai-organizer AbstractProvider.php patterns
 */
function buildFolderUserPrompt(metadata, existingFolders, sessionSuggested) {
  let prompt = 'Analyze this image and suggest the appropriate folder.\n\n'

  // Add image metadata if available
  if (metadata.filename || metadata.title || metadata.alt || metadata.caption) {
    prompt += 'IMAGE METADATA:\n'
    if (metadata.filename) prompt += `- Filename: ${metadata.filename}\n`
    if (metadata.title) prompt += `- Title: ${metadata.title}\n`
    if (metadata.alt) prompt += `- Alt text: ${metadata.alt}\n`
    if (metadata.caption) prompt += `- Caption: ${metadata.caption}\n`
    prompt += '\n'
  }

  // Add available folders
  if (existingFolders.length > 0) {
    prompt += 'AVAILABLE FOLDERS:\n'
    existingFolders.forEach((folder) => {
      prompt += `- ID ${folder.id}: ${folder.path}\n`
    })
    prompt += '\n'
  } else {
    prompt += 'AVAILABLE FOLDERS: None yet (you may suggest a new folder)\n\n'
  }

  // Add session-suggested folders to prevent duplicates
  if (sessionSuggested.size > 0) {
    prompt += 'FOLDERS SUGGESTED THIS SESSION (already being created, do not duplicate):\n'
    sessionSuggested.forEach((path) => {
      prompt += `- ${path}\n`
    })
    prompt += '\n'
  }

  prompt += 'Please analyze the image and provide your folder recommendation in JSON format.'

  return prompt
}

/**
 * Configure the Copilot client to connect to an external CLI server
 * @param {string|null} url - URL of the CLI server (e.g., "localhost:4321") or null to use default
 */
export function setCliServerUrl(url) {
  cliServerUrl = url
  // Force re-initialization with new URL
  if (client) {
    client = undefined
  }
}

/**
 * Get the current CLI server URL configuration
 * @returns {string|null}
 */
export function getCliServerUrl() {
  return cliServerUrl
}

/**
 * List available Copilot models
 * @param {Object} options
 * @param {boolean} [options.visionOnly=false] - Only return models that support vision
 * @returns {Promise<Array<{id: string, name: string, supportsVision: boolean}>>}
 */
export async function listModels(options = {}) {
  const { visionOnly = false } = options
  
  try {
    if (!client) {
      await initCopilot()
    }
    
    const models = await client.listModels()
    console.log('[Copilot] Available models:', models.map(m => `${m.id} (vision: ${m.capabilities?.supports?.vision})`))
    
    let filtered = models
    if (visionOnly) {
      filtered = models.filter(m => m.capabilities?.supports?.vision === true)
      console.log('[Copilot] Vision-capable models:', filtered.map(m => m.id))
    }
    
    return filtered.map(m => ({
      id: m.id,
      name: m.name || m.id,
      supportsVision: m.capabilities?.supports?.vision ?? false,
    }))
  } catch (err) {
    console.error('[Copilot] Failed to list models:', err.message)
    // Return default vision-capable models as fallback
    return [
      { id: 'gpt-4o', name: 'GPT-4o', supportsVision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', supportsVision: true },
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', supportsVision: true },
    ]
  }
}

export async function initCopilot() {
  if (client) return

  console.log('[Copilot] Initializing client...')
  
  const options = cliServerUrl ? { cliUrl: cliServerUrl } : {}
  client = new CopilotClient(options)
  
  if (cliServerUrl) {
    console.log(`[Copilot] Connecting to external CLI server: ${cliServerUrl}`)
  }
  
  await client.start()
  console.log('[Copilot] Client started')
}

export async function stopCopilot() {
  if (client) {
    await client.stop()
    client = undefined
  }
}

/**
 * Check if Copilot CLI is running and get status info
 * @returns {Promise<{running: boolean, version?: string, protocolVersion?: number, error?: string}>}
 */
export async function checkCopilotStatus() {
  try {
    if (!client) {
      await initCopilot()
    }
    
    const status = await client.getStatus()
    console.log('[Copilot] Status:', status)
    
    return {
      running: true,
      version: status.version,
      protocolVersion: status.protocolVersion,
    }
  } catch (err) {
    console.error('[Copilot] Status check failed:', err.message)
    return {
      running: false,
      error: err.message,
    }
  }
}

/**
 * Check if Copilot CLI is authenticated
 * @returns {Promise<{authenticated: boolean, authType?: string, login?: string, host?: string, statusMessage?: string, error?: string}>}
 */
export async function checkCopilotAuth() {
  try {
    if (!client) {
      await initCopilot()
    }
    
    const auth = await client.getAuthStatus()
    console.log('[Copilot] Auth status:', auth)
    
    return {
      authenticated: auth.isAuthenticated,
      authType: auth.authType,
      login: auth.login,
      host: auth.host,
      statusMessage: auth.statusMessage,
    }
  } catch (err) {
    console.error('[Copilot] Auth check failed:', err.message)
    return {
      authenticated: false,
      error: err.message,
    }
  }
}

export async function generateAltText(imagePath, options = {}) {
  if (!client) {
    await initCopilot()
  }

  const maxLength = options.maxLength || 125
  console.log(`[Copilot] Creating session for image: ${imagePath}`)
  
  const session = await client.createSession({
    model: options.model || 'gpt-4o',
    systemMessage: {
      content: ALT_TEXT_SYSTEM_PROMPT,
      mode: 'append',
    },
  })

  try {
    console.log('[Copilot] Sending request...')
    
    // Use event-based approach to capture the response
    let assistantContent = null
    
    session.on((event) => {
      console.log(`[Copilot] Event: ${event.type}`)
      if (event.type === 'assistant.message') {
        assistantContent = event.data?.content
        console.log('[Copilot] Got assistant message:', assistantContent?.substring(0, 100))
      }
      if (event.type === 'session.error') {
        console.error('[Copilot] Session error:', event.data?.message)
      }
    })
    
    const response = await session.sendAndWait(
      {
        prompt: `Generate alt text for this image. Maximum length: ${maxLength} characters.`,
        attachments: [{ type: 'file', path: imagePath }],
      },
      60000  // 60 second timeout
    )

    console.log('[Copilot] sendAndWait returned:', response?.type, response?.data?.content?.substring(0, 50))
    
    // Try to get content from response or from event
    const content = response?.data?.content || assistantContent
    
    if (!content) {
      console.error('[Copilot] No content received from Copilot')
      throw new Error('No response from Copilot - check that Copilot CLI is installed and authenticated')
    }

    console.log('[Copilot] Raw response:', content)
    const parsed = parseJsonResponse(content)
    const validation = validateAltText(parsed.alt_text, maxLength)

    return {
      altText: parsed.alt_text,
      valid: validation.valid,
      issues: validation.issues,
      raw: content,
    }
  } catch (err) {
    console.error('[Copilot] Error:', err.message)
    throw err
  } finally {
    await session.destroy()
  }
}

export async function generateAltTextWithFolder(
  imagePath,
  existingFolders = [],
  options = {}
) {
  if (!client) {
    await initCopilot()
  }

  const languageName = options.languageName || 'English'
  const metadata = options.metadata || {}

  const session = await client.createSession({
    model: options.model || 'gpt-4o',
    systemMessage: {
      content: getFolderSystemPrompt(languageName),
      mode: 'append',
    },
  })

  try {
    const prompt = buildFolderUserPrompt(metadata, existingFolders, sessionSuggestedFolders)

    const response = await session.sendAndWait(
      {
        prompt,
        attachments: [{ type: 'file', path: imagePath }],
      },
      30000
    )

    // sendAndWait returns AssistantMessageEvent | null
    if (!response || response.type !== 'assistant.message') {
      throw new Error('No response from Copilot')
    }

    const content = response.data?.content
    if (!content) {
      throw new Error('Empty response from Copilot')
    }

    const parsed = parseJsonResponse(content)
    
    // Track new folder suggestions to prevent duplicates within session
    if (parsed.action === 'new' && parsed.new_folder_path) {
      sessionSuggestedFolders.add(parsed.new_folder_path)
    }

    // Use visual_description as alt text if available
    const altText = parsed.alt_text || parsed.visual_description || ''
    const maxLength = options.maxLength || 125
    const validation = validateAltText(altText, maxLength)

    return {
      altText,
      visualDescription: parsed.visual_description || '',
      action: parsed.action || 'skip',
      folderId: parsed.folder_id || null,
      folderPath: parsed.folder_path || '',
      newFolderPath: parsed.new_folder_path || '',
      confidence: parsed.confidence || 0,
      reason: parsed.reason || '',
      valid: validation.valid,
      issues: validation.issues,
      raw: content,
    }
  } finally {
    await session.destroy()
  }
}

/**
 * Clear session-suggested folders (call at start of new batch/session)
 */
export function clearSessionSuggestedFolders() {
  sessionSuggestedFolders.clear()
}

/**
 * Get current session-suggested folders
 */
export function getSessionSuggestedFolders() {
  return Array.from(sessionSuggestedFolders)
}

function parseJsonResponse(text) {
  // Try to extract JSON from the response
  let jsonStr = text
  
  // Remove markdown code blocks if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  } else {
    // Try to find JSON object in text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      jsonStr = match[0]
    }
  }

  if (!jsonStr || !jsonStr.includes('{')) {
    throw new Error('No JSON found in Copilot response')
  }

  try {
    return JSON.parse(jsonStr)
  } catch (err) {
    // Try to recover from truncated JSON by adding closing braces
    let recovered = jsonStr
    const openBraces = (recovered.match(/\{/g) || []).length
    const closeBraces = (recovered.match(/\}/g) || []).length
    
    if (openBraces > closeBraces) {
      // Add missing closing braces
      recovered += '}'.repeat(openBraces - closeBraces)
      try {
        return JSON.parse(recovered)
      } catch {
        // Recovery failed
      }
    }
    
    throw new Error(`Invalid JSON in Copilot response: ${err.message}`)
  }
}
