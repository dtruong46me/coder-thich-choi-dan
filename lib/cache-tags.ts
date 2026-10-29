// One place for every cache tag, so publish and the pages agree on the names.
export const TAGS = {
  posts: 'posts',
  post: (id: string) => `post:${id}`,
  projects: 'projects',
  collections: 'collections',
  settings: 'settings',
} as const
