import { Button, Text } from '@react-email/components'
import { Layout, styles } from './Layout'

export default function ConfirmSubscription({ url, topics }: { url: string; topics: string[] }) {
  return (
    <Layout preview="Confirm your subscription">
      <Text style={styles.h1}>One click to confirm</Text>
      <Text style={styles.p}>
        You asked to get new posts by email{topics.length ? ` about ${topics.join(', ')}` : ''}. Confirm below and
        you&apos;re in. The link works for 48 hours.
      </Text>
      <Button href={url} style={styles.button}>
        Confirm subscription
      </Button>
      <Text style={{ ...styles.muted, marginTop: '20px' }}>
        Didn&apos;t ask for this? Ignore this email and nothing happens.
      </Text>
    </Layout>
  )
}
