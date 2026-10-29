import { Button, Link, Text } from '@react-email/components'
import { Layout, styles } from './Layout'

export type NewPostProps = { title: string; excerpt: string; url: string; collection: string; unsubscribeUrl: string }

export default function NewPost({ title, excerpt, url, collection, unsubscribeUrl }: NewPostProps) {
  return (
    <Layout
      preview={excerpt || title}
      footer={
        <Text style={styles.muted}>
          You get this because you subscribed to {collection} posts.{' '}
          <Link href={unsubscribeUrl} style={styles.link}>
            Unsubscribe
          </Link>
          .
        </Text>
      }
    >
      <Text style={{ ...styles.muted, color: '#2f5d46', fontWeight: 600 }}>{collection}</Text>
      <Text style={styles.h1}>{title}</Text>
      {excerpt ? <Text style={styles.p}>{excerpt}</Text> : null}
      <Button href={url} style={styles.button}>
        Read the post
      </Button>
    </Layout>
  )
}
