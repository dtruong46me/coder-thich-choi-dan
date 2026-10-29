import { Button, Text } from '@react-email/components'
import { Layout, styles } from './Layout'

export default function MagicLink({ url, invited }: { url: string; invited?: string }) {
  return (
    <Layout preview="Your sign-in link">
      <Text style={styles.h1}>{invited ? 'You have something to read' : 'Sign in'}</Text>
      <Text style={styles.p}>
        {invited
          ? `Đình Trường shared “${invited}” with you. Use the button to sign in and read it.`
          : 'Use the button below to sign in. The link works once and expires in 15 minutes.'}
      </Text>
      <Button href={url} style={styles.button}>
        {invited ? 'Open it' : 'Sign in'}
      </Button>
      <Text style={{ ...styles.muted, marginTop: '20px' }}>No password needed. If this wasn&apos;t you, ignore it.</Text>
    </Layout>
  )
}
