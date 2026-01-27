import { vi } from 'vitest'

export function createMockCopilotClient(options = {}) {
  const defaultResponse = {
    alt_text: 'A golden retriever playing in a sunny park',
  }

  const mockSession = {
    sendAndWait: vi.fn().mockResolvedValue({
      messages: [
        {
          role: 'assistant',
          content: JSON.stringify(options.response || defaultResponse),
        },
      ],
    }),
    close: vi.fn().mockResolvedValue(undefined),
  }

  const mockClient = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue(mockSession),
  }

  return {
    client: mockClient,
    session: mockSession,
    setResponse: (response) => {
      mockSession.sendAndWait.mockResolvedValue({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify(response),
          },
        ],
      })
    },
    setError: (error) => {
      mockSession.sendAndWait.mockRejectedValue(new Error(error))
    },
  }
}

export function createMockCopilotModule() {
  const mock = createMockCopilotClient()

  return {
    CopilotClient: vi.fn().mockImplementation(() => mock.client),
    __mock: mock,
  }
}

export const mockAltTextResponses = {
  dog: { alt_text: 'A golden retriever playing in a sunny park' },
  product: { alt_text: 'Red leather handbag with gold clasp on white background' },
  landscape: { alt_text: 'Sunset over Norwegian fjord with snow-capped mountains' },
  decorative: { alt_text: '' },
  withFolder: {
    alt_text: 'Blue running shoes on white background',
    folder_path: 'Products/Footwear',
  },
  tooLong:
    { alt_text: 'A'.repeat(200) },
  badPrefix: { alt_text: 'Image of a dog playing in the park' },
  withFilename: { alt_text: 'Photo showing IMG_1234.jpg of sunset' },
  withAiMention: { alt_text: 'AI-generated description of a sunset' },
}
