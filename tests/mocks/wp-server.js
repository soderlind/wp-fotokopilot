import { http, HttpResponse } from 'msw'

export const wpHandlers = [
  http.get('*/wp-json/', () => {
    return HttpResponse.json({
      name: 'Test WordPress Site',
      description: 'A test site for FotoKopilot',
      url: 'https://test.local',
      language: 'nb_NO',
      namespaces: ['wp/v2', 'vmfo/v1'],
    })
  }),

  http.get('*/wp-json/wp/v2/media', ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const perPage = parseInt(url.searchParams.get('per_page') || '10')

    const totalItems = 25
    const totalPages = Math.ceil(totalItems / perPage)
    const startIndex = (page - 1) * perPage

    const items = Array.from({ length: Math.min(perPage, totalItems - startIndex) }, (_, i) => {
      const id = startIndex + i + 1
      return {
        id,
        slug: `test-image-${id}`,
        title: { rendered: `Test Image ${id}` },
        alt_text: id % 3 === 0 ? '' : `Alt text for image ${id}`,
        source_url: `https://test.local/wp-content/uploads/image-${id}.jpg`,
        mime_type: 'image/jpeg',
        media_details: {
          sizes: {
            thumbnail: {
              source_url: `https://test.local/wp-content/uploads/image-${id}-150x150.jpg`,
            },
            medium: {
              source_url: `https://test.local/wp-content/uploads/image-${id}-300x200.jpg`,
            },
          },
        },
      }
    })

    return HttpResponse.json(items, {
      headers: {
        'X-WP-Total': String(totalItems),
        'X-WP-TotalPages': String(totalPages),
      },
    })
  }),

  http.post('*/wp-json/wp/v2/media/:id', async ({ params, request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: parseInt(params.id),
      alt_text: body.alt_text,
      title: { rendered: `Test Image ${params.id}` },
    })
  }),

  http.get('*/wp-json/wp/v2/media/:id', ({ params }) => {
    const id = parseInt(params.id)
    return HttpResponse.json({
      id,
      slug: `test-image-${id}`,
      title: { rendered: `Test Image ${id}` },
      alt_text: `Alt text for image ${id}`,
      source_url: `https://test.local/wp-content/uploads/image-${id}.jpg`,
    })
  }),
]

export const vmfHandlers = [
  http.get('*/wp-json/vmfo/v1/folders', () => {
    return HttpResponse.json([
      { id: 1, name: 'Products', parent: 0, count: 10 },
      { id: 2, name: 'People', parent: 0, count: 5 },
      { id: 3, name: 'Electronics', parent: 1, count: 3 },
      { id: 4, name: 'Clothing', parent: 1, count: 7 },
      { id: 5, name: 'Team', parent: 2, count: 5 },
    ])
  }),

  http.post('*/wp-json/vmfo/v1/folders', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: Math.floor(Math.random() * 1000) + 100,
      name: body.name,
      parent: body.parent || 0,
      count: 0,
    })
  }),

  http.post('*/wp-json/vmfo/v1/folders/:id/media', async ({ params, request }) => {
    const body = await request.json()
    return HttpResponse.json({
      folder_id: parseInt(params.id),
      media_ids: body.media_ids,
      success: true,
    })
  }),

  http.delete('*/wp-json/vmfo/v1/folders/:id/media', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('*/wp-json/vmfo/v1/folders/counts', () => {
    return HttpResponse.json({
      1: 10,
      2: 5,
      3: 3,
      4: 7,
      5: 5,
    })
  }),
]

export const errorHandlers = {
  unauthorized: http.get('*/wp-json/', () => {
    return new HttpResponse(null, { status: 401 })
  }),

  forbidden: http.get('*/wp-json/', () => {
    return new HttpResponse(null, { status: 403 })
  }),

  rateLimited: http.get('*/wp-json/wp/v2/media', () => {
    return new HttpResponse(null, {
      status: 429,
      headers: { 'Retry-After': '60' },
    })
  }),

  serverError: http.get('*/wp-json/wp/v2/media', () => {
    return new HttpResponse(null, { status: 500 })
  }),
}
